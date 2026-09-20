-- 0011_role_guards_are_null_safe.sql
--
-- A non-member could write to another organisation's stock.
--
-- Four functions guarded themselves with
--
--     if public.my_role(org) not in ('owner', 'manager', 'inventory') then
--       raise exception '...';
--     end if;
--
-- and `my_role` returns NULL for somebody who is not a member at all. In SQL,
-- `NULL not in (...)` is NULL, not true, so the `if` body never ran and the
-- function carried on to do the work. Proven against a real Postgres: a user
-- belonging to no organisation called `record_opening_balance` and
-- `adjust_stock` on another organisation's item and both succeeded.
--
-- Row level security does not catch this. These functions are `security
-- definer` precisely so they can write `inventory_movements`, which by D-115
-- has no insert policy at all — the RPC is the only way a movement can be
-- written, so the role check inside it is the only thing standing there.
--
-- The guard is now `coalesce(my_role(org)::text, '') not in (...)`, so a
-- non-member compares as the empty string and is refused. 0006's rate
-- functions used `is distinct from` and were never affected; 0007's used
-- `is null` and were never affected.
--
-- Every function below is otherwise byte-for-byte its current text: receive_purchase
-- from 0009, rebuild_item_balances from 0004, adjust_stock and
-- record_opening_balance from 0005. Applied migrations are not edited.

-- receive_purchase: 1 guard
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

  if coalesce(public.my_role(v_purchase.org_id)::text, '') not in ('owner', 'manager', 'inventory') then
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

    -- F-02 moving weighted average, with the exception in D-126.
    v_new_qty := v_item.qty_on_hand + v_qty_base;
    if v_item.avg_unit_cost is null then
      -- Nothing on the shelf has an established cost, either because there is
      -- nothing there or because it arrived by adjustment. Blending it in at
      -- zero would turn "nobody has worked this out" into "it was free" and
      -- leave an average below anything ever paid, with nothing on screen to
      -- say so. The price just paid is the only cost anyone has established
      -- for this item, so it stands for the whole pile.
      v_new_avg := v_unit_cost;
    else
      v_new_value := (v_item.qty_on_hand * v_item.avg_unit_cost)
                   + (v_landed::numeric / 100);
      v_new_avg := v_new_value / v_new_qty;
    end if;

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

-- rebuild_item_balances: 1 guard
create or replace function public.rebuild_item_balances(p_org_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
begin
  if coalesce(public.my_role(p_org_id)::text, '') not in ('owner', 'manager') then
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

-- adjust_stock: 1 guard
create or replace function public.adjust_stock(
  p_item_id       uuid,
  p_new_qty       numeric,
  p_movement_type public.movement_type,
  p_reason        text,
  p_occurred_at   timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_item     public.items;
  v_unit     public.units;
  v_delta    numeric;
  v_cost     bigint;
  v_movement uuid;
begin
  if p_movement_type not in ('adjustment', 'damage', 'waste') then
    raise exception 'adjust_stock records an adjustment, damage or waste, not %', p_movement_type
      using errcode = '22023';
  end if;

  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'A reason is required. Future you will want to know why this number moved.'
      using errcode = '22023';
  end if;

  -- Lock the item: two adjustments to one item must not both read the same
  -- starting balance.
  select * into v_item from public.items where id = p_item_id for update;
  if not found then
    raise exception 'Item not found' using errcode = 'no_data_found';
  end if;

  if coalesce(public.my_role(v_item.org_id)::text, '') not in ('owner', 'manager', 'inventory') then
    raise exception 'You do not have permission to adjust stock' using errcode = '42501';
  end if;

  select * into v_unit from public.units where id = v_item.base_unit_id;

  if p_new_qty < 0 then
    perform public.refuse_negative_stock(v_item.name, p_new_qty, v_unit.code);
  end if;

  v_delta := p_new_qty - v_item.qty_on_hand;
  if v_delta = 0 then
    raise exception 'That is already the quantity on hand, so there is nothing to record'
      using errcode = '22023';
  end if;

  -- Signed value change, at the average in force. Null average means the item
  -- has never been costed, so the movement has no value effect to record.
  v_cost := case
    when v_item.avg_unit_cost is null then null
    else round(v_delta * v_item.avg_unit_cost * 100)::bigint
  end;

  insert into public.inventory_movements (
    org_id, item_id, movement_type, quantity_change, unit_id, quantity_entered,
    unit_cost_at_movement, cost_effect_cents, resulting_qty, resulting_avg_cost,
    source_table, reason, occurred_at, created_by
  ) values (
    v_item.org_id, p_item_id, p_movement_type, v_delta, v_item.base_unit_id, p_new_qty,
    v_item.avg_unit_cost, v_cost, p_new_qty, v_item.avg_unit_cost,
    'adjustments', btrim(p_reason), p_occurred_at, v_user
  )
  returning id into v_movement;

  update public.items
  set qty_on_hand = p_new_qty,
      updated_at = now(),
      updated_by = v_user
  where id = p_item_id;

  return v_movement;
end;
$$;

-- record_opening_balance: 1 guard
create or replace function public.record_opening_balance(
  p_item_id     uuid,
  p_qty         numeric,
  p_unit_cost   numeric default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_item     public.items;
  v_movement uuid;
begin
  select * into v_item from public.items where id = p_item_id for update;
  if not found then
    raise exception 'Item not found' using errcode = 'no_data_found';
  end if;

  if coalesce(public.my_role(v_item.org_id)::text, '') not in ('owner', 'manager', 'inventory') then
    raise exception 'You do not have permission to record opening balances' using errcode = '42501';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'An opening balance needs a quantity above zero' using errcode = '22023';
  end if;

  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'A unit cost cannot be negative' using errcode = '22023';
  end if;

  if exists (select 1 from public.inventory_movements where item_id = p_item_id) then
    raise exception 'This item already has stock history, so an opening balance would rewrite it. Adjust the stock instead.'
      using errcode = '22023';
  end if;

  insert into public.inventory_movements (
    org_id, item_id, movement_type, quantity_change, unit_id, quantity_entered,
    unit_cost_at_movement, cost_effect_cents, resulting_qty, resulting_avg_cost,
    source_table, occurred_at, created_by
  ) values (
    v_item.org_id, p_item_id, 'opening_balance', p_qty, v_item.base_unit_id, p_qty,
    p_unit_cost,
    case when p_unit_cost is null then null else round(p_qty * p_unit_cost * 100)::bigint end,
    p_qty, p_unit_cost,
    'opening_balances', p_occurred_at, v_user
  )
  returning id into v_movement;

  update public.items
  set qty_on_hand = p_qty,
      avg_unit_cost = p_unit_cost,
      updated_at = now(),
      updated_by = v_user
  where id = p_item_id;

  return v_movement;
end;
$$;

-- The grants are restated because `create or replace` keeps them, but a reader
-- of this file should not have to know that.
revoke execute on function public.receive_purchase(uuid) from public, anon;
grant execute on function public.receive_purchase(uuid) to authenticated;
revoke execute on function public.rebuild_item_balances(uuid) from public, anon;
grant execute on function public.rebuild_item_balances(uuid) to authenticated;
