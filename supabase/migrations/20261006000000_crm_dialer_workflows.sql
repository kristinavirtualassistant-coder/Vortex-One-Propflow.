-- CRM, dialer, campaigns, workflows, agents and demo-mode tables.
-- Builds on the 6 canonical core tables (20260926000000_baseline_core_tables.sql).
-- Idempotent. Tenancy (organization_id) is enforced in application code, matching the
-- existing model; RLS only admits the backend role (vortex_app) when that role exists.

-- ---------------------------------------------------------------------------
-- Organizations: demo-mode flag
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_expires_at timestamptz NULL;

-- ---------------------------------------------------------------------------
-- Properties / owners: fields needed by property intelligence
-- ---------------------------------------------------------------------------
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS bedrooms numeric NULL,
  ADD COLUMN IF NOT EXISTS bathrooms numeric NULL,
  ADD COLUMN IF NOT EXISTS lot_size_sqft integer NULL,
  ADD COLUMN IF NOT EXISTS latitude numeric NULL,
  ADD COLUMN IF NOT EXISTS longitude numeric NULL,
  ADD COLUMN IF NOT EXISTS notes text NULL,
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

ALTER TABLE public.property_owners
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

-- One property per APN within an organization (import already upserts on this key).
-- Skipped (with a notice) if existing data already violates it; resolve duplicates, then re-run.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS properties_org_apn_uq ON public.properties (organization_id, apn);
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'properties_org_apn_uq not created: duplicate (organization_id, apn) rows exist';
END $$;
CREATE INDEX IF NOT EXISTS properties_org_owner_idx
  ON public.properties (organization_id, owner_id);
CREATE INDEX IF NOT EXISTS property_owners_org_name_idx
  ON public.property_owners (organization_id, lower(name));

-- ---------------------------------------------------------------------------
-- Leads: CRM columns (leads.owner_id keeps its legacy meaning: the creating user)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS title varchar NULL,
  ADD COLUMN IF NOT EXISTS source varchar NULL,
  ADD COLUMN IF NOT EXISTS contact_id varchar NULL,
  ADD COLUMN IF NOT EXISTS property_owner_id varchar NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_id varchar NULL,
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS leads_org_stage_idx ON public.leads (organization_id, stage);
CREATE INDEX IF NOT EXISTS leads_org_property_idx ON public.leads (organization_id, primary_property_id);
CREATE INDEX IF NOT EXISTS leads_org_contact_idx ON public.leads (organization_id, contact_id);

