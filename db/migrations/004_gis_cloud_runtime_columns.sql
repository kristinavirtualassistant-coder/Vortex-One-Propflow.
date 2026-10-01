create extension if not exists postgis with schema extensions;

alter table public.properties
  add column if not exists location extensions.geography(Point,4326);

alter table public.properties
  add column if not exists updated_at timestamptz not null default current_timestamp;

create index if not exists properties_location_gist
  on public.properties using gist (location);

create or replace function public.set_properties_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = current_timestamp;
  return new;
end;
$$;

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_properties_updated_at();
