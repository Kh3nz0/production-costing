-- S6 follow-up to 0007, which is already applied.
-- PostgreSQL CHECK accepts NULL. The original positive-quantity / nonnegative-
-- amount checks therefore also need an explicit presence requirement.
-- Otherwise a direct RPC call could save an incomplete line that reads as zero.

alter table public.bom_lines
  add constraint bom_lines_required_value check (
    case when line_type = 'other_cost'
      then amount_cents is not null
      else qty_per_unit is not null
    end
  );
