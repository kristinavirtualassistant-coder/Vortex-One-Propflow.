-- From db/migrations/004. Live already has properties.updated_at and the function;
-- the trigger is missing, so updated_at never advances on UPDATE (server.ts does not set it).
alter table public.properties
  add column if not exists updated_at timestamptz not null default current_timestamp;

-- Same body as 004, plus a fixed search_path (Supabase advisor: function_search_path_mutable).
create or replace function public.set_properties_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = current_timestamp;
  return new;
end;
$$;

revoke execute on function public.set_properties_updated_at() from public, anon, authenticated;

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_properties_updated_at();
