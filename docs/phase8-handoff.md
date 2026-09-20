# Phase 8 — Figma-to-Code Handoff

Part 1 of 2. Companion: `phase8-build-order.md` (data and API requirements, implementation order, testing, technical constraints).

Source of truth: `vHvJDjDOhZQWysnl02Sxth` — "Production Cost, Inventory & Profit — UI Design"
Design approved: 2026-09-19 · 73 screen frames, 23 component sets

**The approved Figma file is the interface's source of truth.** If a technical constraint requires a different interface, the Figma file is updated first and the change is approved. Nothing is redesigned during development. Section 11 lists the changes already known to be needed.

---

## 1. Route inventory

Next.js App Router. `(app)` is an authenticated layout group; `(auth)` is public.

| Route                          | Figma frame                                                                           | Tier |
| ------------------------------ | ------------------------------------------------------------------------------------- | ---- |
| `/login`                       | Sign in / 1440 · 768 · 390                                                            | 1    |
| `/forgot-password`             | Forgot password / 1440                                                                | 3    |
| `/reset-password`              | — (uses the forgot-password layout)                                                   | 3    |
| `/onboarding`                  | Onboarding — Business / Electricity / Equipment / Labour / Overhead / Channels / 1440 | 2    |
| `/dashboard`                   | Dashboard / 1440 · 768 · 390                                                          | 1    |
| `/items`                       | Items / 1440 · 768 · 390                                                              | 1    |
| `/items/new`                   | New item / 1440                                                                       | 3    |
| `/items/[id]`                  | Item detail / 1440                                                                    | 3    |
| `/suppliers`                   | Suppliers / 1440                                                                      | 3    |
| `/purchases`                   | Purchases / 1440 · 768 · 390                                                          | 1    |
| `/purchases/new`               | New purchase / 1440 · 768 · 390                                                       | 1    |
| `/purchases/[id]/receive`      | Receive purchase / 1440                                                               | 3    |
| `/products`                    | Products / 1440 · 768 · 390                                                           | 1    |
| `/products/new`                | New product / 1440                                                                    | 3    |
| `/products/[id]/recipe`        | Product — Recipe / 1440                                                               | 3    |
| `/products/[id]/cost`          | Product — Cost / 1440 · 768 · 390                                                     | 1    |
| `/products/[id]/pricing`       | Product — Pricing / 1440 · 768 · 390                                                  | 1    |
| `/production`                  | Production / 1440 · 768 · 390                                                         | 1    |
| `/production/new`              | Start a run / 1440                                                                    | 3    |
| `/production/[id]/output`      | Production run — Output / 1440 · 768 · 390                                            | 1    |
| `/production/[id]/review`      | Production run — Review / 1440                                                        | 3    |
| `/sales`                       | Sales / 1440 · 768 · 390                                                              | 1    |
| `/sales/new`                   | Record a sale / 1440 · 768 · 390                                                      | 1    |
| `/sales/[id]`                  | Sale detail / 1440                                                                    | 3    |
| `/inventory`                   | Inventory / 1440 · 768 · 390                                                          | 1    |
| `/inventory/movements`         | Inventory movements / 1440 · 768 · 390                                                | 1    |
| `/inventory/valuation`         | Inventory valuation / 1440                                                            | 2    |
| `/inventory/adjust`            | Adjust stock / 1440                                                                   | 3    |
| `/reports`                     | Reports / 1440                                                                        | 2    |
| `/reports/estimate-vs-actual`  | Report — Estimate vs actual / 1440                                                    | 2    |
| `/reports/sales-profitability` | Report — Sales profitability / 1440                                                   | 2    |
| `/reports/waste-and-failure`   | Report — Failures and waste / 1440                                                    | 2    |
| `/reports/[slug]` × 9          | **share the three exemplars' template**                                               | 2    |
| `/settings/business`           | Settings — Business / 1440                                                            | 3    |
| `/settings/equipment`          | Settings — Equipment / 1440                                                           | 3    |
| `/settings/labour`             | Settings — Labour / 1440                                                              | 3    |
| `/settings/overhead`           | Settings — Overhead / 1440                                                            | 3    |
| `/settings/channels`           | Settings — Sales channels / 1440                                                      | 3    |
| `/settings/units`              | **template: Settings — Labour**                                                       | 3    |
| `/settings/utilities`          | **template: Settings — Equipment**                                                    | 3    |
| `/settings/pricing`            | **template: Settings — Business**                                                     | 3    |
| `/settings/import`             | Import — dry run / 1440                                                               | 2    |
| `/settings/export`             | Settings — Export and backup / 1440                                                   | 3    |
| `/settings/people`             | Settings — People / 1440                                                              | 3    |
| `403`                          | Permission denied / 1440                                                              | 3    |
| `404`                          | Not found / 1440                                                                      | 3    |

