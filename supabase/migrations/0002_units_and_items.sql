-- 0002 Units and items
--
-- The unified item model: a raw material, a component, a subassembly and a
-- finished product are all rows in `items` (docs/phase3-data-model.md section 3).
--
-- Two kinds of table appear here for the first time:
--   * reference data (`unit_dimensions`) which is global, seeded, and readable
--     by every signed-in user because it is the same for everyone;
--   * partly-global data (`units`) where a null org_id is a seeded unit and a
--     non-null org_id is a unit one organization added for itself.
-- Both are readable without owning them and writable by nobody but the owner of
-- the row, which is what the RLS sweep in src/test/rls.test.ts asserts.

-- ---------------------------------------------------------------------------
-- Unit dimensions. Reference data.
-- ---------------------------------------------------------------------------

create table public.unit_dimensions (
  code text primary key check (code in ('mass', 'count', 'volume', 'length', 'time', 'energy')),
  name text not null
);

insert into public.unit_dimensions (code, name) values
  ('mass', 'Mass'),
  ('count', 'Count'),
  ('volume', 'Volume'),
  ('length', 'Length'),
  ('time', 'Time'),
  ('energy', 'Energy');

alter table public.unit_dimensions enable row level security;
alter table public.unit_dimensions force row level security;

create policy unit_dimensions_select on public.unit_dimensions
  for select to authenticated using (true);

-- No insert, update or delete policy and no write grant: the six dimensions are
-- the six dimensions.
grant select on public.unit_dimensions to authenticated;

-- ---------------------------------------------------------------------------
-- Units
--
-- factor_to_dimension_base converts within a dimension: 1 kg is 1000 g.
-- Crossing dimensions is never inferred from these factors — that needs the
-- item-level factor below (F-04 rule 2).
-- ---------------------------------------------------------------------------

create table public.units (
  id      uuid primary key default gen_random_uuid(),
  -- Null means a seeded unit shared by everyone. Non-null means one
  -- organization added it for itself.
  org_id  uuid references public.organizations (id) on delete cascade,
  code    text not null check (length(btrim(code)) between 1 and 16),
  name    text not null,
  dimension_code text not null references public.unit_dimensions (code),
  factor_to_dimension_base numeric(20, 8) not null check (factor_to_dimension_base > 0),
  is_dimension_base boolean not null default false,

  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),
  archived_at timestamptz
);

-- A seeded unit and an org's own unit may share a code, but an org cannot have
-- two units with the same code. Two partial indexes rather than one, because a
-- unique constraint treats every null org_id as distinct.
create unique index units_code_global_unique on public.units (code) where org_id is null;
create unique index units_code_org_unique on public.units (org_id, code) where org_id is not null;
create index units_dimension_idx on public.units (dimension_code);
create unique index units_one_base_per_dimension
  on public.units (dimension_code) where is_dimension_base and org_id is null;

create trigger units_set_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

insert into public.units (code, name, dimension_code, factor_to_dimension_base, is_dimension_base) values
  -- mass, base gram
  ('mg', 'Milligram', 'mass', 0.001, false),
  ('g', 'Gram', 'mass', 1, true),
  ('kg', 'Kilogram', 'mass', 1000, false),
  -- count, base piece. A spool, pack, roll or sheet is one of a thing you buy;
  -- how much is inside one is an item-level fact, not a unit-level one.
  ('pc', 'Piece', 'count', 1, true),
  ('pack', 'Pack', 'count', 1, false),
  ('spool', 'Spool', 'count', 1, false),
  ('roll', 'Roll', 'count', 1, false),
  ('box', 'Box', 'count', 1, false),
  ('set', 'Set', 'count', 1, false),
  ('sheet', 'Sheet', 'count', 1, false),
  ('bottle', 'Bottle', 'count', 1, false),
  -- volume, base millilitre
  ('ml', 'Millilitre', 'volume', 1, true),
  ('l', 'Litre', 'volume', 1000, false),
  -- length, base millimetre
  ('mm', 'Millimetre', 'length', 1, true),
  ('cm', 'Centimetre', 'length', 10, false),
  ('m', 'Metre', 'length', 1000, false),
  -- time, base minute
  ('min', 'Minute', 'time', 1, true),
  ('hr', 'Hour', 'time', 60, false),
  -- energy, base watt hour
  ('Wh', 'Watt hour', 'energy', 1, true),
  ('kWh', 'Kilowatt hour', 'energy', 1000, false);

