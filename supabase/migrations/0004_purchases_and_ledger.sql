-- 0004 Purchases and the inventory ledger
--
-- A purchase becomes stock with a derived cost. Three things in here are load
-- bearing and none of them is negotiable later:
--
--   1. Money is bigint centavos, suffixed _cents. Never a float, never numeric
--      for an amount.
--   2. allocated_landed_cost_cents, landed_total_cents and receipt_unit_cost are
--      computed at receipt and STORED. Recomputing them on read would let a
--      later edit to the purchase change the cost of stock already consumed,
--      which is the whole reason this system exists.
--   3. inventory_movements is append-only. No update, no delete, no archived_at.
--      A correction is a new reversing row. Grants and policies below enforce
--      that rather than trusting the application to remember it.

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------

create table public.suppliers (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name   text not null check (length(btrim(name)) between 1 and 200),

  contact_person         text,
  phone                  text,
  email                  text,
  address                text,
  platform_or_store      text,
  typical_lead_time_days int check (typical_lead_time_days >= 0),
  notes                  text,

  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),
  archived_at timestamptz,

  constraint suppliers_name_unique unique (org_id, name)
);

create index suppliers_org_idx on public.suppliers (org_id);

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- items.preferred_supplier_id was declared in 0002 without its foreign key,
-- because suppliers did not exist yet. It does now.
alter table public.items
  add constraint items_preferred_supplier_fkey
  foreign key (preferred_supplier_id) references public.suppliers (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Purchases
-- ---------------------------------------------------------------------------

create type public.landed_cost_base as enum ('value', 'quantity', 'weight');

create type public.vat_treatment as enum (
  'inclusive_non_recoverable',
  'exclusive',
  'exempt',
  'zero_rated'
);

create type public.purchase_status as enum (
  'draft',
  'received',
  'partially_received',
  'cancelled'
);

create type public.payment_status as enum ('unpaid', 'paid');

create table public.purchases (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  supplier_id   uuid references public.suppliers (id) on delete set null,
  reference_no  text,
  purchase_date date not null,

  -- The extras that get spread across the lines.
  supplier_shipping_cents bigint not null default 0 check (supplier_shipping_cents >= 0),
  duties_cents            bigint not null default 0 check (duties_cents >= 0),
  other_landed_cost_cents bigint not null default 0 check (other_landed_cost_cents >= 0),
  discount_cents          bigint not null default 0 check (discount_cents >= 0),

  landed_cost_base public.landed_cost_base not null default 'value',
  vat_treatment    public.vat_treatment not null default 'inclusive_non_recoverable',
  vat_amount_cents bigint not null default 0 check (vat_amount_cents >= 0),
  payment_status   public.payment_status not null default 'unpaid',
  receipt_path     text,
  status           public.purchase_status not null default 'draft',
  notes            text,

  received_at timestamptz,

  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),
  archived_at timestamptz,

  constraint purchases_reference_unique unique (org_id, reference_no)
);

create index purchases_org_date_idx on public.purchases (org_id, purchase_date desc, id);
create index purchases_org_status_idx on public.purchases (org_id, status);

create trigger purchases_set_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