Routes marked **template** have no dedicated frame. They reuse a named frame's structure and are listed so nobody has to guess which one. `robots: noindex, nofollow` on every route.

## 2. Screens without a frame

Three categories, each handled differently. Nothing is left to inference silently.

| Category                                                                          | Rule                                                                                                                                           |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Tablet and mobile for desk work (settings, suppliers, forms, onboarding, reports) | Density comes from the breakpoint table in section 5. Tables follow the table-to-mobile rule in section 6. No new visual decisions             |
| Nine report routes                                                                | Copy the exemplar whose data shape matches: breakdown → Sales profitability; time series → Estimate vs actual; comparison → Failures and waste |
| Four settings routes                                                              | Copy the named template. Rate-versioned settings copy Equipment; list settings copy Labour; plain forms copy Business                          |

## 3. Design token mapping

Figma variable → Tailwind theme key → emitted CSS property. One source, three names, no third value invented anywhere.

### Colour

| Figma                         | Tailwind                 | CSS                          | Value                                                           |
| ----------------------------- | ------------------------ | ---------------------------- | --------------------------------------------------------------- |
| `color/background`            | `colors.background`      | `--color-background`         | `#FFFFFF`                                                       |
| `color/surface`               | `colors.surface.DEFAULT` | `--color-surface`            | `#FFFFFF`                                                       |
| `color/surface-raised`        | `colors.surface.raised`  | `--color-surface-raised`     | `#FFFFFF` — separates from `surface` only in dark mode          |
| `color/surface-sunken`        | `colors.surface.sunken`  | `--color-surface-sunken`     | `#F6F8FB`                                                       |
| `color/surface-accent`        | `colors.surface.accent`  | `--color-surface-accent`     | `#EEF3FE`                                                       |
| `color/text/primary`          | `colors.text.primary`    | `--color-text-primary`       | `#0B1020`                                                       |
| `color/text/secondary`        | `colors.text.secondary`  | `--color-text-secondary`     | `#4F5A70`                                                       |
| `color/text/tertiary`         | `colors.text.tertiary`   | `--color-text-tertiary`      | `#6B7689`                                                       |
| `color/text/inverse`          | `colors.text.inverse`    | `--color-text-inverse`       | `#FFFFFF`                                                       |
| `color/border/default`        | `colors.border.DEFAULT`  | `--color-border`             | `#EDF0F6` — disabled control fills only, never a visible border |
| `color/border/strong`         | `colors.border.strong`   | `--color-border-strong`      | `#E3E8F0`                                                       |
| `color/border/control`        | `colors.border.control`  | `--color-border-control`     | `#7E8BA3`                                                       |
| `color/border/focus`          | `colors.border.focus`    | `--color-border-focus`       | `#1552F0`                                                       |
| `color/accent/default`        | `colors.accent.DEFAULT`  | `--color-accent`             | `#1552F0`                                                       |
| `color/accent/hover`          | `colors.accent.hover`    | `--color-accent-hover`       | `#1240C8`                                                       |
| `color/accent/pressed`        | `colors.accent.pressed`  | `--color-accent-pressed`     | `#0E32A6`                                                       |
| `color/accent/subtle`         | `colors.accent.subtle`   | `--color-accent-subtle`      | `#EEF3FE`                                                       |
| `color/accent/text`           | `colors.accent.text`     | `--color-accent-text`        | `#1039B8`                                                       |
| `color/status/success`        | `colors.success.DEFAULT` | `--color-success`            | `#1A7F4B`                                                       |
| `color/status/success-fill`   | `colors.success.fill`    | `--color-success-fill`       | `#30A46C` — fill, dot, icon, chart only                         |
| `color/status/success-subtle` | `colors.success.subtle`  | `--color-success-subtle`     | `#E9F7EF`                                                       |
| `color/status/warning`        | `colors.warning.DEFAULT` | `--color-warning`            | `#C2410C`                                                       |
| `color/status/warning-fill`   | `colors.warning.fill`    | `--color-warning-fill`       | `#F76B15` — fill, dot, icon, chart only                         |
| `color/status/warning-subtle` | `colors.warning.subtle`  | `--color-warning-subtle`     | `#FEF1E7`                                                       |
| `color/status/danger`         | `colors.danger.DEFAULT`  | `--color-danger`             | `#C62A2F`                                                       |
| `color/status/danger-fill`    | `colors.danger.fill`     | `--color-danger-fill`        | `#E5484D` — fill, dot, icon, chart only                         |
| `color/status/danger-hover`   | `colors.danger.hover`    | `--color-danger-hover`       | `#A82026`                                                       |
| `color/status/danger-subtle`  | `colors.danger.subtle`   | `--color-danger-subtle`      | `#FDECEC`                                                       |
| `color/value/positive`        | `colors.value.positive`  | `--color-positive-value`     | `#1A7F4B`                                                       |
| `color/value/negative`        | `colors.value.negative`  | `--color-negative-value`     | `#C62A2F`                                                       |
| `color/chart/1..6`            | `colors.chart.1..6`      | `--color-chart-1..6`         | `#0E32A6` `#1552F0` `#7397F6` `#B4C8FA` `#C62A2F` `#6E7D93`     |
| `color/brand/bloop`           | `colors.brand.DEFAULT`   | `--color-brand-bloop`        | `#980B2D`                                                       |
| `color/brand/bloop-deep`      | `colors.brand.deep`      | `--color-brand-bloop-deep`   | `#7C0724`                                                       |
| `color/brand/bloop-subtle`    | `colors.brand.subtle`    | `--color-brand-bloop-subtle` | `#F8E7EB`                                                       |

