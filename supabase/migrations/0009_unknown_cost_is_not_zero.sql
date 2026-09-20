-- 0009_unknown_cost_is_not_zero.sql
--
-- Stock whose cost nobody has established must not be valued at zero when a
-- purchase is received.
--
-- D-119 settled this for reading: an item with no established cost shows a gap
-- rather than ₱0.00, because it is not worthless, it is worth an amount nobody
-- has worked out. receive_purchase did the opposite. Its moving average read
--
--     (qty_on_hand * coalesce(avg_unit_cost, 0)) + landed
--
-- so 50 units of unknown cost plus 1,000 bought at ₱1.10 produced ₱1.04761905:
-- a guess of ₱0.00 for the unknown stock, folded into a stored average that
-- nothing afterwards marks as suspect. Every product using that material is
-- then costed too cheaply, invisibly.
--
-- This replaces the function with one change: when the prior average is null,
-- the incoming unit cost becomes the item's average instead of being diluted
-- by a pile valued at nothing. Everything else is byte-for-byte the function
-- from 0004, which is not edited: migrations are append-only once applied.
--
-- rebuild_item_balances needs no change. It reads resulting_avg_cost off the
-- last movement rather than recomputing, so the ledger and the cache still
-- cannot disagree.

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

comment on function public.receive_purchase(uuid) is
  'F-01 and F-02 in one transaction: allocates extras, converts to base units, writes a ledger movement per line and rewrites each item''s cached balance from the same numbers. When the item has no established cost, the received unit cost becomes the average rather than being averaged against zero (D-126).';

revoke execute on function public.receive_purchase(uuid) from public, anon;
grant execute on function public.receive_purchase(uuid) to authenticated;
