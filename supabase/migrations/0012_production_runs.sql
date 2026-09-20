-- S8: a production run is recorded, costed and locked.
--
-- The point of the stage, and the reason the ledger was built the way it was:
-- once a run is completed its cost cannot move. Change a filament price next
-- month and this run still cost what it cost, because every rate it used is
-- written into the run by value, and every movement it made carries the
-- balance and average it produced.
--
-- Two readings of the specification are stated here rather than buried.
--
-- 1. **No failure movement is written.** `inventory_movements` requires
--    `quantity_change <> 0`, and failed units never enter stock, so there is no
--    quantity to record. The loss is not lost: materials leave stock at their
--    full cost, finished goods enter at the capitalised cost, and the
--    difference is the abnormal loss, recorded on the run itself. Writing a
--    zero-quantity movement to represent it would put a row in the ledger that
--    changes no stock, which is exactly what the ledger is not for.
--
-- 2. **Waste is consumption.** Material thrown away during a run left the shelf
--    and was paid for, so it is a `waste` movement with its reason, and its
--    cost is part of what the run cost.

create type public.production_run_status as enum (
  'planned','in_progress','completed','cancelled'
);

create table public.production_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  item_id uuid not null,
  bom_id uuid,
  planned_qty numeric(20,6) not null check (planned_qty > 0),
  units_started integer check (units_started >= 0),
  units_accepted integer check (units_accepted >= 0),
  units_failed integer check (units_failed >= 0),
  status public.production_run_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  run_date date not null default current_date,

  estimated_total_cost_cents bigint check (estimated_total_cost_cents >= 0),
  estimated_unit_cost numeric(20,8),
  actual_total_cost_cents bigint check (actual_total_cost_cents >= 0),
  abnormal_loss_cents bigint check (abnormal_loss_cents >= 0),
  capitalised_cost_cents bigint check (capitalised_cost_cents >= 0),
  actual_cost_per_accepted_unit numeric(20,8),

  -- The ids **and the values** of every rate used. Ids alone would not survive
  -- a rate row being superseded, which is precisely when someone asks what this
  -- run assumed.
  rate_snapshot jsonb not null default '{}'::jsonb,
  reversal_reason text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (org_id,id),
  foreign key (org_id,item_id) references public.items(org_id,id),
  foreign key (org_id,bom_id) references public.boms(org_id,id),
  constraint production_runs_completed_has_figures check (
    status <> 'completed'
    or (units_accepted is not null and units_failed is not null
        and actual_total_cost_cents is not null and capitalised_cost_cents is not null)
  )
);
create index production_runs_list on public.production_runs(org_id,run_date desc,id desc);
create index production_runs_item on public.production_runs(org_id,item_id,run_date desc,id desc);

create table public.production_run_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  run_id uuid not null,
  line_type public.bom_line_type not null,
  ref_item_id uuid,
  ref_equipment_id uuid,
  ref_activity_id uuid,
  unit_id uuid,
  expected_qty numeric(20,6),
  actual_qty numeric(20,6),
  unit_cost_at_run numeric(20,8),
  cost_cents bigint,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id,id),
  foreign key (org_id,run_id) references public.production_runs(org_id,id) on delete cascade
);
create index production_run_lines_run on public.production_run_lines(org_id,run_id,sort_order,id);

-- ---------------------------------------------------------------------------
-- start_production_run
--
-- Copies the active recipe into the run at the quantities a batch of this size
-- needs, so what actually happened is recorded against what was expected rather
-- than against whatever the recipe says later.