**Three rules that are not negotiable.**
`colors.value.*` and `colors.success`/`colors.danger` currently share hex values but are separate tokens. Never alias one to the other: a negative margin is information, not an error, and if the status palette shifts, routine figures must not shift with it.
`colors.border.control` is the only border permitted on an input, select, checkbox or switch outline — WCAG 1.4.11 requires 3:1 and it is the only one that clears it.
`colors.brand.*` is for the wordmark and brand surfaces. It never becomes an action, link or focus colour. See D-074.

### Type

| Figma style       | Tailwind class      | Size / line | Weight | Tracking           |
| ----------------- | ------------------- | ----------- | ------ | ------------------ |
| `text/micro`      | `text-micro`        | 11 / 16     | 500    | +0.06em, uppercase |
| `text/caption`    | `text-caption`      | 12 / 18     | 400    | 0                  |
| `text/body-sm`    | `text-body-sm`      | 13 / 20     | 400    | 0                  |
| `text/body`       | `text-body`         | 14 / 22     | 400    | 0                  |
| `text/body-lg`    | `text-body-lg`      | 16 / 26     | 400    | 0                  |
| `text/heading-sm` | `text-heading-sm`   | 14 / 20     | 600    | −0.01em            |
| `text/heading`    | `text-heading`      | 18 / 24     | 600    | −0.015em           |
| `text/title`      | `text-title`        | 20 / 26     | 600    | −0.02em            |
| `text/value-sm`   | `text-value-sm`     | 16 / 22     | 600    | −0.02em            |
| `text/value`      | `text-value`        | 24 / 30     | 600    | −0.025em           |
| `text/value-lg`   | `text-value-lg`     | 32 / 38     | 600    | −0.03em            |
| `text/mono-sm`    | `font-mono text-xs` | 12 / 18     | 400    | 0                  |

Family: Geist (`--font-sans`), Geist Mono (`--font-mono`). Load via `next/font/local` or `geist` package, subset latin.

**`font-variant-numeric: tabular-nums` is mandatory** on every money figure, quantity, percentage and date. Apply it on the component (`CurrencyValue`, `QuantityValue`, table cells), not per instance. Without it, a column of pesos shifts horizontally as digits change, and this interface is mostly columns of pesos.

### Space, radius, shadow

Space is a 4px scale: `space-1` 4 … `space-12` 96. Radius: `rounded-control` 8, `rounded-card` 12, `rounded-panel` 16, `rounded-pill` 999. Nested radius decays — inner = outer − padding.

