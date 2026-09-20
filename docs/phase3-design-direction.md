# Phase 3 — Design Direction and Motion Specification

Part 7 of 7. This sets intent and constraints. The Figma work order in Phase 6 turns it into a build order, and Phase 7 executes it.

---

## 1. Design intent

Precise, trustworthy, modern, premium, operationally efficient. Light-first. Dark mode is not in v1.

The adaptation problem, stated once: the reference is a marketing site whose job is to impress on one visit. This is an operational tool whose job is to be used eight times a day without friction. **Everything about its visual character is kept; everything about its scale is reduced.** Polish comes from precision of alignment, restraint in colour, and confident typography, not from space.

## 2. Semantic variables

Named by role, never by appearance. These become Figma Variables in Phase 7 and Tailwind theme tokens in Phase 9 under the same names.

**Colour**
`--color-background` · `--color-surface` · `--color-surface-raised` · `--color-surface-sunken` · `--color-surface-accent` · `--color-text-primary` · `--color-text-secondary` · `--color-text-tertiary` · `--color-text-inverse` · `--color-border` · `--color-border-strong` · `--color-border-focus` · `--color-accent` · `--color-accent-hover` · `--color-accent-pressed` · `--color-accent-subtle` · `--color-accent-text` · `--color-success` · `--color-success-subtle` · `--color-warning` · `--color-warning-subtle` · `--color-danger` · `--color-danger-hover` · `--color-danger-subtle` · `--color-positive-value` · `--color-negative-value` · `--color-chart-1` through `--color-chart-6`

Two decisions embedded above. `--color-border-strong` exists because the reference's single hairline is too faint to separate table rows (D-027). `--color-positive-value` and `--color-negative-value` are separate from success and danger because a negative margin is not an error state, and colouring it with the error token would make routine information look broken.

**Space** `--space-0` through `--space-12` on a 4 px base, plus `--space-page`, `--space-section`, `--space-card`, `--space-field`, `--space-table-cell`.

**Radius** `--radius-control` · `--radius-card` · `--radius-panel` · `--radius-pill`. Nested radius decays: inner equals outer minus its padding.

**Shadow** `--shadow-card` · `--shadow-overlay` · `--shadow-accent-glow`. Three only. The reference has no mid-range drop shadow anywhere, and that restraint is most of why it reads as precise rather than as a template.

**Typography** `--font-sans` · `--font-mono` · sizes `--text-micro` through `--text-display` · weights · `--tracking-tight` for large numerals · `--leading-*`.

**Grid** 12 columns at 1440 and 768, 4 at 390. Gutters and margins as tokens.

## 3. Palette direction

Carried from the Phase 2 decisions, not yet fixed to hex values; that happens in Phase 6 with contrast validation.

- White background, near-black text with a slight blue cast, a single blue accent.
- **The accent shifts off `#1452f0`.** Same family, different value, so it does not read as the reference's product.
- **`#fcd116` is removed entirely**, including from the chart series. It is flag yellow and it fails contrast on white at roughly 1.3:1.
- The chart series is six values, ordered so the first three are distinguishable in greyscale and by the common colour-vision deficiencies, because a profitability chart that only works in colour is a chart that fails for some readers and every printout.
- Warning is a darker amber chosen for 4.5:1 on its surface, not a bright yellow.
- Every text-on-surface pair validated at 4.5:1, every non-text control boundary at 3:1.

## 4. Typography direction

A neutral grotesque with genuine tabular figures. Geist qualifies and is free; Inter is the fallback choice. The typeface is not what makes the reference identifiable — the flag palette and the exact accent are — so keeping a good numeral face and changing the colour is the correct trade.

- **`tabular-nums` on every money and quantity figure, without exception.** Proportional digits make a column of peso amounts shift as values change, and this application is mostly columns of peso amounts.
- Negative tracking on large numerals, tightening as size increases. This is why the reference's figures look engineered.
- Uppercase micro-labels with positive tracking above values, in secondary text colour.
- Operational screens use a compressed scale. The 56 px headline of the reference has no place above a table; page titles sit at roughly 24 px and section headings at 16 to 18 px.

## 5. Density

| Context            | Row height | Control height | Section rhythm |
| ------------------ | ---------- | -------------- | -------------- |
| Desktop data table | 44 px      | 36 px          | 24–32 px       |
| Desktop form       | —          | 40 px          | 24 px          |
| Tablet             | 48 px      | 40 px          | 24 px          |
| Mobile record card | 72–88 px   | 44 px minimum  | 16 px          |

44 px is the minimum touch target everywhere on mobile, which sets the floor, not the aesthetic.

## 6. Components requiring explicit design attention

These carry the product's meaning and cannot be default shadcn/ui.

1. **Cost breakdown row** — label, value, share of total, and an expand control that reveals the inputs and the dated rate used. The most important component in the system: it is where success criterion 6 is met or missed.
2. **Margin and markup pair** — the two figures for one price, visually equal in weight so neither reads as the primary.
3. **Unit input** — a number and its unit as one control, where the unit is chosen from the item's valid units only.
4. **Currency input** — peso prefix, two decimals, tabular, right-aligned, with no spinner.
5. **Percentage input** — accepts `5` and `5%`, stores `0.05`, always displays with the symbol.
6. **Quantity input** — accepts decimals to three places, never silently rounds.
7. **Estimated versus actual pair** — two figures with a signed variance, where the sign's colour uses the value tokens, not the status tokens.
8. **Inventory badge** — in stock, low, out, with the number, not just a colour.
9. **Movement row** — type, signed quantity, resulting balance, source link.
10. **Abnormal loss callout** — states the arithmetic in words, because the first time this fires it will look like a bug.
11. **Missing input flag** — names what is missing and links to where to fix it.
12. **Mobile record card** — the table transformation defined in part 4.

## 7. Motion specification

Motion is used to explain a change of state and for nothing else. The brief's own instruction stands: no decorative animation during repetitive tasks.

| Token              | Duration | Easing                           | Used for                                                         |
| ------------------ | -------- | -------------------------------- | ---------------------------------------------------------------- |
| `--motion-instant` | 0 ms     | —                                | Value updates inside a form. A recalculated price never animates |
| `--motion-fast`    | 120 ms   | `ease-out`                       | Hover, focus, press, checkbox and toggle                         |
| `--motion-base`    | 200 ms   | `ease-out`                       | Dropdown, popover, tooltip, inline expand                        |
| `--motion-panel`   | 260 ms   | `cubic-bezier(0.32, 0.72, 0, 1)` | Dialog, drawer, bottom sheet                                     |
| `--motion-page`    | 180 ms   | `ease-out`                       | Route transitions, opacity only, no movement                     |

**Rules.**

1. **Numbers never animate.** No count-ups on money. A figure that climbs is a figure you cannot read, and on a costing screen it invites a screenshot at the wrong moment.
2. **Nothing in the daily loop animates beyond feedback.** Recording a sale has one motion: the confirmation appearing.
3. **Charts animate once on first paint, 240 ms, and never again on filter change.** Re-animating on every filter makes comparison impossible.
4. **Skeletons do not shimmer aggressively.** A slow opacity pulse, or nothing.
5. **`prefers-reduced-motion: reduce` disables all transform and opacity transitions and keeps only instant state changes.** Not a reduced version — off.
6. **Nothing that moves layout.** No entrance animations that shift rows, because a row that moves while being tapped produces a mis-tap.
7. **The one permitted flourish** is the accent glow on the single most important value per screen, and it is static, not animated.
