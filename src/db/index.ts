import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

declare global {
  var _postgresPool: pg.Pool | undefined;
  var _databaseReadyPromise: Promise<void> | undefined;
}

export const formatPemCertificate = (cert: string | undefined): string | undefined => {
  if (!cert) return undefined;
  const trimmed = cert.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes('\n')) return trimmed;
  if (trimmed.includes('\\n')) {
    return trimmed.replace(/\\n/g, '\n');
  }
  const match = trimmed.match(/-----BEGIN [A-Z ]+-----(.+?)-----END [A-Z ]+-----/);
  if (match) {
    const headerMatch = trimmed.match(/-----BEGIN [A-Z ]+-----/);
    const footerMatch = trimmed.match(/-----END [A-Z ]+-----/);
    const header = headerMatch ? headerMatch[0] : '-----BEGIN CERTIFICATE-----';
    const footer = footerMatch ? footerMatch[0] : '-----END CERTIFICATE-----';
    const body = match[1].replace(/\s+/g, '');
    const lines = body.match(/.{1,64}/g) || [body];
    return `${header}\n${lines.join('\n')}\n${footer}`;
  }
  return trimmed;
};

// TLS certificate verification is ON by default. It can only be turned off by an
// explicit DATABASE_SSL_REJECT_UNAUTHORIZED=false; there is no automatic downgrade.
const buildSslOptions = (sslCa: string | undefined) => {
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
  if (!rejectUnauthorized) {
    console.warn('DATABASE_SSL_REJECT_UNAUTHORIZED=false: PostgreSQL TLS certificate verification is disabled.');
  }
  return { rejectUnauthorized, ...(sslCa ? { ca: sslCa } : {}) };
};

// Pool size: default 10, override with DATABASE_POOL_MAX (keep within the provider's connection limit).
const poolMax = () => {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  return Number.isInteger(configured) && configured > 0 ? configured : 10;
};

export const createPool = () => {
  if (!global._postgresPool) {
    const rawConnectionString = process.env.DATABASE_URL;
    let connectionString = rawConnectionString ? rawConnectionString.replace(/:\s+/, ':').replace(/\s+@/, '@') : rawConnectionString;
    let loopbackHost = false;

    if (connectionString) {
      try {
        const parsed = new URL(connectionString);
        if (
          process.env.FIREBASE_CONFIG &&
          ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
        ) {
          throw new Error(
            'DATABASE_URL points to a local database from Firebase. Configure the Firebase production runtime DATABASE_URL with the Supabase PostgreSQL connection string.'
          );
        }
        // Local development/CI databases on loopback do not speak TLS; hosted databases always do.
        loopbackHost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname) && !process.env.FIREBASE_CONFIG;
        parsed.searchParams.delete('sslmode');
        parsed.searchParams.delete('sslrootcert');
        parsed.searchParams.delete('sslcert');
        parsed.searchParams.delete('sslkey');
        connectionString = parsed.toString();
      } catch {
        // Let pg surface an invalid connection string at connection time.
      }

      const sslCa = formatPemCertificate(process.env.DATABASE_SSL_CA);
      const isSupabase = connectionString.includes('supabase.co') || connectionString.includes('pooler.supabase');
      global._postgresPool = new Pool({
        connectionString,
        max: poolMax(),
        connectionTimeoutMillis: 15000,
        ssl: loopbackHost ? false : buildSslOptions(sslCa),
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

      const sslCa = formatPemCertificate(process.env.DATABASE_SSL_CA);
      const isSupabase = host.includes('supabase.co') || host.includes('pooler.supabase');
      global._postgresPool = new Pool({
        host,
        port: Number(process.env.SQL_PORT || 5432),
        user,
        password,
        database,
        max: poolMax(),
        connectionTimeoutMillis: 15000,
        ssl: process.env.SQL_SSL === 'true' || isSupabase ? buildSslOptions(sslCa) : undefined,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }

  return global._postgresPool;
};

// Runs fn inside a transaction on a dedicated client so BEGIN/COMMIT/ROLLBACK never
// interleave with other requests sharing the pool. Always use client.query inside fn.
export const withTransaction = async <T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
  const client = await createPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    const current = createPool();
    const val = (current as any)[prop];
    return typeof val === 'function' ? val.bind(current) : val;
  }
});

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

// Built lazily so importing this module (e.g. in unit tests) never requires database configuration.
let drizzleDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    drizzleDb ??= drizzle(pool, { schema });
    return (drizzleDb as any)[prop];
  },
});

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
      `PostgreSQL canonical schema is incomplete. Missing required tables: ${missing.join(', ')}`
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
      `PostgreSQL users schema is incomplete. Missing required columns: ${missingUserColumns.join(', ')}`
    );
  }
};

export const ensureDatabaseReady = async () => {
  if (!global._databaseReadyPromise) {
    global._databaseReadyPromise = (async () => {
      await pool.query('SELECT 1');
      await verifyCanonicalSchema();
      console.log('PostgreSQL connection and canonical schema verified.');
    })();
  }

  try {
    await global._databaseReadyPromise;
  } catch (error) {
    global._databaseReadyPromise = undefined;
    throw error;
  }
};
