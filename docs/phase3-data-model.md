# Phase 3 — Data Model

Part 3 of 7. Postgres on Supabase. Every business table carries `org_id`, audit fields and archive behaviour.

---

## 0. Conventions applied to every business table

| Column        | Type                                 | Note                                                                                      |
| ------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `id`          | `uuid` default `gen_random_uuid()`   | primary key                                                                               |
| `org_id`      | `uuid not null`                      | references `organizations`. Present from the first migration. Every RLS policy keys on it |
| `created_at`  | `timestamptz not null default now()` |                                                                                           |
| `created_by`  | `uuid not null`                      | references `auth.users`                                                                   |
| `updated_at`  | `timestamptz not null default now()` | trigger-maintained                                                                        |
| `updated_by`  | `uuid`                               |                                                                                           |
| `archived_at` | `timestamptz`                        | null means active. Soft archive replaces deletion                                         |

Money columns are `bigint` holding centavos, suffixed `_cents`. Rates and unit costs are `numeric(20,8)`. Quantities are `numeric(20,6)`. Percentages are `numeric(9,6)` holding a fraction.

Every table has an index on `(org_id)` at minimum, and a partial index `where archived_at is null` on the tables that are listed constantly.

**Rejected alternative:** a single polymorphic `rates` table serving equipment, labour, utilities and overhead. It would have removed four near-identical tables, at the cost of foreign keys, type-specific check constraints and readable queries. Four explicit tables is the trade taken.

---

## 1. Identity and tenancy

**organizations** — `name`, `logo_path`, `currency_code` default `PHP`, `locale` default `en-PH`, `timezone` default `Asia/Manila`, `costing_method` default `weighted_average`, `overhead_method` default `per_attended_hour`, `money_rounding` default `half_up`, `vat_registered` boolean default false, `vat_rate` default 0.12.

**memberships** — `org_id`, `user_id`, `role` enum(`owner`,`manager`,`production`,`inventory`,`readonly`), `can_view_costs` boolean, `invited_at`, `accepted_at`. Unique on `(org_id, user_id)`.

**my_org_ids()** — `security definer` function returning the caller's org ids, used by every RLS policy so policies on `organizations` and `memberships` do not recurse.

---

## 2. Units

**unit_dimensions** — `code` (`mass`,`count`,`volume`,`length`,`time`,`energy`), `name`. Seeded, not org-scoped.

**units** — `org_id` nullable for seeded globals, `code`, `name`, `dimension_code`, `factor_to_dimension_base numeric(20,8) not null check (> 0)`, `is_dimension_base`. Unique `(org_id, code)`.

Conversion within a dimension uses `factor_to_dimension_base`. Crossing dimensions uses the item-level factor in section 3 and nothing else.

---

## 3. Items

**item_categories** — `name`, `parent_id`.

**items** — the unified model. A finished product is an item; a variant is an item; a subassembly is an item.

| Column                                    | Type                             | Note                                                                                                |
| ----------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `name`                                    | text not null                    |                                                                                                     |
| `sku`                                     | text                             | unique per org where not null                                                                       |
| `item_type`                               | enum                             | `raw_material`, `purchased_component`, `packaging`, `consumable`, `subassembly`, `finished_product` |
| `category_id`                             | uuid                             |                                                                                                     |
| `parent_item_id`                          | uuid                             | set on variants, pointing at the family head                                                        |
| `variant_attributes`                      | jsonb                            | `{"switches": 3, "body_colour": "black"}`                                                           |
| `brand`, `colour`, `description`, `notes` | text                             |                                                                                                     |
| `image_path`                              | text                             | Supabase Storage key                                                                                |
| `base_unit_id`                            | uuid not null                    | the unit stock is held and consumed in                                                              |
| `purchase_unit_id`                        | uuid                             | the unit it is bought in                                                                            |
| `purchase_to_base_factor`                 | numeric(20,8) check (> 0)        | 1000 for a 1 kg spool, 90 for a 90-piece pack                                                       |
| `reorder_point`                           | numeric(20,6)                    | in base units                                                                                       |
| `preferred_supplier_id`                   | uuid                             |                                                                                                     |
| `supplier_lead_time_days`                 | int                              |                                                                                                     |
| `qty_on_hand`                             | numeric(20,6) not null default 0 | **cache**, see section 6                                                                            |
| `avg_unit_cost`                           | numeric(20,8)                    | **cache**. Null until first costed receipt                                                          |
| `is_costed`                               | boolean default true             | false disables average-cost maintenance for untracked sundries                                      |

