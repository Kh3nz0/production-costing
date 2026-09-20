# Phase 3 — Calculation Specification

Part 2 of 7. Every formula, its inputs, outputs, rounding, missing-value behaviour, validation, and a worked Philippine-peso example.

Every formula here must have an automated test asserting the worked example. NFR-02.

---

## 0. Numeric conventions

| Kind              | Storage                        | Precision       | Display                                                                                             |
| ----------------- | ------------------------------ | --------------- | --------------------------------------------------------------------------------------------------- |
| Money amount      | integer minor units (centavos) | exact           | `₱1,234.56`, always 2 dp, thousands separated, tabular figures                                      |
| Unit cost or rate | decimal                        | 8 dp            | 2 dp when the value is ₱1.00 or more, 4 dp when below, so `₱0.0500/mm` does not collapse to `₱0.05` |
| Quantity          | decimal                        | 6 dp            | up to 3 dp, trailing zeros trimmed, unit always shown                                               |
| Percentage        | decimal fraction, 6 dp         | `0.05` means 5% | 1 dp, `5.0%`                                                                                        |
| Conversion factor | decimal                        | 8 dp            | as entered                                                                                          |

**Calculation rows.** Inside an expandable cost breakdown, the displayed figures must reconcile on screen. A unit cost shown at 2 decimal places makes `19.32 g x P1.20 = P23.18` when the true figure is `P23.24`, so the "show your work" feature visibly fails to add up. Rule: **inside a calculation row, unit costs display to 6 decimal places and component amounts to 4**, with the section total at 2. The exact stored value is available on hover. Headline figures and table columns keep the display rules above.

**Rounding.** Intermediate values are never rounded. Rounding happens at two moments only: when a monetary amount is stored as an amount, and when a value is displayed. Money rounds **half-up to the centavo**. Half-up rather than banker's rounding because the owner will check figures on a phone calculator, and banker's rounding would disagree with it in exactly the cases he is most likely to check.

**Missing values.** A component whose input is missing is **excluded from the total and flagged**, never treated as zero. A cost carrying any flag is labelled Incomplete wherever it appears, and a price derived from it carries the same label. No default rate is ever substituted.

**Undefined results.** Division by zero yields no value. It renders as an em dash with an explanation, never as 0, NaN or Infinity.

---

## F-01 Landed unit cost of a purchase line

**Inputs:** unit_price, quantity_received, purchase_unit, line_discount, purchase-level shipping, duties, other landed costs, purchase-level discount, allocation base, purchase_to_base_factor.

```
line_net(i)        = unit_price(i) × quantity_received(i) − line_discount(i)
purchase_extras    = supplier_shipping + duties + other_landed_costs − purchase_discount
weight(i)          = line_net(i)                    if base = value
                   = quantity_received(i)           if base = quantity
                   = line_weight(i)                 if base = weight
allocated_extra(i) = purchase_extras × weight(i) / Σ weight
landed_line_total(i) = line_net(i) + allocated_extra(i)
receipt_unit_cost(i) = landed_line_total(i) / (quantity_received(i) × purchase_to_base_factor(i))
```

**Validation.**

- `value` is the default and is always valid.
- `quantity` is selectable only when every line on the purchase shares one unit dimension. Adding 800 g of filament to 90 pieces of switches produces a meaningless divisor, so the option is disabled with that reason shown.
- `weight` is selectable only when every line carries a weight.
- `Σ weight = 0` blocks allocation with an explanatory error.
- `quantity_received > 0`, `purchase_to_base_factor > 0`.

**Worked example.** One purchase, value base. Line A: 2 filament spools at ₱1,150.00 each, factor 1000 g per spool. Line B: 1 pack of 90 switches at ₱720.00, factor 90. Supplier shipping ₱180.00, no duties or discounts.

```
line_net(A)  = 2 × 1,150.00 = ₱2,300.00
line_net(B)  = 1 ×   720.00 = ₱720.00
Σ weight     = ₱3,020.00
allocated(A) = 180.00 × 2300/3020 = ₱137.0861...  → stored ₱137.09
allocated(B) = 180.00 ×  720/3020 =  ₱42.9139...  → stored ₱42.91
landed(A)    = ₱2,437.09     landed(B) = ₱762.91
receipt_unit_cost(A) = 2,437.09 / (2 × 1000) = ₱1.21854500 per gram
receipt_unit_cost(B) =   762.91 / (1 ×   90) = ₱8.47677778 per piece
```

