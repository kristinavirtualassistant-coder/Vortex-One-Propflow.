-- Run once in the Supabase SQL editor, BEFORE 20261005000000_vortex_app_rls.sql.
-- Generate a URL-safe password: openssl rand -base64 32 | tr -d '/+='
CREATE ROLE vortex_app LOGIN PASSWORD '<strong-password>'
  NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

GRANT CONNECT ON DATABASE postgres TO vortex_app;
GRANT USAGE ON SCHEMA public TO vortex_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vortex_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vortex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vortex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO vortex_app;

-- Append-only, once activity_logs exists (A3):
-- REVOKE UPDATE, DELETE ON public.activity_logs FROM vortex_app;