Indexes: `(org_id, item_type)`, `(org_id, name)`, unique `(org_id, sku) where sku is not null`, `(org_id, parent_item_id)`.

**product_details** — one-to-one extension for items that are sold. PK `item_id`.
`target_margin`, `minimum_margin`, `expected_output_qty_per_run`, `expected_failure_rate numeric(9,6) check (>= 0 and < 1)`, `default_channel_id`, `active_bom_id`.

**item_channel_prices** — `item_id`, `channel_id`, `list_price_cents`, `effective_from`. Historical, never updated in place.

---

## 4. Suppliers and purchasing

**suppliers** — `name`, `contact_person`, `phone`, `email`, `address`, `platform_or_store`, `typical_lead_time_days`, `notes`.

**purchases** — `supplier_id`, `reference_no`, `purchase_date date not null`, `supplier_shipping_cents`, `duties_cents`, `other_landed_cost_cents`, `discount_cents`, `landed_cost_base` enum(`value`,`quantity`,`weight`) default `value`, `vat_treatment` enum(`inclusive_non_recoverable`,`exclusive`,`exempt`,`zero_rated`) default `inclusive_non_recoverable`, `vat_amount_cents`, `payment_status`, `receipt_path`, `status` enum(`draft`,`received`,`partially_received`,`cancelled`), `notes`.

**purchase_lines** — `purchase_id`, `item_id`, `qty_ordered`, `qty_received`, `purchase_unit_id`, `unit_price_cents`, `line_discount_cents`, `line_weight` numeric(20,6), `allocated_landed_cost_cents`, `landed_total_cents`, `receipt_unit_cost numeric(20,8)`, `notes`.

The last three are **computed at receipt and stored**, not recomputed on read. Recomputing would let a later edit to the purchase change the cost of stock already consumed.

Index: `(org_id, purchase_date desc, id)`.

---

## 5. Rates, all versioned by effective date

**equipment** — `name`, `category`, `purchase_price_cents`, `purchase_date`, `useful_life_years`, `status` enum(`active`,`retired`), `rated_power_watts`, `measured_avg_power_watts`, `notes`.

**equipment_rate_versions** — `equipment_id`, `effective_from date not null`, `cost_recovery_period_months`, `expected_productive_hours`, `maintenance_allowance_cents`, `repair_allowance_cents`, `hourly_recovery_rate numeric(20,8)`, `notes`. The rate is computed on save from `(purchase_price + maintenance + repairs) / expected_productive_hours` and then stored, so a later edit to the equipment record cannot silently move a historical rate.

**utility_rates** — `utility_type` default `electricity`, `rate_per_unit numeric(20,8)`, `unit_id`, `effective_from date`, `source_reference`, `notes`.

**labor_activities** — `name`, `attended boolean not null`, `default_duration numeric(20,6)`, `duration_unit_id`, `status`, `notes`.

**labor_rate_versions** — `activity_id`, `hourly_rate numeric(20,8)`, `effective_from date`, `notes`.

**overhead_categories** — `name`, `notes`.

**overhead_versions** — `effective_from date`, `method` enum(`per_attended_hour`,`percent_of_direct_cost`,`flat_per_unit`,`none`), `monthly_pool_cents`, `expected_monthly_attended_hours`, `rate numeric(20,8)`, `percent numeric(9,6)`. Line detail in **overhead_version_lines** — `overhead_version_id`, `category_id`, `monthly_amount_cents`.

**sales_channels** — `name`, `status`, `notes`.

**channel_fee_versions** — `channel_id`, `effective_from date`, `commission_rate`, `payment_rate`, `fixed_fee_cents`, `notes`.

Every versioned table has a unique constraint on `(org_id, parent_id, effective_from)` and is read with "the latest version whose `effective_from` is on or before the date in question".

---

## 6. Inventory ledger

**inventory_movements** — append-only. No update, no delete. Corrections are new reversing rows.