Note the allocation is rounded so the two allocations sum to exactly ₱180.00. The last line absorbs any residual centavo. This is a stated rule: **allocation remainders go to the largest line**, so allocations always reconcile to the total.

---

## F-02 Moving weighted average on receipt

```
new_qty         = qty_on_hand + qty_received_in_base
new_total_value = (qty_on_hand × current_avg_cost) + landed_line_total
new_avg_cost    = new_total_value / new_qty
```

**Validation and edges.**

- `qty_on_hand < 0` cannot occur: negative stock is blocked (FR-15).
- `new_qty = 0` cannot occur on a receipt since `qty_received > 0`.
- First ever receipt: `qty_on_hand = 0`, `current_avg = null` → `new_avg = landed_line_total / qty_received`.
- Consumption never changes the average.

**Worked example.** 300 g of filament on hand at ₱1.10000000 per gram. Receive 2000 g with a landed total of ₱2,437.09.

```
new_qty   = 2300 g
new_value = (300 × 1.10) + 2,437.09 = 330.00 + 2,437.09 = ₱2,767.09
new_avg   = 2,767.09 / 2300 = ₱1.20308261 per gram
```

---

## F-03 Cost of consumption

```
consumption_cost = qty_consumed_in_base × avg_cost_at_that_moment
```

The average in force at the moment of the movement is stored on the movement row, so the figure is reproducible later even after further receipts.

---

## F-04 Unit conversion

```
qty_in_base = qty_in_unit × factor_to_base(unit)
```

**Rules.**

1. Conversion is automatic only between units sharing a `dimension` (mass, count, volume, length, time, energy).
2. Crossing dimensions requires an explicit item-level factor, for example `1 pack = 90 pc` or `1 spool = 1000 g`. It is never inferred.
3. An attempted conversion with no defined relationship is a validation error naming both units. It never silently passes.
4. Factors are stored, not computed from a chain, to avoid accumulating error.

**Worked example.** Purchase in `spool`, consume in `g`, item factor 1000. Consuming 18.4 g draws 18.4 base units, costing `18.4 × ₱1.20308261 = ₱22.1367...` → ₱22.14 when stored as an amount.

---

## F-05 BOM line gross quantity, with waste

```
gross_qty_per_unit = net_qty_per_unit × (1 + waste_rate)
```

Waste is defined as a percentage **added to** the net requirement, because that is how the work is described: "add 5% for purge". The alternative definition, `net / (1 − waste)`, treats waste as a share of input and yields a larger figure for the same percentage. Both are defensible; only one may exist, and the interface states which in the field's helper text.

**Worked example.** Net 18.4 g, waste 5%: `18.4 × 1.05 = 19.32 g`.

**Validation.** `waste_rate ≥ 0`. A rate above 1 (100%) is permitted but warned, since it means more is wasted than used.

---

## F-06 Units to start, with expected failure

```
units_to_start = ceil(units_wanted / (1 − failure_rate))
```

**Worked example.** Wanting 20 accepted units at a 5% expected failure rate: `ceil(20 / 0.95) = ceil(21.05) = 22`.

**Validation.** `0 ≤ failure_rate < 1`. A rate of 1 or more is rejected, since no quantity of starts would ever yield an accepted unit.

---

## F-07 Estimated product cost

Components, all per one accepted unit unless stated.

```
material_cost    = Σ over material, component, packaging, subassembly lines:
                     gross_qty_per_unit × item.avg_unit_cost
machine_cost     = Σ over machine lines: hours × equipment.hourly_recovery_rate
electricity_cost = Σ over machine lines: hours × (avg_watts / 1000) × utility_rate_per_kWh
labour_cost      = Σ over labour lines:  hours × activity.hourly_rate
other_cost       = Σ over other-cost lines: amount

direct_unit_cost = material + machine + electricity + labour + other

inventory_unit_cost = direct_unit_cost / (1 − failure_rate)

overhead_unit    = attended_hours_per_unit × overhead_rate_per_attended_hour
                   or, on the alternative base,
                 = direct_unit_cost × overhead_percent_of_direct_cost

pricing_unit_cost = inventory_unit_cost + overhead_unit
```

