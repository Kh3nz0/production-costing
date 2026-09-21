-- What the stock is worth, to the centavo, in a form two databases can be
-- compared on. Ordered by name so the comparison is of figures rather than of
-- row order.
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', false);
set local role authenticated;

select string_agg(
         item_name || '=' || quantity::text || '@' || coalesce(unit_cost::text,'unknown')
           || '=' || coalesce(value_cents::text,'unknown'),
         '; ' order by item_name
       )
from public.inventory_valuation(
       (select id from public.organizations limit 1),
       '2026-12-31T23:59:59Z'::timestamptz
     );
