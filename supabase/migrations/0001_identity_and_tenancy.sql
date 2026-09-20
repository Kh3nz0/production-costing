-- 0001 Identity and tenancy
--
-- Every business table in this system carries org_id and every RLS policy keys
-- on it (docs/phase3-data-model.md section 0). This migration creates the two
-- tables that make that possible, the function every later policy calls, and
-- the shared trigger that maintains updated_at.
--
-- v1 creates only `owner` memberships. The policies for the other four roles
-- ship written but unsatisfied, so adding a user later is an insert rather than
-- a migration.

-- gen_random_uuid() is in Postgres core from 13 onward, so no extension is
-- required. Supabase ships pgcrypto anyway; not depending on it keeps this
-- migration runnable anywhere, including the WASM Postgres the tests use.

-- ---------------------------------------------------------------------------
-- Shared conventions
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger for every business table. updated_at and updated_by are maintained by the database, never by the client.';

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

create type public.costing_method as enum ('weighted_average');
create type public.overhead_method as enum ('per_attended_hour', 'per_machine_hour', 'per_unit');
create type public.money_rounding as enum ('half_up');

create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 1 and 120),
  logo_path     text,
  currency_code text not null default 'PHP' check (currency_code ~ '^[A-Z]{3}$'),
  locale        text not null default 'en-PH',
  timezone      text not null default 'Asia/Manila',

  costing_method  public.costing_method  not null default 'weighted_average',
  overhead_method public.overhead_method not null default 'per_attended_hour',
  money_rounding  public.money_rounding  not null default 'half_up',

  vat_registered boolean not null default false,
  -- A fraction, not a percentage: 0.12 is 12%.
  vat_rate       numeric(9, 6) not null default 0.12 check (vat_rate >= 0 and vat_rate < 1),

  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),
  archived_at timestamptz
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Memberships
-- ---------------------------------------------------------------------------

create type public.membership_role as enum (
  'owner',
  'manager',
  'production',
  'inventory',
  'readonly'
);

create table public.memberships (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role    public.membership_role not null,

  -- Cost hiding for production staff is a view-level concern and is the one
  -- piece of the permission model that needs real work when staff are added.
  -- Flagged here rather than hidden (docs/phase3-data-model.md section 11).
  can_view_costs boolean not null default true,

  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,

  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),
  archived_at timestamptz,

  constraint memberships_org_user_unique unique (org_id, user_id)
);

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_org_id_idx on public.memberships (org_id);
create index memberships_active_idx on public.memberships (org_id) where archived_at is null;

-- ---------------------------------------------------------------------------
-- The function every later policy calls
--
-- security definer so that the policies on organizations and memberships can
-- call it without recursing into their own RLS. It returns only rows already
-- scoped to the caller, so it exposes nothing that the caller could not read.
-- ---------------------------------------------------------------------------

create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.accepted_at is not null
    and m.archived_at is null;
$$;

comment on function public.my_org_ids() is
  'The caller''s accepted, unarchived org ids. Every RLS policy in this schema keys on it.';

create or replace function public.my_role(p_org_id uuid)
returns public.membership_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.org_id = p_org_id
    and m.accepted_at is not null
    and m.archived_at is null;
$$;

-- Deliberately executable by anon as well as authenticated. Signed out,
-- auth.uid() is null and both functions return an empty set, which is the
-- correct answer. Revoking anon would turn a clean empty result into a
-- permission error on every signed-out request.
grant execute on function public.my_org_ids() to anon, authenticated;
grant execute on function public.my_role(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

-- Belt and braces: the table owner would otherwise bypass its own policies.
alter table public.organizations force row level security;
alter table public.memberships force row level security;

-- Organizations --------------------------------------------------------------

create policy organizations_select on public.organizations
  for select to authenticated
  using (id in (select public.my_org_ids()));

-- No insert policy, deliberately. An org is founded only through
-- create_organization() below, which writes the org and its owner membership in
-- one transaction. Leaving a direct insert path open would allow an org with no
-- members: a row nobody can read and nobody can delete.

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.my_role(id) = 'owner')
  with check (public.my_role(id) = 'owner');

-- No delete policy. Organizations are archived, never deleted: every historical
-- cost in the system hangs off one.

-- Memberships ----------------------------------------------------------------

create policy memberships_select on public.memberships
  for select to authenticated
  using (org_id in (select public.my_org_ids()));

-- Only an existing owner may add a member. Founding an org does not go through
-- this policy: it goes through create_organization() below, because the org row
-- and its first membership have to appear together or not at all.
create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (public.my_role(org_id) = 'owner');

create policy memberships_update on public.memberships
  for update to authenticated
  using (public.my_role(org_id) = 'owner')
  with check (public.my_role(org_id) = 'owner');

create policy memberships_delete on public.memberships
  for delete to authenticated
  using (public.my_role(org_id) = 'owner');

-- ---------------------------------------------------------------------------
-- Grants. RLS decides which rows; grants decide which verbs.
-- anon gets nothing: this is a private system and there is no public sign-up.
-- ---------------------------------------------------------------------------

revoke all on public.organizations from anon;
revoke all on public.memberships from anon;

-- No insert on organizations: create_organization() is the only way to found
-- one, and it is security definer so it does not need the grant.
grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;

-- ---------------------------------------------------------------------------
-- Founding an organization
--
-- Two rows have to appear together or not at all: the org, and the owner
-- membership that makes it reachable. Two client-side inserts cannot do this.
-- They cannot even be attempted: `insert ... returning id` on organizations is
-- refused, because RETURNING is also subject to the SELECT policy and at that
-- instant the caller is not yet a member of the org they just created.
--
-- security definer so the function can write both rows before either is
-- visible. It reads the caller from auth.uid() and never takes a user id as an
-- argument, so it cannot be used to found an org on someone else's behalf.
-- ---------------------------------------------------------------------------

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org  uuid;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'An organization needs a name' using errcode = '22023';
  end if;

  insert into public.organizations (name, created_by)
  values (btrim(p_name), v_user)
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role, accepted_at, created_by)
  values (v_org, v_user, 'owner', now(), v_user);

  return v_org;
end;
$$;

comment on function public.create_organization(text) is
  'Creates an organization and its owner membership in one transaction. The only sanctioned way to found an org.';

-- Functions are executable by PUBLIC by default, and PUBLIC includes anon.
-- Signed out this would fail anyway, but it should not be reachable at all:
-- a function that fails differently depending on its input is a probe.
revoke execute on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;