| Column                      | Type                                | Note                                                                                                                                                                                       |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `item_id`                   | uuid not null                       |                                                                                                                                                                                            |
| `movement_type`             | enum                                | `opening_balance`, `purchase_received`, `production_consumption`, `production_output`, `production_failure`, `waste`, `sale`, `customer_return`, `supplier_return`, `damage`, `adjustment` |
| `quantity_change`           | numeric(20,6) not null check (<> 0) | signed, in base units                                                                                                                                                                      |
| `unit_id`                   | uuid not null                       | the unit the user entered, for display                                                                                                                                                     |
| `quantity_entered`          | numeric(20,6)                       | as typed, before conversion                                                                                                                                                                |
| `unit_cost_at_movement`     | numeric(20,8)                       | the average in force, or the receipt cost on an inbound row                                                                                                                                |
| `cost_effect_cents`         | bigint                              | signed value change                                                                                                                                                                        |
| `resulting_qty`             | numeric(20,6) not null              | balance after this row                                                                                                                                                                     |
| `resulting_avg_cost`        | numeric(20,8)                       | average after this row                                                                                                                                                                     |
| `source_table`, `source_id` | text, uuid                          | the purchase, run, sale or adjustment that caused it                                                                                                                                       |
| `reason`                    | text                                | required for `adjustment`, `waste`, `damage`                                                                                                                                               |
| `occurred_at`               | timestamptz not null                | business time, which may differ from `created_at`                                                                                                                                          |
| `reversal_of_id`            | uuid                                | set on correcting rows                                                                                                                                                                     |

Indexes: `(org_id, item_id, occurred_at, id)`, `(org_id, movement_type, occurred_at)`, `(org_id, source_table, source_id)`.

Storing `resulting_qty` and `resulting_avg_cost` on every row is what makes valuation as of any past date a lookup rather than a replay, and what makes "why did this cost move" answerable.

**Balance rule.** `items.qty_on_hand` and `items.avg_unit_cost` are caches written in the same transaction as the movement. `rebuild_item_balances(org_id)` recomputes both from the ledger and is asserted equal in tests (AC-15). The ledger is the truth; the cache exists so item lists do not aggregate on every read.

**No delete.** A movement may only be reversed. `archived_at` does not exist on this table.

---

## 7. Products and BOMs

**boms** — `item_id`, `revision_no int not null`, `status` enum(`draft`,`active`,`superseded`), `effective_from`, `notes`. Unique `(org_id, item_id, revision_no)`. Only one `active` per item, enforced by a partial unique index.

**bom_lines** — `bom_id`, `line_type` enum(`material`,`component`,`packaging`,`subassembly`,`machine_time`,`labour`,`other_cost`), `ref_item_id`, `ref_equipment_id`, `ref_activity_id`, `qty_per_unit numeric(20,6)`, `unit_id`, `waste_rate numeric(9,6) default 0`, `amount_cents` for `other_cost`, `sort_order`, `notes`.

Check constraint: exactly one of `ref_item_id`, `ref_equipment_id`, `ref_activity_id`, `amount_cents` is set, matching `line_type`.

**Revision rule.** Editing a BOM that has never been used by a completed run edits in place. Editing one that has been used creates revision `n+1` and supersedes the previous. A completed production run stores `bom_id`, so the exact revision consumed is always recoverable.

**Cycle detection.** A recursive check on save walks `bom_lines.ref_item_id` for subassembly lines and rejects a save that reaches the owning item. Without it the cost rollup recurses until the request dies.

**pricing_snapshots** — `item_id`, `channel_id`, `taken_at`, `pricing_unit_cost numeric(20,8)`, `inventory_unit_cost`, `target_margin`, `expected_contribution_margin`, `list_price_cents`, `break_even_contribution_cents`, `break_even_overhead_cents`, `inputs jsonb`, `notes`. Immutable. This is the Q3 answer if quotations stay out of scope.

---

## 8. Production

**production_runs** — `item_id`, `bom_id`, `planned_qty`, `units_accepted`, `units_failed`, `started_at`, `completed_at`, `status` enum(`planned`,`in_progress`,`completed`,`cancelled`), `estimated_total_cost_cents`, `actual_total_cost_cents`, `abnormal_loss_cents`, `capitalised_cost_cents`, `actual_cost_per_accepted_unit numeric(20,8)`, `rate_snapshot jsonb`, `notes`.

`rate_snapshot` stores the ids **and the values** of every rate version used: equipment rate, kWh rate, each labour rate, the overhead version, and the BOM revision. Ids alone would not survive a rate row being archived.

