import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

declare global {
  var _postgresPool: pg.Pool | undefined;
  var _databaseReadyPromise: Promise<void> | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const rawConnectionString = process.env.DATABASE_URL;
    let connectionString = rawConnectionString;

    if (connectionString) {
      try {
        const parsed = new URL(connectionString);
        parsed.searchParams.delete('sslmode');
        parsed.searchParams.delete('sslrootcert');
        parsed.searchParams.delete('sslcert');
        parsed.searchParams.delete('sslkey');
        connectionString = parsed.toString();
      } catch {
        // Let pg surface an invalid connection string at connection time.
      }

      global._postgresPool = new Pool({
        connectionString,
        max: 1,
        connectionTimeoutMillis: 15000,
        ssl: { rejectUnauthorized: false },
      });
    } else {
      const host = process.env.SQL_HOST;
      const database = process.env.SQL_DB_NAME;
      const user = process.env.SQL_USER;
      const password = process.env.SQL_PASSWORD;

      if (!host || !database || !user || !password) {
        throw new Error(
          'Production PostgreSQL is not configured. Set DATABASE_URL or SQL_HOST, SQL_PORT, SQL_USER, SQL_PASSWORD, and SQL_DB_NAME.'
        );
      }

      global._postgresPool = new Pool({
        host,
        port: Number(process.env.SQL_PORT || 5432),
        user,
        password,
        database,
        max: 1,
        connectionTimeoutMillis: 15000,
        ssl: process.env.SQL_SSL === 'true' || host.includes('supabase.co')
          ? { rejectUnauthorized: false }
          : undefined,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }

  return global._postgresPool;
};

const pool = createPool();

try {
  const raw = process.env.DATABASE_URL;
  const target = raw ? new URL(raw) : null;
  console.log('PostgreSQL runtime target:', {
    source: raw ? 'DATABASE_URL' : 'SQL_*',
    host: target?.hostname || process.env.SQL_HOST || null,
    database: target?.pathname?.replace(/^\//, '') || process.env.SQL_DB_NAME || null,
  });
} catch {
  console.log('PostgreSQL runtime target: invalid connection string');
}

export const db = drizzle(pool, { schema });

const verifyCanonicalSchema = async () => {
  const requiredTables = [
    'organizations',
    'users',
    'auth_sessions',
    'properties',
    'property_owners',
    'leads',
  ];

  const result = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema='public'
        AND table_name = ANY($1::text[])`,
    [requiredTables]
  );

  const present = new Set(result.rows.map((row: { table_name: string }) => row.table_name));
  const missing = requiredTables.filter((name) => !present.has(name));

  if (missing.length) {
    throw new Error(
      `Supabase canonical schema is incomplete. Missing required tables: ${missing.join(', ')}`
    );
  }

  const usersColumns = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='users'
        AND column_name = ANY($1::text[])`,
    [['id', 'organization_id', 'email', 'name', 'role', 'password_hash', 'disabled_at']]
  );

  const requiredUserColumns = ['id', 'organization_id', 'email', 'name', 'role', 'password_hash', 'disabled_at'];
  const presentUserColumns = new Set(
    usersColumns.rows.map((row: { column_name: string }) => row.column_name)
  );
  const missingUserColumns = requiredUserColumns.filter((name) => !presentUserColumns.has(name));

  if (missingUserColumns.length) {
    throw new Error(
      `Supabase users schema is incomplete. Missing required columns: ${missingUserColumns.join(', ')}`
    );
  }
};

export const ensureDatabaseReady = async () => {
  if (!global._databaseReadyPromise) {
    global._databaseReadyPromise = (async () => {
      await pool.query('SELECT 1');
      await verifyCanonicalSchema();
      console.log('Supabase PostgreSQL connection and canonical schema verified.');
    })();
  }

  try {
    await global._databaseReadyPromise;
  } catch (error) {
    global._databaseReadyPromise = undefined;
    throw error;
  }
};
