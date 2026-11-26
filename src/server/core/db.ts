import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { createInitialSeed } from './seed.ts';
import {
  ensureNormalizedPgSchema,
  loadAllNormalizedTables,
  persistAllNormalizedTables,
} from './pg-relational.ts';
import type { DatabaseSchema } from '../../shared/types.ts';

function resolveDataDir(): string {
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) {
    return path.join('/tmp', 'ufuq-data');
  }
  return path.resolve(process.cwd(), 'data');
}

const DATA_DIR = resolveDataDir();
const DB_FILE = path.join(DATA_DIR, 'commerce-db.json');

class PersistentRelationalStore {
  private data: DatabaseSchema;
  private writeQueue: Promise<void> = Promise.resolve();
  private lockQueue: Promise<void> = Promise.resolve();
  private pool: Pool | null = null;
  private readPool: Pool | null = null;
  private pgInitialized = false;
  private pgInitPromise: Promise<void> | null = null;
  private lastPgSyncAt = 0;

  constructor() {
    const configuredDatabaseUrl =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

    if (configuredDatabaseUrl) {
      const databaseUrl = new URL(configuredDatabaseUrl);
      databaseUrl.searchParams.delete('sslmode');
      const connectionString = databaseUrl.toString();
      const isLocalDatabase =
        connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

      this.pool = new Pool({
        connectionString,
        max: 10,
        ssl: isLocalDatabase ? undefined : { rejectUnauthorized: false },
      });
      if (process.env.DATABASE_READ_REPLICA_URL) {
        const readReplicaUrl = new URL(process.env.DATABASE_READ_REPLICA_URL);
        readReplicaUrl.searchParams.delete('sslmode');
        const readReplicaConnectionString = readReplicaUrl.toString();
        const isLocalReadReplica =
          readReplicaConnectionString.includes('localhost') ||
          readReplicaConnectionString.includes('127.0.0.1');

        this.readPool = new Pool({
          connectionString: readReplicaConnectionString,
          max: 10,
          ssl: isLocalReadReplica ? undefined : { rejectUnauthorized: false },
        });
      }
      this.data = createInitialSeed();
      return;
    }

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw) as DatabaseSchema;
      } else {
        this.data = createInitialSeed();
        this.persistSync();
      }
    } catch {
      this.data = createInitialSeed();
    }
  }

  public isPostgresEnabled(): boolean {
    return Boolean(this.pool);
  }

  public hasReadReplica(): boolean {
    return Boolean(this.readPool);
  }

  public async ensureReady(forceRefresh = false): Promise<void> {
    if (!this.pool) return;

    if (!this.pgInitialized) {
      if (!this.pgInitPromise) {
        this.pgInitPromise = this.initPostgres().finally(() => {
          this.pgInitPromise = null;
        });
      }
      await this.pgInitPromise;
      return;
    }

    const now = Date.now();
    if (forceRefresh || now - this.lastPgSyncAt > 1500) {
      const reader = this.readPool || this.pool;
      const client = await reader.connect();
      try {
        const loaded = await loadAllNormalizedTables(client);
        if (loaded) {
          this.data = loaded;
        }
        this.lastPgSyncAt = Date.now();
      } finally {
        client.release();
      }
    }
  }

  private async initPostgres(): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(7042026)');
      await ensureNormalizedPgSchema(client);

      const loaded = await loadAllNormalizedTables(client);
      if (!loaded) {
        const initial = createInitialSeed();
        await persistAllNormalizedTables(client, initial);
        this.data = initial;
      } else {
        this.data = loaded;
      }

      await client.query('COMMIT');
      this.pgInitialized = true;
      this.lastPgSyncAt = Date.now();
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  private persistSync(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, DB_FILE);
    } catch {
      // Ignore read-only filesystem errors safely
    }
  }

  private schedulePersist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        if (!fs.existsSync(DATA_DIR)) {
          await fs.promises.mkdir(DATA_DIR, { recursive: true });
        }
        const tmp = `${DB_FILE}.tmp`;
        await fs.promises.writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8');
        await fs.promises.rename(tmp, DB_FILE);
      } catch {
        // Ignore read-only filesystem errors safely
      }
    });
    return this.writeQueue;
  }

  public snapshot(): DatabaseSchema {
    return this.data;
  }

  public async withTransaction<T>(fn: (db: DatabaseSchema) => Promise<T> | T): Promise<T> {
    if (this.pool) {
      await this.ensureReady(false);
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(7042026)');
        const fresh = (await loadAllNormalizedTables(client)) || structuredClone(this.data);
        const before = structuredClone(fresh);
        const result = await fn(fresh);
        await persistAllNormalizedTables(client, fresh, before);
        await client.query('COMMIT');
        this.data = fresh;
        this.lastPgSyncAt = Date.now();
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    let release!: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = this.lockQueue;
    this.lockQueue = prev.then(() => nextLock);
    await prev;

    const backup = structuredClone(this.data);
    try {
      const result = await fn(this.data);
      await this.schedulePersist();
      return result;
    } catch (err) {
      this.data = backup;
      throw err;
    } finally {
      release();
    }
  }
}

export const dbStore = new PersistentRelationalStore();
