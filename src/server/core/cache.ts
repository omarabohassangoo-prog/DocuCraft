// Tenant-scoped in-memory cache with Stampede Lock & Sliding Window Rate Limiter

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TenantCacheStore {
  private store = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();
  private rateBuckets = new Map<string, number[]>();

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
  }

  public invalidatePrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
  }

  public async getOrSetWithLock<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T> | T
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const existing = this.inflight.get(key);
    if (existing) return (await existing) as T;

    const promise = Promise.resolve(fetcher()).then((val) => {
      this.set(key, val, ttlSeconds);
      this.inflight.delete(key);
      return val;
    }).catch((err) => {
      this.inflight.delete(key);
      throw err;
    });

    this.inflight.set(key, promise);
    return promise;
  }

  public checkRateLimit(bucketKey: string, maxRequests: number, windowSeconds: number): {
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
    return { allowed: true, remaining: maxRequests - timestamps.length };
  }

  public stats() {
    return {
      cachedKeys: this.store.size,
      activeRateBuckets: this.rateBuckets.size,
    };
  }
}

export const cacheStore = new TenantCacheStore();
