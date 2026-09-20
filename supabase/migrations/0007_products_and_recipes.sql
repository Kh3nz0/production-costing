-- S6: products and recipes. Cost is estimated from the active recipe and
-- dated rates on read; no estimate is written into inventory or a sale.

alter table public.items add constraint items_org_id_id_unique unique (org_id, id);

create table public.product_details (
  item_id uuid primary key,
  org_id uuid not null,
  target_margin numeric(9,6) check (target_margin >= 0 and target_margin < 1),
  minimum_margin numeric(9,6) check (minimum_margin >= 0 and minimum_margin < 1),
  expected_output_qty_per_run numeric(20,6) check (expected_output_qty_per_run > 0),
  expected_failure_rate numeric(9,6) check (expected_failure_rate >= 0 and expected_failure_rate < 1),
  default_channel_id uuid,
  active_bom_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  foreign key (org_id,item_id) references public.items(org_id,id)
);

-- S2 already allowed finished products. Give those rows an extension too, so
-- saving their first recipe can set active_bom_id and a null failure rate is
-- visibly flagged rather than silently assumed to be zero.
insert into public.product_details(item_id,org_id,created_by)
select id,org_id,created_by from public.items where item_type='finished_product';

create type public.bom_status as enum ('draft','active','superseded');
create type public.bom_line_type as enum (
  'material','component','packaging','subassembly','machine_time','labour','other_cost'
);

create table public.boms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  item_id uuid not null,
  revision_no integer not null check (revision_no > 0),
  status public.bom_status not null default 'active',
  effective_from date not null default current_date,
  locked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (org_id,id),
  unique (org_id,item_id,revision_no),
  foreign key (org_id,item_id) references public.items(org_id,id)
);
create unique index boms_one_active_per_item on public.boms(org_id,item_id) where status='active';
create index boms_item_history on public.boms(org_id,item_id,revision_no desc,id);

alter table public.product_details
  add constraint product_details_active_bom_fk foreign key (org_id,active_bom_id)
  references public.boms(org_id,id);

create table public.bom_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  bom_id uuid not null,
  line_type public.bom_line_type not null,
  ref_item_id uuid,
  ref_equipment_id uuid,
  ref_activity_id uuid,
  qty_per_unit numeric(20,6),
  unit_id uuid references public.units(id),
  waste_rate numeric(9,6) not null default 0 check (waste_rate >= 0),
  amount_cents bigint,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (org_id,id),
  foreign key (org_id,bom_id) references public.boms(org_id,id),
  foreign key (org_id,ref_item_id) references public.items(org_id,id),
  foreign key (org_id,ref_equipment_id) references public.equipment(org_id,id),
  foreign key (org_id,ref_activity_id) references public.labor_activities(org_id,id),
  check (
    (line_type in ('material','component','packaging','subassembly')
      and ref_item_id is not null and ref_equipment_id is null and ref_activity_id is null
      and amount_cents is null and qty_per_unit > 0 and unit_id is not null)
    or (line_type = 'machine_time' and ref_item_id is null and ref_equipment_id is not null
      and ref_activity_id is null and amount_cents is null and qty_per_unit > 0 and unit_id is null)
    or (line_type = 'labour' and ref_item_id is null and ref_equipment_id is null
      and ref_activity_id is not null and amount_cents is null and qty_per_unit > 0 and unit_id is null)
    or (line_type = 'other_cost' and ref_item_id is null and ref_equipment_id is null
      and ref_activity_id is null and amount_cents >= 0 and qty_per_unit is null and unit_id is null)
  )
);
create index bom_lines_bom_order on public.bom_lines(org_id,bom_id,sort_order,id);
create index bom_lines_ref_item on public.bom_lines(org_id,ref_item_id) where ref_item_id is not null;