create table public.purchase_lines (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  item_id     uuid not null references public.items (id),

  qty_ordered      numeric(20, 6) not null check (qty_ordered > 0),
  qty_received     numeric(20, 6) check (qty_received > 0),
  purchase_unit_id uuid not null references public.units (id),

  unit_price_cents    bigint not null check (unit_price_cents >= 0),
  line_discount_cents bigint not null default 0 check (line_discount_cents >= 0),
  line_weight         numeric(20, 6) check (line_weight >= 0),

  -- Computed at receipt and stored. Null until then.
  allocated_landed_cost_cents bigint,
  landed_total_cents          bigint,
  receipt_unit_cost           numeric(20, 8),

  notes text,

  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

create index purchase_lines_purchase_idx on public.purchase_lines (purchase_id);
create index purchase_lines_org_item_idx on public.purchase_lines (org_id, item_id);

create trigger purchase_lines_set_updated_at
  before update on public.purchase_lines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- The inventory ledger
-- ---------------------------------------------------------------------------

create type public.movement_type as enum (
  'opening_balance',
  'purchase_received',
  'production_consumption',
  'production_output',
  'production_failure',
  'waste',
  'sale',
  'customer_return',
  'supplier_return',
  'damage',
  'adjustment'
);

create table public.inventory_movements (
  id      uuid primary key default gen_random_uuid(),
  -- The ledger's own order. `occurred_at` is business time and ties freely: a
  -- purchase dated 16 Sep writes every one of its movements with that same
  -- timestamp, and `created_at` ties too because now() is transaction-stable.
  -- Ordering by a uuid to break the tie is ordering at random, which quietly
  -- made rebuild_item_balances pick the wrong "latest" row. An append-only
  -- ledger's truth is the order it was appended in, so it gets a sequence.
  seq     bigint generated always as identity,
  org_id  uuid not null references public.organizations (id) on delete cascade,
  item_id uuid not null references public.items (id),

  movement_type   public.movement_type not null,
  quantity_change numeric(20, 6) not null check (quantity_change <> 0),
  unit_id         uuid not null references public.units (id),
  quantity_entered numeric(20, 6),

  unit_cost_at_movement numeric(20, 8),
  cost_effect_cents     bigint,

  -- Stored on every row, which is what makes valuation as of a past date a
  -- lookup rather than a replay, and "why did this cost move" answerable.
  resulting_qty      numeric(20, 6) not null,
  resulting_avg_cost numeric(20, 8),

  source_table text,
  source_id    uuid,
  reason       text,
  occurred_at  timestamptz not null default now(),
  reversal_of_id uuid references public.inventory_movements (id),

  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),

  -- A reason is not optional on the movement types that exist to explain
  -- themselves.
  constraint inventory_movements_reason_required check (
    movement_type not in ('adjustment', 'waste', 'damage')
    or (reason is not null and length(btrim(reason)) > 0)
  )
);

create unique index inventory_movements_seq_unique on public.inventory_movements (seq);
create index inventory_movements_item_seq_idx
  on public.inventory_movements (org_id, item_id, seq);
create index inventory_movements_item_time_idx
  on public.inventory_movements (org_id, item_id, occurred_at, seq);
create index inventory_movements_type_time_idx
  on public.inventory_movements (org_id, movement_type, occurred_at);
create index inventory_movements_source_idx
  on public.inventory_movements (org_id, source_table, source_id);

-- No updated_at trigger and no archived_at. This table is append-only.

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.suppliers enable row level security;
alter table public.suppliers force row level security;
alter table public.purchases enable row level security;
alter table public.purchases force row level security;
alter table public.purchase_lines enable row level security;
alter table public.purchase_lines force row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_movements force row level security;

create policy suppliers_select on public.suppliers
  for select to authenticated using (org_id in (select public.my_org_ids()));
create policy suppliers_insert on public.suppliers
  for insert to authenticated
  with check (public.my_role(org_id) in ('owner', 'manager', 'inventory'));
create policy suppliers_update on public.suppliers
  for update to authenticated
  using (public.my_role(org_id) in ('owner', 'manager', 'inventory'))
  with check (public.my_role(org_id) in ('owner', 'manager', 'inventory'));

create policy purchases_select on public.purchases
  for select to authenticated using (org_id in (select public.my_org_ids()));
create policy purchases_insert on public.purchases
  for insert to authenticated
  with check (public.my_role(org_id) in ('owner', 'manager', 'inventory'));
-- A received purchase is closed to editing. Its figures are now the cost of
-- stock that may already have been consumed.
create policy purchases_update on public.purchases
  for update to authenticated
  using (public.my_role(org_id) in ('owner', 'manager', 'inventory') and status = 'draft')
  with check (public.my_role(org_id) in ('owner', 'manager', 'inventory'));

create policy purchase_lines_select on public.purchase_lines
  for select to authenticated using (org_id in (select public.my_org_ids()));
