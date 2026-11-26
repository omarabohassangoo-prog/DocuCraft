import { Redis } from 'ioredis';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Dual-mode Tenant Cache & Sliding-Window Rate Limiter:
 * Uses real Redis (ioredis) when REDIS_URL is configured, with automatic
 * in-memory fallback when running standalone without Redis.
 */
class TenantCacheStore {
  private store = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();
  private rateBuckets = new Map<string, number[]>();
  private redis: Redis | null = null;
  private redisConnected = false;

  constructor() {
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 2,
          lazyConnect: true,
          enableOfflineQueue: false,
        });
        this.redis.on('ready', () => {
          this.redisConnected = true;
        });
        this.redis.on('error', () => {
          this.redisConnected = false;
        });
        this.redis.connect().catch(() => {
          this.redisConnected = false;
        });
      } catch {
        this.redis = null;
      }
    }
  }

  public isRedisEnabled(): boolean {
    return Boolean(this.redis && this.redisConnected);
  }

  public key(tenantId: string, suffix: string): string {
    return `t:${tenantId}:${suffix}`;
  }

  public get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    if (this.redis && this.redisConnected) {
      this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch(() => {});
    }
  }

  public invalidatePrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
    if (this.redis && this.redisConnected) {
      this.redis
        .keys(`${prefix}*`)
        .then((keys) => (keys.length > 0 ? this.redis!.del(...keys) : 0))
        .catch(() => {});
    }
  }

  public async getOrSetWithLock<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T> | T
  ): Promise<T> {
    if (this.redis && this.redisConnected) {
      try {
        const raw = await this.redis.get(key);
        if (raw) return JSON.parse(raw) as T;
      } catch {
        // fall through to local/fetcher
      }
    }

    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const existing = this.inflight.get(key);
    if (existing) return (await existing) as T;

    const promise = Promise.resolve(fetcher())
      .then((val) => {
        this.set(key, val, ttlSeconds);
        this.inflight.delete(key);
        return val;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  public checkRateLimit(
    bucketKey: string,
    maxRequests: number,
    windowSeconds: number
  ): {
    allowed: boolean;
    remaining: number;
  } {
    const now = Date.now();
    const cutoff = now - windowSeconds * 1000;
    const timestamps = (this.rateBuckets.get(bucketKey) || []).filter((ts) => ts > cutoff);
    if (timestamps.length >= maxRequests) {
      this.rateBuckets.set(bucketKey, timestamps);
      return { allowed: false, remaining: 0 };
    }
    timestamps.push(now);
    this.rateBuckets.set(bucketKey, timestamps);

    if (this.redis && this.redisConnected) {
      const rKey = `rl:${bucketKey}`;
      this.redis
        .multi()
        .zremrangebyscore(rKey, 0, cutoff)
        .zadd(rKey, now, `${now}-${Math.random()}`)
        .expire(rKey, windowSeconds)
        .exec()
        .catch(() => {});
    }

    return { allowed: true, remaining: maxRequests - timestamps.length };
  }

  public stats() {
    return {
      backend: this.isRedisEnabled() ? 'redis' : 'memory',
      cachedKeys: this.store.size,
      activeRateBuckets: this.rateBuckets.size,
    };
  }
}

export const cacheStore = new TenantCacheStore();