| Figma effect         | Tailwind             | Value                                                                      |
| -------------------- | -------------------- | -------------------------------------------------------------------------- |
| `shadow/card`        | `shadow-card`        | `0 12px 32px rgb(11 16 32 / 0.06)` — always with a 1px border              |
| `shadow/overlay`     | `shadow-overlay`     | `0 20px 48px rgb(11 16 32 / 0.12)`                                         |
| `shadow/accent-glow` | `shadow-accent-glow` | `0 14px 32px rgb(21 82 240 / 0.24), inset 0 1px 0 rgb(255 255 255 / 0.28)` |

**There is no mid-range drop shadow in this system.** Structure comes from borders. Do not add `shadow-sm` or `shadow-md` anywhere.

**Border weight (D-091, superseding D-085).** Every decorative border is **1px** on `--color-border-strong` (#E3E8F0, 1.23:1) — card edges, dividers, table rules, chips, chart gridlines. One token, one width, no exceptions on the decorative side. Soft borders come from the value, not the width, which is how both reference sites achieve the effect.

`--color-border` (#EDF0F6) is **not** a border in code. It survives only as the fill of a disabled control. Do not reach for it for a card edge: two neighbouring hairline greys were a distinction nobody could see and they drifted apart in the design file.

The withdrawn 0.25px rule is recorded because it will look like a regression in the git history: sub-pixel borders round unpredictably and can vanish on a 1x display, and the sweep that applied it also thinned form-control outlines to invisibility.

Form control outlines are the exception and use **1px** on `--color-border-control` (#7E8BA3, 3.44:1), because WCAG 1.4.11 asks 3:1 of a component edge. An input on `--color-border-strong` has no visible boundary; that was a real defect on 100 instances in the design file (F-19). Disabled controls are exempt from 1.4.11 and use `--color-border-strong`. Focus rings are **2px** on `--color-border-focus`. The active tab underline is **2px** on `--color-accent`.

**Buttons carry no border.** `secondary` is a filled `surface-sunken`, not an outline; `ghost` is transparent; `danger` is a solid `#C62A2F` because white on `#E5484D` is only 3.91:1.

## 4. Component mapping

shadcn/ui supplies accessible primitives. Every row below is restyled; none ships with default shadcn appearance. The domain components have no shadcn equivalent.

| Figma component                          | Code component                                                                                                  | Base                 | Notes                                                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button (24 variants)                     | `<Button>`                                                                                                      | shadcn Button        | 36px md, radius 8, no shadow on primary. Focus: 2px `border-focus`, 2px offset. Variants map to `variant` + `state` is CSS, not a prop                              |
| Input (6 states)                         | `<Field>`                                                                                                       | shadcn Input + Label | Wrapper enforces a persistent label and helper. Label and helper always fill and wrap — never truncate (D-077). Error replaces helper, linked by `aria-describedby` |
| Select (6)                               | `<Select>`                                                                                                      | shadcn Select        |                                                                                                                                                                     |
| Checkbox / Radio / Switch                | `<Checkbox>` `<RadioGroup>` `<Switch>`                                                                          | shadcn               | Radio labels wrap; the disabled option's reason must stay readable                                                                                                  |
| Tab (4)                                  | `<Tabs>`                                                                                                        | shadcn Tabs          | 2px accent underline. Colour alone never signals selection                                                                                                          |
| Badge (6)                                | `<Badge tone>`                                                                                                  | shadcn Badge         |                                                                                                                                                                     |
| Status badge (20)                        | `<StatusBadge status>`                                                                                          | shadcn Badge         | 20 fixed statuses; dot plus word, never colour alone                                                                                                                |
| Toast (4)                                | `<Toast>`                                                                                                       | sonner               | Every message names the resulting figure                                                                                                                            |
| Skeleton (3)                             | `<Skeleton kind>`                                                                                               | shadcn Skeleton      | Matches the real layout's shape. Slow opacity pulse, no aggressive shimmer                                                                                          |
| Dialog (2)                               | `<ConfirmDialog>`                                                                                               | shadcn Dialog        | Names the record and the consequence                                                                                                                                |
| Empty state (4)                          | `<EmptyState state>`                                                                                            | none                 | First use, filtered, permission denied, error are four different messages                                                                                           |
| Pagination                               | `<Pagination>`                                                                                                  | shadcn Pagination    |                                                                                                                                                                     |
| File upload (4)                          | `<CsvDropzone>`                                                                                                 | none                 | Wrong type and too-large states name the problem and the fix                                                                                                        |
| Table row (3)                            | `<DataTable>`                                                                                                   | TanStack Table       | Column priority drives the responsive drop. Sticky header, sticky total                                                                                             |
| Chart / Bar                              | `<BarChart>`                                                                                                    | Recharts             | Text summary precedes the chart. Animate once on mount, never on filter change. Bars round the top edge only                                                        |
| **Table total (2)**                      | `<TableTotal>`                                                                                                  | none                 | `Pending` keeps the bar and its label and skeletons only the figures, because the total is a separate aggregate query that lands after the rows                     |
| Sidebar (9)                              | `<AppSidebar activeRoute>`                                                                                      | none                 | 240px. Bloop wordmark. An `Active` variant per destination: surface-accent pill, accent text, **solid** icon                                                        |
| Sidebar rail / 768 (9)                   | `<AppSidebar variant="rail" activeRoute>`                                                                       | none                 | 64px, labels on hover and focus. Same 9 `Active` variants                                                                                                           |
| Tab bar / Mobile (5)                     | `<MobileTabBar activeRoute>`                                                                                    | none                 | Five destinations, 44px minimum targets. `Active` variant per tab; `More` covers Items, Purchases, Products, Reports, Settings                                      |
| Stat card (3)                            | `<StatCard>`                                                                                                    | none                 | Micro-label, value, sub-label. No data renders an em dash, never a zero                                                                                             |
| **Cost breakdown row (5)**               | `<CostRow>`                                                                                                     | none                 | The most important component. Expanded shows unit cost at 6dp and amounts at 4dp plus the dated rate. This is where success criterion 6 is met or missed            |
| Margin and markup pair                   | `<MarginMarkupPair>`                                                                                            | none                 | Both figures, equal weight                                                                                                                                          |
| Production loss callout                  | `<ProductionLossCallout>`                                                                                       | none                 | States the arithmetic in words                                                                                                                                      |
| Missing input flag                       | `<MissingInputFlag>`                                                                                            | none                 | Names what is missing and links to the fix. Styled as information, not failure                                                                                      |
| — (built inline, extract on first reuse) | `<AllocationPreview>` `<MovementRow>` `<LiveProfitPanel>` `<RecordCard>` `<BreakEvenBand>` `<RateVersionTable>` | none                 | Exist on screens but not yet as Figma components. Extract in code; add to Figma when a second use appears                                                           |

## 5. Responsive behaviour

The Figma `Responsive` variable collection has Desktop / Tablet / Mobile modes. **Those are a design-time construct. There is no runtime mode in code** — they become Tailwind breakpoint variants. A developer must not look for a mode switch.

| Token                | `1440` base                    | `md:` 768        | `sm:` 390            |
| -------------------- | ------------------------------ | ---------------- | -------------------- |
| `space-page`         | 32                             | 24               | 16                   |
| `space-card`         | 20                             | 20               | 16                   |
| `space-table-cell-x` | 16                             | 12               | 16                   |
| `space-table-cell-y` | 12                             | 12               | 14                   |
| `row-height`         | 44                             | 48               | 82 (record card)     |
| `control-height`     | 36                             | 40               | **44 (touch floor)** |
| `icon`               | 16                             | 20               | 20                   |
| `grid`               | 12 col / 24 gutter / 32 margin | 8 / 20 / 24      | 4 / 16 / 16          |
| navigation           | 240px sidebar                  | 64px rail        | bottom tab bar       |
| tables               | all columns                    | priority 1 and 2 | record cards         |

Tailwind is mobile-first, so author 390 as the base and add `md:` and `lg:`. The table above is written desktop-first because that is how the Figma file reads; invert it when writing classes.

## 6. Table-to-mobile rule

1. Every table declares column priorities. Priority 1 is the row's identity plus the one number that matters.
2. 1440 all columns · 768 priority 1 and 2 · 390 record cards.
3. A record card: identity as title, priority-1 number right-aligned and typographically dominant, at most three priority-2 facts as label-value pairs, status badge. Tap opens the detail.
4. **No horizontal scrolling of a data table on mobile.** One exception: a deliberate matrix report gets a pinned first column and an explicit affordance.
5. Footer totals never disappear — they become a sticky summary bar.
6. Filters become a bottom sheet behind a button showing the active count.
7. Bulk selection is not offered on mobile.

Column priorities per table are fixed in `phase3-ia-flows-permissions.md` section 3 and are not re-decided in code.

## 7. Interaction and motion

| Token            | Tailwind           | Duration | Easing                        | Used for                                         |
| ---------------- | ------------------ | -------- | ----------------------------- | ------------------------------------------------ |
| `motion-instant` | —                  | 0ms      | —                             | A recalculated figure. **Numbers never animate** |
| `motion-fast`    | `duration-[120ms]` | 120ms    | `ease-out`                    | Hover, focus, press, checkbox, switch            |
| `motion-base`    | `duration-200`     | 200ms    | `ease-out`                    | Dropdown, popover, tooltip, inline expand        |
| `motion-panel`   | `duration-[260ms]` | 260ms    | `cubic-bezier(0.32,0.72,0,1)` | Dialog, drawer, bottom sheet                     |
| `motion-page`    | `duration-[180ms]` | 180ms    | `ease-out`                    | Route transitions, **opacity only**              |

Rules, all enforceable in review:

- No count-up animations on money. A figure that climbs cannot be read.
- Charts animate once on mount and **never** on filter change; re-animating makes comparison impossible.
- Nothing animates layout position. A row that moves while being tapped produces a mis-tap.
- `prefers-reduced-motion: reduce` turns transitions **off**, not shorter.
- The only permitted flourish is `shadow-accent-glow` on the single most important value per view, and it is static.
- Motion library: `motion` for dialogs, drawers and sheets. Everything else is CSS transitions.

## 8. Icon and asset inventory

**Icons (10), HeroIcons (D-086, D-094).** In code use `@heroicons/react/24/outline`, not lucide — the design is drawn from HeroIcons and the two sets have different metrics. The mapping is: dashboard → `Squares2X2Icon`, items → `ArchiveBoxIcon`, purchases → `ShoppingBagIcon`, production → `Cog6ToothIcon`, sales → `TagIcon`, inventory → `RectangleStackIcon`, products → `CubeIcon`, reports → `ChartBarIcon`, settings → `AdjustmentsHorizontalIcon`, mobile More → `EllipsisHorizontalIcon`. Render at 16, 20 or 22 from `size/icon-*`; HeroIcons' own 1.5 stroke is correct and must not be reduced to match the border rule — that rule governs borders, not icon strokes.

**Navigation swaps to the solid set on the current route.** Import the same names from `@heroicons/react/24/solid` and pick per item: `const Icon = isActive ? SolidIcon : OutlineIcon`. Weight, not only colour, marks position, so the current page survives greyscale and colour-vision deficiency. The design file carries this as an `Active` variant on all three navigation components; in code it is one ternary driven by the route.

**Dropdown indicator.** `ChevronDownIcon` at 18px with a 1.5 stroke, rotating to `ChevronUpIcon` when open. A collapsed disclosure row uses `ChevronRightIcon`. 18px rather than the more common 16px because the control is 40px tall and the glyph sits beside a 14px value; the design previously used a 5px text glyph, which the owner rejected as too small.

**Assets — vector, no raster.** `Logo / Bloop wordmark` and `Logo / Bloop mark` are Figma components built from the owner's `dark.svg`, with the fill bound to `color/brand/bloop`. The PNGs they replaced are gone from the design.

In code, ship the wordmark and the B as two SVG files (or one sprite) and set `fill: currentColor` so the brand token drives them. Sizes in use: wordmark 76×27.5 sidebar, 152×55 cover, 84×30.4 sign-in desktop, 104×37.7 tablet, 112×40.6 mobile, 150×54.4 sign-in brand panel; mark 26×24.2 in the 64px rail. Aspect ratios are 2.760:1 and 1.073:1 — preserve them.

Two things to know about the source file: every glyph was duplicated (fifteen paths for five glyphs), and the light variant is white at 80% opacity, which is invisible on white. The design uses five deduplicated paths with the brand fill.

**Known constraint: WebP image fills do not render in Figma.** The upload succeeds and the fill attaches, but it rasterises blank; PNG works. Irrelevant to the web build, relevant if anyone re-imports assets to Figma.

Ask the owner for an SVG of the wordmark before launch. A 2000px PNG for a 104px slot is ~370KB for something that should be under 10KB, and it will not stay crisp on a high-DPI display at larger sizes.

## 9. State behaviour

Every operational screen implements all of these. A route is not done without them.

| State               | Rule                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Loading             | `<Skeleton>` in the real layout's shape. No full-page spinners. Server Components stream; `loading.tsx` per route segment |
| Empty, first use    | Explains the screen and offers the one action that fills it                                                               |
| Empty, filtered     | Names the filter that excluded everything and offers to clear it                                                          |
| Partial             | Content present with missing inputs flagged via `<MissingInputFlag>`. Styled as information                               |
| Success             | Inline confirmation naming the resulting figure, not just that something saved                                            |
| Warning             | Non-blocking                                                                                                              |
| Error, field        | Beside the field, naming the rule and the fix, linked by `aria-describedby`                                               |
| Error, request      | Retryable, **preserving entered data**. Never discards a form. `error.tsx` per segment                                    |
| Permission denied   | Names the role required. Never a bare 403                                                                                 |
| Destructive confirm | Names the record and the consequence                                                                                      |

**Error and empty copy is already written.** Take every string from `phase4-content-system.md`. Do not invent new microcopy in code; if a string is missing, it is a content gap and goes back to Phase 4.

## 10. Accessibility requirements

Gates, not aspirations. Each is testable.

| Requirement             | Target                                                                     | How it is verified                                                                                   |
| ----------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Text contrast           | 4.5:1 minimum                                                              | The measured table on Figma page `01 — Foundations`                                                  |
| UI component boundaries | 3:1                                                                        | `border-control` is the only input outline                                                           |
| Graphical objects       | 3:1, or a 1px `border-strong` stroke                                       | `chart-3` at 2.81:1 and `chart-4` at 1.67:1 carry the stroke; neither is used for a thin line series |
| Focus                   | Visible on every interactive element, 2px ring, 2px offset, never removed  | Keyboard pass per route                                                                              |
| Focus order             | Follows visual order; dialogs trap and restore focus                       | Keyboard pass                                                                                        |
| Touch targets           | 44×44 minimum on mobile; 32 with 8px spacing on desktop                    | Script audit, already passing in Figma                                                               |
| Colour alone            | Never the sole carrier of meaning                                          | Every status badge carries a word; every inventory badge carries a number                            |
| Charts                  | Text summary before the chart; series labelled directly where space allows | Present in `<BarChart>`                                                                              |
| Forms                   | Every control labelled; errors linked; required state programmatic         | axe per route                                                                                        |
| Live regions            | The sale profit panel announces contribution profit politely on change     | Manual screen-reader pass                                                                            |
| Motion                  | `prefers-reduced-motion` turns transitions off                             | Manual                                                                                               |
| Zoom                    | Usable at 200% with no content loss and no horizontal scroll               | Manual                                                                                               |
| Headings                | One `h1` per screen, no skipped levels                                     | axe                                                                                                  |

Target: **zero axe violations on every route**, plus a keyboard-only completion of the purchase, production and sale workflows.

## 11. Design changes needed before coding — both now built

Per the project rules these were reported rather than absorbed. Both are done in Figma.

**11.1 The sticky table total needs a pending state. BUILT (D-099).** A footer total across 5,000 rows cannot be computed from a page of 20; it needs its own aggregate query, so the rows and the total arrive separately. `Table total` on the Components page now carries `State=Loaded` and `State=Pending`.

The rule: **pending keeps the bar, its height and its label, and skeletons only the figures.** Nothing shifts when the number lands, and the rows are never blocked waiting for it. The skeleton bar is `border/strong` on the `surface-sunken` total bar, 12px tall, 3px radius, at the left edge of each numeric column.

The ten footer totals in the file are column-matched to their own tables, so they are not instances of this component and are not meant to be. `Table total` is the contract; each table applies it to its own columns. Affects Items, Purchases, Sales, Suppliers, Inventory, Valuation, Overhead and every report footer.

**11.2 `/items/[id]` has a route and no frame. BUILT (D-100).** `Item detail / 1440` now exists: sidebar on Items, breadcrumb, title with an `In stock` status badge, three actions (Archive item, Adjust stock, Record a purchase), and the five tabs from the approved content — `Overview · Stock · Cost history · Movements · Used in` — with **Cost history** shown, because that is the tab US-12 promises and the one that proves the audit trail.

It carries the six readouts, the cost-history table (`Date · Event · Quantity · Cost of that batch · Average after · Change`), a reconciliation line under the table, and an aside holding the unit-cost explanation and the `Used in` summary. Only the desktop frame was drawn; tablet and mobile inherit the table-to-mobile rule in section 5, as agreed for the 70-frame cut (D-075).

**11.3 Nothing else.** The other constraints in `phase8-build-order.md` section 5 are implementation concerns that the design already accommodates.
