# Phase 6 — Design Tokens and Component Inventory

Part 1 of 2. Every value below is measured, not asserted. Contrast ratios were computed against the WCAG 2.x relative-luminance formula.

These become Figma Variables on page `01 — Foundations` in Phase 7, and Tailwind theme tokens under the same names in Phase 9.

---

## 1. Colour

Named by role. No token is named after its appearance.

### Surfaces

| Token                    | Value     | Use                                                  |
| ------------------------ | --------- | ---------------------------------------------------- |
| `--color-background`     | `#FFFFFF` | Page                                                 |
| `--color-surface`        | `#FFFFFF` | Cards, tables, forms                                 |
| `--color-surface-raised` | `#FFFFFF` | Dialogs, popovers. Separated by shadow, not tint     |
| `--color-surface-sunken` | `#F6F8FB` | Table headers, inert panels, code and formula blocks |
| `--color-surface-accent` | `#EDF2FE` | Selected rows, active nav, informational panels      |

### Text

| Token                    | Value     | On white         | Verdict                                             |
| ------------------------ | --------- | ---------------- | --------------------------------------------------- |
| `--color-text-primary`   | `#0B1020` | **18.93:1**      | AAA                                                 |
| `--color-text-secondary` | `#4F5A70` | **6.93:1**       | AA, near AAA                                        |
| `--color-text-tertiary`  | `#6B7689` | **4.59:1**       | AA. This is the floor; nothing lighter carries text |
| `--color-text-inverse`   | `#FFFFFF` | 6.01:1 on accent | AA                                                  |

The brief warns against low-contrast grey text. `#6B7689` at 4.59:1 is the lightest value permitted anywhere, and it is reserved for micro-labels and timestamps. The reference's own `#545e74` sits at 6.4:1, which our secondary matches.

### Lines

| Token                    | Value     | On white   | Use                                                                                      |
| ------------------------ | --------- | ---------- | ---------------------------------------------------------------------------------------- |
| `--color-border`         | `#EDF0F6` | 1.14:1     | Disabled control fills only. Not used as a visible border                                |
| `--color-border-strong`  | `#E3E8F0` | 1.23:1     | **Every visible border: card edges, dividers, table rules, chips, chart gridlines. 1px** |
| `--color-border-control` | `#7E8BA3` | **3.44:1** | Input, select, checkbox and radio outlines. 1px                                          |
| `--color-border-focus`   | `#1552F0` | 6.01:1     | Focus ring. 2px                                                                          |

**One visible border, revised 19 September (D-091).** Every decorative edge is 1px on `--color-border-strong`. `--color-border` survives only as the fill of a disabled control: two neighbouring hairline greys were a distinction nobody could see, and keeping both invited drift between card edges and table rules.

Form controls are the deliberate exception, and the reason is an accessibility rule rather than taste. WCAG 1.4.11 requires **3:1 for the boundary of a user-interface component**, so an input outline uses `--color-border-control` at 3.44:1. `#E3E8F0` at 1.23:1 is correct for a card edge and is a failure on a text field: the field has no visible boundary at all. That was a live defect in the Figma file on 100 input instances (F-19), and it is the only accessibility failure the September QA pass found. Disabled controls are exempt from 1.4.11 and keep the soft grey. Row separation is reinforced by hover and by spacing, so a 1.23:1 rule never carries meaning alone (D-027).

### Accent

| Token                    | Value     | Contrast                   | Use                                           |
| ------------------------ | --------- | -------------------------- | --------------------------------------------- |
| `--color-accent`         | `#1552F0` | **6.01:1** both directions | Primary action, links, focus. Owner-specified |
| `--color-accent-hover`   | `#1240C8` | 8.10:1                     | Hover                                         |
| `--color-accent-pressed` | `#0E32A6` | 10.37:1                    | Active                                        |
| `--color-accent-subtle`  | `#EEF3FE` | —                          | Tinted surface                                |
| `--color-accent-text`    | `#1039B8` | **8.21:1 on subtle**       | Text and icons on the tinted surface          |

