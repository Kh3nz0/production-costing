# Phase 3 — Information Architecture, Flows and Permissions

Part 4 of 7.

---

## 1. Sitemap and routes

Next.js App Router. `(app)` is an authenticated layout group.

| Route                                 | Purpose                                                                                | Auth            |
| ------------------------------------- | -------------------------------------------------------------------------------------- | --------------- |
| `/login`                              | Email and password. No sign-up link                                                    | Public          |
| `/reset-password`                     | Recovery, checked above the session check                                              | Public          |
| `/onboarding`                         | First-run setup wizard                                                                 | Session, no org |
| `/dashboard`                          | The operating picture. Default landing                                                 | Session         |
| `/items`                              | All items, filtered by type                                                            | Session         |
| `/items/new`, `/items/[id]`           | Create, view, edit. Detail has tabs: Overview, Stock, Cost history, Movements, Used in | Session         |
| `/suppliers`, `/suppliers/[id]`       | Directory and purchase history                                                         | Session         |
| `/purchases`                          | List, filtered by status and date                                                      | Session         |
| `/purchases/new`, `/purchases/[id]`   | Record, receive, view allocation                                                       | Session         |
| `/products`                           | Sellable items with margin status                                                      | Session         |
| `/products/new`, `/products/[id]`     | Detail with tabs: Overview, Recipe, Cost, Pricing, Variants, History                   | Session         |
| `/production`                         | Run list by status                                                                     | Session         |
| `/production/new`, `/production/[id]` | Plan, record, complete                                                                 | Session         |
| `/sales`                              | Sale list                                                                              | Session         |
| `/sales/new`, `/sales/[id]`           | Record, view profit breakdown                                                          | Session         |
| `/inventory`                          | On-hand summary with low-stock filter                                                  | Session         |
| `/inventory/movements`                | The full ledger, filterable                                                            | Session         |
| `/inventory/valuation`                | Value as of a date                                                                     | Session         |
| `/inventory/adjust`                   | Adjustment and opening balance entry                                                   | Session         |
| `/reports`                            | Report index                                                                           | Session         |
| `/reports/[slug]`                     | Twelve reports, each date-filtered and exportable                                      | Session         |
| `/settings/business`                  | Name, logo, currency, locale, time zone, VAT status                                    | Owner           |
| `/settings/units`                     | Units and conversions                                                                  | Owner           |
| `/settings/equipment`                 | Equipment and rate versions                                                            | Owner           |
| `/settings/utilities`                 | Utility rates                                                                          | Owner           |
| `/settings/labour`                    | Activities and rate versions                                                           | Owner           |
| `/settings/overhead`                  | Pool, method, versions                                                                 | Owner           |
| `/settings/channels`                  | Channels and fee versions                                                              | Owner           |
| `/settings/pricing`                   | Default target margin, rounding, price ending rules                                    | Owner           |
| `/settings/import`                    | CSV import, mapping, dry run, errors                                                   | Owner           |
| `/settings/export`                    | Report and full-account export                                                         | Owner           |
| `/settings/users`                     | Members and roles. Present but owner-only in v1                                        | Owner           |

Report slugs: `product-cost`, `inventory-on-hand`, `inventory-movements`, `inventory-valuation`, `purchase-history`, `supplier-spending`, `production-history`, `waste-and-failure`, `sales-profitability`, `channel-profitability`, `estimate-vs-actual`, `cost-changes`.

## 2. Navigation architecture

**Desktop (1440).** Persistent left sidebar, 240 px, in two groups.
Operate: Dashboard · Items · Purchases · Production · Sales · Inventory.
Understand: Products · Reports.
Footer: Settings, then the account menu.
Products sits under Understand rather than Operate because defining a product is occasional work, while items, purchases, production and sales are the daily loop.

**Tablet (768).** The same sidebar collapsed to a 64 px icon rail, labels on hover and on focus. Tables keep their columns but drop to the priority-2 set.

**Mobile (390).** Bottom tab bar with five destinations: Dashboard · Production · Sales · Inventory · More. More opens a sheet holding Items, Purchases, Products, Reports, Settings. The five chosen are the ones with a daily or weekly rhythm; everything occasional lives one tap deeper.

A single floating action button on mobile offers Record a sale, Start a run, Record a purchase, Adjust stock.

## 3. Table-to-mobile transformation rules

Applies to every list in the system.

1. **Each table declares a column priority.** Priority 1 columns are the identity of the row and the one number that matters. Priority 2 supports scanning. Priority 3 is detail.
2. **1440:** all columns. **768:** priority 1 and 2. **390:** the table becomes a stack of record cards.
3. **A record card** shows the priority-1 identity as its title, the priority-1 number right-aligned and typographically dominant, at most three priority-2 facts as a label-value row beneath, and status as a badge. Tapping opens the detail view.
4. **No horizontal scrolling of a data table on mobile.** The only exception is a deliberate matrix report, which gets a pinned first column and an explicit "scroll for more" affordance.
5. **Totals are never hidden.** A table with a footer total keeps that total visible on mobile as a sticky summary bar above the list.
6. **Filters** become a bottom sheet triggered by a button that shows the active filter count.

