begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_secrets (
  key text primary key,
  secret_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

create or replace function public.is_developer_password(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select extensions.crypt(candidate, secret.secret_hash) = secret.secret_hash
      from public.app_secrets as secret
      where secret.key = 'developer_password'
    ),
    false
  );
$$;

create or replace function public.developer_password_configured()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_secrets
    where key = 'developer_password'
  );
$$;

create or replace function public.configure_developer_password(
  primary_admin_code text,
  new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(coalesce(new_password, '')) < 10 then
    return false;
  end if;

  if not exists (
    select 1
    from public.production_state as state,
      jsonb_array_elements(coalesce(state.payload -> 'users', '[]'::jsonb)) as profile
    where state.id = 'main'
      and profile ->> 'code' = primary_admin_code
      and coalesce((profile ->> 'isPrimaryAdmin')::boolean, false)
  ) then
    return false;
  end if;

  insert into public.app_secrets (key, secret_hash, updated_at)
  values (
    'developer_password',
    extensions.crypt(new_password, extensions.gen_salt('bf')),
    now()
  )
  on conflict (key) do update
    set secret_hash = excluded.secret_hash,
        updated_at = excluded.updated_at;

  return true;
end;
$$;

create or replace function public.read_production_state_developer(developer_password text)
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
    and public.is_developer_password(developer_password);
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
    and (
      exists (
        select 1
        from jsonb_array_elements(coalesce(state.payload -> 'users', '[]'::jsonb)) as profile
        where profile ->> 'id' = actor_user_id
          and profile ->> 'code' = access_code
      )
      or public.is_developer_password(access_code)
    )
  returning state.payload, state.version, state.updated_by_device;
$$;

revoke all on function public.is_developer_password(text) from public;
revoke all on function public.developer_password_configured() from public;
revoke all on function public.configure_developer_password(text, text) from public;
revoke all on function public.read_production_state_developer(text) from public;

grant execute on function public.developer_password_configured() to authenticated;
grant execute on function public.configure_developer_password(text, text) to authenticated;
grant execute on function public.read_production_state_developer(text) to authenticated;

commit;