-- A direct or transitive reference back to the product is refused by name.
-- Include all active and draft paths; superseded revisions are historical and
-- cannot create a cycle in a current estimate.
create function public.refuse_bom_cycle() returns trigger
language plpgsql set search_path = '' as $$
declare v_owner uuid; v_name text;
begin
  if new.ref_item_id is null then return new; end if;
  select item_id into v_owner from public.boms where id=new.bom_id;
  if v_owner is null then raise exception 'Recipe not found' using errcode='no_data_found'; end if;
  if exists (
    with recursive path(item_id,visited) as (
      select new.ref_item_id, array[new.ref_item_id]
      union all
      select l.ref_item_id, path.visited || l.ref_item_id
      from path
      join public.boms b on b.item_id=path.item_id and b.org_id=new.org_id
        and b.status in ('active','draft')
      join public.bom_lines l on l.bom_id=b.id and l.ref_item_id is not null
      where not l.ref_item_id=any(path.visited)
    ) select 1 from path where item_id=v_owner
  ) then
    select name into v_name from public.items where id=v_owner;
    raise exception 'A recipe cannot contain % because that would make a cycle.',v_name
      using errcode='22023';
  end if;
  return new;
end;
$$;
create trigger bom_lines_no_cycle before insert or update on public.bom_lines
  for each row execute function public.refuse_bom_cycle();

create function public.refuse_locked_recipe_edit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.boms where id=old.bom_id and locked_at is not null) then
    raise exception 'This recipe revision was used by a completed run and cannot be changed.'
      using errcode='22023';
  end if;
  return old;
end;
$$;
create trigger bom_lines_lock before update or delete on public.bom_lines
  for each row execute function public.refuse_locked_recipe_edit();