Column priorities, stated once here and honoured in Phase 6:

| Table           | Priority 1                | Priority 2                           | Priority 3                                   |
| --------------- | ------------------------- | ------------------------------------ | -------------------------------------------- |
| Items           | Name, quantity on hand    | Type, unit cost, reorder status      | SKU, category, supplier, lead time           |
| Purchases       | Supplier, total           | Date, status                         | Reference, line count, VAT treatment         |
| Products        | Name, current margin      | Estimated cost, list price           | SKU, variants, target margin                 |
| Production runs | Product, status           | Date, accepted, actual cost per unit | Planned, failed, variance                    |
| Sales           | Date, contribution profit | Channel, revenue                     | Reference, customer, fees, fulfilment        |
| Movements       | Item, quantity change     | Type, date                           | Resulting balance, cost effect, source, user |

## 4. Workflow diagrams

Text form here; drawn in Figma on page `06 — Flows`.

**W-1 First-run setup**

```
Sign in → no org → Onboarding
  Step 1 Business: name, currency PHP, locale, timezone
  Step 2 Electricity: rate per kWh + bill reference        [skippable, flagged]
  Step 3 Equipment: name, price, expected productive hours [skippable, flagged]
  Step 4 Labour: at least one activity + hourly rate       [skippable, flagged]
  Step 5 Overhead: monthly pool + expected attended hours  [skippable, flagged]
  Step 6 Channels: at least Direct sale                    [skippable, flagged]
  → Dashboard, showing a Setup incomplete card listing what was skipped
```

Every step is skippable because forcing complete setup before first use is how a system never gets used. Skipped steps become named gaps rather than silent zeros.

**W-2 Record a purchase and receive**

```
/purchases/new → supplier, date, reference
  → add lines: item, qty ordered, purchase unit, unit price
  → extras: shipping, duties, discount, VAT treatment
  → choose allocation base (value default; others validated)
  → Preview allocation: per-line allocated amount and resulting unit cost shown BEFORE saving
  → Save as draft  |  Receive now
Receive → confirm qty received per line (defaults to ordered)
  → transaction: movements purchase_received, weighted average recomputed, unit costs stored
  → confirmation names the new unit cost of each item and the change from the previous one
```

**W-3 Create a product and its BOM**

```
/products/new → name, category, variant attributes
  → Recipe tab → add lines by type
      material/component/packaging → item picker, qty per unit, unit, waste %
      machine_time → equipment picker, time per unit
      labour → activity picker, time per unit
  → cycle check on save
  → Cost tab → breakdown, each row expandable to its inputs and the dated rate used
  → Pricing tab → target margin, margin/markup pair, per-channel price, expected contribution margin, both break-even figures
  → Save pricing snapshot (optional)
```

**W-4 Record a production run**

```
/production/new → product, variant, planned accepted quantity
  → system computes units to start = ceil(planned / (1 − failure rate))
  → Expected consumption table shown, editable
  → Start run  [status in_progress]
  ... work happens ...
  → Record actuals: consumption per line, machine hours, labour hours
  → Record output: accepted, failed, waste per item
  → Review: estimated vs actual, normal vs abnormal failure, abnormal loss called out in words
  → Complete  [one transaction: consumption, output, failure, waste, FG average, snapshot]
  → Summary: cost per accepted unit, variance, what moved
```

**W-5 Record a sale**

```
/sales/new → date defaults today, channel defaults last used
  → add line: product, quantity, unit price (defaults to that channel's list price)
  → discount, shipping charged, actual shipping
  → fees prefilled from the channel's current fee version, each overridable
  → live panel: revenue, COGS, gross profit, fees, shipping result, contribution profit, contribution margin
  → Save  [movements: sale; FG average unchanged]
If no costed stock: blocked with explanation, override records cost_source = estimate and flags the sale
```

**W-6 CSV import**

```
/settings/import → choose template → upload → column mapping (auto-matched, correctable)
  → Dry run: row count, per-row errors with row numbers and reasons, nothing written
  → Fix and re-upload, or Apply valid rows only
  → Apply → batch record with a per-row outcome, reversible as a batch
```

## 5. Click paths for the eighteen prototype workflows

These are the Phase 7 prototype starting points.

