# Phase 3 — Product Requirements

Project: Production Cost, Inventory, and Profit System
Date: 2026-09-18
Status: awaiting approval

Part 1 of 7. See also: `phase3-calculations.md`, `phase3-data-model.md`, `phase3-ia-flows-permissions.md`, `phase3-import-export.md`, `phase3-build-plan.md`, `phase3-design-direction.md`.

---

## 1. Goals

| #   | Goal                                                     | Measured by                                                                                                                                                                                               |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-1 | Know the true cost of a product before setting its price | A product's cost breakdown accounts for material, components, packaging, attended labour, machine recovery, electricity, expected waste and expected failure, and every figure expands to show its inputs |
| G-2 | Never enter the same fact twice                          | An item, rate, activity or channel is recorded once and referenced by every product that uses it                                                                                                          |
| G-3 | Keep history truthful                                    | Changing a current price changes future estimates only. No completed run or past sale changes value                                                                                                       |
| G-4 | Know what is actually on the shelf                       | Stock is derived from an append-only ledger, and every change is attributable                                                                                                                             |
| G-5 | Know what a sale actually earned                         | Contribution profit after COGS, discounts, channel fees, payment fees and shipping                                                                                                                        |
| G-6 | Survive growth without a rebuild                         | Staff, a second business, and a second currency are schema-possible from day one                                                                                                                          |

## 2. Non-goals

Bookkeeping or a general ledger. Payroll. Tax computation or filing. VAT return preparation. An online store. Marketplace API synchronisation. Customer relationship management. Purchase order approval workflows. Production scheduling, routings, work centres or capacity planning. Offline stock mutation. Slicer file parsing. Multi-currency transactions. Barcode scanning. Demand forecasting. Anything described as net profit.

## 3. User types

| Type                   | v1            | Description                                                                                           |
| ---------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| Owner / Admin          | Built         | Sole operator. Sets up everything, costs products, runs production, records sales, reads every report |
| Manager                | Designed only | Operates everything except settings, rates and user management                                        |
| Production staff       | Designed only | Records production runs and consumption. No cost or profit visibility                                 |
| Inventory staff        | Designed only | Purchases, receiving, counts, adjustments. No profit visibility                                       |
| Accountant / read-only | Designed only | Reads reports and exports. No operational writes                                                      |

## 4. User stories

Written as owner stories because that is the v1 user. Each maps to acceptance criteria in section 7.

**Setup**

- US-01 As the owner I record my business name, currency, locale and time zone so figures and dates render correctly.
- US-02 I define units and conversions so I can buy in spools and consume in grams.
- US-03 I record my printer's purchase price and expected productive hours so machine time carries a real cost.
- US-04 I record my electricity rate with the bill it came from so old runs keep the rate that applied then.
- US-05 I record labour activities with hourly rates, marking which ones occupy my hands.
- US-06 I record my monthly overhead so pricing can recover it.
- US-07 I record my sales channels and their fee rates.

**Items and buying**

- US-08 I create an item once, with a purchase unit and a consumption unit.
- US-09 I record a purchase with shipping and discounts, and see how those were spread across the lines.
- US-10 I receive a different quantity from the one I ordered and the cost follows what arrived.
- US-11 I see an item's unit cost derived from what I paid, never typed by hand.
- US-12 I see how an item's cost has moved over time and which purchase moved it.
- US-13 I record what is already on my shelf as an opening balance without inventing a purchase.

**Products and pricing**

- US-14 I build a product recipe from items, machine time and labour activities.
- US-15 I add a waste percentage to a recipe line for purge and supports.
- US-16 I set an expected failure rate for a product.
- US-17 I see the estimated cost per unit and per batch, broken into components that expand to show their inputs.
- US-18 I see the price for a target margin and the price for a target markup, side by side, and understand they differ.
- US-19 I see the list price needed on a specific channel to still hit my margin after that channel's fees.
- US-20 I see the price below which a sale loses money, and the higher price above which it also covers its share of my monthly running costs.
- US-21 I create a variant that reuses the shared recipe rather than duplicating it.
- US-22 I save a dated pricing snapshot so I can tell a customer a price and still know later what it assumed.

**Producing**

