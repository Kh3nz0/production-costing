-- S9: a sale shows what it actually earned.
--
-- Two rules the table shape exists to hold.
--
-- 1. **Fees are stored as amounts, never as rates.** The channel's rate is a
--    default that fills the field; what is written is the peso amount the
--    platform actually took. A rate change next month cannot reach back and
--    rewrite what this sale earned.
--
-- 2. **Cost of goods comes out of the stock that was sold**, at the average in
--    force when it left, and is written onto the line. It does not move when
--    material prices move later, for the same reason a completed production run
--    does not.

-- `payment_status` already exists from 0004, where a purchase is unpaid or
-- paid. A sale means the same thing by those words, so it uses the same type
-- rather than a parallel one that would have to be kept in step. Refunds and
-- partial payments are not modelled yet and are not part of S9's criteria.
create type public.fulfilment_status as enum ('unfulfilled','fulfilled','cancelled','returned');
create type public.cost_source as enum ('actual','estimate');

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  sale_date date not null default current_date,
  reference_no text,
  customer_name text,
  channel_id uuid,
  channel_fee_version_id uuid,

  -- Amounts, not rates.
  commission_fee_cents bigint not null default 0 check (commission_fee_cents >= 0),
  payment_fee_cents bigint not null default 0 check (payment_fee_cents >= 0),
  fixed_fee_cents bigint not null default 0 check (fixed_fee_cents >= 0),
  other_costs_cents bigint not null default 0 check (other_costs_cents >= 0),
  shipping_charged_cents bigint not null default 0 check (shipping_charged_cents >= 0),
  shipping_cost_cents bigint not null default 0 check (shipping_cost_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),

  payment_status public.payment_status not null default 'unpaid',
  fulfilment_status public.fulfilment_status not null default 'unfulfilled',

  revenue_cents bigint not null default 0,
  cogs_cents bigint,
  gross_profit_cents bigint,
  net_revenue_cents bigint not null default 0,
  contribution_profit_cents bigint,
  cost_source public.cost_source not null default 'actual',
  notes text,

  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (org_id,id),
  foreign key (org_id,channel_id) references public.sales_channels(org_id,id)
);
create index sales_list on public.sales(org_id,sale_date desc,id desc);

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  sale_id uuid not null,
  item_id uuid not null,
  quantity numeric(20,6) not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  line_discount_cents bigint not null default 0 check (line_discount_cents >= 0),
  -- Written at the moment of sale and never recomputed.
  unit_cogs numeric(20,8),
  line_cogs_cents bigint,
  production_run_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id,id),
  foreign key (org_id,sale_id) references public.sales(org_id,id) on delete cascade,
  foreign key (org_id,item_id) references public.items(org_id,id)
);
create index sale_lines_sale on public.sale_lines(org_id,sale_id,id);
create index sale_lines_item on public.sale_lines(org_id,item_id,id);

-- ---------------------------------------------------------------------------
-- record_sale
--
-- One transaction: a stock movement per line at the average in force, the line
-- costs, the sale's totals, and the status. Any failure rolls all of it back.
--
-- `p_estimated_unit_cogs` on a line is the override the "no costed stock"
-- screen offers. It is only accepted when the item genuinely has no stock to
-- take a cost from, it is computed by the server rather than typed, and it
-- marks the whole sale `cost_source = 'estimate'` so it can be corrected later.

