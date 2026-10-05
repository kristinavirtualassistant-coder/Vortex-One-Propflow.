-- Prereq: the vortex_app role must exist (see docs/db/vortex_app_role.sql).
-- Tenancy (organization_id) is enforced in application code; these policies only
-- admit the backend role. anon/authenticated get no access.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vortex_app') THEN
    RAISE EXCEPTION 'role vortex_app does not exist; run docs/db/vortex_app_role.sql first';
  END IF;
END $$;

-- The earlier integration_events policy applied to PUBLIC (USING (true)); replace it.
DROP POLICY IF EXISTS integration_events_backend_access ON public.integration_events;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','users','auth_sessions','properties',
                           'property_owners','leads','integration_events']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS vortex_app_all ON public.%I', t);
    EXECUTE format('CREATE POLICY vortex_app_all ON public.%I FOR ALL TO vortex_app USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
