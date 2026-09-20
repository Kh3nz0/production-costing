# Phase 2 — Industry and Competitor Research

Project: Production Cost, Inventory, and Profit System
Date: 2026-09-18
Status: awaiting approval

Legend: **[FACT]** verifiable from sources or measured directly · **[ASSUMPTION]** inferred · **[RECOMMENDATION]** my proposal · **[DECIDED]** locked

Not accounting or tax advice. Philippine tax points are context for costing design and should be confirmed with an accountant before they affect filings.

---

## 1. Competitor comparison

| Tool                                                                                                 | Built for                                    | Costing method                                                                                                                             | BOM depth                                              | What it does well                                                                                                                                                                                           | Where it fails this project                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Craftybase (now also branded Stocksmith)                                                             | Handmade and D2C small manufacturers         | Weighted average, COGS derived from BOM at production time                                                                                 | Multi-level, subassemblies, batch recipes, cost rollup | Closest existing product to this brief: material plus labour plus overhead rolled into COGS, batch and lot tracking, production history                                                                     | Cost model is opaque at the point of decision; no separate attended-vs-unattended time; no channel price back-solve; subscription and US-centric                                                          |
| Katana Cloud Inventory                                                                               | Scaling manufacturers with staff             | Actual manufacturing cost from BOM and production activity                                                                                 | Multi-level with subassemblies                         | Real-time shortage alerts, strong production floor model                                                                                                                                                    | Priced from about USD 179/month, with core features moved into add-ons; reviews report it punishes businesses with many small-ticket orders. Routings and work centres are overhead for a one-person shop |
| MRPeasy                                                                                              | Small and mid manufacturers up to ~200 staff | Cost rollup through BOM and routings                                                                                                       | Multi-level plus routings, work centres, operations    | One-click product cost and lead time, finite scheduling, Gantt capacity view                                                                                                                                | From about USD 49/user/month. Routings, work centres and capacity planning are the complexity this project must not import                                                                                |
| Inventora                                                                                            | Makers, Etsy and Shopify sellers             | Auto COGS on synced sales; distributes shipping across received materials                                                                  | Single-level recipes, automatic material deduction     | Cheapest real entry point, free hobby tier, clean automatic deduction, allocates inbound shipping into material cost                                                                                        | Shallow: no multi-level components, thin reporting, no equipment or overhead model                                                                                                                        |
| Unleashed / Cin7 Core                                                                                | Wholesale and light manufacturing            | FIFO on purchased stock. **Products with a Production BOM can only use Average Cost**; Assembly BOMs may use latest or fixed purchase cost | Assembly and Production BOMs                           | Landed cost allocation by quantity, weight, volume or value, extended to transfers. Labour and overhead allocated during the assembly task                                                                  | Accounting-integration-first, priced and shaped for wholesalers, heavy setup                                                                                                                              |
| LayerMath                                                                                            | 3D print sellers and Etsy shops              | Claims 14 cost layers: material, electricity, fees, VAT, failures, labour                                                                  | None — per-listing, not a BOM system                   | Back-calculates the listing price that actually hits a target margin, including fees and VAT                                                                                                                | A pricing calculator, not an operational record: no inventory, no production history, no audit trail                                                                                                      |
| Prusa calculator and the general 3D-print calculator category (printpal, 3DPCC, engineercalc, pea3d) | Hobbyists quoting one print                  | (weight x price/g) + (time x watts x rate) + depreciation, then a failure-rate uplift                                                      | None                                                   | Correct shape for the machine-cost part. Typical inputs: spool price and weight, grams used, print hours, printer wattage, kWh rate, useful life in print hours (commonly 3,000–10,000), failure percentage | Single print, no persistence, no components, no packaging, no stock, no sales. This is exactly the tool the brief is replacing                                                                            |
| Printago, AutoFarm3D / 3DQue, Filametrics                                                            | Print farms at scale                         | Not a costing layer                                                                                                                        | n/a                                                    | Job routing, cloud slicing, failure detection, per-job filament drawdown                                                                                                                                    | Fleet operations, not costing. Relevant only as a possible later integration for print time and filament weight                                                                                           |