create or replace function public.start_production_run(
  p_item_id uuid,
  p_planned_qty numeric,
  p_estimated_total_cost_cents bigint default null,
  p_estimated_unit_cost numeric default null,
  p_run_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_bom uuid;
  v_rate numeric;
  v_started numeric;
  v_run uuid;
begin
  select org_id into v_org from public.items where id = p_item_id;
  if v_org is null then
    raise exception 'Product not found' using errcode = 'no_data_found';
  end if;
  if coalesce(public.my_role(v_org)::text,'') not in ('owner','manager','production') then
    raise exception 'You do not have permission to record production' using errcode = '42501';
  end if;
  if p_planned_qty is null or p_planned_qty <= 0 then
    raise exception 'A run needs to plan at least one good unit' using errcode = '22023';
  end if;

  select active_bom_id, expected_failure_rate into v_bom, v_rate
  from public.product_details where item_id = p_item_id;
  if v_bom is null then
    raise exception 'This product has no active recipe, so there is nothing to make'
      using errcode = '22023';
  end if;

  -- How many to start to end up with the number wanted: the failures you expect
  -- have to be started too, or every run comes up short (F-11).
  v_started := ceil(p_planned_qty / (1 - coalesce(v_rate, 0)));

  insert into public.production_runs (
    org_id,item_id,bom_id,planned_qty,units_started,status,run_date,
    estimated_total_cost_cents,estimated_unit_cost,notes,created_by
  ) values (
    v_org,p_item_id,v_bom,p_planned_qty,v_started,'in_progress',
    coalesce(p_run_date, current_date),
    p_estimated_total_cost_cents,p_estimated_unit_cost,p_notes,auth.uid()
  ) returning id into v_run;

  -- Expected quantities are per started unit, not per accepted unit: the
  -- material for a unit that fails is consumed all the same.
  insert into public.production_run_lines (
    org_id,run_id,line_type,ref_item_id,ref_equipment_id,ref_activity_id,
    unit_id,expected_qty,actual_qty,sort_order,notes
  )
  select v_org, v_run, l.line_type, l.ref_item_id, l.ref_equipment_id, l.ref_activity_id,
         l.unit_id,
         case
           when l.line_type in ('material','component','packaging','subassembly')
             then round(l.qty_per_unit * (1 + coalesce(l.waste_rate,0)) * v_started, 6)
           when l.line_type in ('machine_time','labour')
             then round(l.qty_per_unit * v_started, 6)
           else null
         end,
         case
           when l.line_type in ('material','component','packaging','subassembly')
             then round(l.qty_per_unit * (1 + coalesce(l.waste_rate,0)) * v_started, 6)
           when l.line_type in ('machine_time','labour')
             then round(l.qty_per_unit * v_started, 6)
           else null
         end,
         l.sort_order, l.notes
  from public.bom_lines l
  where l.bom_id = v_bom
  order by l.sort_order, l.id;

  return v_run;
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_production_run
--
-- One transaction: every consumption movement, every waste movement, the
-- output movement, the finished-goods average, the cost figures and the status
-- change. Any failure rolls all of it back (FR-33).

create or replace function public.complete_production_run(
  p_run_id uuid,
  p_lines jsonb,
  p_units_accepted integer,
  p_units_failed integer,
  p_waste jsonb default '[]'::jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run       public.production_runs;
  v_user      uuid := (select auth.uid());
  v_rate      numeric;
  v_line      record;
  v_item      public.items;
  v_unit      public.units;
  v_qty_base  numeric;
  v_cost      bigint;
  v_total     bigint := 0;
  v_started   integer;
  v_expected  integer;
  v_abnormal  integer;
  v_per_start numeric;
  v_loss      bigint;
  v_cap       bigint;
  v_per_unit  numeric;
  v_new_qty   numeric;
  v_new_avg   numeric;
  v_snapshot  jsonb := '{}'::jsonb;
  v_equip     record;
  v_waste     jsonb;
begin
  select * into v_run from public.production_runs where id = p_run_id for update;
  if not found then
    raise exception 'Run not found' using errcode = 'no_data_found';
  end if;
  if coalesce(public.my_role(v_run.org_id)::text,'') not in ('owner','manager','production') then
    raise exception 'You do not have permission to record production' using errcode = '42501';
  end if;
  if v_run.status not in ('planned','in_progress') then
    raise exception 'This run is already % and cannot be completed again', v_run.status
      using errcode = '22023';
  end if;
  if p_units_accepted is null or p_units_failed is null
     or p_units_accepted < 0 or p_units_failed < 0 then
    raise exception 'Accepted and failed units must be zero or more' using errcode = '22023';
  end if;

  v_started := p_units_accepted + p_units_failed;
  if v_started = 0 then
    raise exception 'A run that started nothing cannot be completed' using errcode = '22023';
  end if;

  select expected_failure_rate into v_rate
  from public.product_details where item_id = v_run.item_id;
  if v_rate is null then
    raise exception 'This product has no expected failure rate, so a failure cannot be told from a loss. Set one first.'
      using errcode = '22023';
  end if;

  -- Actual quantities, as recorded by the person who was there.
  update public.production_run_lines l
  set actual_qty = (e.value ->> 'actual_qty')::numeric
  from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) e
  where l.run_id = p_run_id and l.id = (e.value ->> 'id')::uuid;

  -- Every item this run touches, locked up front in id order so concurrent
  -- runs queue rather than deadlock (D-078).
  perform 1 from public.items
  where id in (
    select ref_item_id from public.production_run_lines
    where run_id = p_run_id and ref_item_id is not null
    union
    select (w.value ->> 'item_id')::uuid from jsonb_array_elements(coalesce(p_waste,'[]'::jsonb)) w
    union
    select v_run.item_id
  )
  order by id
  for update;

  for v_line in
    select * from public.production_run_lines
    where run_id = p_run_id order by sort_order, id
  loop
    v_cost := 0;

    if v_line.line_type in ('material','component','packaging','subassembly') then
      if coalesce(v_line.actual_qty,0) > 0 then
        select * into v_item from public.items where id = v_line.ref_item_id;
        v_qty_base := public.convert_to_base(v_line.ref_item_id, v_line.actual_qty,
                                             coalesce(v_line.unit_id, v_item.base_unit_id));
        if v_item.avg_unit_cost is null then
          raise exception '% has no established cost, so this run cannot be costed. Record a purchase or an opening balance for it first.',
            v_item.name using errcode = '22023';
        end if;
        if v_item.qty_on_hand - v_qty_base < 0 then
          select * into v_unit from public.units where id = v_item.base_unit_id;
          perform public.refuse_negative_stock(v_item.name,
                                               v_item.qty_on_hand - v_qty_base, v_unit.code);
        end if;

        v_cost := round(v_qty_base * v_item.avg_unit_cost * 100)::bigint;
        v_new_qty := v_item.qty_on_hand - v_qty_base;

        insert into public.inventory_movements (
          org_id,item_id,movement_type,quantity_change,unit_id,quantity_entered,
          unit_cost_at_movement,cost_effect_cents,resulting_qty,resulting_avg_cost,
          source_table,source_id,occurred_at,created_by
        ) values (
          v_run.org_id,v_line.ref_item_id,'production_consumption',-v_qty_base,
          v_item.base_unit_id,v_line.actual_qty,
          v_item.avg_unit_cost,-v_cost,v_new_qty,v_item.avg_unit_cost,
          'production_runs',p_run_id,v_run.run_date::timestamptz,v_user
        );
        update public.items set qty_on_hand = v_new_qty, updated_at = now(), updated_by = v_user
        where id = v_line.ref_item_id;

        update public.production_run_lines
        set unit_cost_at_run = v_item.avg_unit_cost, cost_cents = v_cost
        where id = v_line.id;
      else
        update public.production_run_lines set cost_cents = 0 where id = v_line.id;
      end if;

    elsif v_line.line_type = 'machine_time' then
      select e.id, e.name, e.measured_avg_power_watts,
             (select r.hourly_recovery_rate from public.equipment_rate_versions r
              where r.equipment_id = e.id and r.effective_from <= v_run.run_date
              order by r.effective_from desc, r.id desc limit 1) as rate,
             (select r.id from public.equipment_rate_versions r
              where r.equipment_id = e.id and r.effective_from <= v_run.run_date
              order by r.effective_from desc, r.id desc limit 1) as rate_id
      into v_equip
      from public.equipment e where e.id = v_line.ref_equipment_id;

      if v_equip.rate is null then
        raise exception '% has no hourly rate in force on %, so this run cannot be costed.',
          v_equip.name, v_run.run_date using errcode = '22023';
      end if;
      v_cost := round(coalesce(v_line.actual_qty,0) * v_equip.rate * 100)::bigint;
      update public.production_run_lines
      set unit_cost_at_run = v_equip.rate, cost_cents = v_cost where id = v_line.id;
      v_snapshot := v_snapshot || jsonb_build_object(
        'equipment_' || v_equip.id::text,
        jsonb_build_object('name',v_equip.name,'rate',v_equip.rate,'rate_version_id',v_equip.rate_id)
      );

      -- Electricity is derived from the same hours, never a recipe line, so it
      -- cannot be recorded twice (F-07).
      declare
        v_kwh numeric;
        v_kwh_id uuid;
        v_elec bigint;
      begin
        select (u.rate_per_unit * 1000 / nullif(un.factor_to_dimension_base,0)), u.id
        into v_kwh, v_kwh_id
        from public.utility_rates u
        join public.units un on un.id = u.unit_id
        where u.org_id = v_run.org_id and u.utility_type = 'electricity'
          and u.effective_from <= v_run.run_date
        order by u.effective_from desc, u.id desc limit 1;

        if v_kwh is not null and v_equip.measured_avg_power_watts is not null then
          v_elec := round(coalesce(v_line.actual_qty,0)
                          * (v_equip.measured_avg_power_watts / 1000) * v_kwh * 100)::bigint;
          v_cost := v_cost + v_elec;
          update public.production_run_lines
          set cost_cents = cost_cents + v_elec where id = v_line.id;
          v_snapshot := v_snapshot || jsonb_build_object(
            'electricity', jsonb_build_object('rate_per_kwh',v_kwh,'rate_id',v_kwh_id,
                                              'watts',v_equip.measured_avg_power_watts)
          );
        end if;
      end;

    elsif v_line.line_type = 'labour' then
      declare
        v_lrate numeric;
        v_lid uuid;
        v_lname text;
      begin
        select a.name,
               (select r.hourly_rate from public.labor_rate_versions r
                where r.activity_id = a.id and r.effective_from <= v_run.run_date
                order by r.effective_from desc, r.id desc limit 1),
               (select r.id from public.labor_rate_versions r
                where r.activity_id = a.id and r.effective_from <= v_run.run_date
                order by r.effective_from desc, r.id desc limit 1)
        into v_lname, v_lrate, v_lid
        from public.labor_activities a where a.id = v_line.ref_activity_id;

        if v_lrate is null then
          raise exception '% has no hourly rate in force on %, so this run cannot be costed.',
            v_lname, v_run.run_date using errcode = '22023';
        end if;
        v_cost := round(coalesce(v_line.actual_qty,0) * v_lrate * 100)::bigint;
        update public.production_run_lines
        set unit_cost_at_run = v_lrate, cost_cents = v_cost where id = v_line.id;
        v_snapshot := v_snapshot || jsonb_build_object(
          'activity_' || v_line.ref_activity_id::text,
          jsonb_build_object('name',v_lname,'rate',v_lrate,'rate_version_id',v_lid)
        );
      end;

    elsif v_line.line_type = 'other_cost' then
      v_cost := coalesce(v_line.cost_cents,0);
    end if;

    v_total := v_total + coalesce(v_cost,0);
  end loop;

  -- Waste: material that left the shelf and was paid for, so it is part of what
  -- the run cost, and it carries its reason like every other waste movement.
  for v_waste in select value from jsonb_array_elements(coalesce(p_waste,'[]'::jsonb))
  loop
    select * into v_item from public.items where id = (v_waste ->> 'item_id')::uuid;
    if not found then
      raise exception 'Wasted item not found' using errcode = 'no_data_found';
    end if;
    if coalesce((v_waste ->> 'qty')::numeric,0) <= 0 then
      raise exception 'A waste line needs a quantity above zero' using errcode = '22023';
    end if;
    if coalesce(btrim(v_waste ->> 'reason'),'') = '' then
      raise exception 'A waste line needs a reason' using errcode = '22023';
    end if;

    v_qty_base := (v_waste ->> 'qty')::numeric;
    if v_item.qty_on_hand - v_qty_base < 0 then
      select * into v_unit from public.units where id = v_item.base_unit_id;
      perform public.refuse_negative_stock(v_item.name, v_item.qty_on_hand - v_qty_base, v_unit.code);
    end if;
    v_cost := case when v_item.avg_unit_cost is null then null
                   else round(v_qty_base * v_item.avg_unit_cost * 100)::bigint end;
    v_new_qty := v_item.qty_on_hand - v_qty_base;

    insert into public.inventory_movements (
      org_id,item_id,movement_type,quantity_change,unit_id,quantity_entered,
      unit_cost_at_movement,cost_effect_cents,resulting_qty,resulting_avg_cost,
      source_table,source_id,reason,occurred_at,created_by
    ) values (
      v_run.org_id,v_item.id,'waste',-v_qty_base,v_item.base_unit_id,v_qty_base,
      v_item.avg_unit_cost, case when v_cost is null then null else -v_cost end,
      v_new_qty,v_item.avg_unit_cost,
      'production_runs',p_run_id,btrim(v_waste ->> 'reason'),v_run.run_date::timestamptz,v_user
    );
    update public.items set qty_on_hand = v_new_qty, updated_at = now(), updated_by = v_user
    where id = v_item.id;
    v_total := v_total + coalesce(v_cost,0);
  end loop;

  -- F-11. Failures you expected are the cost of doing the work and spread over
  -- the good units; failures beyond that are a loss that happened.
  v_expected := round(v_started * v_rate);
  v_abnormal := greatest(0, p_units_failed - v_expected);
  v_per_start := v_total::numeric / v_started;

  if p_units_accepted = 0 then
    -- Stated separately in F-11: with nothing accepted there is no unit to
    -- carry even the expected failures' cost, so the run is the loss.
    v_loss := v_total;
  else
    v_loss := round(v_per_start * v_abnormal)::bigint;
  end if;
  v_cap := v_total - v_loss;
  v_per_unit := case when p_units_accepted = 0 then null
                     else (v_cap::numeric / 100) / p_units_accepted end;

  if p_units_accepted > 0 then
    select * into v_item from public.items where id = v_run.item_id;
    v_new_qty := v_item.qty_on_hand + p_units_accepted;
    -- F-12, and D-126's rule again: stock of unknown cost does not dilute.
    v_new_avg := case
      when v_item.avg_unit_cost is null then (v_cap::numeric / 100) / p_units_accepted
      else ((v_item.qty_on_hand * v_item.avg_unit_cost) + (v_cap::numeric / 100)) / v_new_qty
    end;

    insert into public.inventory_movements (
      org_id,item_id,movement_type,quantity_change,unit_id,quantity_entered,
      unit_cost_at_movement,cost_effect_cents,resulting_qty,resulting_avg_cost,
      source_table,source_id,occurred_at,created_by
    ) values (
      v_run.org_id,v_run.item_id,'production_output',p_units_accepted,
      v_item.base_unit_id,p_units_accepted,
      v_per_unit,v_cap,v_new_qty,v_new_avg,
      'production_runs',p_run_id,v_run.run_date::timestamptz,v_user
    );
    update public.items
    set qty_on_hand = v_new_qty, avg_unit_cost = v_new_avg,
        updated_at = now(), updated_by = v_user
    where id = v_run.item_id;
  end if;

  update public.production_runs
  set status = 'completed',
      completed_at = now(),
      units_started = v_started,
      units_accepted = p_units_accepted,
      units_failed = p_units_failed,
      actual_total_cost_cents = v_total,
      abnormal_loss_cents = v_loss,
      capitalised_cost_cents = v_cap,
      actual_cost_per_accepted_unit = v_per_unit,
      rate_snapshot = v_snapshot || jsonb_build_object(
        'bom_id', v_run.bom_id, 'expected_failure_rate', v_rate, 'run_date', v_run.run_date
      ),
      notes = coalesce(p_notes, notes),
      updated_at = now(),
      updated_by = v_user
  where id = p_run_id;

  return p_run_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- reverse_production_run
--
-- A completed run is never edited. It is reversed: every movement it made gets
-- an opposite movement pointing back at it, and the run is marked cancelled
-- with a reason. Both the original and the reversal stay visible, because
-- "this never happened" and "this happened and was undone" are different
-- facts and only one of them is true.

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
      'production_runs',p_run_id,btrim(p_reason),v_movement.id,now(),v_user
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

-- ---------------------------------------------------------------------------
-- Grants. A completed run is never edited, only reversed, so there is no update
-- grant on either table: both are written by the functions above.

alter table public.production_runs enable row level security;
alter table public.production_runs force row level security;
alter table public.production_run_lines enable row level security;
alter table public.production_run_lines force row level security;
revoke all on public.production_runs from anon,authenticated;
revoke all on public.production_run_lines from anon,authenticated;
grant select on public.production_runs to authenticated;
grant select on public.production_run_lines to authenticated;
create policy production_runs_select on public.production_runs
  for select to authenticated
  using (public.my_role(org_id) in ('owner','manager','production'));
create policy production_run_lines_select on public.production_run_lines
  for select to authenticated
  using (public.my_role(org_id) in ('owner','manager','production'));

revoke all on function public.start_production_run(uuid,numeric,bigint,numeric,date,text) from public,anon;
grant execute on function public.start_production_run(uuid,numeric,bigint,numeric,date,text) to authenticated;
revoke all on function public.complete_production_run(uuid,jsonb,integer,integer,jsonb,text) from public,anon;
grant execute on function public.complete_production_run(uuid,jsonb,integer,integer,jsonb,text) to authenticated;
revoke all on function public.reverse_production_run(uuid,text) from public,anon;
grant execute on function public.reverse_production_run(uuid,text) to authenticated;