**Two costs, deliberately.** `inventory_unit_cost` is what a produced unit is worth in stock and what COGS will draw on. `pricing_unit_cost` adds overhead and exists only to set prices. The interface names both and never shows one where the other belongs.

**Why divide by (1 − failure_rate).** Starting 100 units that each cost C, with 5% failing, produces 95 good units carrying 100C of cost, so each good unit costs `C / 0.95`. Multiplying by `(1 + failure_rate)` would understate it.

**Stated simplification.** A failed unit is assumed to have consumed its full expected cost. In reality a print that fails at 80% consumed roughly 80% of its filament and time. Modelling that needs a per-product `failure_stage_factor`, which is deferred; the current rule is conservative, meaning it slightly overstates cost, which is the safer direction for pricing.

**Display rows.** The breakdown table shows one row per component, then a subtotal, then overhead:

```
Materials, Components, Packaging, Subassemblies   (from recipe lines)
Machine time                                      (from machine_time lines)
Electricity                                       (DERIVED, not a recipe line:
                                                   machine hours x watts/1000 x kWh rate)
Labour, Other
Expected failure allowance = inventory_unit_cost - direct_unit_cost
------------------------------------------------------------------
Production cost per unit   = inventory_unit_cost   <- subtotal
Overhead                   = overhead_unit
------------------------------------------------------------------
Full cost with overhead    = pricing_unit_cost     <- total
```

Two things this fixes. **Electricity is derived**, not a line type: there is no electricity row in `bom_lines`, and adding one would let a user record electricity twice. **Expected failure allowance is a derived display row**, the difference between the direct cost and the failure-adjusted cost, so the rows sum to the subtotal instead of double counting the division.

**Batch figures.**

```
estimated_batch_cost = pricing_unit_cost × planned_accepted_units
```

**Missing-value behaviour.** If `item.avg_unit_cost` is null because nothing has been purchased, that line is excluded and listed under "Missing inputs". If no utility rate exists, electricity is excluded and flagged. If no overhead rule is set, overhead is excluded and flagged, and `pricing_unit_cost` equals `inventory_unit_cost` with a note saying so.

**Worked example.** Three-switch clickable keychain, one unit.

| Component             | Working                         | Amount       |
| --------------------- | ------------------------------- | ------------ |
| Filament              | 19.32 g × ₱1.20308261           | ₱23.2436     |
| Switches              | 3 pc × ₱8.47677778              | ₱25.4303     |
| Key ring              | 1 pc × ₱2.50000000              | ₱2.5000      |
| Plastic bag           | 1 pc × ₱1.20000000              | ₱1.2000      |
| Machine time          | 0.35 h × ₱12.00000000           | ₱4.2000      |
| Electricity           | 0.35 h × (110/1000) kW × ₱12.50 | ₱0.4813      |
| Labour, assembly      | 0.10 h × ₱150.00                | ₱15.0000     |
| Labour, packing       | 0.03 h × ₱150.00                | ₱4.5000      |
| **direct_unit_cost**  | sum                             | **₱76.5552** |
| inventory_unit_cost   | 76.5552 / 0.95                  | **₱80.5844** |
| overhead              | 0.13 attended h × ₱95.00        | ₱12.3500     |
| **pricing_unit_cost** | 80.5844 + 12.3500               | **₱92.9344** |

All rates above are illustrative placeholders, not the owner's real figures, which are still to be collected.

Note what the breakdown shows: filament is ₱23.24 of a ₱92.93 cost, 25%. A calculator that counted only filament and electricity would have reported ₱23.72 and called the product profitable at ₱40.

---

## F-08 Margin and markup

```
margin = (price − cost) / price
markup = (price − cost) / cost

price_from_margin = cost / (1 − target_margin)
price_from_markup = cost × (1 + target_markup)

margin_from_markup = markup / (1 + markup)
markup_from_margin = margin / (1 − margin)
```

**Validation.** `target_margin < 1`. At 1 the price is infinite; the field rejects 100% and above with that explanation. Negative margins are permitted, since selling below cost is a real decision, but they are shown in the negative colour.

**Worked example, the trap.** Cost ₱60.00, the owner types 40 in both places.