**Category observation [FACT]:** the market splits cleanly into per-print calculators with no memory, and manufacturing inventory systems built around staff, warehouses and accounting integrations. The gap this project sits in — one owner, real BOMs, real history, an auditable ledger, and an explained calculation — is occupied only by Craftybase, and Craftybase does not explain its numbers or separate machine time from hand time.

## 2. Industry-standard workflow summary

What essentially every serious tool does, in this order:

1. **Define items and units.** Purchase unit and consumption unit differ; a conversion factor links them.
2. **Receive stock through a purchase.** Landed costs (freight, duty, fees) are allocated across lines by an explicit base — quantity, weight, volume or value — and become part of item cost. Inventora does this for inbound shipping; Cin7 Core makes the base selectable.
3. **Maintain one costing method per item.** The item cost is derived from receipts, not typed in.
4. **Build a BOM.** Quantities per unit, at multiple levels, with cost rolled up from components.
5. **Run production against the BOM.** Expected consumption is proposed, actual consumption is recorded, output is added to stock, and the run's cost is fixed at completion. Labour and overhead are attached at this step (Cin7 Core attaches them during the assembly task).
6. **Sell, and derive COGS from the stored cost**, not from current prices.
7. **Report on variance:** what it was expected to cost versus what it did cost.

Two standards worth copying exactly: cost is always **derived from recorded events**, and the **method is set per item, not per transaction**.

## 3. Recommended mechanics

| #    | Mechanic                                                                                                                                                 | Why, and the evidence                                                                                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | Append-only inventory movement ledger; stock is a derived balance                                                                                        | Universal in serious systems. Corrections are reversing entries, never edits. Without it, a mistyped count silently rewrites valuation history                                                                                                                    |
| R-02 | Per-item costing method, moving weighted average, recomputed at every receipt                                                                            | Craftybase's model and Cin7 Core's mandatory choice for Production BOMs. Suits commingled materials — a gram of filament cannot be traced to a spool                                                                                                              |
| R-03 | Store `unit_cost` **and** the resulting running average and running quantity on every movement row                                                       | Makes the average auditable and valuation at any past date recomputable. Most tools recompute silently and cannot show you why the cost moved                                                                                                                     |
| R-04 | Landed-cost allocation with a visible, selectable base: by value, by quantity, or by weight                                                              | Cin7 Core's model. The brief demands the method be explicit and visible                                                                                                                                                                                           |
| R-05 | Multi-level BOM where a subassembly is an ordinary item that has its own BOM and its own production run                                                  | Craftybase, Katana and MRPeasy all support this. Keeps one stock store and one consumption path                                                                                                                                                                   |
| R-06 | Cycle detection on BOM save (an item may not contain itself, directly or transitively)                                                                   | Without it, cost rollup recurses forever. Not a nicety — a crash                                                                                                                                                                                                  |
| R-07 | Two separate time rates: attended human hours and unattended machine hours, structurally distinct                                                        | Print-farm sources are blunt about this: "hardware parallelizes; your hands do not," and the documented pricing mistake is one hourly rate doing both jobs. Typical 2026 guidance is USD 2–4 per machine hour against USD 25–45 per human hour, roughly a 10x gap |
| R-08 | Equipment cost-recovery rate = (purchase price + expected maintenance + expected repairs) ÷ expected productive hours in the recovery period             | The calculator category's depreciation input, extended. Desktop printers are commonly assumed to last 3,000–10,000 print hours                                                                                                                                    |
| R-09 | Expected material waste as a per-BOM-line percentage, separate from unit failure rate                                                                    | Two different mechanics with two different effects. Conflating them either overstates cost or hides scrap                                                                                                                                                         |
| R-10 | Expected (normal) failure absorbs into the cost of good units; failure **above** the expected rate becomes a visible production loss, not inventory cost | Standard cost accounting: normal spoilage is absorbed into good units, abnormal spoilage is a period cost that cannot be capitalized into inventory. No maker tool found does this                                                                                |
| R-11 | Margin and markup always displayed together for the same price                                                                                           | Margin = profit ÷ price; markup = profit ÷ cost. The two produce different prices from the same intent                                                                                                                                                            |
| R-12 | Channel price back-solve: the list price needed to hit a target margin after channel fee, payment fee and shipping subsidy                               | LayerMath's core feature and the reason it exists. Belongs in the pricing layer, never in product cost                                                                                                                                                            |
| R-13 | Dated rate versions for electricity, labour, equipment and overhead, plus BOM revisions; every completed run and sale stores the rate set it used        | The brief's hardest requirement, and the thing spreadsheets cannot do                                                                                                                                                                                             |
| R-14 | Block negative stock on costed items by default                                                                                                          | A negative or zero quantity breaks the weighted-average divisor and produces nonsense unit costs that then propagate into every product using that item                                                                                                           |
| R-15 | A `vat_treatment` and `vat_amount` field on every purchase line from the first migration, even while non-VAT                                             | See section 8. Retrofitting this means re-entering purchase history                                                                                                                                                                                               |

