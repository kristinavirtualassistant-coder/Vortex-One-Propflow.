-- From db/migrations/002. Live already has properties.location and its GiST index;
-- this adds the missing org index and the three spatial functions.
-- None of the functions has an app caller today (grep), so this is groundwork.
-- Functions are SECURITY INVOKER: RLS applies to the caller (vortex_app policy).
create extension if not exists postgis with schema extensions;

alter table public.properties
  add column if not exists location extensions.geography(Point,4326);

create index if not exists properties_location_gist
  on public.properties using gist (location);

-- Note: despite the name this is a plain btree on organization_id (kept as in 002).
create index if not exists properties_org_location_idx
  on public.properties (organization_id);

create or replace function public.nearby_properties(
  p_organization_id varchar,
  p_lat float8,
  p_long float8,
  p_radius_meters float8 default 5000,
  p_limit int default 100
)
returns table (
  id varchar, organization_id varchar, owner_id varchar, address varchar,
  city varchar, state varchar, zip varchar, county varchar, apn varchar,
  property_type varchar, units_count int, estimated_value numeric,
  estimated_equity numeric, latitude float8, longitude float8,
  distance_meters float8
)
language sql stable set search_path=''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(p_long,p_lat),4326)::extensions.geography as g
  )
  select p.id,p.organization_id,p.owner_id,p.address,p.city,p.state,p.zip,p.county,p.apn,
         p.property_type,p.units_count,p.estimated_value,p.estimated_equity,
         extensions.st_y(p.location::extensions.geometry),
         extensions.st_x(p.location::extensions.geometry),
         extensions.st_distance(p.location,origin.g)
  from public.properties p, origin
  where p.organization_id=p_organization_id
    and p.location is not null
    and extensions.st_dwithin(p.location,origin.g,p_radius_meters)
  order by p.location operator(extensions.<->) origin.g
  limit greatest(1,least(p_limit,500));
$$;

create or replace function public.properties_in_view(
  p_organization_id varchar,
  p_min_lat float8,
  p_min_long float8,
  p_max_lat float8,
  p_max_long float8,
  p_limit int default 2000
)
returns table (
  id varchar, organization_id varchar, owner_id varchar, address varchar,
  city varchar, state varchar, zip varchar, county varchar, apn varchar,
  property_type varchar, units_count int, estimated_value numeric,
  latitude float8, longitude float8
)
language sql stable set search_path=''
as $$
  select p.id,p.organization_id,p.owner_id,p.address,p.city,p.state,p.zip,p.county,p.apn,
         p.property_type,p.units_count,p.estimated_value,
         extensions.st_y(p.location::extensions.geometry),
         extensions.st_x(p.location::extensions.geometry)
  from public.properties p
  where p.organization_id=p_organization_id
    and p.location is not null
    and extensions.st_intersects(
      p.location::extensions.geometry,
      extensions.st_makeenvelope(p_min_long,p_min_lat,p_max_long,p_max_lat,4326)
    )
  limit greatest(1,least(p_limit,5000));
$$;

create or replace function public.set_property_location(
  p_property_id varchar,
  p_lat float8,
  p_long float8
)
returns void
language sql set search_path=''
as $$
  update public.properties
  set location=extensions.st_setsrid(extensions.st_makepoint(p_long,p_lat),4326)::extensions.geography
  where id=p_property_id;
$$;

comment on column public.properties.location
  is 'WGS84 property point used for GIS Cloud/PostGIS spatial queries.';

-- Functions default to EXECUTE for PUBLIC; restrict to the backend role.
revoke execute on function public.nearby_properties(varchar, float8, float8, float8, int) from public, anon, authenticated;
revoke execute on function public.properties_in_view(varchar, float8, float8, float8, float8, int) from public, anon, authenticated;
revoke execute on function public.set_property_location(varchar, float8, float8) from public, anon, authenticated;
grant execute on function public.nearby_properties(varchar, float8, float8, float8, int) to vortex_app;
grant execute on function public.properties_in_view(varchar, float8, float8, float8, float8, int) to vortex_app;
grant execute on function public.set_property_location(varchar, float8, float8) to vortex_app;
