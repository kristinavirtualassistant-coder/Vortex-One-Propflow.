#!/usr/bin/env bash
# Applies the app-level Supabase migrations to a LOCAL/CI PostgreSQL (plain Postgres, no PostGIS,
# no vortex_app role). Usage: DATABASE_URL=postgres://... npm run db:migrate:local
# Production schema changes go through Supabase migrations (see README); this is for dev and tests.
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to the target database}"
cd "$(dirname "$0")/.."
# Supabase provides these roles; stub them on plain Postgres so the REVOKE statements run.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
SQL
for f in \
  supabase/migrations/20260926000000_baseline_core_tables.sql \
  supabase/migrations/20260930000000_add_integration_events.sql \
  supabase/migrations/20261005000300_properties_updated_at_trigger.sql \
  supabase/migrations/20261006000000_crm_dialer_workflows.sql; do
  echo "applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