## 4. Rejected mechanics

| #    | Rejected                                                                                                                     | Consequence of adopting it                                                                                                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X-01 | Routings, work centres, operations sequencing, capacity planning, Gantt scheduling (Katana, MRPeasy)                         | Three to four extra screens and a scheduling model, for one person with one printer. Revisit at two or more operators or five or more machines                                                      |
| X-02 | FIFO cost layers on finished goods                                                                                           | Every sale needs layer-consumption logic with partial splits, and variants fragment stock into dozens of tiny layers. The run snapshot already answers "which batch cost more"                      |
| X-03 | LIFO                                                                                                                         | Prohibited under PAS 2 / PFRS, which the Philippines follows. Not an option                                                                                                                         |
| X-04 | Full absorption costing (overhead capitalized into inventory value)                                                          | Inventory value would move with the internet bill, and unwinding it later means restating every past COGS figure. Requires period-end over/under-applied overhead variance accounting to be correct |
| X-05 | Phantom BOMs (auto-exploded subassemblies that are never stocked)                                                            | A second consumption path alongside real subassembly stock. Reconsider only if pre-making subassemblies proves not to happen                                                                        |
| X-06 | Marketplace API sync (Shopee, TikTok, Etsy) — the headline feature of Inventora and Craftybase                               | Fee schedules, payout timing and refund reconciliation are a project of their own. Manual sale entry first, kept under 20 seconds                                                                   |
| X-07 | Slicer file parsing (3MF, G-code) in the core                                                                                | Ties the engine to 3D printing before the neutral model is proven. Deliberately an optional later extension                                                                                         |
| X-08 | Per-user or per-order pricing pressure in the design, i.e. building machinery whose cost per order exceeds the order's value | Katana reviews describe exactly this failure. Design rule: the daily loop must stay cheap                                                                                                           |
| X-09 | Multi-currency in v1                                                                                                         | The engine stays currency-agnostic, the interface assumes one currency                                                                                                                              |

## 5. Costing recommendation

**Purchased items (materials, components, packaging, consumables): moving weighted average. [RECOMMENDATION]**

Evidence: it is Craftybase's model for makers, and Cin7 Core forces Average Cost for anything produced through a Production BOM. It is permitted under PAS 2. It suits commingled materials, requires tracking only total quantity and total cost rather than layers, and adjustments are a simple recalculation. The known cost is that smoothing can obscure a cost trend — mitigated here by keeping full purchase history and a "recent cost increases" report.

Mechanics to lock in Phase 3:

- Average recomputed on every receipt: `new_avg = (qty_on_hand x current_avg + qty_received x receipt_unit_cost) / (qty_on_hand + qty_received)`, where `receipt_unit_cost` already includes allocated landed cost.
- Both the receipt unit cost and the resulting running average are stored on the movement row.
- Consumption leaves stock at the running average at the moment of consumption.
- Rate precision fixed at Phase 3; amounts in integer centavos, unit costs at higher decimal precision.

**Production cost of a run [RECOMMENDATION]:** actual materials and components consumed at their running average, plus packaging, plus attended labour at the dated labour rate, plus machine hours at the dated equipment recovery rate, plus electricity at the dated kWh rate. General overhead is excluded — see section 7.

## 6. Inventory valuation recommendation

**Finished goods: weighted-average pool per product variant, with immutable per-run cost snapshots alongside. [RECOMMENDATION] — this is the answer to Phase 1 Q1.**

Evidence: Cin7 Core permits only Average Cost for Production BOM products, which is the same conclusion reached from a different direction. A manufactured unit's cost is already a blend of many inputs, so layering blends of blends buys little.