|                | Price                   | Profit | Margin | Markup |
| -------------- | ----------------------- | ------ | ------ | ------ |
| 40% **margin** | 60 / 0.60 = **₱100.00** | ₱40.00 | 40.0%  | 66.7%  |
| 40% **markup** | 60 × 1.40 = **₱84.00**  | ₱24.00 | 28.6%  | 40.0%  |

Same number, ₱16.00 apart. Both figures appear together for every price, always.

---

## F-09 Channel price back-solve

The list price needed to hit a target contribution margin on a given channel after its fees.

```
C = the chosen cost basis (see below)
m = target margin on that basis
f = commission_rate + payment_rate            (percentage fees, applied to the discounted price)
K = fixed fee per unit (channel fixed fee, other per-sale costs)
S = shipping subsidy per unit = max(0, actual_shipping_cost − shipping_charged_to_customer)
d = planned discount rate

Required net revenue  NR = C / (1 − m)
Price                 P  = (C / (1 − m) + K + S) / ((1 − d) × (1 − f))
```

**Two cost bases, and they are not interchangeable. [Phase 5 correction]**

Pricing back-solves against **full cost with overhead**, because a price has to recover overhead. But a sale's contribution profit subtracts only **production cost**, because overhead is never capitalised into stock (D-008). The consequence, which must be shown rather than discovered:

> A price set for a 40% target on full cost returns a **higher** contribution margin than 40%, by exactly the overhead share.

Worked: cost basis P92.93 full / P80.58 production, 40% target, Shopee at 7%.

```
Price        = P166.54
Fees         = 166.54 x 0.07 = P11.66
Net revenue  = P154.88
Contribution = 154.88 - 80.58 = P74.30  ->  48.0%, not 40%
```

That is not an error: the extra 8 points is the P12.35 of overhead the price was built to recover. The pricing screen therefore shows **both** the target margin on full cost and the expected contribution margin, so the figure the sale reports later is never a surprise.

**Margin is measured against net revenue,** not list price. Measuring against list price while discounting 20% would report a margin on money that never arrived.

**Validation.** `(1 − d) × (1 − f) > 0`; `m < 1`; `f < 1`.

**Worked example.** Cost ₱92.93, target margin 40%, Shopee commission 5% and payment 2%, no fixed fee, no shipping subsidy, no discount.

```
NR = 92.93 / 0.60 = ₱154.8833
P  = 154.8833 / (1 × 0.93) = ₱166.5412 → ₱166.54
```

Same product, same target, with a 10% discount planned:

```
P = 154.8833 / (0.90 × 0.93) = ₱185.0458 → ₱185.05
```

And a direct sale with no fees: `P = 154.8833 / 1 = ₱154.88`.

The three prices for one product across three channels are shown together on the pricing screen.

---

## F-10 Break-even price

F-09 with `m = 0`. **There are two break-even prices and conflating them is a real error. [Phase 5 correction]**

```
break_even_contribution = (production_unit_cost + K + S) / ((1 − d) × (1 − f))
break_even_with_overhead = (full_unit_cost      + K + S) / ((1 − d) × (1 − f))
```

**Worked example**, Shopee at 7%, no discount, no subsidy:

```
break_even_contribution  = 80.58 / 0.93 = ₱86.65
break_even_with_overhead = 92.93 / 0.93 = ₱99.92
```

Below **₱86.65** the sale genuinely loses money: contribution profit is negative. Between ₱86.65 and ₱99.92 the sale earns something, but not enough to carry its share of your monthly running costs. Above ₱99.92 it carries both.

The original single figure of ₱99.92 was labelled "below this price the sale loses money", which is false — at ₱99.92 contribution profit is ₱12.35, not zero. Both figures are shown, with the band between them named.

---

## F-11 Actual production run cost

```
actual_material_cost    = Σ actual_qty_consumed × avg_cost_at_consumption
actual_machine_cost     = actual_machine_hours × equipment_rate_snapshot
actual_electricity_cost = actual_machine_hours × (watts/1000) × kwh_rate_snapshot
actual_labour_cost      = Σ actual_hours × labour_rate_snapshot
actual_total_cost       = the four above

units_started   = units_accepted + units_failed
expected_failed = round_half_up(units_started × product.expected_failure_rate)
normal_failed   = min(units_failed, expected_failed)
abnormal_failed = max(0, units_failed − expected_failed)

cost_per_started_unit = actual_total_cost / units_started
abnormal_loss         = abnormal_failed × cost_per_started_unit
capitalised_cost      = actual_total_cost − abnormal_loss
actual_cost_per_accepted_unit = capitalised_cost / units_accepted
```