create or replace function public.record_sale(
  p_sale jsonb,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org       uuid;
  v_user      uuid := (select auth.uid());
  v_sale      uuid;
  v_date      date;
  v_line      jsonb;
  v_item      public.items;
  v_unit      public.units;
  v_qty       numeric;
  v_price     bigint;
  v_discount  bigint;
  v_revenue   bigint := 0;
  v_cogs      bigint := 0;
  v_unknown   boolean := false;
  v_estimated boolean := false;
  v_unit_cogs numeric;
  v_line_cogs bigint;
  v_new_qty   numeric;
  v_costs     bigint;
  v_ship_net  bigint;
  v_net       bigint;
begin
  v_org := (p_sale ->> 'org_id')::uuid;
  if coalesce(public.my_role(v_org)::text,'') not in ('owner','manager') then
    raise exception 'You do not have permission to record sales' using errcode = '42501';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'A sale needs at least one line' using errcode = '22023';
  end if;

  v_date := coalesce((p_sale ->> 'sale_date')::date, current_date);

  insert into public.sales (
    org_id,sale_date,reference_no,customer_name,channel_id,channel_fee_version_id,
    commission_fee_cents,payment_fee_cents,fixed_fee_cents,other_costs_cents,
    shipping_charged_cents,shipping_cost_cents,discount_cents,
    payment_status,fulfilment_status,notes,created_by
  ) values (
    v_org,v_date,
    nullif(btrim(coalesce(p_sale ->> 'reference_no','')),''),
    nullif(btrim(coalesce(p_sale ->> 'customer_name','')),''),
    (p_sale ->> 'channel_id')::uuid,
    (p_sale ->> 'channel_fee_version_id')::uuid,
    coalesce((p_sale ->> 'commission_fee_cents')::bigint,0),
    coalesce((p_sale ->> 'payment_fee_cents')::bigint,0),
    coalesce((p_sale ->> 'fixed_fee_cents')::bigint,0),
    coalesce((p_sale ->> 'other_costs_cents')::bigint,0),
    coalesce((p_sale ->> 'shipping_charged_cents')::bigint,0),
    coalesce((p_sale ->> 'shipping_cost_cents')::bigint,0),
    coalesce((p_sale ->> 'discount_cents')::bigint,0),
    coalesce((p_sale ->> 'payment_status')::public.payment_status,'unpaid'),
    coalesce((p_sale ->> 'fulfilment_status')::public.fulfilment_status,'unfulfilled'),
    nullif(btrim(coalesce(p_sale ->> 'notes','')),''),
    v_user
  ) returning id into v_sale;

  -- Every item locked up front in id order, so two sales of the same product
  -- queue rather than deadlock (D-078).
  perform 1 from public.items
  where id in (select (l.value ->> 'item_id')::uuid from jsonb_array_elements(p_lines) l)
  order by id
  for update;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    select * into v_item from public.items where id = (v_line ->> 'item_id')::uuid;
    if not found or v_item.org_id <> v_org then
      raise exception 'Item not found' using errcode = 'no_data_found';
    end if;

    v_qty := (v_line ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Every line needs a quantity above zero' using errcode = '22023';
    end if;
    v_price := coalesce((v_line ->> 'unit_price_cents')::bigint,0);
    v_discount := coalesce((v_line ->> 'line_discount_cents')::bigint,0);
    v_revenue := v_revenue + (round(v_price * v_qty)::bigint - v_discount);

    if v_item.avg_unit_cost is not null and v_item.qty_on_hand >= v_qty then
      -- The ordinary case: the units came out of stock and carry its cost.
      v_unit_cogs := v_item.avg_unit_cost;
      v_line_cogs := round(v_qty * v_unit_cogs * 100)::bigint;
      v_new_qty := v_item.qty_on_hand - v_qty;

      insert into public.inventory_movements (
        org_id,item_id,movement_type,quantity_change,unit_id,quantity_entered,
        unit_cost_at_movement,cost_effect_cents,resulting_qty,resulting_avg_cost,
        source_table,source_id,occurred_at,created_by
      ) values (
        v_org,v_item.id,'sale',-v_qty,v_item.base_unit_id,v_qty,
        v_unit_cogs,-v_line_cogs,v_new_qty,v_item.avg_unit_cost,
        'sales',v_sale,v_date::timestamptz,v_user
      );
      update public.items set qty_on_hand = v_new_qty, updated_at = now(), updated_by = v_user
      where id = v_item.id;

    elsif (v_line ->> 'estimated_unit_cogs') is not null then
      -- The override: no stock to take a cost from, so the sale is recorded
      -- against the product's current estimate and flagged for correction. No
      -- movement is written, because no stock left: there was none.
      v_unit_cogs := (v_line ->> 'estimated_unit_cogs')::numeric;
      v_line_cogs := round(v_qty * v_unit_cogs * 100)::bigint;
      v_estimated := true;

    elsif v_item.qty_on_hand < v_qty then
      select * into v_unit from public.units where id = v_item.base_unit_id;
      perform public.refuse_negative_stock(v_item.name, v_item.qty_on_hand - v_qty, v_unit.code);

    else
      -- Stock exists but nobody has established what it cost. Guessing zero
      -- here would report the sale as pure profit (D-119).
      v_unknown := true;
      v_unit_cogs := null;
      v_line_cogs := null;
      v_new_qty := v_item.qty_on_hand - v_qty;

      insert into public.inventory_movements (
        org_id,item_id,movement_type,quantity_change,unit_id,quantity_entered,
        unit_cost_at_movement,cost_effect_cents,resulting_qty,resulting_avg_cost,
        source_table,source_id,occurred_at,created_by
      ) values (
        v_org,v_item.id,'sale',-v_qty,v_item.base_unit_id,v_qty,
        null,null,v_new_qty,null,
        'sales',v_sale,v_date::timestamptz,v_user
      );
      update public.items set qty_on_hand = v_new_qty, updated_at = now(), updated_by = v_user
      where id = v_item.id;
    end if;

    if v_line_cogs is not null then
      v_cogs := v_cogs + v_line_cogs;
    end if;

    insert into public.sale_lines (
      org_id,sale_id,item_id,quantity,unit_price_cents,line_discount_cents,
      unit_cogs,line_cogs_cents,notes
    ) values (
      v_org,v_sale,v_item.id,v_qty,v_price,v_discount,
      v_unit_cogs,v_line_cogs,nullif(btrim(coalesce(v_line ->> 'notes','')),'')
    );
  end loop;

  -- F-13.
  v_costs := coalesce((p_sale ->> 'commission_fee_cents')::bigint,0)
           + coalesce((p_sale ->> 'payment_fee_cents')::bigint,0)
           + coalesce((p_sale ->> 'fixed_fee_cents')::bigint,0)
           + coalesce((p_sale ->> 'other_costs_cents')::bigint,0);
  v_ship_net := coalesce((p_sale ->> 'shipping_charged_cents')::bigint,0)
              - coalesce((p_sale ->> 'shipping_cost_cents')::bigint,0);
  v_net := v_revenue - v_costs + v_ship_net;

  update public.sales
  set revenue_cents = v_revenue,
      cogs_cents = case when v_unknown then null else v_cogs end,
      gross_profit_cents = case when v_unknown then null else v_revenue - v_cogs end,
      net_revenue_cents = v_net,
      contribution_profit_cents = case when v_unknown then null else v_net - v_cogs end,
      cost_source = (case when v_estimated then 'estimate' else 'actual' end)::public.cost_source,
      updated_at = now(),
      updated_by = v_user
  where id = v_sale;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. A sale's status can be changed; its figures cannot, because they are
-- what the sale earned and that is a fact about a past event.

alter table public.sales enable row level security;
alter table public.sales force row level security;
alter table public.sale_lines enable row level security;
alter table public.sale_lines force row level security;
revoke all on public.sales from anon,authenticated;
revoke all on public.sale_lines from anon,authenticated;
grant select on public.sales to authenticated;
grant select on public.sale_lines to authenticated;
create policy sales_select on public.sales
  for select to authenticated using (public.my_role(org_id) in ('owner','manager'));
create policy sale_lines_select on public.sale_lines
  for select to authenticated using (public.my_role(org_id) in ('owner','manager'));

revoke all on function public.record_sale(jsonb,jsonb) from public,anon;
grant execute on function public.record_sale(jsonb,jsonb) to authenticated;

-- Status is the one thing a sale can be updated for: paid, fulfilled, returned.
create or replace function public.set_sale_status(
  p_sale_id uuid,
  p_payment public.payment_status default null,
  p_fulfilment public.fulfilment_status default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  select org_id into v_org from public.sales where id = p_sale_id;
  if v_org is null then
    raise exception 'Sale not found' using errcode = 'no_data_found';
  end if;
  if coalesce(public.my_role(v_org)::text,'') not in ('owner','manager') then
    raise exception 'You do not have permission to change a sale' using errcode = '42501';
  end if;
  update public.sales
  set payment_status = coalesce(p_payment, payment_status),
      fulfilment_status = coalesce(p_fulfilment, fulfilment_status),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_sale_id;
  return p_sale_id;
end;
$$;

revoke all on function public.set_sale_status(uuid,public.payment_status,public.fulfilment_status) from public,anon;
grant execute on function public.set_sale_status(uuid,public.payment_status,public.fulfilment_status) to authenticated;
