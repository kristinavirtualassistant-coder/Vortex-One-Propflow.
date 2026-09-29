import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import fs from 'node:fs';
import path from 'node:path';

const { Pool } = pg;

declare global {
  var _postgresPool: pg.Pool | undefined;
  var _databaseReadyPromise: Promise<void> | undefined;
  var _isUsingLocalFallback: boolean | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const rawConnectionString = process.env.DATABASE_URL;
    let connectionString = rawConnectionString;
    if (connectionString) {
      // pg-connection-string lets sslmode in the URL override the ssl object.
      // Remove libpq SSL-mode overrides so the explicit runtime policy below wins.
      try {
        const parsed = new URL(connectionString);
        parsed.searchParams.delete('sslmode');
        parsed.searchParams.delete('sslrootcert');
        parsed.searchParams.delete('sslcert');
        parsed.searchParams.delete('sslkey');
        connectionString = parsed.toString();
      } catch {
        // Fall back to the raw connection string; pg will report a clear error if invalid.
      }
    }
    global._postgresPool = new Pool(connectionString ? {
      connectionString,
      max: 1,
      connectionTimeoutMillis: 15000,
      ssl: { rejectUnauthorized: false },
    } : {
      host: process.env.SQL_HOST,
      port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
      ssl: process.env.SQL_SSL === 'true' || String(process.env.SQL_HOST || '').includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

try {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const target = raw ? new URL(raw) : null;
  console.log('PostgreSQL runtime target:', {
    source: raw ? (process.env.DATABASE_URL ? 'DATABASE_URL' : 'POSTGRES_URL') : 'SQL_*',
    host: target?.hostname || process.env.SQL_HOST || null,
    database: target?.pathname?.replace(/^\\//, '') || process.env.SQL_DB_NAME || null,
  });
} catch {
  console.log('PostgreSQL runtime target: invalid connection string');
}

export const db = drizzle(pool, { schema });

const runDatabaseMigrations = async () => {
  // The production database already has its canonical users/auth_sessions model.
  // These are additive compatibility columns used by PropFlow's profile/auth flows.
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS uid varchar");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider varchar NOT NULL DEFAULT 'password'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider_subject varchar");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio_size text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_market text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS current_address text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_income text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS move_in_date text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS occupants_count integer");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS has_pets text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS trade_specialty text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS property_types text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS management_fee text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS service_radius text");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_dispatch text");
  await pool.query("UPDATE users SET uid = id WHERE uid IS NULL");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS users_uid_unique_idx ON users(uid)");
  await pool.query("CREATE INDEX IF NOT EXISTS users_auth_provider_subject_idx ON users(auth_provider, auth_provider_subject)");
  await pool.query("CREATE TABLE IF NOT EXISTS app_records (id text PRIMARY KEY, owner_uid text NOT NULL, collection text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())");
  await pool.query("CREATE INDEX IF NOT EXISTS app_records_owner_collection_idx ON app_records(owner_uid, collection)");
  await pool.query("CREATE TABLE IF NOT EXISTS financial_metrics (id serial PRIMARY KEY, month text NOT NULL, revenue integer NOT NULL, occupancy_rate integer NOT NULL)");
};

export const ensureDatabaseReady = async () => {
  if (!global._databaseReadyPromise) {
    global._databaseReadyPromise = (async () => {
      try {
        await pool.query('SELECT 1');
        await runDatabaseMigrations();
        const migrationPath = path.join(process.cwd(), 'db', 'migrations', '001_property_intelligence.sql');
        if (!fs.existsSync(migrationPath)) throw new Error('Required property intelligence migration file is missing.');
        await pool.query(fs.readFileSync(migrationPath, 'utf8'));
        global._isUsingLocalFallback = false;
        console.log("PostgreSQL Database is ready and migrated successfully!");
      } catch (error: any) {
        global._isUsingLocalFallback = false;
        console.error("PostgreSQL database is unavailable. Local JSON fallback is disabled.", error);
        throw error;
      }
    })();
  }
  try {
    await global._databaseReadyPromise;
  } catch (error) {
    global._databaseReadyPromise = undefined;
    throw error;
  }
};
