-- S5: rate history. A version is an event: it may be inserted, never changed.
-- Costs can therefore retain the rate and version that were in force on a date.

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null check (length(btrim(name)) > 0),
  category text,
  purchase_price_cents bigint not null check (purchase_price_cents >= 0),
  purchase_date date,
  status text not null default 'active' check (status in ('active','retired')),
  rated_power_watts numeric(20,6),
  measured_avg_power_watts numeric(20,6),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(org_id,id)
);

create table public.equipment_rate_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  equipment_id uuid not null,
  effective_from date not null,
  cost_recovery_period_months integer not null check (cost_recovery_period_months > 0),
  expected_productive_hours numeric(20,6) not null check (expected_productive_hours > 0),
  maintenance_allowance_cents bigint not null check (maintenance_allowance_cents >= 0),
  repair_allowance_cents bigint not null check (repair_allowance_cents >= 0),
  hourly_recovery_rate numeric(20,8) not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(org_id,equipment_id,effective_from),
  foreign key(org_id,equipment_id) references public.equipment(org_id,id)
);

create table public.utility_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  utility_type text not null default 'electricity',
  rate_per_unit numeric(20,8) not null check (rate_per_unit >= 0),
  unit_id uuid not null references public.units(id),
  effective_from date not null,
  source_reference text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(org_id,utility_type,effective_from)
);

create function public.validate_utility_rate_unit() returns trigger
language plpgsql set search_path = '' as $$
declare v_dimension text; v_org uuid;
begin
  select dimension_code, org_id into v_dimension, v_org from public.units where id = new.unit_id;
  if v_org is not null and v_org <> new.org_id then
    raise exception 'That unit belongs to another organization' using errcode = '42501';
  end if;
  if new.utility_type = 'electricity' and v_dimension is distinct from 'energy' then
    raise exception 'Electricity needs an energy unit such as kWh' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger utility_rate_unit before insert on public.utility_rates
  for each row execute function public.validate_utility_rate_unit();

create table public.labor_activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null check (length(btrim(name)) > 0),
  attended boolean not null default true,
  default_duration numeric(20,6) check (default_duration > 0),
  duration_unit_id uuid references public.units(id),
  status text not null default 'active' check (status in ('active','retired')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(org_id,id)
);

create table public.labor_rate_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  activity_id uuid not null,
  hourly_rate numeric(20,8) not null check (hourly_rate >= 0),
  effective_from date not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(org_id,activity_id,effective_from),
  foreign key(org_id,activity_id) references public.labor_activities(org_id,id)
);

create table public.overhead_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null check (length(btrim(name)) > 0),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(org_id,id)
);

create table public.overhead_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  effective_from date not null,
  method text not null check (method in ('per_attended_hour','percent_of_direct_cost','flat_per_unit','none')),
  monthly_pool_cents bigint not null default 0 check (monthly_pool_cents >= 0),
  expected_monthly_attended_hours numeric(20,6),
  rate numeric(20,8),
  percent numeric(9,6),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(org_id,id),
  unique(org_id,effective_from),
  check (method <> 'per_attended_hour' or (expected_monthly_attended_hours > 0 and rate is not null)),
  check (method <> 'percent_of_direct_cost' or (percent >= 0 and percent < 1))
);

create table public.overhead_version_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  overhead_version_id uuid not null,
  category_id uuid not null,
  monthly_amount_cents bigint not null check (monthly_amount_cents >= 0),
  unique(overhead_version_id,category_id),
  foreign key(org_id,overhead_version_id) references public.overhead_versions(org_id,id),
  foreign key(org_id,category_id) references public.overhead_categories(org_id,id)
);

create table public.sales_channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null check (length(btrim(name)) > 0),
  status text not null default 'active' check (status in ('active','retired')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(org_id,id)
);