**What this does in words.** Failures you expected are part of the cost of doing the work, so they spread across the good units. Failures beyond what you expected are a loss that happened, not value sitting on a shelf, so they are reported as a production loss and excluded from stock value.

**Edge cases.**

- `units_accepted = 0`: the entire run cost becomes a production loss, no stock is added, and `actual_cost_per_accepted_unit` is undefined.
- `units_started = 0`: the run cannot be completed; validation blocks it.
- `expected_failure_rate = 0`: every failure is abnormal, which is the correct behaviour for a product the owner has declared should never fail.

**Worked example.** Planned 20 accepted units, expected failure 5%. Started 20, accepted 12, failed 8. Actual total cost ₱1,531.10.

```
expected_failed = round(20 × 0.05) = 1
normal_failed   = 1        abnormal_failed = 7
cost_per_started = 1,531.10 / 20 = ₱76.5550
abnormal_loss    = 7 × 76.5550 = ₱535.885 → ₱535.89
capitalised_cost = 1,531.10 − 535.89 = ₱995.21
cost_per_accepted = 995.21 / 12 = ₱82.9342 → ₱82.93
```

Compare with the naive figure, `1,531.10 / 12 = ₱127.59`. The naive figure would make twelve perfectly good keychains look unsellable. The correct reading is that the units cost ₱82.93, close to the ₱80.58 estimate, and the night cost an extra ₱535.89 that belongs in the failure report.

---

## F-12 Finished goods average on run completion

```
new_fg_qty = fg_qty_on_hand + units_accepted
new_fg_avg = (fg_qty_on_hand × fg_avg_cost + capitalised_cost) / new_fg_qty
```

**Worked example.** 5 units on hand at ₱78.00. Add 12 units carrying ₱995.21.

```
new_qty = 17
new_avg = (5 × 78.00 + 995.21) / 17 = (390.00 + 995.21) / 17 = 1,385.21 / 17 = ₱81.4829
```

---

## F-13 Sale and contribution profit

Per line:

```
line_revenue = unit_price × quantity − line_discount
line_cogs    = quantity × fg_avg_cost_at_sale_time
line_gross_profit = line_revenue − line_cogs
```

Per sale:

```
revenue        = Σ line_revenue
cogs           = Σ line_cogs
gross_profit   = revenue − cogs
gross_margin   = gross_profit / revenue

commission_fee = revenue × channel.commission_rate     (overridable; stored as an amount)
payment_fee    = revenue × channel.payment_rate        (overridable; stored as an amount)
sale_costs     = commission_fee + payment_fee + fixed_fees + other_sale_costs
shipping_net   = shipping_charged_to_customer − actual_shipping_cost      (negative is a subsidy)

net_revenue         = revenue − sale_costs + shipping_net
contribution_profit = net_revenue − cogs
contribution_margin = contribution_profit / net_revenue
```

**Naming rule.** `contribution_profit` is never called net profit anywhere, because it excludes overhead, taxes and every operating expense. The label carries a tooltip saying exactly that.

**Fees stored as amounts, not rates.** The rate is a default that fills the field; what is stored is the peso amount, so a later change to the channel's rate cannot rewrite a past sale.

**Worked example.** One keychain sold on Shopee at ₱120.00, no discount, COGS ₱81.48, commission 5%, payment 2%, shipping charged ₱50.00, actual shipping ₱65.00.

```
revenue        = ₱120.00
cogs           = ₱81.48
gross_profit   = ₱38.52          gross_margin = 32.1%
commission_fee = 120.00 × 0.05 = ₱6.00
payment_fee    = 120.00 × 0.02 = ₱2.40
sale_costs     = ₱8.40
shipping_net   = 50.00 − 65.00 = −₱15.00
net_revenue    = 120.00 − 8.40 − 15.00 = ₱96.60
contribution_profit = 96.60 − 81.48 = ₱15.12
contribution_margin = 15.12 / 96.60 = 15.7%
```

