-- Conserva la fila y todos sus datos. Solo cambia como se permite acceder.
begin;

drop policy if exists "production authenticated read" on public.production_state;
drop policy if exists "production authenticated insert" on public.production_state;
drop policy if exists "production authenticated update" on public.production_state;

revoke all on public.production_state from anon, authenticated;
revoke execute on function public.save_production_state(bigint, jsonb, text) from anon, authenticated;

create or replace function public.read_production_state(access_code text)
returns table (
  payload jsonb,
  version bigint,
  updated_by_device text
)
language sql
stable
security definer
set search_path = public
as $$
  select state.payload, state.version, state.updated_by_device
  from public.production_state as state
  where state.id = 'main'
    and exists (
      select 1
      from jsonb_array_elements(coalesce(state.payload -> 'users', '[]'::jsonb)) as profile
      where profile ->> 'code' = access_code
    );
$$;

create or replace function public.save_production_state_secure(
  expected_version bigint,
  new_payload jsonb,
  device_name text,
  actor_user_id text,
  access_code text
)
returns table (
  payload jsonb,
  version bigint,
  updated_by_device text
)
language sql
security definer
set search_path = public
as $$
  update public.production_state as state
  set payload = new_payload,
      version = state.version + 1,
      updated_at = now(),
      updated_by = auth.uid(),
      updated_by_device = device_name
  where state.id = 'main'
    and state.version = expected_version
    and exists (
      select 1
      from jsonb_array_elements(coalesce(state.payload -> 'users', '[]'::jsonb)) as profile
      where profile ->> 'id' = actor_user_id
        and profile ->> 'code' = access_code
    )
  returning state.payload, state.version, state.updated_by_device;
$$;

revoke all on function public.read_production_state(text) from public;
revoke all on function public.save_production_state_secure(bigint, jsonb, text, text, text) from public;
grant execute on function public.read_production_state(text) to authenticated;
grant execute on function public.save_production_state_secure(bigint, jsonb, text, text, text) to authenticated;

commit;
