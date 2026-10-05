-- Baseline for the 6 core tables. Previously created at runtime by
-- src/db/index.ts (bootstrapDatabaseTables, removed). Idempotent: a no-op on the
-- live DB, where these tables already exist. Timestamped before
-- 20260930000000_add_integration_events (which FKs to organizations).

CREATE TABLE IF NOT EXISTS public.organizations (
  id varchar PRIMARY KEY,
  name varchar NOT NULL,
  slug varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id varchar PRIMARY KEY,
  user_id varchar NOT NULL,
  token_hash varchar NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

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
);

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
);
