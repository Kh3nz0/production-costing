-- A movement may not be dated before stock history that already exists.
--
-- Every movement stores the balance and average it produced, which is what
-- makes valuation as of a past date a lookup rather than a replay (D-113).
-- That is only sound while movements arrive in business-time order. Record a
-- run dated 1 January today, after a purchase dated 20 September, and the
-- January row carries September's balance — so asking what was held on 31
-- January answers with stock that had not been bought yet.
--
-- Reproduced against a real Postgres before this was written:
--
--     2,000 g received, dated 20 September
--     1,500 g counted,  dated 1 January, recorded afterwards
--     valuation as of 31 January  ->  1,500 g
--
-- A trigger rather than a change to each function: the rule belongs to the
-- ledger, not to the four things that currently write to it, and the next
-- writer inherits it without having to remember.
--
-- The cost, stated: a run you forgot on Monday cannot be recorded on Wednesday
-- if Tuesday already moved that stock. The alternative was to stop promising
-- that a past valuation is exact, and the promise is worth more than the
-- convenience (D-128).

create or replace function public.refuse_out_of_order_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_latest timestamptz;
  v_name   text;
begin
  select max(occurred_at) into v_latest
  from public.inventory_movements
  where item_id = new.item_id;

  -- Compared by date, not by instant. Business time in this system is a date:
  -- a purchase has a purchase_date, a run has a run_date, and both reach the
  -- ledger as midnight. An opening balance recorded at 8pm would otherwise put
  -- every same-day movement "before" it, which is a clock detail masquerading
  -- as a business fact.
  if v_latest is not null and new.occurred_at::date < v_latest::date then
    select name into v_name from public.items where id = new.item_id;
    raise exception
      '% already has stock movements dated % or later, so this cannot be recorded as of %. A movement stores the balance it produced, and one dated behind what is already there would make every valuation between those dates wrong. Record it as of % or later.',
      v_name, to_char(v_latest, 'DD Mon YYYY'), to_char(new.occurred_at, 'DD Mon YYYY'),
      to_char(v_latest, 'DD Mon YYYY')
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger inventory_movements_in_order
  before insert on public.inventory_movements
  for each row execute function public.refuse_out_of_order_movement();

revoke all on function public.refuse_out_of_order_movement() from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- reverse_production_run, replaced for the same reason.
--
-- A reversal is stamped `now()`, which is behind a run dated ahead of today —
-- so the rule above would refuse the undo and leave a completed run that could
-- never be reversed. It now takes the later of now() and the item's last
-- movement, so it always sorts last without ever pre-dating anything.

create or replace function public.reverse_production_run(
  p_run_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run      public.production_runs;
  v_user     uuid := (select auth.uid());
  v_movement record;
  v_item     public.items;
  v_unit     public.units;
  v_new_qty  numeric;
  v_new_val  numeric;
  v_new_avg  numeric;
  v_at       timestamptz;
begin
  select * into v_run from public.production_runs where id = p_run_id for update;
  if not found then
    raise exception 'Run not found' using errcode = 'no_data_found';
  end if;
  if coalesce(public.my_role(v_run.org_id)::text,'') not in ('owner','manager') then
    raise exception 'You do not have permission to reverse a run' using errcode = '42501';
  end if;
  if v_run.status <> 'completed' then
    raise exception 'Only a completed run can be reversed' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'A reversal needs a reason. Future you will want to know why this was undone.'
      using errcode = '22023';
  end if;

  perform 1 from public.items
  where id in (
    select item_id from public.inventory_movements
    where source_table = 'production_runs' and source_id = p_run_id
  )
  order by id
  for update;

  -- Newest first: undoing a run walks its movements backwards, so the balance
  -- each reversal produces is the one that existed before its original.
  for v_movement in
    select * from public.inventory_movements
    where source_table = 'production_runs' and source_id = p_run_id
      and reversal_of_id is null
    order by seq desc
  loop
    select * into v_item from public.items where id = v_movement.item_id;

    v_new_qty := v_item.qty_on_hand - v_movement.quantity_change;
    if v_new_qty < 0 then
      select * into v_unit from public.units where id = v_item.base_unit_id;
      perform public.refuse_negative_stock(v_item.name, v_new_qty, v_unit.code);
    end if;

    -- Unknown stays unknown (D-119): an item whose cost was never established
    -- does not acquire one by having a movement undone.
    if v_item.avg_unit_cost is null or v_new_qty = 0 then
      v_new_avg := case when v_new_qty = 0 then null else v_item.avg_unit_cost end;
    else
      v_new_val := (v_item.qty_on_hand * v_item.avg_unit_cost)
                 - (coalesce(v_movement.cost_effect_cents,0)::numeric / 100);
      v_new_avg := v_new_val / v_new_qty;
    end if;

    -- A reversal happens now, but it must still sort last, or the ordering rule
    -- would refuse the undo of a run dated ahead of today and leave a completed
    -- run that can never be reversed. "Now, or the last thing that happened to
    -- this item, whichever is later" is the honest date: you cannot undo
    -- something as of a date before the last thing that happened to it.
    select greatest(now(), max(occurred_at)) into v_at
    from public.inventory_movements where item_id = v_movement.item_id;

    insert into public.inventory_movements (
      org_id,item_id,movement_type,quantity_change,unit_id,quantity_entered,
      unit_cost_at_movement,cost_effect_cents,resulting_qty,resulting_avg_cost,
      source_table,source_id,reason,reversal_of_id,occurred_at,created_by
    ) values (
      v_movement.org_id,v_movement.item_id,v_movement.movement_type,
      -v_movement.quantity_change,v_movement.unit_id,v_movement.quantity_entered,
      v_movement.unit_cost_at_movement,
      case when v_movement.cost_effect_cents is null then null
           else -v_movement.cost_effect_cents end,
      v_new_qty,v_new_avg,
      'production_runs',p_run_id,btrim(p_reason),v_movement.id,v_at,v_user
    );

    update public.items
    set qty_on_hand = v_new_qty, avg_unit_cost = v_new_avg,
        updated_at = now(), updated_by = v_user
    where id = v_item.id;
  end loop;

  update public.production_runs
  set status = 'cancelled',
      reversal_reason = btrim(p_reason),
      updated_at = now(),
      updated_by = v_user
  where id = p_run_id;

  return p_run_id;
end;
$$;

revoke all on function public.reverse_production_run(uuid,text) from public,anon;
grant execute on function public.reverse_production_run(uuid,text) to authenticated;
