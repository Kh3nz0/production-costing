-- S7: pricing. A snapshot records what a price assumed, so a figure quoted to
-- a customer can still be explained after the costs and rates behind it move.
--
-- Immutable by construction, like the ledger: no update or delete policy and
-- no update or delete grant. A snapshot that could be edited would answer
-- "what did we assume?" with today's assumptions, which is the one thing it
-- exists not to do.

create table public.pricing_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  item_id uuid not null,
  channel_id uuid,
  taken_at timestamptz not null default now(),

  -- Both costs, because they answer different questions and conflating them is
  -- the error F-09 and F-10 were corrected for. The price is built on the full
  -- cost; the contribution margin is measured after the production cost only.
  pricing_unit_cost numeric(20,8) not null,
  inventory_unit_cost numeric(20,8) not null,

  target_margin numeric(9,6) not null check (target_margin < 1),
  expected_contribution_margin numeric(9,6),
  list_price_cents bigint not null check (list_price_cents >= 0),
  break_even_contribution_cents bigint not null check (break_even_contribution_cents >= 0),
  break_even_overhead_cents bigint not null check (break_even_overhead_cents >= 0),

  -- The channel's terms as they stood, by value. Ids alone would not survive a
  -- fee version being superseded, which is exactly when the question gets asked.
  inputs jsonb not null default '{}'::jsonb,
  notes text,

  created_by uuid not null references auth.users(id),
  foreign key (org_id,item_id) references public.items(org_id,id),
  foreign key (org_id,channel_id) references public.sales_channels(org_id,id)
);

create index pricing_snapshots_item on public.pricing_snapshots(org_id,item_id,taken_at desc,id);

-- ---------------------------------------------------------------------------
-- save_pricing_snapshot
--
-- One row, written by the server from figures the server computed. The client
-- cannot insert directly: a snapshot whose numbers came from the browser would
-- record what the browser believed rather than what the costs were.

create or replace function public.save_pricing_snapshot(
  p_item_id uuid,
  p_channel_id uuid,
  p_pricing_unit_cost numeric,
  p_inventory_unit_cost numeric,
  p_target_margin numeric,
  p_expected_contribution_margin numeric,
  p_list_price_cents bigint,
  p_break_even_contribution_cents bigint,
  p_break_even_overhead_cents bigint,
  p_inputs jsonb default '{}'::jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_id  uuid;
begin
  select org_id into v_org from public.items where id = p_item_id;
  if v_org is null then
    raise exception 'Product not found' using errcode = 'no_data_found';
  end if;
  -- coalesce, not a bare `not in`: my_role is NULL for a non-member and
  -- `NULL not in (...)` is NULL, so the guard would never fire (F-60).
  if coalesce(public.my_role(v_org)::text, '') not in ('owner','manager') then
    raise exception 'You do not have permission to price products' using errcode = '42501';
  end if;
  if p_target_margin is null or p_target_margin >= 1 then
    raise exception 'A margin of 100%% would need an infinite price' using errcode = '22023';
  end if;

  insert into public.pricing_snapshots (
    org_id,item_id,channel_id,pricing_unit_cost,inventory_unit_cost,target_margin,
    expected_contribution_margin,list_price_cents,break_even_contribution_cents,
    break_even_overhead_cents,inputs,notes,created_by
  ) values (
    v_org,p_item_id,p_channel_id,p_pricing_unit_cost,p_inventory_unit_cost,p_target_margin,
    p_expected_contribution_margin,p_list_price_cents,p_break_even_contribution_cents,
    p_break_even_overhead_cents,coalesce(p_inputs,'{}'::jsonb),p_notes,auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_product_pricing
--
-- The target margin lives on product_details, which has no update grant.

create or replace function public.save_product_pricing(
  p_item_id uuid,
  p_target_margin numeric,
  p_minimum_margin numeric default null,
  p_default_channel_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.items where id = p_item_id;
  if v_org is null then
    raise exception 'Product not found' using errcode = 'no_data_found';
  end if;
  if coalesce(public.my_role(v_org)::text, '') not in ('owner','manager') then
    raise exception 'You do not have permission to price products' using errcode = '42501';
  end if;
  if p_target_margin is not null and p_target_margin >= 1 then
    raise exception 'A margin of 100%% would need an infinite price' using errcode = '22023';
  end if;

  update public.product_details
  set target_margin = p_target_margin,
      minimum_margin = coalesce(p_minimum_margin, minimum_margin),
      default_channel_id = coalesce(p_default_channel_id, default_channel_id),
      updated_at = now(),
      updated_by = auth.uid()
  where item_id = p_item_id;

  return p_item_id;
end;
$$;

-- Explicit grants after Supabase's broad defaults. Snapshots are readable and
-- nothing else: they are written by the function above and never changed.
alter table public.pricing_snapshots enable row level security;
alter table public.pricing_snapshots force row level security;
revoke all on public.pricing_snapshots from anon,authenticated;
grant select on public.pricing_snapshots to authenticated;
create policy pricing_snapshots_select on public.pricing_snapshots
  for select to authenticated
  using (public.my_role(org_id) in ('owner','manager'));

revoke all on function public.save_pricing_snapshot(uuid,uuid,numeric,numeric,numeric,numeric,bigint,bigint,bigint,jsonb,text) from public,anon;
grant execute on function public.save_pricing_snapshot(uuid,uuid,numeric,numeric,numeric,numeric,bigint,bigint,bigint,jsonb,text) to authenticated;
revoke all on function public.save_product_pricing(uuid,numeric,numeric,uuid) from public,anon;
grant execute on function public.save_product_pricing(uuid,numeric,numeric,uuid) to authenticated;