**Accent, revised 19 September.** The owner specified `#1552F0`, which is one unit from the eGov reference's `#1452F0` and visually identical to it. Superseding my earlier argument for `#1E3FD4` (D-084). The earlier reasoning was: Two reasons, one of substance and one of identity. The reference blue clears AA at 6.01:1; ours clears AAA for normal text at 7.73:1, which matters on a screen that uses the accent for links inside dense tables. And it is visibly a different blue — deeper and more indigo, less electric — so the interface does not read as the same product as a government platform (D-026). Same family, different value: the visual logic is inherited, the identity is not.

### Status

| Token                  | Value     | On white | Paired surface                               | Text on surface |
| ---------------------- | --------- | -------- | -------------------------------------------- | --------------- |
| `--color-success`      | `#1A7F4B` | 5.02:1   | `--color-success-subtle` `#E9F7EF`           | 4.55:1          |
| `--color-success-fill` | `#30A46C` | 3.16:1   | fill, dot, icon, chart only                  | —               |
| `--color-warning`      | `#C2410C` | 5.18:1   | `--color-warning-subtle` `#FEF1E7`           | 4.90:1          |
| `--color-warning-fill` | `#F76B15` | 2.97:1   | fill, dot, icon, chart only                  | —               |
| `--color-danger`       | `#C62A2F` | 5.57:1   | `--color-danger-subtle` `#FDECEC`            | 4.87:1          |
| `--color-danger-fill`  | `#E5484D` | 3.91:1   | fill, dot, icon, chart only. Owner-specified | —               |
| `--color-danger-hover` | `#A82026` | 6.9:1    | —                                            | —               |

Warning is a true orange at 5.18:1. It was originally `#8A5200`, a dark amber that read brown; the owner rejected the brown on 19 September and it was replaced (D-071). The reference's `#fcd116` sits at roughly 1.3:1 on white and cannot carry text at all; it is also the Philippine flag yellow, and it is removed from this system entirely including from the chart series (D-026).

### Values

| Token                    | Value     | Use                                                        |
| ------------------------ | --------- | ---------------------------------------------------------- |
| `--color-positive-value` | `#1A7F4B` | A gain, a favourable variance, a margin at or above target |
| `--color-negative-value` | `#C62A2F` | A loss, an unfavourable variance, a margin below target    |

Deliberately separate tokens from success and danger even though two of them currently share a hex. A negative margin is information, not an error, and if the status palette ever shifts, routine figures must not shift with it.

### Brand

| Token                        | Value     | On white | Use                                        |
| ---------------------------- | --------- | -------- | ------------------------------------------ |
| `--color-brand-bloop`        | `#980B2D` | 8.60:1   | The Bloop wordmark and brand surfaces only |
| `--color-brand-bloop-deep`   | `#7C0724` | 10.9:1   | Brand hover or print                       |
| `--color-brand-bloop-subtle` | `#F8E7EB` | —        | Brand tint                                 |

**Bloop crimson is the brand, not the interface accent.** `#980B2D` is taken from the owner's vector file, superseding the `#96062A` first sampled from the lossy PNG. The logo colour sits at hue 345°, which is 18° from `--color-danger` at hue 3° — effectively the same colour family — and only 1.36:1 apart in lightness. A crimson primary button placed next to red error text would be nearly indistinguishable from it, and in this product red already means loss, below-target and error. `--color-chart-3` pink is 8° from the brand hue, so the brand colour stays out of the chart series too.

Where the brand appears: the sidebar wordmark, the cover, the sign-in screen, and exported or printed report headers. Everywhere the interface needs an action, a link or a focus ring, it is blue. D-074.

### Charts

**Revised 19 September (D-092).** The previous palette mixed a teal, a pink and a violet. The owner rejected it: the interface is a blue system and a chart is not licence to introduce three unrelated hues. The palette is now one blue ramp plus two reserved semantic colours.