-- ---------------------------------------------------------------------------
-- Contacts (people: leads' contacts, owners' contacts, prospects, tenants, vendors)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacts (
  id varchar PRIMARY KEY,
  organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name varchar NOT NULL,
  last_name varchar NOT NULL DEFAULT '',
  email varchar NULL,
  phone varchar NULL,
  company varchar NULL,
  contact_type varchar NOT NULL DEFAULT 'prospect',
  property_owner_id varchar NULL,
  assigned_user_id varchar NULL,
  source varchar NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  do_not_call boolean NOT NULL DEFAULT false,
  last_contacted_at timestamptz NULL,
  archived_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS contacts_org_idx ON public.contacts (organization_id, archived_at);
CREATE INDEX IF NOT EXISTS contacts_org_owner_idx ON public.contacts (organization_id, property_owner_id);
CREATE INDEX IF NOT EXISTS contacts_org_phone_idx ON public.contacts (organization_id, phone);

-- ---------------------------------------------------------------------------
-- Tasks, notes, activity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id varchar PRIMARY KEY,
  organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title varchar NOT NULL,
  description text NULL,
  due_at timestamptz NULL,
  status varchar NOT NULL DEFAULT 'open',
  priority varchar NOT NULL DEFAULT 'normal',
  assigned_user_id varchar NULL,
  created_by varchar NULL,
  contact_id varchar NULL,
  lead_id varchar NULL,
  property_id varchar NULL,
  campaign_id varchar NULL,
  call_id varchar NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tasks_org_status_due_idx ON public.tasks (organization_id, status, due_at);
CREATE INDEX IF NOT EXISTS tasks_org_assignee_idx ON public.tasks (organization_id, assigned_user_id);

CREATE TABLE IF NOT EXISTS public.notes (
  id varchar PRIMARY KEY,
  organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id varchar NULL,
  contact_id varchar NULL,
  lead_id varchar NULL,
  property_id varchar NULL,
  property_owner_id varchar NULL,
  campaign_id varchar NULL,
  call_id varchar NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS notes_org_contact_idx ON public.notes (organization_id, contact_id);
CREATE INDEX IF NOT EXISTS notes_org_lead_idx ON public.notes (organization_id, lead_id);
CREATE INDEX IF NOT EXISTS notes_org_property_idx ON public.notes (organization_id, property_id);

-- Append-only activity log. Every entity id that applies is stored so the same event
-- shows up on the contact, lead, property, owner and campaign it relates to.
CREATE TABLE IF NOT EXISTS public.activities (
  id varchar PRIMARY KEY,
  organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type varchar NOT NULL,
  summary text NOT NULL,
  actor_kind varchar NOT NULL DEFAULT 'user',
  actor_user_id varchar NULL,
  contact_id varchar NULL,
  lead_id varchar NULL,
  property_id varchar NULL,
  property_owner_id varchar NULL,
  campaign_id varchar NULL,
  call_id varchar NULL,
  task_id varchar NULL,
  workflow_run_id varchar NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS activities_org_created_idx ON public.activities (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_org_contact_idx ON public.activities (organization_id, contact_id);
CREATE INDEX IF NOT EXISTS activities_org_lead_idx ON public.activities (organization_id, lead_id);
CREATE INDEX IF NOT EXISTS activities_org_property_idx ON public.activities (organization_id, property_id);
CREATE INDEX IF NOT EXISTS activities_org_campaign_idx ON public.activities (organization_id, campaign_id);

-- ---------------------------------------------------------------------------
-- Campaigns and calls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id varchar PRIMARY KEY,
  organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name varchar NOT NULL,
  description text NULL,
  script text NULL,
  status varchar NOT NULL DEFAULT 'draft',
  created_by varchar NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  archived_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS campaigns_org_status_idx ON public.campaigns (organization_id, status);

CREATE TABLE IF NOT EXISTS public.campaign_contacts (
  id varchar PRIMARY KEY,
  organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id varchar NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id varchar NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  lead_id varchar NULL,
  status varchar NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_outcome varchar NULL,
  last_called_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (campaign_id, contact_id)
);
CREATE INDEX IF NOT EXISTS campaign_contacts_org_campaign_idx
  ON public.campaign_contacts (organization_id, campaign_id, status);

CREATE TABLE IF NOT EXISTS public.calls (
  id varchar PRIMARY KEY,
  organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id varchar NULL,
  lead_id varchar NULL,
  property_id varchar NULL,
  campaign_id varchar NULL,
  user_id varchar NULL,
  direction varchar NOT NULL DEFAULT 'outbound',
  to_number varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'dialing',
  outcome varchar NULL,
  -- Provider the call went through. 'simulated' never touches a telephone network.
  provider varchar NOT NULL DEFAULT 'simulated',
  is_simulated boolean NOT NULL DEFAULT true,
  provider_call_id varchar NULL,
  failure_reason text NULL,
  notes text NULL,
  started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at timestamptz NULL,
  ended_at timestamptz NULL,
  duration_seconds integer NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS calls_org_started_idx ON public.calls (organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS calls_org_contact_idx ON public.calls (organization_id, contact_id);
CREATE INDEX IF NOT EXISTS calls_org_campaign_idx ON public.calls (organization_id, campaign_id);

-- ---------------------------------------------------------------------------
-- Workflows and agents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workflows (
  id varchar PRIMARY KEY,
  organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name varchar NOT NULL,
  description text NULL,
  trigger_type varchar NOT NULL,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_by varchar NULL,
  last_run_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS workflows_org_trigger_idx ON public.workflows (organization_id, trigger_type, enabled);

CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id varchar PRIMARY KEY,
  organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id varchar NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  status varchar NOT NULL DEFAULT 'queued',
  trigger_type varchar NOT NULL,
  trigger_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions_met boolean NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text NULL,
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS workflow_runs_org_workflow_idx
  ON public.workflow_runs (organization_id, workflow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id varchar PRIMARY KEY,
  organization_id varchar NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_key varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'queued',
  triggered_by varchar NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NULL,
  error text NULL,
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS agent_runs_org_created_idx ON public.agent_runs (organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: admit only the backend role, like the core tables. anon/authenticated get nothing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contacts','tasks','notes','activities','campaigns','campaign_contacts',
                           'calls','workflows','workflow_runs','agent_runs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vortex_app') THEN
      EXECUTE format('DROP POLICY IF EXISTS vortex_app_all ON public.%I', t);
      EXECUTE format('CREATE POLICY vortex_app_all ON public.%I FOR ALL TO vortex_app USING (true) WITH CHECK (true)', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;