One refinement that improves on every tool reviewed: **an optional `production_run_id` on the sale line.** COGS still comes from the average pool, but when he knows a batch of 20 sold at a bazaar came from Tuesday's run, he can link it and get run-level profitability without layer accounting. Traceability becomes an opt-in reporting link rather than a mandatory costing mechanism.

Rejected alternative, stated plainly: FIFO layers on finished goods. It would answer "which run did this sale consume" automatically, at the price of layer-splitting logic on every sale and heavy fragmentation across variants. The run snapshot plus the optional link gets the same answer for the cases that matter.

## 7. Overhead recommendation

**Predetermined overhead rate per attended human hour, kept in the pricing layer and out of inventory value. [RECOMMENDATION] — this is the answer to Phase 1 Q2.**

Rate = monthly overhead pool ÷ expected monthly attended hours. A product's overhead allocation = its expected attended time x that rate. An alternative base of "percentage of direct production cost" is offered in settings.

Why attended hours and not the obvious alternatives:

| Base                                  | Verdict                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Machine hours                         | Rejected. Standard guidance reserves machine-hour bases for capital-intensive automated plants. Here an unattended 9-hour print would absorb more overhead than a hand-assembled keyboard keychain that consumed an hour of his actual attention. It allocates away from the real constraint |
| Flat peso amount per unit             | Rejected. Applies the same overhead to a ₱30 keychain and a ₱600 keyboard build                                                                                                                                                                                                              |
| Percentage of direct cost             | Offered as an alternative. Zero extra inputs, but a material-heavy cheap product absorbs little overhead even when it took an hour of handling                                                                                                                                               |
| Monthly pool ÷ expected monthly units | Rejected. Same defect as flat per unit, with an extra estimate to maintain                                                                                                                                                                                                                   |
| No allocation                         | Rejected for pricing, but see below — it is effectively what happens at the inventory layer                                                                                                                                                                                                  |

Why overhead stays out of inventory value: absorbing a monthly pool into stock requires period-end over- and under-applied overhead variance accounting to remain truthful, which is real bookkeeping machinery and unverifiable without books. Excluding it keeps COGS explainable purely from what was consumed, and keeps "contribution profit" an honest name.

**The consequence, stated as a better mental model:** overhead is not recovered per keychain, it is recovered in aggregate. The dashboard therefore shows **overhead recovered this month: total contribution profit against the monthly overhead pool**. When contribution exceeds the pool, the month is above break-even. This answers a real question that per-unit overhead fiction cannot.

## 8. Philippine considerations that affect costing

**[FACT]** VAT is 12%. Mandatory registration once annual gross sales reach ₱3,000,000, with 30 days from the end of the month in which the threshold is crossed. Below the threshold a business is generally non-VAT and pays 3% percentage tax on gross sales, unless it elects the 8% income tax regime that replaces percentage tax. Voluntary VAT registration is allowed and its main attraction is reclaiming input VAT.

**[FACT]** The Philippines applies PFRS, so PAS 2 governs inventory: FIFO and weighted average are permitted, LIFO is not.

**Costing consequences [RECOMMENDATION]:**

1. While non-VAT, VAT paid on filament, switches and packaging is **not recoverable and is therefore part of item cost**. Purchases are recorded at the price actually paid, VAT inclusive.
2. If he registers for VAT later, input VAT becomes recoverable and must be **excluded** from item cost, or every product cost is overstated by up to 12% and every margin understated.
3. Therefore purchases carry `vat_treatment` (inclusive non-recoverable / exclusive / exempt / zero-rated) and `vat_amount` from the first migration, defaulting to inclusive non-recoverable. Cheap now, expensive later: the alternative is re-entering purchase history at the moment the business is busiest.
4. The ₱3,000,000 threshold is a revenue figure the system already tracks. A dashboard indicator showing rolling 12-month gross sales against the threshold is a genuine operational warning, not decoration. Recommended for v1.
5. The inventory valuation report must be runnable **as of a date**, because an inventory list as of year-end is the shape of information BIR expects from registered taxpayers. **[ASSUMPTION]** — confirm the exact requirement with an accountant; the design requirement (valuation as of a date) holds regardless.