| #   | Workflow                   | Path                                                                                |
| --- | -------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Initial business setup     | `/login` → Onboarding step 1 → … → step 6 → `/dashboard`                            |
| 2   | Add a material             | `/items` → New item → type, units, factor → Save → `/items/[id]`                    |
| 3   | Record a purchase          | `/purchases` → New → lines → extras → allocation preview → Save                     |
| 4   | Receive inventory          | `/purchases/[id]` → Receive → confirm quantities → Confirm → unit cost change shown |
| 5   | Create a product           | `/products` → New → details → Save → Recipe tab                                     |
| 6   | Create a BOM               | `/products/[id]` → Recipe → add lines → Save                                        |
| 7   | View a cost breakdown      | `/products/[id]` → Cost → expand a component row                                    |
| 8   | Adjust a target margin     | `/products/[id]` → Pricing → change target → prices update live                     |
| 9   | Record a production run    | `/production` → New → product, quantity → Start                                     |
| 10  | Record failed units        | `/production/[id]` → Output → failed quantity → abnormal loss appears               |
| 11  | Record waste               | `/production/[id]` → Output → Waste → item, quantity, reason                        |
| 12  | Complete a run             | `/production/[id]` → Review → Complete → summary                                    |
| 13  | Record a sale              | `/sales` → New → product, price, channel → Save                                     |
| 14  | View contribution profit   | `/sales/[id]` → profit breakdown                                                    |
| 15  | Review inventory movements | `/inventory/movements` → filter by item → row detail                                |
| 16  | Import through CSV         | `/settings/import` → template → upload → map → dry run → apply                      |
| 17  | Handle import errors       | dry-run result → error list → download error CSV → fix → re-upload                  |
| 18  | View a low-stock alert     | `/dashboard` → Low stock card → item → Reorder                                      |

## 6. Permissions matrix

C create, R read, U update, A archive, X none. v1 activates the owner column only.

| Area                                       | Owner | Manager | Production     | Inventory      | Read-only |
| ------------------------------------------ | ----- | ------- | -------------- | -------------- | --------- |
| Business settings                          | CRUA  | R       | X              | X              | X         |
| Users and roles                            | CRUA  | X       | X              | X              | X         |
| Units                                      | CRUA  | R       | R              | R              | R         |
| Equipment, utility, labour, overhead rates | CRUA  | R       | R (no amounts) | R (no amounts) | R         |
| Sales channels and fees                    | CRUA  | R       | X              | X              | R         |
| Items                                      | CRUA  | CRUA    | R              | CRU            | R         |
| Item costs and supplier prices             | R     | R       | X              | R              | R         |
| Suppliers                                  | CRUA  | CRUA    | X              | CRUA           | R         |
| Purchases                                  | CRUA  | CRUA    | X              | CRU            | R         |
| Receiving                                  | CRU   | CRU     | X              | CRU            | R         |
| Products and BOMs                          | CRUA  | CRUA    | R (no costs)   | X              | R         |
| Pricing and margins                        | CRUA  | R       | X              | X              | R         |
| Production runs                            | CRUA  | CRUA    | CRU            | R              | R         |
| Inventory adjustments                      | CRU   | CRU     | X              | CRU            | R         |
| Inventory movements                        | R     | R       | R (own)        | R              | R         |
| Sales                                      | CRUA  | CRUA    | X              | X              | R         |
| Profit reports                             | R     | R       | X              | X              | R         |
| Operational reports                        | R     | R       | R              | R              | R         |
| Exports                                    | R     | R       | X              | X              | R         |

**The one hard part, stated plainly.** Production and Inventory staff must not see cost or profit columns. Hiding them in the client is not security, because the row already travelled. This needs cost-free database views for those roles, which is real work. It is designed now and built when a second user exists. Nothing in v1 depends on it, and nothing in v1 prevents it.

## 7. Authentication requirements

- Email and password through Supabase Auth. No public sign-up route in v1; the owner account is created directly.
- Password recovery through a reset screen checked **above** the session check, because a recovery link creates a real session and would otherwise land on the dashboard with the old password still valid.
- Expired recovery links route to the same screen and explain themselves rather than dropping the user on login.
- Session persisted; no idle timeout in v1, since it is a single-owner private tool.
- Every mutation re-checks authorisation on the server. Client checks are presentation only.

## 8. Screen states

Every operational screen defines all of these. A screen is not complete in Figma without them.

| State               | Rule                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Loading             | Skeletons matching the real layout's shape. No spinners on full pages                        |
| Empty, first use    | Explains what the screen is for and offers the one action that fills it                      |
| Empty, filtered     | Says which filter excluded everything and offers to clear it                                 |
| Partial             | Content present but with missing inputs flagged, for example a cost with no electricity rate |
| Success             | Inline confirmation naming what changed, including the resulting figure                      |
| Warning             | Non-blocking, for example a waste rate above 100%                                            |
| Error, field        | Beside the field, naming the rule and how to satisfy it                                      |
| Error, request      | Retryable, preserving entered data. Never discards a form                                    |
| Permission denied   | Explains which role is required, never a bare 403                                            |
| Destructive confirm | Names the exact record and the consequence, and requires typing for irreversible actions     |
