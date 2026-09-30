CREATE TABLE IF NOT EXISTS public.integration_events (
  id varchar PRIMARY KEY,
  organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source varchar NOT NULL,
  event_type varchar NOT NULL,
  external_id varchar,
  idempotency_key varchar,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS integration_events_idempotency_key_uq
  ON public.integration_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS integration_events_org_created_idx
  ON public.integration_events (organization_id, created_at DESC);

ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_events_backend_access ON public.integration_events;
CREATE POLICY integration_events_backend_access
  ON public.integration_events
  FOR ALL
  USING (true)
  WITH CHECK (true);