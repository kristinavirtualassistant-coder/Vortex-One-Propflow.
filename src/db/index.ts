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
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

const runDatabaseMigrations = async () => {
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'password'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider_subject text");
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
  await pool.query("CREATE INDEX IF NOT EXISTS users_auth_provider_subject_idx ON users(auth_provider, auth_provider_subject)");
  await pool.query("CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())");
  await pool.query("CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at)");
  await pool.query("CREATE TABLE IF NOT EXISTS financial_metrics (id serial PRIMARY KEY, month text NOT NULL, revenue integer NOT NULL, occupancy_rate integer NOT NULL)");
  await pool.query("CREATE TABLE IF NOT EXISTS app_records (id text PRIMARY KEY, owner_uid text NOT NULL, collection text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())");
  await pool.query("CREATE INDEX IF NOT EXISTS app_records_owner_collection_idx ON app_records(owner_uid, collection)");

  // The property-intelligence schema is part of the production PostgreSQL
  // data layer. It must be installed on the same database before property
  // APIs are considered ready.
  const migrationPath = path.join(process.cwd(), 'db', 'migrations', '001_property_intelligence.sql');
  if (fs.existsSync(migrationPath)) {
    await pool.query(fs.readFileSync(migrationPath, 'utf8'));
  } else {
    throw new Error('Required property intelligence migration file is missing.');
  }

  // Session IDs are now stored as SHA-256 hashes of random browser tokens.
  // Invalidate legacy sessions once, rather than on every application restart.
  await pool.query("CREATE TABLE IF NOT EXISTS app_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const migration = await pool.query(
    "INSERT INTO app_migrations(id) VALUES('auth_cookie_sessions_v1') ON CONFLICT DO NOTHING RETURNING id"
  );
  if (migration.rowCount) await pool.query("DELETE FROM sessions");
};

export const ensureDatabaseReady = async () => {
  if (!global._databaseReadyPromise) {
    global._databaseReadyPromise = (async () => {
      try {
        await runDatabaseMigrations();
        global._isUsingLocalFallback = false;
        console.log("PostgreSQL Database is ready and migrated successfully!");
      } catch (error: any) {
        global._isUsingLocalFallback = false;
        console.error("PostgreSQL Database is unavailable. Vortex One will not use local JSON fallback storage.", error);
        throw new Error(`PostgreSQL database is unavailable: ${error?.message || 'connection failed'}`);
      }
    })();
  }

  try {
    await global._databaseReadyPromise;
  } catch (error) {
    // Allow a later request/serverless invocation to retry after a transient
    // database outage instead of permanently caching a rejected promise.
    global._databaseReadyPromise = undefined;
    throw error;
  }
};