| Token             | Value     | On white | Relative luminance | Role                                                          |
| ----------------- | --------- | -------- | ------------------ | ------------------------------------------------------------- |
| `--color-chart-1` | `#0E32A6` | 10.37:1  | 0.051              | Series 1, and the highlighted member of a single-series chart |
| `--color-chart-2` | `#1552F0` | 6.01:1   | 0.125              | Series 2, and the default bar colour                          |
| `--color-chart-3` | `#7397F6` | 2.81:1   | 0.324              | Series 3                                                      |
| `--color-chart-4` | `#B4C8FA` | 1.67:1   | 0.579              | Series 4                                                      |
| `--color-chart-5` | `#C62A2F` | 5.57:1   | 0.139              | Losses and negatives only                                     |
| `--color-chart-6` | `#6E7D93` | 4.19:1   | 0.201              | Unallocated remainder                                         |

Chart 1 to 4 are one sequential ramp, and every adjacent pair separates in **greyscale** by at least 1.3:1 — 1.73, 2.14 and 1.68 respectively — so a multi-series chart survives printing and every form of colour-vision deficiency. Chart 5 and chart 6 separate by 1.33:1.

**Two constraints, stated rather than hidden.**

Greyscale separation across four steps requires a light end, so `--color-chart-3` at 2.81:1 and `--color-chart-4` at 1.67:1 fall below the 3:1 WCAG 1.4.11 asks of a graphical object. Rule: **any mark in chart-3 or chart-4 carries a 1px `--color-border-strong` stroke**, and neither is used for a thin line series. Filled bars and areas may use them, because area compensates where a one-pixel line does not.

`--color-chart-2` against `--color-chart-5` is only **1.08:1** in greyscale: the default blue and the loss red are the same value and would merge into one shade. Rule: **a chart that shows a gain against a loss uses chart-1 for the gain and chart-5 for the loss**, which separate by 1.86:1. `--color-chart-6` was moved from `#64748B` to `#6E7D93` for the same reason — against chart-5 the old slate separated by only 1.17:1. The replacement sits in the one narrow luminance window that clears both its neighbours while staying above 3:1 against white.

---

## 2. Typography

**Icons.** HeroIcons outline, the set named on the cover of the owner's eGOV Icons file. Drawn as vectors at 24x24 and scaled to 16, 20 or 22; stroke scales to 1.0, 1.25 and 1.375. That file was not modified, and it was deliberately not linked as a library: doing so would make a private business file depend on a government organisation's library.

**Outline for rest, solid for the current page (D-094).** Navigation icons use the HeroIcons **solid** counterpart when their destination is the one on screen, and the outline everywhere else. Weight, not just colour, marks position, so the current page survives greyscale and colour-vision deficiency instead of relying on a blue tint alone. Implement with `@heroicons/react/24/outline` and `@heroicons/react/24/solid` switched on the active route.

**Dropdown indicator.** A 16px chevron is the 2026 convention — shadcn/ui, Radix Themes, Mantine and Stripe all land there. The Figma file used a 5px-wide `▾` text glyph, which the owner correctly called too small. It is now a HeroIcons chevron vector in an 18px box with a 1.5px stroke: 18px rather than 16px because the control is 40px tall and the glyph needs to read against a 14px value. Chevron down when closed, up when open, right for a collapsed disclosure row.

**Family.** `--font-sans`: Geist, falling back to Inter, then system sans. Geist is free, is a neutral grotesque, and has genuine tabular figures, which is the deciding property for an interface that is mostly columns of pesos. Keeping the reference's typeface and changing its colour is the correct trade: the flag palette and the exact accent are what identify it, not the letterforms.
`--font-mono`: Geist Mono, for reference numbers, SKUs and import error rows.

**`font-variant-numeric: tabular-nums` is mandatory on every money figure, quantity, percentage and date.** Without it a column of amounts shifts horizontally as digits change, which is most of this application.