alter table public.units enable row level security;
alter table public.units force row level security;

create policy units_select on public.units
  for select to authenticated
  using (org_id is null or org_id in (select public.my_org_ids()));

-- An org may add its own unit. It may never write a global one: `org_id is not
-- null` in the check is what stops a tenant editing shared reference data.
create policy units_insert on public.units
  for insert to authenticated
  with check (org_id is not null and public.my_role(org_id) in ('owner', 'manager'));

create policy units_update on public.units
  for update to authenticated
  using (org_id is not null and public.my_role(org_id) in ('owner', 'manager'))
  with check (org_id is not null and public.my_role(org_id) in ('owner', 'manager'));

grant select, insert, update on public.units to authenticated;

-- ---------------------------------------------------------------------------
-- Item categories
-- ---------------------------------------------------------------------------

create table public.item_categories (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references public.organizations (id) on delete cascade,
  name      text not null check (length(btrim(name)) between 1 and 120),
  parent_id uuid references public.item_categories (id) on delete set null,

  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),
  archived_at timestamptz,

  constraint item_categories_name_unique unique (org_id, name)
);

create index item_categories_org_idx on public.item_categories (org_id);

create trigger item_categories_set_updated_at
  before update on public.item_categories
  for each row execute function public.set_updated_at();

alter table public.item_categories enable row level security;
alter table public.item_categories force row level security;

create policy item_categories_select on public.item_categories
  for select to authenticated using (org_id in (select public.my_org_ids()));
create policy item_categories_insert on public.item_categories
  for insert to authenticated with check (public.my_role(org_id) in ('owner', 'manager'));
create policy item_categories_update on public.item_categories
  for update to authenticated
  using (public.my_role(org_id) in ('owner', 'manager'))
  with check (public.my_role(org_id) in ('owner', 'manager'));

grant select, insert, update on public.item_categories to authenticated;

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------

create type public.item_type as enum (
  'raw_material',
  'purchased_component',
  'packaging',
  'consumable',
  'subassembly',
  'finished_product'
);

create table public.items (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references public.organizations (id) on delete cascade,
  name      text not null check (length(btrim(name)) between 1 and 200),
  sku       text check (length(btrim(sku)) between 1 and 60),
  item_type public.item_type not null,

  category_id        uuid references public.item_categories (id) on delete set null,
  parent_item_id     uuid references public.items (id) on delete set null,
  variant_attributes jsonb not null default '{}'::jsonb,

  brand       text,
  colour      text,
  description text,
  notes       text,
  image_path  text,

  -- The unit stock is held and consumed in. Never null: everything in this
  -- system is counted in something.
  base_unit_id     uuid not null references public.units (id),
  purchase_unit_id uuid references public.units (id),
  -- 1000 for a 1 kg spool consumed in grams, 90 for a 90-piece pack consumed in
  -- pieces. This is the authority for purchase-to-base conversion and it
  -- outranks dimension factors: a pack and a piece are both `count`, so
  -- dimension arithmetic would say one pack is one piece.
  purchase_to_base_factor numeric(20, 8) check (purchase_to_base_factor > 0),

  reorder_point            numeric(20, 6) check (reorder_point >= 0),
  preferred_supplier_id    uuid,
  supplier_lead_time_days  int check (supplier_lead_time_days >= 0),

  -- Caches maintained by the inventory ledger from S4. Nothing writes them yet.
  qty_on_hand   numeric(20, 6) not null default 0,
  avg_unit_cost numeric(20, 8),
  is_costed     boolean not null default true,

  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),
  archived_at timestamptz,

  -- A purchase unit that differs from the base unit is meaningless without the
  -- factor that relates them. Refusing it here means no row can exist that the
  -- costing engine cannot convert.
  constraint items_purchase_factor_required check (
    purchase_unit_id is null
    or purchase_unit_id = base_unit_id
    or purchase_to_base_factor is not null
  ),
  constraint items_not_own_parent check (parent_item_id is null or parent_item_id <> id)
);