create table public.channel_fee_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  channel_id uuid not null,
  effective_from date not null,
  commission_rate numeric(9,6) not null default 0 check (commission_rate >= 0 and commission_rate < 1),
  payment_rate numeric(9,6) not null default 0 check (payment_rate >= 0 and payment_rate < 1),
  fixed_fee_cents bigint not null default 0 check (fixed_fee_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(org_id,channel_id,effective_from),
  foreign key(org_id,channel_id) references public.sales_channels(org_id,id)
);

-- Deny even a future accidental UPDATE/DELETE grant on history tables.
create function public.refuse_rate_rewrite() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Rate history cannot be changed. Add a new version with a new effective date.' using errcode = '22023';
end;
$$;

create trigger equipment_rate_immutable before update or delete on public.equipment_rate_versions
  for each row execute function public.refuse_rate_rewrite();
create trigger utility_rate_immutable before update or delete on public.utility_rates
  for each row execute function public.refuse_rate_rewrite();
create trigger labor_rate_immutable before update or delete on public.labor_rate_versions
  for each row execute function public.refuse_rate_rewrite();
create trigger overhead_immutable before update or delete on public.overhead_versions
  for each row execute function public.refuse_rate_rewrite();
create trigger overhead_lines_immutable before update or delete on public.overhead_version_lines
  for each row execute function public.refuse_rate_rewrite();
create trigger channel_fee_immutable before update or delete on public.channel_fee_versions
  for each row execute function public.refuse_rate_rewrite();