| Token               | Size / line height | Weight | Tracking           | Use                                       |
| ------------------- | ------------------ | ------ | ------------------ | ----------------------------------------- |
| `--text-micro`      | 11 / 16            | 500    | +0.06em, uppercase | Stat labels, table micro-labels, eyebrows |
| `--text-caption`    | 12 / 18            | 400    | 0                  | Helper text, timestamps                   |
| `--text-body-sm`    | 13 / 20            | 400    | 0                  | Table cells, dense forms                  |
| `--text-body`       | 14 / 22            | 400    | 0                  | Default interface text                    |
| `--text-body-lg`    | 16 / 26            | 400    | 0                  | Onboarding and explanatory prose          |
| `--text-heading-sm` | 14 / 20            | 600    | −0.01em            | Card headings                             |
| `--text-heading`    | 18 / 24            | 600    | −0.015em           | Section headings                          |
| `--text-title`      | 20 / 26            | 600    | −0.02em            | Page titles                               |
| `--text-value-sm`   | 16 / 22            | 600    | −0.02em            | Table totals, inline figures              |
| `--text-value`      | 24 / 30            | 600    | −0.025em           | Stat card values                          |
| `--text-value-lg`   | 32 / 38            | 600    | −0.03em            | The one hero figure per screen            |

**Revised 19 September (D-093).** The owner cut the upper half of the ladder directly in Figma, judging the headings and figures too large for a dense costing screen, and the sizes above are his. I then tightened the line heights to match, because reducing a size without reducing its leading leaves a heading floating in its own box: `heading` went from 18/26 to 18/24 (1.44 to 1.33), `title` from 20/32 to 20/26, `value` from 24/34 to 24/30, `value-lg` from 32/42 to 32/38. Display figures want a ratio near 1.2; body text wants 1.5. Both specimen labels in the Figma Foundations page are now generated from the live text styles rather than typed, so they cannot drift from the tokens again.

Negative tracking tightens as size increases, which is the mechanic that makes the reference's numerals look engineered. Nothing reaches the reference's 56px display size: that is a marketing dimension and it has no place above a table.

**Scaling the reference honestly.** Its dashboard previews use 9px labels against 14px values. Those are decorative miniatures inside a marketing image, not real interface values. The ratio is adopted, the pixel sizes are not (P-06 in the Phase 5 QA report).

---

## 3. Space, radius, shadow, grid

**Space**, 4px base: `--space-0` 0, `-1` 4, `-2` 8, `-3` 12, `-4` 16, `-5` 20, `-6` 24, `-7` 32, `-8` 40, `-9` 48, `-10` 64, `-11` 80, `-12` 96.

Semantic: `--space-page` 32 desktop / 24 tablet / 16 mobile · `--space-section` 32 / 24 / 24 · `--space-card` 20 / 20 / 16 · `--space-field` 16 · `--space-table-cell-x` 16 / 12 / 16 · `--space-table-cell-y` 12 / 12 / 14.

**Radius**: `--radius-control` 8 · `--radius-card` 12 · `--radius-panel` 16 · `--radius-pill` 999.
Nested radius decays: an inner radius equals the outer radius minus its padding. A 12px card with 20px padding holds an 8px control comfortably.

**Stroke weight, revised 19 September (D-091), superseding D-085.** Every decorative border — card edges, dividers, table rules, chips, chart gridlines — is **1px** on `--color-border-strong`. Form control outlines are **1px** on `--color-border-control`. Focus rings are **2px** on `--color-border-focus`. The active tab underline is **2px** on `--color-accent`. Buttons carry **no border**: secondary is a filled surface.

The earlier 0.25px rule is withdrawn. It chased the reference's borderless look through width and failed twice: sub-pixel borders round unpredictably and can vanish on a 1x display, and the sweep that applied it also thinned form-control outlines to invisibility. Softness comes from the value, not the width — which is why one light value at a normal 1px is both the softer and the more buildable answer.

**Shadow**, three only:

- `--shadow-card` `0 12px 32px rgba(11, 16, 32, 0.06)` — always with a 1px `--color-border`
- `--shadow-overlay` `0 20px 48px rgba(11, 16, 32, 0.12)` — dialogs, drawers, popovers
- `--shadow-accent-glow` `0 14px 32px rgba(30, 63, 212, 0.24)` plus `inset 0 1px 0 rgba(255, 255, 255, 0.28)` — the single most important value on a screen, used at most once per view

There is no mid-range drop shadow. Structure comes from borders; elevation is reserved for things that genuinely float. This restraint is the main reason the reference reads as precise rather than as an admin template.

**Grid**: 1440 → 12 columns, 24px gutter, 32px margin, max content width 1280. 768 → 8 columns, 20px gutter, 24px margin. 390 → 4 columns, 16px gutter, 16px margin.

**Density**

| Context            | Row height | Control height | Icon |
| ------------------ | ---------- | -------------- | ---- |
| Desktop table      | 44         | 36             | 16   |
| Desktop form       | —          | 40             | 16   |
| Tablet             | 48         | 40             | 20   |
| Mobile record card | 76–88      | 44 minimum     | 20   |

44px is the mobile touch-target floor and is a requirement, not a preference.

---

## 4. Motion tokens

| Token              | Duration | Easing                           |
| ------------------ | -------- | -------------------------------- |
| `--motion-instant` | 0ms      | —                                |
| `--motion-fast`    | 120ms    | `ease-out`                       |
| `--motion-base`    | 200ms    | `ease-out`                       |
| `--motion-panel`   | 260ms    | `cubic-bezier(0.32, 0.72, 0, 1)` |
| `--motion-page`    | 180ms    | `ease-out`, opacity only         |

Numbers never animate. Charts animate once on first paint and never on filter change. `prefers-reduced-motion: reduce` turns transitions off rather than shortening them (D-047).

---

## 5. Component inventory

Every component is built as a Figma component with properties and variants. Nothing is a detached copy.

### Primitives