create index items_org_type_idx on public.items (org_id, item_type);
create index items_org_name_idx on public.items (org_id, name);
create unique index items_org_sku_unique on public.items (org_id, sku) where sku is not null;
create index items_org_parent_idx on public.items (org_id, parent_item_id);
create index items_active_idx on public.items (org_id, item_type) where archived_at is null;

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

alter table public.items enable row level security;
alter table public.items force row level security;

create policy items_select on public.items
  for select to authenticated using (org_id in (select public.my_org_ids()));
create policy items_insert on public.items
  for insert to authenticated
  with check (public.my_role(org_id) in ('owner', 'manager', 'inventory'));
create policy items_update on public.items
  for update to authenticated
  using (public.my_role(org_id) in ('owner', 'manager', 'inventory'))
  with check (public.my_role(org_id) in ('owner', 'manager', 'inventory'));

-- No delete policy. An item is archived, never deleted: it stays on every
-- historical movement, recipe, run and sale (docs/phase3-data-model.md s12).
grant select, insert, update on public.items to authenticated;

-- ---------------------------------------------------------------------------
-- F-04 Unit conversion
--
--   qty_in_base = qty_in_unit x factor_to_base(unit)
--
-- Order matters, and it is not the order the dimension table would suggest:
--   1. the base unit itself converts one to one;
--   2. the item's own purchase-to-base factor, if the unit is its purchase unit;
--   3. dimension factors, when both units share a dimension;
--   4. otherwise refuse, naming both units.
--
-- Step 2 sits above step 3 deliberately. A pack and a piece are both `count`,
-- so step 3 alone would convert a pack of 90 switches into one piece and every
-- material cost downstream would be wrong by a factor of ninety.
-- ---------------------------------------------------------------------------

create or replace function public.convert_to_base(
  p_item_id uuid,
  p_qty     numeric,
  p_unit_id uuid
)
returns numeric
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_item   public.items;
  v_from   public.units;
  v_base   public.units;
begin
  select * into v_item from public.items where id = p_item_id;
  if not found then
    raise exception 'Item not found' using errcode = 'no_data_found';
  end if;

  select * into v_from from public.units where id = p_unit_id;
  if not found then
    raise exception 'Unit not found' using errcode = 'no_data_found';
  end if;

  select * into v_base from public.units where id = v_item.base_unit_id;

  -- 1. already in base units
  if p_unit_id = v_item.base_unit_id then
    return p_qty;
  end if;

  -- 2. the item's own factor, which outranks dimension arithmetic
  if p_unit_id = v_item.purchase_unit_id and v_item.purchase_to_base_factor is not null then
    return p_qty * v_item.purchase_to_base_factor;
  end if;

  -- 3. same dimension, so the stored factors relate them
  if v_from.dimension_code = v_base.dimension_code then
    return p_qty * v_from.factor_to_dimension_base / v_base.factor_to_dimension_base;
  end if;

  -- 4. no defined relationship. Name both units and the item, and say what to
  -- do about it. Never silently pass (F-04 rule 3).
  raise exception 'There is no conversion between % and % for %. Set how many % are in one % on the item first.',
    v_base.name, v_from.name, v_item.name, v_base.name, v_from.name
    using errcode = 'data_exception';
end;
$$;

comment on function public.convert_to_base(uuid, numeric, uuid) is
  'F-04. Converts a quantity into an item''s base unit. The item factor outranks dimension factors; an undefined relationship raises rather than guessing.';

grant execute on function public.convert_to_base(uuid, numeric, uuid) to authenticated;