A product that looked like it had 32% gross margin returned 15.7% once fees and a ₱15 shipping subsidy were counted. This example belongs in the interface as the explanation of why the two figures differ.

---

## F-14 Inventory valuation

```
item_value = qty_on_hand × avg_unit_cost
total_inventory_value = Σ item_value over non-archived items
```

**As of a date:** for each item take the last movement on or before that date and use the `resulting_qty` and `resulting_avg_cost` stored on it. No replay is required because both are recorded on every movement row.

---

## F-15 Overhead recovery

```
overhead_rate_per_attended_hour = monthly_overhead_pool / expected_monthly_attended_hours
overhead_recovered_in_period    = Σ contribution_profit of sales in the period
recovery_ratio                  = overhead_recovered / monthly_overhead_pool
```

**Worked example.** Pool ₱9,500 per month, expected 100 attended hours → ₱95.00 per attended hour. If the month's sales produced ₱11,400 of contribution, recovery is 120% and the month cleared overhead by ₱1,900.

---

## F-16 Operational indicators

```
low_stock            = qty_on_hand ≤ reorder_point                      (both in base units)
below_target_margin  = current_estimated_margin < product.target_margin
waste_rate_period    = Σ wasted quantity / Σ quantity consumed          per item, per period
waste_rate_business  = Σ value of waste (₱) / Σ value consumed (₱)      across items  [Phase 5 correction]
failure_rate_period  = Σ units_failed / Σ units_started                 per product, per period
recent_cost_increase = avg_cost_now / avg_cost_30_days_ago − 1          flagged above a threshold
vat_threshold_ratio  = rolling 12-month gross revenue / 3,000,000
```

**Aggregation rule [Phase 5 correction].** A single business-wide waste rate cannot be a quantity ratio, because it would add grams to pieces — the same defect that makes allocation by quantity invalid across mixed units (D-032). The dashboard figure is **by value**. The per-item figure on a report stays a quantity ratio, which is meaningful because it is one unit.

The business-wide failure rate **is** a plain unit count across products, and is labelled as such: it weights a ₱30 keychain the same as a ₱600 build. A value-weighted version is available on the failure report.

```

```

---

## F-17 Estimate versus actual

```
variance_amount  = actual_cost_per_accepted_unit − estimated_inventory_unit_cost_at_run_time
variance_percent = variance_amount / estimated_inventory_unit_cost_at_run_time
```

Compared against the estimate **as it stood when the run started**, taken from the run's snapshot, not against today's estimate. Comparing against a current estimate would make the variance change every time a price moved.

**Worked example.** Estimate ₱80.58, actual ₱82.93 → variance ₱2.35, 2.9% over. The report attributes it by component: material, machine, electricity, labour.

---

## 18. Validation summary

| Field           | Rule                                                         | Message shape                                                                              |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| quantity        | > 0 on receipts, consumption and output                      | "Enter a quantity greater than zero"                                                       |
| conversion      | units must share a dimension or have an item factor          | "There is no conversion between kilograms and pieces for this item. Add a pack size first" |
| failure_rate    | 0 ≤ r < 1                                                    | "A failure rate of 100% would mean no unit is ever accepted"                               |
| waste_rate      | ≥ 0, warn above 1                                            | "A waste rate above 100% means more material is wasted than used. Continue?"               |
| target_margin   | < 1                                                          | "A 100% margin has no finite price. Use a markup instead"                                  |
| stock           | result must not be negative for a costed item                | "This would leave −40 g of PLA Basic. Record a purchase or an opening balance first"       |
| allocation base | quantity base needs one dimension; weight base needs weights | "Allocate by quantity is unavailable because this purchase mixes grams and pieces"         |
| BOM             | no cycle                                                     | "A Keycap Set cannot contain itself through Printed Keycap"                                |
| run completion  | units_started > 0                                            | "Record at least one accepted or failed unit"                                              |
| sale            | stock must exist, or the sale is flagged                     | see below                                                                                  |

**Sale with no costed stock.** Blocked by default with an explanation, and an explicit override that records the sale with `cost_source = 'estimate'` using the product's current **production cost per unit**, never the full cost with overhead, because COGS never carries overhead. The sale is marked Estimated COGS everywhere it appears, and a report lists all such sales so they can be corrected once the production run is entered. This exists because in practice a sale gets recorded before the run that produced it.