-- An item and its product extension are one operation. The product cannot be
-- left half-created if its failure or margin fields fail validation.
create function public.create_product(
  p_org_id uuid,p_name text,p_sku text,p_base_unit_id uuid,
  p_expected_failure_rate numeric default null,p_output_qty numeric default null,
  p_target_margin numeric default null,p_minimum_margin numeric default null,
  p_parent_item_id uuid default null,p_description text default null,
  p_variant text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if public.my_role(p_org_id) not in ('owner','manager') or public.my_role(p_org_id) is null then
    raise exception 'You do not have permission to create products' using errcode='42501';
  end if;
  if p_name is null or btrim(p_name)='' then
    raise exception 'Give the product a name' using errcode='22023';
  end if;
  if not exists (select 1 from public.units
    where id=p_base_unit_id and (org_id is null or org_id=p_org_id)
      and dimension_code='count' and archived_at is null) then
    raise exception 'Choose a count unit belonging to this organization' using errcode='22023';
  end if;
  if p_parent_item_id is not null and not exists (
    select 1 from public.items where id=p_parent_item_id and org_id=p_org_id and item_type='finished_product'
  ) then raise exception 'The parent product was not found' using errcode='22023'; end if;
  insert into public.items(org_id,name,sku,item_type,base_unit_id,parent_item_id,description,variant_attributes,created_by)
    values(p_org_id,btrim(p_name),nullif(btrim(p_sku),''),'finished_product',p_base_unit_id,
      p_parent_item_id,p_description,
      case when nullif(btrim(p_variant),'') is null then '{}'::jsonb else jsonb_build_object('label',btrim(p_variant)) end,
      auth.uid()) returning id into v_id;
  insert into public.product_details(item_id,org_id,expected_failure_rate,
    expected_output_qty_per_run,target_margin,minimum_margin,created_by)
    values(v_id,p_org_id,p_expected_failure_rate,p_output_qty,p_target_margin,p_minimum_margin,auth.uid());
  return v_id;
end;
$$;

-- Replace an unlocked active recipe atomically. Once a production run marks a
-- revision locked, saving creates revision n+1 and preserves every old line.
create function public.save_product_recipe(p_item_id uuid,p_lines jsonb,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_item public.items; v_bom public.boms; v_id uuid; v_row record; v_order integer:=0;
begin
  select * into v_item from public.items where id=p_item_id for update;
  if not found then raise exception 'Product not found' using errcode='no_data_found'; end if;
  if public.my_role(v_item.org_id) not in ('owner','manager') or public.my_role(v_item.org_id) is null then
    raise exception 'You do not have permission to edit recipes' using errcode='42501';
  end if;
  if v_item.item_type not in ('finished_product','subassembly') then
    raise exception 'Only a product or subassembly can have a recipe' using errcode='22023';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Recipe lines must be a list' using errcode='22023';
  end if;
  if jsonb_array_length(p_lines)=0 then
    raise exception 'Add at least one recipe line' using errcode='22023';
  end if;
  select * into v_bom from public.boms where item_id=p_item_id and status='active' for update;
  if found and v_bom.locked_at is null then
    v_id:=v_bom.id;
    delete from public.bom_lines where bom_id=v_id;
    update public.boms set notes=p_notes where id=v_id;
  else
    if found then update public.boms set status='superseded' where id=v_bom.id; end if;
    insert into public.boms(org_id,item_id,revision_no,status,notes,created_by)
      values(v_item.org_id,p_item_id,coalesce(v_bom.revision_no,0)+1,'active',p_notes,auth.uid())
      returning id into v_id;
  end if;
  for v_row in select * from jsonb_to_recordset(p_lines) as x(
    line_type text,ref_item_id uuid,ref_equipment_id uuid,ref_activity_id uuid,
    qty_per_unit numeric,unit_id uuid,waste_rate numeric,amount_cents bigint,notes text
  ) loop
    v_order:=v_order+1;
    if v_row.ref_item_id is not null then
      if not exists (select 1 from public.items i where i.id=v_row.ref_item_id
        and i.org_id=v_item.org_id and i.archived_at is null
        and ((v_row.line_type='material' and i.item_type in ('raw_material','consumable'))
          or (v_row.line_type='component' and i.item_type='purchased_component')
          or (v_row.line_type='packaging' and i.item_type='packaging')
          or (v_row.line_type='subassembly' and i.item_type in ('subassembly','finished_product')))) then
        raise exception 'Choose an active item of the right type for each recipe line' using errcode='22023';
      end if;
      if not exists (select 1 from public.units u where u.id=v_row.unit_id
        and (u.org_id is null or u.org_id=v_item.org_id) and u.archived_at is null) then
        raise exception 'Choose a unit belonging to this organization' using errcode='22023';
      end if;
      perform public.convert_to_base(v_row.ref_item_id,v_row.qty_per_unit,v_row.unit_id);
    end if;
    insert into public.bom_lines(org_id,bom_id,line_type,ref_item_id,ref_equipment_id,
      ref_activity_id,qty_per_unit,unit_id,waste_rate,amount_cents,sort_order,notes,created_by)
    values(v_item.org_id,v_id,v_row.line_type::public.bom_line_type,v_row.ref_item_id,
      v_row.ref_equipment_id,v_row.ref_activity_id,v_row.qty_per_unit,v_row.unit_id,
      coalesce(v_row.waste_rate,0),v_row.amount_cents,v_order,v_row.notes,auth.uid());
  end loop;
  update public.product_details set active_bom_id=v_id,updated_at=now(),updated_by=auth.uid()
    where item_id=p_item_id;
  return v_id;
end;
$$;

-- Explicit grants after Supabase's broad defaults. Recipe writes have no
-- direct grant: the function enforces the entire set and revision rule.
do $$ declare t text; begin
  foreach t in array array['product_details','boms','bom_lines'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.my_role(org_id) in (''owner'',''manager''))',t||'_select',t);
  end loop;
end $$;

revoke all on function public.create_product(uuid,text,text,uuid,numeric,numeric,numeric,numeric,uuid,text,text) from public,anon;
grant execute on function public.create_product(uuid,text,text,uuid,numeric,numeric,numeric,numeric,uuid,text,text) to authenticated;
revoke all on function public.save_product_recipe(uuid,jsonb,text) from public,anon;
grant execute on function public.save_product_recipe(uuid,jsonb,text) to authenticated;
revoke all on function public.refuse_bom_cycle() from public,anon,authenticated;
revoke all on function public.refuse_locked_recipe_edit() from public,anon,authenticated;
