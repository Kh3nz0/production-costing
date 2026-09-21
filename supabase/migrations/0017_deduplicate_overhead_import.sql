-- 0016 resolves duplicate category names to one category id, but passes both
-- amounts to add_overhead_version, which correctly rejects duplicate lines.
-- Keep only the last amount for each category before creating the version.

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
  v_user              uuid := (select auth.uid());
  v_row               jsonb;
  v_category          uuid;
  v_lines_by_category jsonb := '{}'::jsonb;
  v_lines             jsonb;
  v_from              date;
begin
  if coalesce(public.my_role(p_org_id)::text,'') not in ('owner','manager') then
    raise exception 'You do not have permission to import overhead' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    raise exception 'Add at least one overhead category' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    select id into v_category
    from public.overhead_categories
    where org_id = p_org_id and lower(name) = lower(btrim(v_row ->> 'category'));

    if v_category is null then
      insert into public.overhead_categories (org_id,name,notes,created_by)
      values (p_org_id, btrim(v_row ->> 'category'),
              nullif(btrim(coalesce(v_row ->> 'notes','')),''), v_user)
      returning id into v_category;
    end if;

    -- JSON object assignment replaces an earlier value at the same id.
    v_lines_by_category := v_lines_by_category || jsonb_build_object(
      v_category::text,
      jsonb_build_object(
        'category_id', v_category,
        'amount_cents', coalesce((v_row ->> 'amount_cents')::bigint, 0)
      )
    );
    v_from := coalesce(v_from, (v_row ->> 'effective_from')::date);
  end loop;

  select jsonb_agg(value order by key) into v_lines
  from jsonb_each(v_lines_by_category);

  return public.add_overhead_version(
    p_org_id, coalesce(v_from, current_date), p_expected_hours, v_lines
  );
end;
$$;

revoke all on function public.import_overhead(uuid,jsonb,numeric) from public,anon;
grant execute on function public.import_overhead(uuid,jsonb,numeric) to authenticated;