| Component               | Variants                                                                                                                                                                                             | States                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Button                  | primary, secondary, ghost, danger · sm 32 / md 36 / lg 40 · icon-left, icon-right, icon-only                                                                                                         | default, hover, focus, active, disabled, loading                                |
| Input                   | default, with prefix, with suffix, with unit                                                                                                                                                         | default, hover, focus, filled, disabled, error, warning                         |
| Currency input          | ₱ prefix, right-aligned, tabular, 2dp                                                                                                                                                                | + error, disabled                                                               |
| Percentage input        | % suffix, accepts `5` or `5%`                                                                                                                                                                        | + error, disabled                                                               |
| Quantity input          | unit suffix, 3dp                                                                                                                                                                                     | + error, disabled                                                               |
| Unit input              | number plus unit selector as one control                                                                                                                                                             | default, focus, error, restricted (unit list limited to the item's valid units) |
| Textarea                | default                                                                                                                                                                                              | default, focus, disabled, error                                                 |
| Select                  | default                                                                                                                                                                                              | default, hover, focus, open, disabled, error                                    |
| Combobox                | searchable, with create-new                                                                                                                                                                          | default, focus, open, loading, empty results, no match with suggestion          |
| Checkbox, Radio, Switch | —                                                                                                                                                                                                    | default, hover, focus, checked, indeterminate, disabled                         |
| Date field              | single, range                                                                                                                                                                                        | default, focus, open, error                                                     |
| Badge                   | neutral, accent, success, warning, danger, info                                                                                                                                                      | —                                                                               |
| Status badge            | In stock, Low, Out of stock, No cost yet, Archived, Draft, Received, Planned, In progress, Completed, Cancelled, Cost locked, Estimated cost, On target, Below target, Incomplete cost, Paid, Unpaid | —                                                                               |
| Tooltip                 | top, bottom, left, right                                                                                                                                                                             | —                                                                               |
| Avatar, Icon            | 16, 20, 24                                                                                                                                                                                           | —                                                                               |
| Tabs                    | underline, segmented                                                                                                                                                                                 | default, hover, active, disabled                                                |
| Breadcrumb, Pagination  | —                                                                                                                                                                                                    | default, hover, current, disabled                                               |
| Toast                   | success, warning, danger, info                                                                                                                                                                       | entering, resting                                                               |
| Skeleton                | line, block, table row, card, stat                                                                                                                                                                   | —                                                                               |

### Domain components

These carry the product's meaning. None may be an unmodified shadcn/ui default.

| Component                        | Why it is bespoke                                                                                                                                                                                                    | States                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Cost breakdown row**           | Label, amount, share of total, expand control. Expanded shows `[qty] [unit] × ₱[unit cost] = ₱[amount]` at six and four decimal places, plus the dated rate used. This is where success criterion 6 is met or missed | collapsed, expanded, missing input, subtotal, total           |
| **Missing input flag**           | Names what is absent and links to the fix. Styled as information, not failure                                                                                                                                        | inline, banner                                                |
| **Margin and markup pair**       | Two figures for one price, equal visual weight so neither reads as primary                                                                                                                                           | default, target met, below target, below minimum              |
| **Price by channel row**         | Channel, fees, price, expected contribution margin, both break-even figures                                                                                                                                          | default, loses-money, in-band, covers-overhead                |
| **Break-even band**              | The visual gap between "loses money below" and "covers overhead above"                                                                                                                                               | —                                                             |
| **Stat card**                    | Micro-label, value, sub-label, optional trend                                                                                                                                                                        | default, loading, no data, warning                            |
| **Overhead recovery card**       | Bar with a target marker                                                                                                                                                                                             | under, at, over                                               |
| **VAT threshold card**           | Progress against ₱3,000,000                                                                                                                                                                                          | normal, approaching                                           |
| **Estimate vs actual pair**      | Two figures and a signed variance using value tokens, not status tokens                                                                                                                                              | over, under, equal                                            |
| **Inventory badge**              | Number plus state, never colour alone                                                                                                                                                                                | in stock, low, out, no cost                                   |
| **Movement row**                 | Type, signed quantity, resulting balance, cost effect, source link                                                                                                                                                   | inbound, outbound, adjustment, reversal                       |
| **Abnormal loss callout**        | States the arithmetic in words. The first time this fires it will look like a bug                                                                                                                                    | —                                                             |
| **Allocation preview table**     | Per-line share, landed total, new unit cost, change                                                                                                                                                                  | default, reconciled footer, invalid base                      |
| **Live profit panel**            | Revenue through contribution profit, `aria-live="polite"`                                                                                                                                                            | default, negative contribution, estimated cost                |
| **Mobile record card**           | The table transformation                                                                                                                                                                                             | default, pressed, selected, status variants                   |
| **Data table**                   | Column priority, sticky header, sticky total, sortable, selectable                                                                                                                                                   | default, loading, empty, filtered-empty, error                |
| **Filter bar**                   | Active count, clear-all                                                                                                                                                                                              | inactive, active, mobile sheet                                |
| **CSV mapping row**              | Source column to target field, auto-matched                                                                                                                                                                          | matched, unmatched, ignored, conflict                         |
| **Import error row**             | Row number, field, message, suggestion                                                                                                                                                                               | —                                                             |
| **Chart**                        | Bar, line, stacked bar, progress. Each with a text summary for screen readers                                                                                                                                        | default, loading, no data, single series                      |
| **Dialog, Drawer, Bottom sheet** | —                                                                                                                                                                                                                    | default, destructive, loading                                 |
| **Empty state**                  | Illustration-free. Heading, explanation, one primary action                                                                                                                                                          | first use, filtered, no permission, error                     |
| **File upload**                  | Drag target                                                                                                                                                                                                          | idle, hover, uploading, success, error, too large, wrong type |

Component count: 31 primitives and 21 domain components. Every one needs the states listed. That is the real scope of page `02 — Components`.