-- Price, allowances and hours are read in one transaction. A change to the
-- equipment row later cannot alter the numeric rate stored in this version.
create function public.add_equipment_rate(
  p_equipment_id uuid, p_effective_from date, p_period_months integer,
  p_productive_hours numeric, p_maintenance_cents bigint, p_repairs_cents bigint,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_equipment public.equipment;
  v_id uuid;
begin
  select * into v_equipment from public.equipment where id = p_equipment_id for update;
  if not found then raise exception 'Equipment not found' using errcode = 'no_data_found'; end if;
  if public.my_role(v_equipment.org_id) is distinct from 'owner'::public.membership_role then
    raise exception 'Only the owner can change rates' using errcode = '42501';
  end if;
  if p_period_months is null or p_period_months <= 0 or p_productive_hours is null or p_productive_hours <= 0
     or p_maintenance_cents is null or p_maintenance_cents < 0 or p_repairs_cents is null or p_repairs_cents < 0 then
    raise exception 'Enter a positive period and productive hours, and non-negative allowances' using errcode = '22023';
  end if;
  insert into public.equipment_rate_versions (
    org_id,equipment_id,effective_from,cost_recovery_period_months,
    expected_productive_hours,maintenance_allowance_cents,repair_allowance_cents,
    hourly_recovery_rate,notes,created_by
  ) values (
    v_equipment.org_id,p_equipment_id,p_effective_from,p_period_months,
    p_productive_hours,p_maintenance_cents,p_repairs_cents,
    round(((v_equipment.purchase_price_cents + (p_maintenance_cents + p_repairs_cents) * p_period_months::numeric / 12) / 100) / p_productive_hours,8),
    p_notes,auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

-- One lookup for the rate in force on a date, preserving decimal as numeric.
create function public.equipment_rate_on(p_equipment_id uuid, p_on date)
returns public.equipment_rate_versions language sql stable security invoker set search_path = '' as $$
  select v from public.equipment_rate_versions v
  where v.equipment_id = p_equipment_id and v.effective_from <= p_on
  order by v.effective_from desc, v.id desc limit 1;
$$;

-- A monthly overhead version and its category detail must be written together.
-- The pool is summed from line amounts; it is never an independent typed total.
create function public.add_overhead_version(
  p_org_id uuid, p_effective_from date, p_expected_hours numeric, p_lines jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_pool bigint;
  v_count integer;
begin
  if public.my_role(p_org_id) is distinct from 'owner'::public.membership_role then
    raise exception 'Only the owner can change rates' using errcode = '42501';
  end if;
  if p_expected_hours is null or p_expected_hours <= 0 then
    raise exception 'Expected working hours must be above zero' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one overhead category' using errcode = '22023';
  end if;
  select count(*), sum((line->>'amount_cents')::bigint)
    into v_count, v_pool from jsonb_array_elements(p_lines) line;
  if v_pool is null or v_pool < 0 or v_count <> (
    select count(distinct line->>'category_id') from jsonb_array_elements(p_lines) line
  ) or exists (
    select 1 from jsonb_array_elements(p_lines) line
    left join public.overhead_categories c
      on c.id = (line->>'category_id')::uuid and c.org_id = p_org_id
    where c.id is null or (line->>'amount_cents')::bigint < 0
  ) then
    raise exception 'Overhead categories and amounts are invalid' using errcode = '22023';
  end if;
  insert into public.overhead_versions (
    org_id,effective_from,method,monthly_pool_cents,
    expected_monthly_attended_hours,rate,created_by
  ) values (
    p_org_id,p_effective_from,'per_attended_hour',v_pool,p_expected_hours,
    round((v_pool::numeric / 100) / p_expected_hours,8),auth.uid()
  ) returning id into v_id;
  insert into public.overhead_version_lines (
    org_id,overhead_version_id,category_id,monthly_amount_cents
  ) select p_org_id,v_id,(line->>'category_id')::uuid,(line->>'amount_cents')::bigint
    from jsonb_array_elements(p_lines) line;
  return v_id;
end;
$$;

-- Supabase's broad defaults must be undone on every new table and function.
do $$
declare t text;
begin
  foreach t in array array[
    'equipment','equipment_rate_versions','utility_rates','labor_activities',
    'labor_rate_versions','overhead_categories','overhead_versions',
    'overhead_version_lines','sales_channels','channel_fee_versions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.my_role(org_id) = ''owner'')', t || '_select', t);
  end loop;
end;
$$;

-- The current app has only owner users. Future staff roles must receive
-- purpose-built cost-free views; no rate table is exposed to them here.
grant insert, update on public.equipment to authenticated;
grant insert, update on public.labor_activities to authenticated;
grant insert, update on public.overhead_categories to authenticated;
grant insert, update on public.sales_channels to authenticated;
grant insert on public.utility_rates to authenticated;
grant insert on public.labor_rate_versions to authenticated;
grant insert on public.channel_fee_versions to authenticated;

do $$
declare t text;
begin
  foreach t in array array['equipment','labor_activities','overhead_categories','sales_channels'] loop
    execute format('create policy %I on public.%I for insert to authenticated with check (public.my_role(org_id) = ''owner'' and created_by = auth.uid())',t || '_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (public.my_role(org_id) = ''owner'') with check (public.my_role(org_id) = ''owner'')',t || '_update',t);
  end loop;
  foreach t in array array['utility_rates','labor_rate_versions','channel_fee_versions'] loop
    execute format('create policy %I on public.%I for insert to authenticated with check (public.my_role(org_id) = ''owner'' and created_by = auth.uid())',t || '_insert',t);
  end loop;
end;
$$;

revoke all on function public.add_equipment_rate(uuid,date,integer,numeric,bigint,bigint,text) from public, anon;
grant execute on function public.add_equipment_rate(uuid,date,integer,numeric,bigint,bigint,text) to authenticated;
revoke all on function public.equipment_rate_on(uuid,date) from public, anon;
grant execute on function public.equipment_rate_on(uuid,date) to authenticated;
revoke all on function public.add_overhead_version(uuid,date,numeric,jsonb) from public, anon;
grant execute on function public.add_overhead_version(uuid,date,numeric,jsonb) to authenticated;
revoke all on function public.refuse_rate_rewrite() from public, anon, authenticated;
revoke all on function public.validate_utility_rate_unit() from public, anon, authenticated;