- US-23 I start a production run for a product and quantity and see what it expects to consume.
- US-24 I record what was actually consumed when it differs from the expectation.
- US-25 I record accepted units, failed units and wasted material.
- US-26 I complete the run, stock moves, and the run's cost is locked with the rates it used.
- US-27 I see whether the run cost more or less than estimated, and which component caused it.
- US-28 When a run fails badly, I see the excess as a production loss rather than as inflated stock value.

**Selling**

- US-29 I record a sale in under twenty seconds on my phone.
- US-30 I apply a discount, a channel fee, a payment fee and a shipping figure.
- US-31 I see revenue, COGS, gross profit, fees, shipping result and contribution profit for that sale.
- US-32 I see which products and which channels actually make money.

**Watching**

- US-33 I see which materials are below their reorder point.
- US-34 I see which products are below their target margin.
- US-35 I see whether this month's contribution has covered my overhead.
- US-36 I see my rolling twelve-month sales against the VAT registration threshold.
- US-37 I review a full movement history for any item and understand every change.
- US-38 I export any report to CSV.

## 5. Functional requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                            | Priority |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-01 | Email and password authentication. No public sign-up route                                                                                                                                                                                                                                                             | Must     |
| FR-02 | All business data scoped to an organisation, enforced by Row Level Security                                                                                                                                                                                                                                            | Must     |
| FR-03 | Units with dimensions, and conversions valid only within a dimension or via an explicit item-level factor                                                                                                                                                                                                              | Must     |
| FR-04 | Items of type raw material, purchased component, packaging, consumable, subassembly, finished product                                                                                                                                                                                                                  | Must     |
| FR-05 | Item variants sharing a parent, each with its own SKU and stock                                                                                                                                                                                                                                                        | Must     |
| FR-06 | Suppliers                                                                                                                                                                                                                                                                                                              | Must     |
| FR-07 | Purchases with lines, discounts, shipping, duties and other landed costs                                                                                                                                                                                                                                               | Must     |
| FR-08 | Landed-cost allocation by value, quantity or weight, with the base shown and quantity/weight bases validated before they can be selected                                                                                                                                                                               | Must     |
| FR-09 | Partial receiving: quantity received may differ from ordered                                                                                                                                                                                                                                                           | Must     |
| FR-10 | Moving weighted-average cost recomputed on every receipt                                                                                                                                                                                                                                                               | Must     |
| FR-11 | Append-only inventory movement ledger of eleven event types                                                                                                                                                                                                                                                            | Must     |
| FR-12 | Cached stock balance and average cost, rebuildable from the ledger by a single function                                                                                                                                                                                                                                | Must     |
| FR-13 | Opening balances entered without a purchase                                                                                                                                                                                                                                                                            | Must     |
| FR-14 | Stock adjustments requiring a reason                                                                                                                                                                                                                                                                                   | Must     |
| FR-15 | Negative stock blocked on costed items                                                                                                                                                                                                                                                                                 | Must     |
| FR-16 | Equipment with a cost-recovery rate derived from price, maintenance, repairs and expected productive hours                                                                                                                                                                                                             | Must     |
| FR-17 | Utility rates with an effective date and a source reference                                                                                                                                                                                                                                                            | Must     |
| FR-18 | Labour activities with an hourly rate and an attended flag                                                                                                                                                                                                                                                             | Must     |
| FR-19 | Overhead pool with an allocation rule and a rate                                                                                                                                                                                                                                                                       | Must     |
| FR-20 | All four rate types versioned by effective date, never updated in place                                                                                                                                                                                                                                                | Must     |
| FR-21 | BOM with lines of type material, component, packaging, subassembly, machine time, labour, other cost                                                                                                                                                                                                                   | Must     |
| FR-22 | Per-line waste rate; per-product failure rate                                                                                                                                                                                                                                                                          | Must     |
| FR-23 | BOM revisions; a completed run references the revision it consumed                                                                                                                                                                                                                                                     | Must     |
| FR-24 | Multi-level BOMs with cycle detection on save                                                                                                                                                                                                                                                                          | Must     |
| FR-25 | Estimated cost per unit and per batch, split into inventory cost and pricing cost                                                                                                                                                                                                                                      | Must     |
| FR-26 | Expandable cost breakdown showing every input and the dated rate used                                                                                                                                                                                                                                                  | Must     |
| FR-27 | Margin and markup shown together for the same price                                                                                                                                                                                                                                                                    | Must     |
| FR-28 | Channel-aware price back-solve, expected contribution margin, and both break-even figures                                                                                                                                                                                                                              | Must     |
| FR-29 | Dated pricing snapshots                                                                                                                                                                                                                                                                                                | Must     |
| FR-30 | Production runs with planned and actual quantities, consumption, labour, machine time, failures and waste                                                                                                                                                                                                              | Must     |
| FR-31 | Normal failure absorbed into accepted units; abnormal failure recorded as a production loss                                                                                                                                                                                                                            | Must     |
| FR-32 | Run completion writes an immutable cost snapshot including every rate used                                                                                                                                                                                                                                             | Must     |
| FR-33 | Run completion is transactional: all movements and the snapshot commit together or none do                                                                                                                                                                                                                             | Must     |
| FR-34 | Sales with lines, discounts, channel fee, payment fee, fixed fees, shipping charged and shipping paid                                                                                                                                                                                                                  | Must     |
| FR-35 | Optional link from a sale line to a production run for traceability                                                                                                                                                                                                                                                    | Should   |
| FR-36 | Contribution profit and contribution margin per line and per sale                                                                                                                                                                                                                                                      | Must     |
| FR-37 | Sales channels with default fee rules, overridable per sale                                                                                                                                                                                                                                                            | Must     |
| FR-38 | Dashboard: inventory value, low stock, products below target margin, production cost this month, revenue, contribution profit, average margin, waste rate, failure rate, best sellers, most profitable, recent cost increases, recent purchases, recent runs, recent sales, overhead recovery, VAT threshold indicator | Must     |
| FR-39 | Twelve reports, each date-filtered and CSV-exportable                                                                                                                                                                                                                                                                  | Must     |
| FR-40 | Inventory valuation as of a chosen date                                                                                                                                                                                                                                                                                | Must     |
| FR-41 | CSV import for the thirteen setup templates, with dry-run validation and a row-level error report                                                                                                                                                                                                                      | Must     |
| FR-42 | Full-account export of every table as CSV in one archive                                                                                                                                                                                                                                                               | Must     |
| FR-43 | Soft archive on every record history depends on; no destructive delete                                                                                                                                                                                                                                                 | Must     |
| FR-44 | Duplicate-submission protection on every mutating form                                                                                                                                                                                                                                                                 | Must     |
| FR-45 | Missing inputs are flagged and excluded, never silently treated as zero                                                                                                                                                                                                                                                | Must     |
| FR-46 | Role-ready permission model, with only the owner role active in v1                                                                                                                                                                                                                                                     | Must     |