## 9. Design-reference analysis — platforms.e.gov.ph

Measured directly from the live site on 2026-09-18, not described from appearance. **[FACT]** for every value below.

**Headline finding:** the reference is built on a shadcn/ui semantic token set with Geist as the type family. Its variables are literally `--background`, `--foreground`, `--primary`, `--muted-foreground`, `--border`, `--sidebar`, `--radius`, `--chart-1` through `--chart-5`. Our stack is the same stack. This means we can adopt its structural logic natively and substitute our own values, which is a far better position than imitating a look.

### Measured token values

| Token                                            | Value                                                 | Note                                                                    |
| ------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `--background` / `--card` / `--popover`          | `#ffffff`                                             | Pure white, no off-white                                                |
| `--foreground`                                   | `#0b0f1a`                                             | Near-black with a blue cast, not pure black                             |
| `--primary`                                      | `#1452f0`                                             | Royal blue. 5.96:1 on white, so it passes for text and UI               |
| `--primary-foreground`                           | `#ffffff`                                             |                                                                         |
| `--secondary` / `--accent`                       | `#eef3fe`                                             | Pale blue tint surface                                                  |
| `--secondary-foreground` / `--accent-foreground` | `#12309e`                                             | Deep blue for text on the tint                                          |
| `--muted`                                        | `#f4f6fb`                                             |                                                                         |
| `--muted-foreground`                             | `#545e74`                                             | 6.4:1 on white. Passes. Not the low-contrast grey the brief warns about |
| `--border` / `--input`                           | `#e5e9f2`                                             | 1.13:1 against white. See the adaptation note                           |
| `--destructive`                                  | `#e5484d`                                             |                                                                         |
| `--sun`                                          | `#fcd116`                                             | Philippine flag yellow. Also used as `--chart-2`                        |
| `--chart-1..5`                                   | `#1452f0`, `#fcd116`, `#e5484d`, `#7396f5`, `#b3c6f8` | Two flag colours inside a five-series palette                           |
| `--radius`                                       | `0.625rem` = 10px                                     | Base; larger radii derive upward                                        |

### Measured typography

| Element                              | Value                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Family                               | Geist, everywhere                                                                                |
| Body                                 | 16px, `#0b0f1a`                                                                                  |
| H1                                   | 56px / 58.8px line height (1.05), weight 600, letter-spacing −3.36px (−0.06em)                   |
| H2                                   | 36px / 39.6px (1.10), weight 600, letter-spacing −0.9px (−0.025em)                               |
| Eyebrow label                        | 14px, weight 600, uppercase, letter-spacing +0.56px (+0.04em), colour `--primary`, no background |
| Stat label inside dashboard previews | 9px, weight 500, uppercase, +0.54px (+0.06em), `--muted-foreground`                              |
| Stat value inside dashboard previews | 14px, weight 600, −0.35px, `--foreground`                                                        |

### Measured structure and surfaces

| Mechanic         | Measured value                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Container        | `max-width: 1600px`, `padding-inline: 64px`                                                                                                                                                                              |
| Section rhythm   | 96px top and bottom                                                                                                                                                                                                      |
| Header           | 63px tall, sticky, `rgba(255,255,255,0.8)` with `backdrop-filter: blur(12px)`, 1px `#e5e9f2` bottom border                                                                                                               |
| Top stripe       | 2px, `linear-gradient(to right, #1452f0, #e5484d, #fcd116)`                                                                                                                                                              |
| Primary button   | height 56px, radius 10px, padding 0 28px, weight 500, solid `#1452f0`, **no shadow**                                                                                                                                     |
| Secondary button | same geometry, white, 1px `#e5e9f2`, no shadow                                                                                                                                                                           |
| Chip / pill      | height 32px, fully rounded, 1px border, 14px text                                                                                                                                                                        |
| Card             | radius 14 / 16 / 18px by nesting level, 1px `#e5e9f2`, shadow `0 16px 44px rgba(15,23,42,0.07)`                                                                                                                          |
| Floating panel   | radius 30–34px, shadow `0 24px 60px rgba(15,23,42,0.09)`                                                                                                                                                                 |
| Glow CTA         | `0 18px 38px rgba(37,84,244,0.28)` plus `inset 0 1px 0 rgba(255,255,255,0.32)`                                                                                                                                           |
| Highlight panel  | `linear-gradient(135deg,#0b2da8,#071855 56%,#0c37c8)` plus `radial-gradient(circle at 90% 20%, rgba(96,165,250,0.85), transparent 16%)`, blue-tinted border at 0.3 alpha, glow `0 30px 60px rgba(29,78,216,0.34)`        |
| Technical grid   | `linear-gradient(to right, rgba(148,163,184,0.14) 1px, transparent 1px)` plus the vertical twin. Used **inside preview panels only**, never as page background. On dark panels the same grid at `rgba(255,255,255,0.06)` |
| Stat tile        | radius 10px, 1px `#e5e9f2`, white, padding 8px 10px                                                                                                                                                                      |

