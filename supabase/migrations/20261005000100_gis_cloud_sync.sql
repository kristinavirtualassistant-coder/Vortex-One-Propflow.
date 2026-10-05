-- From db/migrations/003 (never applied live). server.ts upserts into this table.
-- Requires the vortex_app role (docs/db/vortex_app_role.sql).
create table if not exists public.gis_cloud_sync (
  id varchar primary key,
  organization_id varchar not null,
  vortex_property_id varchar not null,
  gis_map_id bigint not null,
  gis_layer_id bigint not null,
  gis_feature_id varchar,
  sync_hash varchar not null,
  sync_status varchar not null default 'pending',
  last_pushed_at timestamptz,
  last_pulled_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, vortex_property_id, gis_layer_id)
);

create index if not exists gis_cloud_sync_org_status_idx
  on public.gis_cloud_sync (organization_id, sync_status);

alter table public.gis_cloud_sync enable row level security;
revoke all on public.gis_cloud_sync from anon, authenticated;

-- 003 enabled RLS with no policy, which would hide every row from vortex_app.
grant select, insert, update, delete on public.gis_cloud_sync to vortex_app;
drop policy if exists vortex_app_all on public.gis_cloud_sync;
create policy vortex_app_all on public.gis_cloud_sync
  for all to vortex_app using (true) with check (true);