## 6. Non-functional requirements

| ID     | Requirement                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Decimal-safe arithmetic throughout. Money as integer centavos, quantities and rates as fixed-point decimal. No float in any costing path |
| NFR-02 | Every costing formula covered by automated unit tests, including the worked examples in `phase3-calculations.md`                         |
| NFR-03 | Every inventory mutation covered by an integration test asserting ledger and balance agreement                                           |
| NFR-04 | Server-side authorisation for every mutation. Client-side checks are presentation only                                                   |
| NFR-05 | All operational writes carry created_by, created_at, updated_by, updated_at                                                              |
| NFR-06 | WCAG 2.2 AA: contrast, visible focus, keyboard operability, labelled controls, announced errors                                          |
| NFR-07 | Touch targets at least 44 by 44 CSS pixels on mobile                                                                                     |
| NFR-08 | Usable at 390, 768 and 1440 px, designed for each rather than scaled                                                                     |
| NFR-09 | A sale recordable in under 20 seconds on a phone by an experienced user                                                                  |
| NFR-10 | Any list of 5,000 rows paginated or virtualised, never fetched whole                                                                     |
| NFR-11 | Error logging that never records supplier prices, costs or margins in log payloads                                                       |
| NFR-12 | Documented backup and restore procedure, tested by an actual restore before launch                                                       |
| NFR-13 | No beta, canary or release-candidate dependencies. Versions pinned in the lockfile                                                       |
| NFR-14 | Time zone Asia/Manila for display; timestamps stored as UTC                                                                              |

## 7. Acceptance criteria for the first usable release

Each maps to the owner's twenty-two success criteria. "Done when" is observable.