create policy purchase_lines_insert on public.purchase_lines
  for insert to authenticated
  with check (
    public.my_role(org_id) in ('owner', 'manager', 'inventory')
    and exists (
      select 1 from public.purchases p
      where p.id = purchase_lines.purchase_id and p.status = 'draft'
    )
  );
create policy purchase_lines_update on public.purchase_lines
  for update to authenticated
  using (
    public.my_role(org_id) in ('owner', 'manager', 'inventory')
    and exists (
      select 1 from public.purchases p
      where p.id = purchase_lines.purchase_id and p.status = 'draft'
    )
  )
  with check (public.my_role(org_id) in ('owner', 'manager', 'inventory'));
create policy purchase_lines_delete on public.purchase_lines
  for delete to authenticated
  using (
    public.my_role(org_id) in ('owner', 'manager', 'inventory')
    and exists (
      select 1 from public.purchases p
      where p.id = purchase_lines.purchase_id and p.status = 'draft'
    )
  );

-- The ledger is readable and nothing else. Rows are written by the RPCs, which
-- are security definer. There is no insert, update or delete policy at all: a
-- movement cannot be created by hand, so the balance cache and the ledger cannot
-- be made to disagree by anything the client does.
create policy inventory_movements_select on public.inventory_movements
  for select to authenticated using (org_id in (select public.my_org_ids()));

-- ---------------------------------------------------------------------------
-- Grants, stated per table and per verb (D-110)
-- ---------------------------------------------------------------------------

revoke all on public.suppliers from anon, authenticated;
revoke all on public.purchases from anon, authenticated;
revoke all on public.purchase_lines from anon, authenticated;
revoke all on public.inventory_movements from anon, authenticated;

grant select, insert, update on public.suppliers to authenticated;
grant select, insert, update on public.purchases to authenticated;
-- A draft line may be removed before the purchase is received. After receipt the
-- policy above closes the door.
grant select, insert, update, delete on public.purchase_lines to authenticated;
grant select on public.inventory_movements to authenticated;

-- ---------------------------------------------------------------------------
-- Allocation
--
-- Kept as a pure function over arrays so it can be tested on its own and pinned
-- against the TypeScript implementation in Money.allocate. One rule, two
-- implementations, and a test that fails if they ever disagree.
--
-- Each share rounds half-up, then the residual centavo goes to the largest
-- weight. The spec states it directly: "allocation remainders go to the largest
-- line, so allocations always reconcile to the total."
-- ---------------------------------------------------------------------------