**production_run_lines** — `run_id`, `line_type`, `ref_item_id`/`ref_equipment_id`/`ref_activity_id`, `expected_qty`, `actual_qty`, `unit_id`, `unit_cost_at_run numeric(20,8)`, `cost_cents`. Normalised rather than only JSON so reports can aggregate consumption by item across runs.

**Completion transaction.** One database transaction performs: consumption movements for every material line, an output movement for accepted units, a failure movement, waste movements, the finished-goods average recalculation, the cost snapshot write, and the status change. Any failure rolls all of it back. FR-33.

**Immutability.** A completed run cannot be edited. It can be reversed, which writes opposite movements and sets status `cancelled` with a reason, leaving both the original and the reversal visible.

---

## 9. Sales

**sales** — `sale_date date`, `reference_no`, `customer_name`, `channel_id`, `channel_fee_version_id`, `commission_fee_cents`, `payment_fee_cents`, `fixed_fee_cents`, `other_costs_cents`, `shipping_charged_cents`, `shipping_cost_cents`, `discount_cents`, `payment_status`, `fulfilment_status`, `revenue_cents`, `cogs_cents`, `gross_profit_cents`, `net_revenue_cents`, `contribution_profit_cents`, `cost_source` enum(`actual`,`estimate`), `notes`.

Fees are stored as **amounts**. The channel rate fills the field as a default; changing the channel's rate later cannot rewrite this sale.

**sale_lines** — `sale_id`, `item_id`, `quantity`, `unit_price_cents`, `line_discount_cents`, `unit_cogs numeric(20,8)`, `line_cogs_cents`, `production_run_id` nullable for optional traceability, `notes`.

Index: `(org_id, sale_date desc, id)`, `(org_id, item_id, sale_date)`.

---

## 10. Import and support tables

**import_batches** — `template_code`, `file_path`, `status` enum(`validating`,`validated`,`applied`,`failed`,`cancelled`), `row_count`, `error_count`, `dry_run boolean`, `summary jsonb`.

**import_rows** — `batch_id`, `row_number`, `raw jsonb`, `status`, `error_code`, `error_message`, `created_record_id`.

**activity_log** — `entity_table`, `entity_id`, `action`, `changes jsonb`, `actor`, `occurred_at`. Covers edits to records that are not inventory movements, such as a rate change or an archive.

---

## 11. Row Level Security

Every business table: `using (org_id in (select my_org_ids()))` for select, and the same with a role check for insert, update and delete.

- `owner`: full access.
- `manager`: all operational tables, no `memberships`, no rate versions, no `organizations`.
- `production`: `production_runs`, `production_run_lines`, `inventory_movements` insert, read of `items` and `boms`. No cost columns — enforced by a restricted view rather than by hiding columns in the client.
- `inventory`: purchases, receiving, adjustments, counts.
- `readonly`: select only.

v1 creates only `owner` memberships. The policies for the other roles ship inactive but written, so adding a user later is an insert, not a migration. **Cost hiding for production staff is a view-level concern and is the one piece of the permission model that will need real work when staff are added** — flagged rather than hidden.

---

## 12. Archive behaviour

| Entity                                     | On archive                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Item                                       | Hidden from pickers. Remains on every historical movement, BOM line, run and sale. Blocked if it has stock on hand |
| Supplier                                   | Hidden from pickers. Purchases remain                                                                              |
| BOM                                        | Superseded, never removed. Runs keep pointing at their revision                                                    |
| Equipment, activity, channel, rate version | Hidden from pickers. Snapshots keep the values                                                                     |
| Purchase, run, sale                        | Never archived. Cancelled with a reason and a reversal                                                             |
| Inventory movement                         | Never archived, never deleted, only reversed                                                                       |

---

## 13. Indexes worth stating explicitly

`inventory_movements (org_id, item_id, occurred_at, id)` — the item history screen and every as-of valuation.
`inventory_movements (org_id, source_table, source_id)` — "what did this run move".
`sales (org_id, sale_date desc, id)` — the sales list, paged. The trailing `id` is deliberate: paging over a non-unique sort returns rows in a different order per page, duplicating some and skipping others.
`purchase_lines (org_id, item_id)` — item cost history.
`items (org_id, item_type) where archived_at is null` — pickers.
`production_runs (org_id, completed_at desc, id)`.
