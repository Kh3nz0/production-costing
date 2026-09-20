# Phase 1 — Understand the Project

Project: Production Cost, Inventory, and Profit System (working title)
Owner: Khenzo Bacani
Date: 2026-09-18
Status: awaiting approval

Legend: **[FACT]** stated by the owner · **[ASSUMPTION]** inferred, needs confirmation · **[RECOMMENDATION]** my proposal, not yet approved · **[DECIDED]** locked

---

## 1. Confirmed problem statement

The owner prices physical products without knowing what they actually cost to make. Existing calculators count only material and electricity, which makes products look profitable while ignoring purchased components, packaging, preparation and assembly labour, machine cost recovery, maintenance, failed prints, wasted material, marketplace and payment fees, discounts, shipping subsidies, and business overhead.

Second problem: the same information is re-entered for every product and every quotation, because nothing is stored as a reusable record.

Third problem, the one that makes this a system rather than a calculator: costs change. A spool bought at a new price must change future estimates without rewriting the cost of production runs already completed or sales already made. Spreadsheets cannot hold that distinction reliably.

The system therefore has to be the operational record of how products are costed, produced, stocked, and sold — with an auditable history.

## 2. Confirmed user groups

| Group                  | v1                                   | Notes                                                                             |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| Owner / Admin          | Fully implemented                    | Single user at launch. Full access to costing, profit, supplier prices, settings. |
| Manager                | Schema + permissions designed, no UI | Products, purchases, inventory, production, sales, permitted reports.             |
| Production staff       | Schema + permissions designed, no UI | Production runs, permitted inventory actions, no profit data.                     |
| Inventory staff        | Schema + permissions designed, no UI | Purchases, receiving, counts, movements.                                          |
| Read-only / accountant | Schema + permissions designed, no UI | Reports and exports only.                                                         |

Every business-owned row carries an organisation identifier and audit fields from day one, so staff can be added later without a migration that rewrites history. **[FACT]**

## 3. Confirmed v1 outcomes

1. Calculate product costs and recommend selling prices.
2. Track material, component, packaging, and finished-product inventory.
3. Log production runs with accepted output, failures, waste, and actual cost.
4. Log sales with fees, discounts, and shipping, producing actual contribution profit.

Supporting capability required for those four to be trustworthy, and therefore also in v1: business setup and reusable rates, the inventory movement ledger, dated cost history, reports with date filters, and CSV export.

## 4. Initial workflow map

Six workflows. Frequency drives interface priority.

| #   | Workflow            | Frequency          | Primary device                | Core steps                                                                                                                                                                                                 |
| --- | ------------------- | ------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Set up the business | Once, then rarely  | Desktop                       | Business profile, currency/locale/timezone, units and conversions, electricity rate, equipment, labour activities, overhead rule, sales channels, pricing defaults                                         |
| 1   | Buy                 | Weekly             | Desktop, mobile for receiving | Record purchase, enter lines and purchase units, add discounts/shipping/duties, allocate landed cost, receive quantities, inventory moves in, new cost record created                                      |
| 2   | Define              | Occasional, bursts | Desktop                       | Create item, create product, build recipe/BOM, add labour and equipment time, set waste and failure allowance, choose packaging, read cost breakdown, set target margin, see recommended price per channel |
| 3   | Make                | Daily              | Mobile and desktop            | Start run, confirm expected consumption, record actual consumption, record accepted and failed units, record waste, complete run, inventory moves out and in, immutable cost snapshot written              |
| 4   | Sell                | Daily              | Mobile                        | Record sale, pick product and variant, quantity and price, discount, channel fee, payment fee, shipping charged and shipping paid, finished goods move out at preserved cost, contribution profit shown    |
| 5   | Watch               | Weekly             | Desktop                       | Dashboard, low stock, products below target margin, estimate vs actual, reports, CSV export                                                                                                                |

Dependency order: 0 → 1 → 2 → 3 → 4 → 5. Nothing downstream is trustworthy until the one before it is recorded, which is also the correct build order.

## 5. What belongs in v1

