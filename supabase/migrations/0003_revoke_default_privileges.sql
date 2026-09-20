-- 0003 Take back what Supabase grants by default
--
-- Supabase ships ALTER DEFAULT PRIVILEGES granting `anon` and `authenticated`
-- everything on every table created in `public`. That is convenient for a
-- prototype and wrong for this system, and it produced four real defects that
-- the first two migrations did not notice:
--
--   1. `anon` held 28 grants in `public`. An anonymous reader was answered with
--      200 and an empty body where it should have been refused outright. RLS
--      still returned no rows, so nothing leaked — but "refused" and "allowed,
--      and there happened to be nothing" are different postures, and only one
--      of them stays safe when a policy is later edited.
--
--   2. `delete from items` silently affected zero rows instead of being
--      refused. RLS with no DELETE policy deletes nothing and reports success.
--      A silent no-op is worse than an error: the application would have shown
--      the owner a confirmation for an archive that never happened.
--
--   3. The same silent no-op on `unit_dimensions`, which is reference data no
--      tenant should be able to touch at all.
--
--   4. `create_organization()` was callable signed out. 0001 revoked it from
--      PUBLIC, which does not remove an explicit grant to `anon`.
--
-- The rule from here: grants are stated per table, verb by verb, and `anon`
-- gets nothing except the two functions it deliberately needs.

-- ---------------------------------------------------------------------------
-- Stop the defaults applying to anything created from now on
-- ---------------------------------------------------------------------------

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on routines from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- ---------------------------------------------------------------------------
-- Take back everything, then hand back exactly what is needed
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines in schema public from anon;

revoke all on all tables in schema public from authenticated;

-- organizations: founded only through create_organization(), archived never
-- deleted, so neither insert nor delete is granted.
grant select, update on public.organizations to authenticated;

-- memberships: an owner adds and removes people, so delete belongs here. It is
-- the only table in the schema a tenant may delete from.
grant select, insert, update, delete on public.memberships to authenticated;

-- units: an org may add its own; a seeded one is protected by the policy. No
-- delete: a unit in use by an item must not be able to vanish.
grant select, insert, update on public.units to authenticated;

-- item_categories and items: archived, never deleted. An item stays on every
-- movement, recipe, run and sale it was ever part of.
grant select, insert, update on public.item_categories to authenticated;
grant select, insert, update on public.items to authenticated;

-- unit_dimensions: the six dimensions are the six dimensions.
grant select on public.unit_dimensions to authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

grant execute on function public.my_org_ids() to authenticated;
grant execute on function public.my_role(uuid) to authenticated;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.convert_to_base(uuid, numeric, uuid) to authenticated;

-- The one deliberate exception for `anon`, carried over from 0001 and restated
-- here because the blanket revoke above would otherwise have removed it.
--
-- Signed out, auth.uid() is null and both functions return an empty set, which
-- is the correct answer. Revoking them would turn a clean empty result into a
-- permission error on every signed-out request, which the client would have to
-- special-case. They read nothing a caller could not already read.
grant execute on function public.my_org_ids() to anon;
grant execute on function public.my_role(uuid) to anon;

-- create_organization stays revoked from anon. Signed out it raises 'Not signed
-- in', and a function that fails differently depending on its input is a probe.
revoke execute on function public.create_organization(text) from anon;
revoke execute on function public.convert_to_base(uuid, numeric, uuid) from anon;