### Mechanics to reuse

1. **Semantic token architecture verbatim in structure**, values replaced. Surface and foreground travel in pairs; one `--radius` base; a named `--chart-1..5` series.
2. **Structure by border, emphasis by one wide ambient shadow.** The primary CTA has no shadow at all. Cards use a single very low-alpha, very wide shadow. There is no mid-range drop shadow anywhere on the page. This is the main reason it reads as precise rather than templated.
3. **Nested radius decay:** 18 outer, 14 inner, 10 for tiles. Adopt as a rule: inner radius = outer radius minus padding.
4. **Uppercase eyebrow labels in accent blue with positive tracking and no background chip.** Cheap, and it carries most of the "small uppercase section label" character.
5. **The stat tile ratio:** uppercase micro label in muted, tight-tracked semibold value in foreground, inside a small bordered box.
6. **Sticky translucent blurred header with a hairline bottom border.** Directly useful for an operational app: filters and totals stay visible while a long table scrolls.
7. **The 1px slate grid at 14% alpha as chart plot-area texture,** which is where the "fine technical detail" impression comes from.
8. **Negative tracking on large numerals** (−0.025em at 36px, −0.06em at 56px). This is why their figures look engineered rather than merely large.
9. **One glowing navy panel per view, reserved for the single most important value.** Ours should be the recommended selling price, or the contribution profit on a sale.

### Mechanics to reject or adapt

1. **Scale.** 96px section padding, 56px buttons and a 1600px container are marketing dimensions. Adapt to roughly 24–32px section rhythm, 36–40px controls, 32px row actions. Keeping them would push a 20-row table across two screens.
2. **`#e5e9f2` at 1.13:1 is fine for card edges and too faint to separate table rows.** Add a distinct stronger border token for data grids, plus row hover, and never rely on the faint hairline alone for column separation.
3. **The 2px flag gradient stripe must not be reproduced in any form.** `#1452f0 → #e5484d → #fcd116` is the Philippine flag, and it is the single most government-identifying element on the page.
4. **Drop `--sun: #fcd116` entirely, including from the chart palette.** It is flag yellow, and at roughly 1.3:1 on white it fails as a warning colour anyway. Our warning colour will be a darker amber chosen for contrast.
5. **Shift the accent off `#1452f0`.** Geist plus that exact hex plus the same token names would read as the same product. Recommendation: keep a neutral grotesque with strong tabular figures (Geist itself is acceptable and free, and its numerals suit a money application) and change the accent blue. Rejected alternative: changing the type family and keeping the blue, which discards the better asset and keeps the more identifying one.
6. **The reference's stat values are 9px labels and 14px numbers because they are decorative miniatures inside a marketing image.** Copying those pixel values would produce an unreadable dashboard. Adopt the ratio and re-scale: roughly 11px labels and 26–30px values in real UI.
7. **Add `font-variant-numeric: tabular-nums` to every money and quantity figure.** The reference does not need it; a table of peso amounts does, or columns jitter as digits change.

## 10. Opportunities to improve on existing tools