create or replace function public.allocate_cents(p_total bigint, p_weights numeric[])
returns bigint[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_sum      numeric := 0;
  v_shares   bigint[] := '{}';
  v_residual bigint;
  v_largest  int := 1;
  w          numeric;
  i          int;
begin
  if array_length(p_weights, 1) is null then
    raise exception 'Cannot allocate across zero lines' using errcode = '22023';
  end if;

  foreach w in array p_weights loop
    if w < 0 then
      raise exception 'Cannot allocate across a negative weight' using errcode = '22023';
    end if;
    v_sum := v_sum + w;
  end loop;

  if v_sum = 0 then
    raise exception 'Cannot allocate across weights that sum to zero' using errcode = '22023';
  end if;

  for i in 1 .. array_length(p_weights, 1) loop
    v_shares := v_shares || round(p_total * p_weights[i] / v_sum)::bigint;
    if p_weights[i] > p_weights[v_largest] then
      v_largest := i;
    end if;
  end loop;

  select p_total - coalesce(sum(s), 0) into v_residual from unnest(v_shares) as s;
  if v_residual <> 0 then
    v_shares[v_largest] := v_shares[v_largest] + v_residual;
  end if;

  return v_shares;
end;
$$;

comment on function public.allocate_cents(bigint, numeric[]) is
  'F-01 allocation. Shares round half-up and the residual centavo goes to the largest weight, so the parts always sum to the total.';

grant execute on function public.allocate_cents(bigint, numeric[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Receiving a purchase
--
-- One transaction. Every line becomes a ledger movement, every affected item's
-- cached balance is rewritten from the same numbers, and the purchase closes.
--
-- security definer because it writes inventory_movements, which has no insert
-- policy: a movement cannot be created by hand, so the ledger and the cache
-- cannot be made to disagree by anything the client does. The org is taken from
-- the purchase and the caller's role is checked explicitly, so definer rights
-- do not become a way around RLS.
-- ---------------------------------------------------------------------------

create or replace function public.receive_purchase(p_purchase_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase   public.purchases;
  v_user       uuid := (select auth.uid());
  v_extras     bigint;
  v_weights    numeric[] := '{}';
  v_alloc      bigint[];
  v_line_ids   uuid[] := '{}';
  v_dims       text[];
  v_line       record;
  v_item       public.items;
  v_i          int := 0;
  v_qty_base   numeric;
  v_line_net   bigint;
  v_landed     bigint;
  v_unit_cost  numeric(20, 8);
  v_new_qty    numeric;
  v_new_value  numeric;
  v_new_avg    numeric(20, 8);
begin
  -- Lock the purchase first. Two concurrent receipts of the same purchase
  -- serialise here, and the status check below then rejects the second.
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'Purchase not found' using errcode = 'no_data_found';
  end if;

  if public.my_role(v_purchase.org_id) not in ('owner', 'manager', 'inventory') then
    raise exception 'You do not have permission to receive purchases' using errcode = '42501';
  end if;

  if v_purchase.status <> 'draft' then
    raise exception 'This purchase has already been received' using errcode = '22023';
  end if;

  if not exists (select 1 from public.purchase_lines where purchase_id = p_purchase_id) then
    raise exception 'A purchase needs at least one line before it can be received'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.purchase_lines
    where purchase_id = p_purchase_id and coalesce(qty_received, qty_ordered) is null
  ) then
    raise exception 'Every line needs a received quantity' using errcode = '22023';
  end if;

  -- Allocation base validation (F-01).
  if v_purchase.landed_cost_base = 'quantity' then
    select array_agg(distinct u.dimension_code) into v_dims
    from public.purchase_lines pl
    join public.units u on u.id = pl.purchase_unit_id
    where pl.purchase_id = p_purchase_id;

    if array_length(v_dims, 1) > 1 then
      raise exception 'Allocate by quantity is unavailable because this purchase mixes % and %',
        (select u.name from public.units u
         join public.purchase_lines pl on pl.purchase_unit_id = u.id
         where pl.purchase_id = p_purchase_id
         order by u.dimension_code limit 1),
        (select u.name from public.units u
         join public.purchase_lines pl on pl.purchase_unit_id = u.id
         where pl.purchase_id = p_purchase_id
         order by u.dimension_code desc limit 1)
        using errcode = '22023';
    end if;
  elsif v_purchase.landed_cost_base = 'weight' then
    if exists (
      select 1 from public.purchase_lines
      where purchase_id = p_purchase_id and line_weight is null
    ) then
      raise exception 'Allocate by weight needs a weight on every line' using errcode = '22023';
    end if;
  end if;

  v_extras := v_purchase.supplier_shipping_cents
            + v_purchase.duties_cents
            + v_purchase.other_landed_cost_cents
            - v_purchase.discount_cents;

  -- Weights in a fixed order, so the allocation is reproducible.
  for v_line in
    select pl.*, coalesce(pl.qty_received, pl.qty_ordered) as qty
    from public.purchase_lines pl
    where pl.purchase_id = p_purchase_id
    order by pl.item_id, pl.id
  loop
    v_line_ids := v_line_ids || v_line.id;
    v_weights := v_weights || case v_purchase.landed_cost_base
      when 'value' then
        (round(v_line.unit_price_cents * v_line.qty) - v_line.line_discount_cents)::numeric
      when 'quantity' then v_line.qty
      when 'weight' then v_line.line_weight
    end;
  end loop;

  v_alloc := public.allocate_cents(v_extras, v_weights);

  -- Take every item lock up front, in id order. Two concurrent receipts that
  -- touch the same items therefore queue rather than deadlock, which is what
  -- makes the weighted average safe to recompute (D-078).
  perform 1
  from public.items
  where id in (
    select item_id from public.purchase_lines where purchase_id = p_purchase_id
  )
  order by id
  for update;

  for v_line in
    select pl.*, coalesce(pl.qty_received, pl.qty_ordered) as qty
    from public.purchase_lines pl
    where pl.purchase_id = p_purchase_id
    order by pl.item_id, pl.id
  loop
    v_i := v_i + 1;

    -- Re-read inside the loop: two lines may name the same item, and the second
    -- must see the average the first produced.
    select * into v_item from public.items where id = v_line.item_id;

    v_qty_base := public.convert_to_base(v_line.item_id, v_line.qty, v_line.purchase_unit_id);
    if v_qty_base <= 0 then
      raise exception 'A received quantity must be above zero' using errcode = '22023';
    end if;

    v_line_net := round(v_line.unit_price_cents * v_line.qty)::bigint - v_line.line_discount_cents;
    v_landed := v_line_net + v_alloc[v_i];
    v_unit_cost := (v_landed::numeric / 100) / v_qty_base;

    -- F-02 moving weighted average.
    v_new_qty := v_item.qty_on_hand + v_qty_base;
    v_new_value := (v_item.qty_on_hand * coalesce(v_item.avg_unit_cost, 0))
                 + (v_landed::numeric / 100);
    v_new_avg := v_new_value / v_new_qty;

    insert into public.inventory_movements (
      org_id, item_id, movement_type, quantity_change, unit_id, quantity_entered,
      unit_cost_at_movement, cost_effect_cents, resulting_qty, resulting_avg_cost,
      source_table, source_id, occurred_at, created_by
    ) values (
      v_purchase.org_id, v_line.item_id, 'purchase_received', v_qty_base,
      v_line.purchase_unit_id, v_line.qty,
      v_unit_cost, v_landed, v_new_qty, v_new_avg,
      'purchases', p_purchase_id, v_purchase.purchase_date::timestamptz, v_user
    );

    update public.items
    set qty_on_hand = v_new_qty,
        avg_unit_cost = v_new_avg,
        updated_at = now(),
        updated_by = v_user
    where id = v_line.item_id;

    update public.purchase_lines
    set qty_received = v_line.qty,
        allocated_landed_cost_cents = v_alloc[v_i],
        landed_total_cents = v_landed,
        receipt_unit_cost = v_unit_cost,
        updated_at = now(),
        updated_by = v_user
    where id = v_line.id;
  end loop;

  update public.purchases
  set status = 'received',
      received_at = now(),
      updated_at = now(),
      updated_by = v_user
  where id = p_purchase_id;

  return p_purchase_id;
end;
$$;

comment on function public.receive_purchase(uuid) is
  'F-01 and F-02 in one transaction: allocates extras, converts to base units, writes a ledger movement per line and rewrites each item''s cached balance from the same numbers.';

revoke execute on function public.receive_purchase(uuid) from public, anon;
grant execute on function public.receive_purchase(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- rebuild_item_balances
--
-- The ledger is the truth; items.qty_on_hand and items.avg_unit_cost are a
-- cache so item lists do not aggregate on every read. This recomputes the cache
-- from the ledger, and the tests assert the two agree after every mutation.
-- ---------------------------------------------------------------------------

create or replace function public.rebuild_item_balances(p_org_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
begin
  if public.my_role(p_org_id) not in ('owner', 'manager') then
    raise exception 'You do not have permission to rebuild balances' using errcode = '42501';
  end if;

  with latest as (
    select distinct on (item_id) item_id, resulting_qty, resulting_avg_cost
    from public.inventory_movements
    where org_id = p_org_id
    order by item_id, seq desc
  )
  update public.items i
  set qty_on_hand = coalesce(l.resulting_qty, 0),
      avg_unit_cost = l.resulting_avg_cost
  from latest l
  where i.id = l.item_id and i.org_id = p_org_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.rebuild_item_balances(uuid) from public, anon;
grant execute on function public.rebuild_item_balances(uuid) to authenticated;
