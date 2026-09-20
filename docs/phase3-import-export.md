# Phase 3 — Import and Export Specification

Part 5 of 7.

---

## 1. Import principles

1. **Dry run first, always.** An upload never writes on the first pass. It validates every row and reports what would happen.
2. **Row-level outcomes.** Each row succeeds or fails on its own terms and reports a row number, a field, a reason and a suggested fix.
3. **Partial apply is allowed** but never silent: the confirmation states how many rows will be written and how many skipped.
4. **Reversible as a batch.** An applied import can be undone, which reverses the movements it created and archives the records it inserted, provided nothing downstream references them.
5. **Names resolve to records, not ids.** The templates use human names because the owner is filling them in a spreadsheet. An unmatched name is an error with the closest matches offered, never a silently created record.
6. **Numbers are plain.** No currency symbol, no thousands separators. A cell containing `₱1,250.50` is a row error with the correction shown, because guessing at a locale is how a decimal point moves.

## 2. Templates and their order

Order matters: later templates reference names from earlier ones.

| #   | Template              | Creates                                         | Depends on                             |
| --- | --------------------- | ----------------------------------------------- | -------------------------------------- |
| 1   | `01-units`            | units                                           | —                                      |
| 2   | `03-suppliers`        | suppliers                                       | —                                      |
| 3   | `02-items`            | items                                           | units, suppliers                       |
| 4   | `04-purchases`        | purchase headers                                | suppliers                              |
| 5   | `05-purchase-lines`   | purchase lines, then receipt movements on apply | purchases, items                       |
| 6   | `06-opening-stock`    | opening_balance movements                       | items                                  |
| 7   | `07-equipment`        | equipment, first rate version                   | —                                      |
| 8   | `08-utility-rates`    | utility rate versions                           | units                                  |
| 9   | `09-labor-activities` | activities, first rate version                  | units                                  |
| 10  | `10-overhead`         | overhead version and lines                      | —                                      |
| 11  | `11-products`         | items of type finished_product, product_details | categories                             |
| 12  | `12-bom-lines`        | boms revision 1 and lines                       | products, items, equipment, activities |
| 13  | `13-sales-channels`   | channels, first fee version                     | —                                      |

## 3. Validation rules by class

| Class       | Rule                                            | Error message shape                                                                        |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Required    | Missing value in a required column              | "Row 14: item name is required"                                                            |
| Reference   | Name does not match an existing record          | "Row 14: no item named 'PLA Basik'. Did you mean 'PLA Basic Filament'?"                    |
| Number      | Not parseable as a decimal                      | "Row 14: unit price '₱1,150.00' is not a plain number. Enter 1150.00"                      |
| Range       | Outside the allowed range                       | "Row 14: failure rate 1.2 must be below 1"                                                 |
| Unit        | Unit unknown, or conversion undefined           | "Row 14: cannot convert kg to pc for Mechanical Switch. Set a pack size on the item first" |
| Duplicate   | SKU already used, or duplicated within the file | "Row 14: SKU KC-3SW already exists on 'Clickable Keychain 3-switch'"                       |
| Consistency | Cross-row contradiction                         | "Rows 14 and 19 give different pack sizes for the same item"                               |
| Order       | Depends on a template not yet imported          | "Import 02-items before 12-bom-lines"                                                      |

## 4. Import result

A dry run returns: total rows, rows that would be created, rows that would be updated, rows that would be skipped, the error list, and a downloadable error CSV containing the original rows plus two appended columns, `error_field` and `error_message`, so the owner fixes the file he already has rather than transcribing from a screen.

## 5. Export specification

**Per-report export.** Every report exports exactly what is on screen: the same rows, the same filters, the same column order, the same totals. A CSV whose total disagrees with the screen is a defect (AC-12).

**Full-account export.** One action produces a ZIP containing one CSV per table, plus `manifest.json` recording the schema version, the export timestamp, the row count per file, and the application version. The manifest exists so a restore can tell whether an archive predates a schema change.

Tables included: organizations, units, item_categories, items, product_details, suppliers, purchases, purchase_lines, equipment, equipment_rate_versions, utility_rates, labor_activities, labor_rate_versions, overhead_versions, overhead_version_lines, sales_channels, channel_fee_versions, boms, bom_lines, inventory_movements, production_runs, production_run_lines, sales, sale_lines, pricing_snapshots, item_channel_prices, activity_log.

**Format rules.** UTF-8 with BOM so Excel opens Philippine peso text correctly. ISO dates. Money exported as a decimal string with two places, not as centavos, because the file is for a human. A second column `*_cents` accompanies each money column for lossless re-import.

## 6. Backup and restore

Research question from the brief: should a complete owner-controlled backup format exist beyond CSV? **Recommendation: yes, and it should be two things, not one.**

1. **A weekly automated `pg_dump`** to private storage, which is the real restore path. CSV is not a backup: it loses constraints, defaults, functions and RLS policies, and restoring twenty-seven CSVs in dependency order by hand is not a procedure anyone completes correctly under stress.
2. **The full CSV archive** as the portability guarantee, which is what the no-lock-in requirement actually asks for. It proves the data can leave, and it is readable in fifty years when the application is gone.

**Restore procedure must be tested before launch**, not documented and assumed. NFR-12. The test is: restore the dump into an empty project, run `rebuild_item_balances`, and assert that inventory valuation matches the source to the centavo.

**Retention:** twelve weekly dumps. A failed dump fails loudly rather than committing an empty file, which is the specific failure mode that makes a backup routine worthless.
