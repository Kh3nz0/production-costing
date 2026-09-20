-- S12, completed: the four templates that could not be applied row by row.
--
-- A purchase is a header plus its lines plus a receipt. An overhead version is
-- a version plus its category lines. A recipe is a revision plus its lines.
-- Applying any of those one row at a time from the client leaves a half-written
-- batch when row 40 fails, and no way to tell what state you are in.
--
-- So each becomes one function and therefore one transaction: it writes all of
-- it or none of it. Where a function already exists for the thing being made —
-- receive_purchase, add_overhead_version, save_product_recipe — these call it
-- rather than writing the rows themselves, so an imported record goes through
-- exactly the checks a typed one does.
--
-- Rows arrive already validated by the dry run and already resolved to ids, so
-- these functions take ids rather than names: name resolution is the client's
-- job and belongs where the error messages and the "did you mean" live.

create or replace function public.import_purchases(
  p_org_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row  jsonb;
  v_id   uuid;
  v_ids  jsonb := '[]'::jsonb;
begin
  if coalesce(public.my_role(p_org_id)::text,'') not in ('owner','manager','inventory') then
    raise exception 'You do not have permission to import purchases' using errcode = '42501';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    insert into public.purchases (
      org_id,supplier_id,reference_no,purchase_date,
      supplier_shipping_cents,duties_cents,other_landed_cost_cents,discount_cents,
      landed_cost_base,vat_amount_cents,payment_status,notes,created_by
    ) values (
      p_org_id,
      (v_row ->> 'supplier_id')::uuid,
      nullif(btrim(coalesce(v_row ->> 'reference_no','')),''),
      (v_row ->> 'purchase_date')::date,
      coalesce((v_row ->> 'shipping_cents')::bigint,0),
      coalesce((v_row ->> 'duties_cents')::bigint,0),
      coalesce((v_row ->> 'other_cents')::bigint,0),
      coalesce((v_row ->> 'discount_cents')::bigint,0),
      coalesce((v_row ->> 'landed_cost_base')::public.landed_cost_base,'value'),
      coalesce((v_row ->> 'vat_cents')::bigint,0),
      coalesce((v_row ->> 'payment_status')::public.payment_status,'unpaid'),
      nullif(btrim(coalesce(v_row ->> 'notes','')),''),
      v_user
    ) returning id into v_id;
    v_ids := v_ids || to_jsonb(v_id);
  end loop;

  return v_ids;
end;
$$;

-- ---------------------------------------------------------------------------
-- import_purchase_lines
--
-- Writes every line, then receives each purchase the lines belong to. The
-- receipt is what turns a line into stock at a landed cost, and doing it here
-- means an imported purchase and a typed one produce the same movements.

create or replace function public.import_purchase_lines(
  p_org_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_row      jsonb;
  v_id       uuid;
  v_ids      jsonb := '[]'::jsonb;
  v_purchase uuid;
begin
  if coalesce(public.my_role(p_org_id)::text,'') not in ('owner','manager','inventory') then
    raise exception 'You do not have permission to import purchases' using errcode = '42501';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    insert into public.purchase_lines (
      org_id,purchase_id,item_id,qty_ordered,qty_received,purchase_unit_id,
      unit_price_cents,line_discount_cents,notes,created_by
    ) values (
      p_org_id,
      (v_row ->> 'purchase_id')::uuid,
      (v_row ->> 'item_id')::uuid,
      (v_row ->> 'qty_ordered')::numeric,
      coalesce((v_row ->> 'qty_received')::numeric, (v_row ->> 'qty_ordered')::numeric),
      (v_row ->> 'purchase_unit_id')::uuid,
      coalesce((v_row ->> 'unit_price_cents')::bigint,0),
      coalesce((v_row ->> 'line_discount_cents')::bigint,0),
      nullif(btrim(coalesce(v_row ->> 'notes','')),''),
      v_user
    ) returning id into v_id;
    v_ids := v_ids || to_jsonb(v_id);
  end loop;

  -- Then receive each one, in a stable order so two imports cannot interleave
  -- their item locks differently and deadlock (D-078).
  for v_purchase in
    select distinct (value ->> 'purchase_id')::uuid
    from jsonb_array_elements(p_rows)
    order by 1
  loop
    perform public.receive_purchase(v_purchase);
  end loop;

  return v_ids;
end;
$$;

-- ---------------------------------------------------------------------------
-- import_overhead
--
-- One version for the whole file: the template is a list of categories and
-- their monthly amounts, which together are a single monthly pool.

create or replace function public.import_overhead(
  p_org_id uuid,
  p_rows jsonb,
  p_expected_hours numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_row      jsonb;
  v_category uuid;
  v_lines    jsonb := '[]'::jsonb;
  v_from     date;
begin
  if coalesce(public.my_role(p_org_id)::text,'') not in ('owner','manager') then
    raise exception 'You do not have permission to import overhead' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    raise exception 'Add at least one overhead category' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    -- A category named twice in the file is one category with the later amount,
    -- not two rows fighting over the same name.
    select id into v_category
    from public.overhead_categories
    where org_id = p_org_id and lower(name) = lower(btrim(v_row ->> 'category'));

    if v_category is null then
      insert into public.overhead_categories (org_id,name,notes,created_by)
      values (p_org_id, btrim(v_row ->> 'category'),
              nullif(btrim(coalesce(v_row ->> 'notes','')),''), v_user)
      returning id into v_category;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'category_id', v_category,
      'amount_cents', coalesce((v_row ->> 'amount_cents')::bigint, 0)
    );
    v_from := coalesce(v_from, (v_row ->> 'effective_from')::date);
  end loop;

  return public.add_overhead_version(
    p_org_id, coalesce(v_from, current_date), p_expected_hours, v_lines
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- import_bom_lines
--
-- The file is one row per recipe line across many products. Each product's
-- lines are gathered and saved as one revision through save_product_recipe, so
-- the cycle check, the unit conversion and the locked-revision rule all apply.

create or replace function public.import_bom_lines(
  p_org_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product uuid;
  v_lines   jsonb;
  v_ids     jsonb := '[]'::jsonb;
begin
  if coalesce(public.my_role(p_org_id)::text,'') not in ('owner','manager') then
    raise exception 'You do not have permission to import recipes' using errcode = '42501';
  end if;

  for v_product in
    select distinct (value ->> 'product_id')::uuid
    from jsonb_array_elements(p_rows)
    order by 1
  loop
    select jsonb_agg(value - 'product_id') into v_lines
    from jsonb_array_elements(p_rows)
    where (value ->> 'product_id')::uuid = v_product;

    v_ids := v_ids || to_jsonb(public.save_product_recipe(v_product, v_lines, 'Imported'));
  end loop;

  return v_ids;
end;
$$;

-- ---------------------------------------------------------------------------
-- reverse_import_batch
--
-- An applied import can be undone, "provided nothing downstream references
-- them" — which is not a check this function performs, but one Postgres
-- performs for it. A foreign key from a row somebody has since built on raises,
-- the whole reversal rolls back, and the message names what is in the way.
--
-- Records that can be archived are archived rather than deleted, because an
-- item that has ever moved stock must stay on every movement that names it.

create or replace function public.reverse_import_batch(
  p_batch_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_row   record;
  v_count integer := 0;
begin
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Import batch not found' using errcode = 'no_data_found';
  end if;
  if coalesce(public.my_role(v_batch.org_id)::text,'') not in ('owner','manager') then
    raise exception 'You do not have permission to reverse an import' using errcode = '42501';
  end if;
  if v_batch.status <> 'applied' then
    raise exception 'Only an applied import can be reversed' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'A reversal needs a reason. Future you will want to know why this was undone.'
      using errcode = '22023';
  end if;

  -- Newest first, so a record created later cannot block one created earlier.
  for v_row in
    select created_record_id from public.import_rows
    where batch_id = p_batch_id and created_record_id is not null
    order by row_number desc
  loop
    case v_batch.template_code
      when '01-units' then
        delete from public.units where id = v_row.created_record_id and org_id = v_batch.org_id;
      when '03-suppliers' then
        update public.suppliers set archived_at = now()
        where id = v_row.created_record_id and org_id = v_batch.org_id;
      when '02-items','11-products' then
        update public.items set archived_at = now()
        where id = v_row.created_record_id and org_id = v_batch.org_id;
      when '07-equipment' then
        update public.equipment set status = 'retired'
        where id = v_row.created_record_id and org_id = v_batch.org_id;
      when '08-utility-rates' then
        delete from public.utility_rates
        where id = v_row.created_record_id and org_id = v_batch.org_id;
      when '09-labor-activities' then
        update public.labor_activities set status = 'inactive'
        where id = v_row.created_record_id and org_id = v_batch.org_id;
      when '13-sales-channels' then
        update public.sales_channels set status = 'inactive'
        where id = v_row.created_record_id and org_id = v_batch.org_id;
      else
        -- An opening balance, a receipt, an overhead version or a recipe
        -- revision is a movement or a dated version, and neither is deleted:
        -- the ledger is append-only and a rate version is what old records
        -- were costed with. Those reverse through their own mechanisms.
        raise exception 'An applied % import is not reversible here. It wrote movements or dated versions, which are undone through the ledger rather than removed.',
          v_batch.template_code using errcode = '22023';
    end case;
    v_count := v_count + 1;
  end loop;

  update public.import_batches
  set status = 'reversed',
      reversed_at = now(),
      reversal_reason = btrim(p_reason)
  where id = p_batch_id;

  return v_count;
end;
$$;

revoke all on function public.import_purchases(uuid,jsonb) from public,anon;
grant execute on function public.import_purchases(uuid,jsonb) to authenticated;
revoke all on function public.import_purchase_lines(uuid,jsonb) from public,anon;
grant execute on function public.import_purchase_lines(uuid,jsonb) to authenticated;
revoke all on function public.import_overhead(uuid,jsonb,numeric) from public,anon;
grant execute on function public.import_overhead(uuid,jsonb,numeric) to authenticated;
revoke all on function public.import_bom_lines(uuid,jsonb) from public,anon;
grant execute on function public.import_bom_lines(uuid,jsonb) to authenticated;
revoke all on function public.reverse_import_batch(uuid,text) from public,anon;
grant execute on function public.reverse_import_batch(uuid,text) to authenticated;
