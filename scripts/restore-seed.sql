-- A known quantity of stock, put through the real functions rather than
-- inserted, so the rehearsal exercises what the app actually writes: a receipt
-- with landed cost allocated across two lines, an opening balance, and waste.
--
-- Figures are F-01's: 2 spools at ₱1,150.00 and 1 pack at ₱720.00 with ₱180.00
-- of shipping allocated by value, which lands at ₱1.218545/g and ₱8.476778/pc.
set role postgres;

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'rehearsal@costed.test')
on conflict do nothing;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', false);
set role authenticated;

select public.create_organization('Restore rehearsal');

do $$
declare
  v_org      uuid;
  v_user     uuid := '11111111-1111-1111-1111-111111111111';
  v_gram     uuid;
  v_piece    uuid;
  v_spool    uuid;
  v_pack     uuid;
  v_filament uuid;
  v_switch   uuid;
  v_purchase uuid;
begin
  select id into v_org from public.organizations limit 1;
  select id into v_gram  from public.units where code = 'g'     and org_id is null;
  select id into v_piece from public.units where code = 'pc'    and org_id is null;
  select id into v_spool from public.units where code = 'spool' and org_id is null;
  select id into v_pack  from public.units where code = 'pack'  and org_id is null;

  insert into public.items (org_id,name,item_type,base_unit_id,purchase_unit_id,
                            purchase_to_base_factor,created_by)
  values (v_org,'PLA Basic Filament','raw_material',v_gram,v_spool,1000,v_user)
  returning id into v_filament;

  insert into public.items (org_id,name,item_type,base_unit_id,purchase_unit_id,
                            purchase_to_base_factor,created_by)
  values (v_org,'Mechanical Switch','purchased_component',v_piece,v_pack,90,v_user)
  returning id into v_switch;

  insert into public.purchases (org_id,purchase_date,supplier_shipping_cents,
                                landed_cost_base,created_by)
  values (v_org,'2026-09-16',18000,'value',v_user)
  returning id into v_purchase;

  insert into public.purchase_lines (org_id,purchase_id,item_id,qty_ordered,qty_received,
                                     purchase_unit_id,unit_price_cents,created_by)
  values (v_org,v_purchase,v_filament,2,2,v_spool,115000,v_user),
         (v_org,v_purchase,v_switch,1,1,v_pack,72000,v_user);

  perform public.receive_purchase(v_purchase);
  perform public.adjust_stock(v_filament, 1940, 'waste', 'Purge losses', '2026-09-17'::timestamptz);
end
$$;
