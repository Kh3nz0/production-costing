-- 0005 Stock is a ledger, not a number
--
-- Receiving already wrote movements, because it could not work otherwise. This
-- adds the three things that make the ledger the whole truth about stock:
-- adjustments, opening balances, and valuation as of a past date.
--
-- Valuation is a lookup rather than a replay. Every movement stores the quantity
-- and average that resulted from it, so "what was this worth on 16 September"
-- reads one row per item instead of re-adding the history — and it stays correct
-- after later receipts, because a later row cannot change an earlier one.

-- ---------------------------------------------------------------------------
-- The shared refusal
--
-- Negative stock is blocked (FR-15). The message names the item, the shortfall
-- and the two ways out, in the words the content spec fixes.
-- ---------------------------------------------------------------------------

create or replace function public.refuse_negative_stock(
  p_item_name text,
  p_qty       numeric,
  p_unit_code text
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  -- Postgres substitutes % positionally, in order. FM strips trailing zeros but
  -- leaves the decimal point behind, so "-40.000000" becomes "-40." and needs
  -- the rtrim as well. The message reads "-40 g", not "-40. g".
  raise exception 'This would leave % % of %. Record a purchase or an opening balance first, or reduce the quantity.',
    rtrim(trim(to_char(p_qty, 'FM999999999990.999999')), '.'), p_unit_code, p_item_name
    using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- Adjusting stock
--
-- The user states what is actually on the shelf; the difference is what gets
-- recorded. An adjustment never changes the average cost: only a receipt does
-- that (F-02). Consumption and shrinkage are valued at the average in force at
-- the moment they happen, which is stored on the row so the figure is
-- reproducible later (F-03).
-- ---------------------------------------------------------------------------

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

  if public.my_role(v_item.org_id) not in ('owner', 'manager', 'inventory') then
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

comment on function public.adjust_stock(uuid, numeric, public.movement_type, text, timestamptz) is
  'Records the difference between what the system shows and what is actually there. Never changes the average cost: only a receipt does that.';

revoke execute on function public.adjust_stock(uuid, numeric, public.movement_type, text, timestamptz)
  from public, anon;
grant execute on function public.adjust_stock(uuid, numeric, public.movement_type, text, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Opening balances
--
-- For stock already owned, with no purchase behind it. The cost is optional on
-- purpose: an item with no unit cost is more honest than an item with a guessed
-- one, and it will pick up a real cost at the next purchase.
--
-- Only valid as an item's first movement. Allowing it later would make it a back
-- door for setting the average cost directly, which is the one number in this
-- system that must always be derived.
-- ---------------------------------------------------------------------------

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

  if public.my_role(v_item.org_id) not in ('owner', 'manager', 'inventory') then
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

revoke execute on function public.record_opening_balance(uuid, numeric, numeric, timestamptz)
  from public, anon;
grant execute on function public.record_opening_balance(uuid, numeric, numeric, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Valuation as of a date
--
-- One row per item: the last movement at or before the date, and the quantity
-- and average it resulted in. A lookup, not a replay, and unaffected by
-- movements recorded afterwards.
-- ---------------------------------------------------------------------------

create or replace function public.inventory_valuation(
  p_org_id uuid,
  p_as_of  timestamptz default now()
)
returns table (
  item_id      uuid,
  item_name    text,
  item_type    public.item_type,
  unit_code    text,
  quantity     numeric,
  unit_cost    numeric,
  value_cents  bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    i.id,
    i.name,
    i.item_type,
    u.code,
    coalesce(m.resulting_qty, 0),
    m.resulting_avg_cost,
    case
      when m.resulting_avg_cost is null then null
      else round(coalesce(m.resulting_qty, 0) * m.resulting_avg_cost * 100)::bigint
    end
  from public.items i
  join public.units u on u.id = i.base_unit_id
  left join lateral (
    select mv.resulting_qty, mv.resulting_avg_cost
    from public.inventory_movements mv
    where mv.item_id = i.id
      and mv.occurred_at <= p_as_of
    order by mv.occurred_at desc, mv.seq desc
    limit 1
  ) m on true
  where i.org_id = p_org_id
  order by i.name, i.id;
$$;

comment on function public.inventory_valuation(uuid, timestamptz) is
  'What stock was worth on a date, from the quantity and average each item''s last movement at or before it resulted in. security invoker, so RLS on items and inventory_movements still applies.';

revoke execute on function public.inventory_valuation(uuid, timestamptz) from public, anon;
grant execute on function public.inventory_valuation(uuid, timestamptz) to authenticated;
