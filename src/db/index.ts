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
        ssl: buildSslOptions(sslCa),
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

export const bootstrapDatabaseTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.organizations (
      id varchar PRIMARY KEY,
      name varchar NOT NULL,
      slug varchar NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.users (
      id varchar PRIMARY KEY,
      organization_id varchar NOT NULL,
      email varchar NOT NULL,
      name varchar NOT NULL,
      role varchar NOT NULL DEFAULT 'member',
      uid varchar NULL,
      password_hash text NULL,
      phone varchar NULL,
      company_name varchar NULL,
      portfolio_size varchar NULL,
      primary_market varchar NULL,
      current_address varchar NULL,
      monthly_income varchar NULL,
      employment_status varchar NULL,
      move_in_date varchar NULL,
      occupants_count integer NULL,
      has_pets varchar NULL,
      trade_specialty varchar NULL,
      hourly_rate varchar NULL,
      property_types varchar NULL,
      management_fee varchar NULL,
      service_radius varchar NULL,
      emergency_dispatch varchar NULL,
      auth_provider varchar NULL,
      auth_provider_subject varchar NULL,
      avatar_url varchar NULL,
      disabled_at timestamptz NULL,
      last_login_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.auth_sessions (
      id varchar PRIMARY KEY,
      user_id varchar NOT NULL,
      token_hash varchar NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.properties (
      id varchar PRIMARY KEY,
      organization_id varchar NOT NULL,
      owner_id varchar NULL,
      address varchar NOT NULL,
      city varchar NOT NULL,
      state varchar NOT NULL,
      zip varchar NOT NULL,
      county varchar NOT NULL,
      apn varchar NOT NULL,
      property_type varchar NOT NULL,
      units_count integer NOT NULL DEFAULT 1,
      square_feet integer NOT NULL DEFAULT 0,
      year_built integer NULL,
      estimated_value numeric NOT NULL DEFAULT '0',
      assessed_tax_value numeric NOT NULL DEFAULT '0',
      estimated_equity numeric NOT NULL DEFAULT '0',
      mortgage_balance numeric NOT NULL DEFAULT '0',
      is_absentee_owner boolean NOT NULL DEFAULT false,
      is_corporate_owned boolean NOT NULL DEFAULT false,
      tax_delinquent boolean NOT NULL DEFAULT false,
      last_sale_date date NULL,
      last_sale_price numeric NULL,
      provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.property_owners (
      id varchar PRIMARY KEY,
      organization_id varchar NOT NULL,
      name varchar NOT NULL,
      entity_type varchar NOT NULL DEFAULT 'individual',
      mailing_address varchar NULL,
      mailing_city varchar NULL,
      mailing_state varchar NULL,
      mailing_zip varchar NULL,
      phone_numbers jsonb NOT NULL DEFAULT '[]'::jsonb,
      email_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
      properties_owned_count integer NOT NULL DEFAULT 1,
      total_portfolio_value numeric NOT NULL DEFAULT '0',
      total_portfolio_equity numeric NOT NULL DEFAULT '0',
      notes text NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.leads (
      id varchar PRIMARY KEY,
      organization_id varchar NOT NULL,
      owner_id varchar NULL,
      primary_property_id varchar NULL,
      lead_score integer NOT NULL DEFAULT 0,
      classification varchar NOT NULL DEFAULT 'nurture',
      factors jsonb NOT NULL DEFAULT '[]'::jsonb,
      stage varchar NOT NULL DEFAULT 'identified',
      assigned_agent varchar NOT NULL DEFAULT 'sub_agent_2',
      dnc_compliant boolean NOT NULL DEFAULT true,
      last_activity_date timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      next_recommended_action text NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

export const ensureThreeMinEventsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.integration_events (
      id varchar PRIMARY KEY,
      organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      source varchar NOT NULL,
      event_type varchar NOT NULL,
      external_id varchar NULL,
      idempotency_key varchar NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS integration_events_idempotency_key_uq
      ON public.integration_events (idempotency_key)
      WHERE idempotency_key IS NOT NULL
  `);

  await pool.query(`ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY`);
  await pool.query(`DROP POLICY IF EXISTS integration_events_backend_access ON public.integration_events`);
};

export const ensureDatabaseReady = async () => {
  if (!global._databaseReadyPromise) {
    global._databaseReadyPromise = (async () => {
      await pool.query('SELECT 1');
      await bootstrapDatabaseTables();
      await verifyCanonicalSchema();
      await ensureThreeMinEventsTable();
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
