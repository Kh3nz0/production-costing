-- Generated from src/test/pg.ts. The two must not drift: a restore
-- rehearsal that builds a different database from the test suite proves
-- something about a database nobody runs.
create schema if not exists auth;

  create table if not exists auth.users (
    id    uuid primary key default gen_random_uuid(),
    email text unique
  );

  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;

  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
  end
  $$;

  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant select on auth.users to authenticated;

  -- Supabase grants anon and authenticated everything on every table created in
  -- the public schema, through ALTER DEFAULT PRIVILEGES. Reproducing that here is the
  -- difference between a test that flatters the migration and one that checks
  -- it: without this line a migration that forgets to revoke anon still passes,
  -- and the live project answers an anonymous reader with 200 and an empty body
  -- where the test expected 401. That gap was found on the live database, not
  -- here, which is exactly once too often.
  alter default privileges in schema public
    grant all on tables to anon, authenticated;
  alter default privileges in schema public
    grant all on functions to anon, authenticated;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated;