1. **Split expected failure from abnormal failure.** Expected scrap absorbs into good units; a bad night becomes a visible production loss instead of quietly making the surviving stock look expensive. No maker tool reviewed does this.
2. **Make attended and unattended time structurally different.** The documented pricing mistake in this industry is one hourly rate doing both jobs.
3. **Show the derivation, not the number.** Every cost figure expands into its inputs with the dated rate used. Craftybase gives a COGS figure; success criterion 6 asks to see how it was reached.
4. **Overhead recovery as a monthly target** rather than a per-unit fiction.
5. **Margin and markup side by side, always,** with the channel back-solve as a separate explicit step.
6. **Snapshot immutability as a visible feature:** a completed run displays "cost locked" with the exact rate set it used.
7. **Philippine-specific:** VAT-inclusive cost now with a documented switch later, and a rolling 12-month gross sales indicator against the ₱3,000,000 threshold.
8. **Lead the cost breakdown with the non-material majority.** Industry sources put material at 5–15% of true cost; a breakdown that lists material first teaches the wrong lesson.

## 11. Sources

Competitors and tools

- https://craftybase.com/bill-of-materials-software
- https://craftybase.com/manufacturing-inventory-management-software
- https://craftybase.com/3d-printing-inventory-software
- https://craftybase.com/blog/fifo-lifo-and-weighted-average-cost-methods
- https://craftybase.com/compare/inventora-inventory
- https://inventora.com/features/
- https://inventora.com/pricing-plans/
- https://www.getapp.com/industries-software/a/katana-mrp/
- https://www.capterra.com/p/172888/Katana-MRP/pricing/
- https://www.capterra.com/p/134177/MRPEasy/
- https://dupple.com/reviews/mrpeasy
- https://help.core.cin7.com/hc/en-us/articles/9034464614415-Costing-Methods
- https://help.core.cin7.com/hc/en-us/articles/9034464211343-Average-Cost
- https://help.core.cin7.com/hc/en-us/articles/9034516716047-Landed-cost-expense-distribution
- https://help.core.cin7.com/hc/en-us/articles/9982508174223-An-Introduction-to-Cost-of-Goods-Sold-COGS
- https://www.growthpath.com.au/insights/173-cloud-erp-supply-chain-review-xero-dear-inventory-unleashed-cin7-and-others/
- https://layermath.com/
- https://layermath.com/blog/3d-printing-hourly-rate
- https://layermath.com/blog/how-to-run-a-3d-print-farm
- https://printago.io/
- https://www.3dque.com/autofarm3d
- https://www.gartner.com/reviews/market/3d-printing-workflow-software

3D printing cost mechanics

- https://blog.prusa3d.com/how-to-calculate-printing-costs_38650/
- https://printpal.io/tools/3d-print-cost-calculator
- https://3dprintingcostcalculator.com/news/3d-printing-cost-formula
- https://engineercalc.net/3d-print-cost-calculator/

Costing and valuation

- https://www.finaleinventory.com/accounting-and-inventory-software/inventory-costing-methods
- https://www.erpclaw.ai/blog/inventory-fifo-vs-weighted-average/
- https://www.fulfil.io/blog/inventory-valuation-methods-fifo-moving-weighted-average/
- https://www.dmcpas.com/articles/inventory-valuation-methods-for-manufacturers/
- https://www.gsquaredcfo.com/blog/inventory-costing-methods-manufacturing
- https://www.accountingformanagement.org/predetermined-overhead-rate/
- https://saylordotorg.github.io/text_managerial-accounting/s06-03-assigning-manufacturing-overhe.html
- https://phoenixstrategy.group/blog/optimizing-overhead-allocation-for-small-manufacturers
- https://madrasaccountancy.com/blog-posts/manufacturing-overhead-allocation-methods-explained
- https://www.dummies.com/article/business-careers-money/business/accounting/general-accounting/cost-accounting-normal-versus-abnormal-spoilage-164763/
- https://www.dummies.com/article/business-careers-money/business/accounting/general-accounting/cost-accounting-job-costs-for-spoilage-reworked-products-and-scrap-164765/
- https://mbaknol.com/business-finance/accounting-treatment-for-material-losses-waste-scrap-and-spoilage/

Philippine tax context

- https://www.cleartax.com/ph/vat-philippines
- https://cloudcfo.ph/resources/ph-taxes/vat
- https://emerhub.com/philippines/philippines-vat-calculator/
- https://taxify.ph/blog/vat-registration-threshold-philippines/
- https://taxsummaries.pwc.com/philippines/corporate/other-taxes

Design reference

- https://platforms.e.gov.ph/ — inspected live, computed styles and CSS custom properties read directly from the running page on 2026-09-18
