#!/usr/bin/env bash
# Applies EVERY Supabase migration (supabase/migrations/*.sql, in filename order)
# to a LOCAL/CI PostgreSQL with PostGIS, after shaping the database like Supabase.
# Usage: DATABASE_URL=postgres://... npm run db:migrate:local
# Production schema changes go through Supabase migrations (see README); this is for dev and tests.
#
# Supabase differences this script stubs, so the canonical migrations run unmodified:
#   1. Roles anon / authenticated exist (Supabase built-ins).
#   2. Role vortex_app exists (production creates it with docs/db/vortex_app_role.sql;
#      here it is NOLOGIN with the same grants, so the RLS migrations apply).
#   3. PostGIS lives in schema "extensions" and the search_path includes it.
#      The postgis/postgis CI image pre-installs PostGIS into "public"; on an EMPTY
#      database we move it. On a database that already has tables we refuse rather
#      than drop anything.
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to the target database}"
cd "$(dirname "$0")/.."

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
DECLARE
  postgis_schema text;
  user_tables int;
BEGIN
  -- 1. Supabase built-in roles.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;

  -- 2. Backend role (mirrors docs/db/vortex_app_role.sql, without LOGIN/password).
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vortex_app') THEN
    CREATE ROLE vortex_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  -- 3. PostGIS in schema "extensions", as on Supabase.
  CREATE SCHEMA IF NOT EXISTS extensions;
  SELECT n.nspname INTO postgis_schema
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'postgis';

  IF postgis_schema IS NOT NULL AND postgis_schema <> 'extensions' THEN
    SELECT count(*) INTO user_tables
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('r', 'p')
       AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions', 'topology', 'tiger', 'tiger_data')
       AND c.relname <> 'spatial_ref_sys';
    IF user_tables > 0 THEN
      RAISE EXCEPTION 'PostGIS is installed in schema "%" but Supabase uses "extensions". This database already has % table(s), so it will not be changed automatically. Use a fresh database.', postgis_schema, user_tables;
    END IF;
    -- Empty database (e.g. the postgis/postgis CI image): drop the image's
    -- pre-installed extensions and reinstall PostGIS where Supabase has it.
    DROP EXTENSION IF EXISTS postgis_tiger_geocoder, postgis_topology, fuzzystrmatch;
    DROP EXTENSION postgis;
  END IF;

  CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
  EXECUTE format('ALTER DATABASE %I SET search_path = "$user", public, extensions', current_database());
END $$;

-- vortex_app grants (same as docs/db/vortex_app_role.sql). Default privileges
-- cover the tables the migrations create next.
GRANT USAGE ON SCHEMA public TO vortex_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vortex_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vortex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vortex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO vortex_app;
SQL

shopt -s nullglob
migrations=(supabase/migrations/*.sql)
if [ "${#migrations[@]}" -eq 0 ]; then
  echo "no migrations found in supabase/migrations" >&2
  exit 1
fi
# Each psql call is a new connection, so it picks up the search_path set above.
for f in "${migrations[@]}"; do
  echo "applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "applied ${#migrations[@]} migrations"