In scope: single active business; units and conversions; items across material, component, packaging, consumable, subassembly, finished product; suppliers and purchases with landed-cost allocation; equipment and utility rates with effective dates; labour activities; one overhead allocation rule; products, variants, BOMs; cost breakdown with a visible calculation trail; margin and markup pricing side by side; production runs with failures and waste; the inventory movement ledger; manual sales with fees, discounts, and shipping; sales channels with default fee rules that can be overridden per sale; the listed reports with date filters; CSV import for bulk setup; CSV export; owner-only authentication with RLS; soft archive instead of deletion; automated tests for costing and inventory mutations.

## 6. What should wait

| Deferred                                                      | Reason                                                                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Multi-business switcher UI                                    | Schema supports it; a switcher adds state and permission surface with no current second business               |
| Staff role UIs and invitations                                | No second user exists yet; roles are designed, not built                                                       |
| 3MF / G-code parsing                                          | Would tie the core to 3D printing before the neutral engine is proven                                          |
| Marketplace API sync (Shopee, TikTok)                         | Fee and payout reconciliation is its own project; manual entry first                                           |
| Offline inventory editing                                     | Requires conflict resolution; a wrong stock number is worse than no stock number                               |
| PWA install                                                   | **[RECOMMENDATION]** Defer. Installing a shell that cannot write offline mostly produces stale-cache confusion |
| Purchase orders with approval flow                            | Single owner; a purchase record is enough                                                                      |
| Bookkeeping, general ledger, payroll, tax filing, VAT returns | Different domain; the brief excludes it                                                                        |
| Multi-currency                                                | PHP only; the engine stays currency-agnostic but the UI assumes one currency                                   |
| Customer records / CRM                                        | Optional customer name on a sale is enough for v1                                                              |
| Barcode scanning                                              | Useful later for counts; not needed at current volume                                                          |
| Customer-facing quotation documents                           | **[OPEN — Q3]** Pricing snapshots may be enough                                                                |

## 7. Assumption register

| ID   | Assumption                                                                                                     | Impact if wrong                                                                                                 | Confirm by |
| ---- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------- |
| A-01 | One business, one user, for the whole of v1                                                                    | Low. Schema is multi-tenant regardless                                                                          | Phase 1    |
| A-02 | Volume is tens of production runs and low hundreds of sales per month, not thousands                           | Medium. Changes pagination, batch entry, and whether bulk sale import is needed in v1                           | Phase 1    |
| A-03 | Sales are recorded after the fact, in batches, often from a phone                                              | Medium. Drives mobile-first sale entry and a fast repeat-last-sale path                                         | Phase 1    |
| A-04 | Finished goods are produced before they are sold, so stock exists at sale time                                 | High. If he sells to order, the sale must be able to trigger or reference a run, or fall back to estimated cost | Phase 1    |
| A-05 | Single production location, no transfers between locations                                                     | Medium. Adding locations later means a location column on every movement                                        | Phase 3    |
| A-06 | Equipment cost recovery is a planning rate, not book depreciation for tax                                      | Low, but the labels must say so                                                                                 | Phase 2    |
| A-07 | No VAT registration yet, so purchase prices are recorded VAT-inclusive as paid                                 | Medium. If VAT-registered, input VAT must be separated or costs are overstated                                  | Phase 2    |
| A-08 | Labour is the owner's own time, valued at a chosen rate rather than a payroll cost                             | Low, but "profit" must not be read as including a salary already paid                                           | Phase 2    |
| A-09 | Existing data lives in Bambu Studio outputs, Meralco bills, receipts, and memory — no clean spreadsheet exists | Medium. Drives the data-collection template and CSV import shape                                                | Phase 1    |
| A-10 | English interface only                                                                                         | Low                                                                                                             | Phase 3    |
| A-11 | Desktop is the real setup environment; mobile is for logging, checking, and selling                            | Medium. Drives the responsive plan                                                                              | Phase 1    |

## 8. Contradictions and tensions found

