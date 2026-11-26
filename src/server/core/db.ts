import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { createInitialSeed } from './seed.ts';
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
  private pgInitialized = false;
  private pgInitPromise: Promise<void> | null = null;
  private lastPgSyncAt = 0;

  constructor() {
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        ssl:
          process.env.DATABASE_URL.includes('localhost') ||
          process.env.DATABASE_URL.includes('127.0.0.1')
            ? undefined
            : { rejectUnauthorized: false },
      });
      this.data = createInitialSeed();
      return;
    }

    // Local / Docker / Vercel /tmp fallback when DATABASE_URL is not configured
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

    // Keep multi-instance Vercel serverless functions synchronized
    const now = Date.now();
    if (forceRefresh || now - this.lastPgSyncAt > 1500) {
      const res = await this.pool.query<{ schema_json: DatabaseSchema }>(
        'SELECT schema_json FROM ufuq_app_state WHERE id = 1'
      );
      if (res.rows[0]?.schema_json) {
        this.data = res.rows[0].schema_json;
      }
      this.lastPgSyncAt = Date.now();
    }
  }

  private async initPostgres(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ufuq_app_state (
        id INTEGER PRIMARY KEY,
        schema_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ schema_json: DatabaseSchema }>(
        'SELECT schema_json FROM ufuq_app_state WHERE id = 1 FOR UPDATE'
      );
      if (existing.rows.length === 0) {
        const initial = createInitialSeed();
        await client.query(
          'INSERT INTO ufuq_app_state (id, schema_json, updated_at) VALUES (1, $1::jsonb, NOW())',
          [JSON.stringify(initial)]
        );
        this.data = initial;
      } else {
        this.data = existing.rows[0].schema_json;
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

  // Serialized ACID transaction lock (PostgreSQL row lock in production, mutex locally)
  public async withTransaction<T>(fn: (db: DatabaseSchema) => Promise<T> | T): Promise<T> {
    if (this.pool) {
      await this.ensureReady(false);
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const row = await client.query<{ schema_json: DatabaseSchema }>(
          'SELECT schema_json FROM ufuq_app_state WHERE id = 1 FOR UPDATE'
        );
        const workingDb = row.rows[0]?.schema_json || structuredClone(this.data);
        const result = await fn(workingDb);
        await client.query(
          'UPDATE ufuq_app_state SET schema_json = $1::jsonb, updated_at = NOW() WHERE id = 1',
          [JSON.stringify(workingDb)]
        );
        await client.query('COMMIT');
        this.data = workingDb;
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