| #     | Done when                                                                                                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | A purchase of one 1 kg filament spool with shipping produces an item unit cost per gram that equals (line total + allocated shipping) ÷ 1000, verifiable on screen                                                            |
| AC-02 | The same item appears in three different product recipes without re-entry                                                                                                                                                     |
| AC-03 | A product with a recipe containing material, component, packaging, machine time and labour shows a cost breakdown whose components sum to the stated total, and each component expands to its inputs with the dated rate used |
| AC-04 | Changing the target margin changes the recommended price immediately, and the markup figure changes with it                                                                                                                   |
| AC-05 | A recorded production run deducts exactly the quantities entered, adds exactly the accepted units, and writes one ledger movement per stock change                                                                            |
| AC-06 | A run with failures above the expected rate shows an abnormal production loss, and the accepted units' cost per unit is lower than total cost ÷ accepted units                                                                |
| AC-07 | After a run is completed, changing a material's price does not alter that run's recorded cost                                                                                                                                 |
| AC-08 | A sale shows revenue, COGS, gross profit, each fee, shipping result and contribution profit, and the arithmetic is reproducible by hand                                                                                       |
| AC-09 | An item below its reorder point appears in low stock on the dashboard                                                                                                                                                         |
| AC-10 | A product whose current estimated margin is below its target appears in the below-target list                                                                                                                                 |
| AC-11 | An item's movement history shows every change with type, quantity, resulting balance, resulting average cost, related record, user and timestamp                                                                              |
| AC-12 | Every report exports a CSV whose totals match the on-screen totals                                                                                                                                                            |
| AC-13 | Recording a purchase, a run and a sale is completable on a 390 px viewport without horizontal scrolling                                                                                                                       |
| AC-14 | Adding a second user with a non-owner role requires no schema migration                                                                                                                                                       |
| AC-15 | Rebuilding balances from the ledger reproduces every current quantity and average cost exactly                                                                                                                                |

## 8. Constraints

- Free tier or low cost only. Supabase free tier and Vercel hobby are the assumed hosting.
- One operator, so every workflow must be completable alone.
- No accountant involved at launch, so nothing may require accounting knowledge to operate correctly.
- The owner is rebuilding frontend knowledge, so clarity of code structure matters alongside correctness.
- Philippine peso, Philippines locale, Asia/Manila. Currency not hard-coded.

## 9. Out of scope for v1

Everything in section 2, plus: supplier returns workflow (movement type exists, no dedicated screen), customer returns workflow (same), stock transfers between locations, serial or lot tracking, expiry dates, cycle counting schedules, purchase requisitions, quotation documents pending Q3, dark mode, and multi-language.

## 10. Risk register

| ID    | Risk                                                                               | Likelihood                  | Impact | Mitigation                                                                                              |
| ----- | ---------------------------------------------------------------------------------- | --------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| RK-01 | Data entry never happens, so the system holds no real data                         | Medium                      | High   | The data-collection package exists before the build; CSV import is a v1 requirement, not a later nicety |
| RK-02 | VAT registration mid-life invalidates historical item costs                        | Low now, rises with revenue | High   | vat_treatment and vat_amount recorded from migration one; documented switch procedure                   |
| RK-03 | Cached balances drift from the ledger                                              | Medium                      | High   | Both written in one transaction; a rebuild function; AC-15 tests it                                     |
| RK-04 | Weighted average hides a rising material cost                                      | Medium                      | Medium | Recent cost increases report; purchase price history retained                                           |
| RK-05 | Abnormal-loss rule confuses the owner the first time it fires                      | Medium                      | Medium | The run summary states the arithmetic in words, not just numbers                                        |
| RK-06 | Estimated cost drifts from reality because rates were set once and never revisited | High                        | Medium | Estimate versus actual report; a settings review prompt when a rate is older than twelve months         |
| RK-07 | Mobile sale entry too slow, so sales are never logged                              | Medium                      | High   | NFR-09 is a tested criterion, not an aspiration                                                         |
| RK-08 | Supabase free tier limits reached                                                  | Low                         | Medium | Row volumes are small; export and restore documented                                                    |
| RK-09 | The design reads as a government product                                           | Low after Phase 2 decisions | High   | D-026: flag palette removed, accent shifted, no government naming or marks                              |
| RK-10 | Scope creep toward ERP                                                             | Medium                      | High   | Section 2 is enforced at every phase gate                                                               |
| RK-11 | Figma file ownership sits with a government organisation                           | Open, Q5                    | Medium | Awaiting the owner's decision                                                                           |