**C-01 — Weighted-average costing and preserved run costs are two different valuation layers.** Weighted average recalculates a moving cost as stock arrives. A production-run snapshot preserves one batch's actual cost forever. Both are wanted. They agree for raw materials. They collide for finished goods: if finished goods sit in one weighted-average pool, a sale cannot tell you which run's cost it consumed, and "this batch cost more" disappears from COGS. See Q1.

**C-02 — Overhead and labour absorbed into inventory value undermine the audit trail.** If monthly overhead is allocated into the cost of finished goods, inventory value moves with the internet bill and the subscription renewals, and COGS stops being explainable from consumption. See Q2.

**C-03 — Success criterion 5 puts fees inside the product cost, but fees are already subtracted at the sale.** "Include labor, equipment, electricity, waste, packaging, overhead, and fees" in the estimated cost, while contribution profit subtracts marketplace and payment fees from revenue, double counts them. Fees are a function of price and channel, not of making the product. See Q4.

**C-04 — Expected waste and failure allowance are different mechanics and must not compound by accident.** Waste inflates material consumed per good unit (purge, supports, spillage). Failure inflates the number of units that must be started to get the quantity wanted. Applying both as a single percentage either overstates cost or hides scrap. The calculation specification must define them separately with a worked example.

**C-05 — "Gross profit" and "contribution profit" need fixed definitions or the dashboard will lie.** Proposal for Phase 3: gross profit = revenue − COGS. Contribution profit = gross profit − discounts − channel fee − payment fee − shipping subsidy − other sale costs. Neither is net profit, and the interface never uses that phrase.

**C-06 — "Not designed around 3D printing" versus a brief full of 3D-printing specifics.** Resolution: 3D printing enters only as data — a printer is an equipment row, a print is machine time, filament is an item with grams as base unit, purge is waste. No column, table, or screen in the core mentions printing. See D-006.

**C-07 — Products and inventory items are the same thing viewed twice.** A finished product must have stock, and a subassembly is both something produced and something consumed. Keeping products and items in separate tables with separate stock invites two sources of truth. Position for Phase 3: one item table, with a product facet holding recipe, pricing, and variants.

**C-08 — Integer minor units are right for money amounts and wrong for unit rates.** ₱1,200 per kilogram is ₱1.20 per gram, which is fine, but 7 cm of a five-metre chain, or a per-minute machine rate, needs more precision than centavos. Position: amounts in integer centavos; unit costs, rates, and conversion factors in fixed-point decimal with documented precision.

**C-09 — The Figma file lives on a Department of Information and Communications Technology organisation seat, and the visual reference is a DICT platform.** Two separate risks: the organisation may own files created on its seat, and a private business system designed inside that workspace, closely modelled on a government service, is harder to defend as unrelated to government identity. See Q5.

## 9. Decisions that could create serious consequences later

| Risk                                        | Consequence if decided wrongly                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Finished-goods cost method (Q1)             | Rewriting how COGS is assigned after real sales exist means recomputing history or losing it                                      |
| Overhead absorption (Q2)                    | Absorbed overhead is extremely hard to unwind; inventory valuation and every past COGS figure would need restating                |
| Movement ledger as the only source of stock | If a quantity column is ever written directly, the ledger and the balance diverge and neither can be trusted                      |
| Snapshot immutability                       | If a run or sale reads live prices instead of stored ones, past profit changes every time a supplier raises a price               |
| Organisation identifier on every row        | Retrofitting tenancy onto existing data is the most common cause of a rebuild                                                     |
| Units and conversions                       | Allowing an unconstrained conversion (kilograms to pieces with no defined relationship) silently corrupts every cost that uses it |
| Soft archive vs delete                      | A deleted supplier or item referenced by a completed run destroys the audit trail                                                 |

## 10. Initial scope boundaries

The system records how things are made and sold. It does not do accounting, it does not file taxes, it does not sell, and it does not talk to marketplaces in v1. It is a private, authenticated, single-owner application with a database built for more owners later.

Explicitly not promised: offline stock changes, automatic slicer file parsing, real-time marketplace fees, accounting-grade net profit, or tax advice.
