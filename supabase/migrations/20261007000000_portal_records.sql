-- Tenant-scoped document store for the legacy portals (maintenance, upkeep, utilities, vendors,
-- lease documents, uploads). Replaces the former Firestore collections of the same names.
-- Idempotent. Tenancy is enforced in application code (organization_id), matching the core model.

CREATE TABLE IF NOT EXISTS public.portal_records (
  id              text        PRIMARY KEY,
  organization_id text        NOT NULL,
  collection      text        NOT NULL,
  data            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by      text        NULL,
  created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT portal_records_collection_check CHECK (collection IN (
    'maintenance_requests', 'recurring_upkeep_schedules', 'utility_bills',
    'vendors', 'lease_documents', 'uploaded_documents'
  ))
);

CREATE INDEX IF NOT EXISTS idx_portal_records_org_collection
  ON public.portal_records (organization_id, collection, created_at DESC);

ALTER TABLE public.portal_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_records FROM anon, authenticated;
