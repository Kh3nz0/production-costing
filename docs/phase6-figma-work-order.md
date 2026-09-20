# Phase 6 — Figma Work Order

Part 2 of 2. Companion: `phase6-design-tokens.md`.

Target file: `vHvJDjDOhZQWysnl02Sxth`. Write access verified 2026-09-18. The file is empty: one page, zero nodes.

**No Figma editing happens in this phase.** This document is the build order for Phase 7.

---

## 1. Figma page structure

| Page                     | Contents                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `00 — Cover`             | Project title, version, date, sample-data notice, contents index                                                   |
| `01 — Foundations`       | Variable collections, colour styles, text styles, effect styles, grids, density specimens, contrast evidence table |
| `02 — Components`        | 31 primitives, 21 domain components, all states, documented                                                        |
| `03 — Desktop`           | 1440 screens, grouped by section                                                                                   |
| `04 — Tablet`            | 768 adaptations                                                                                                    |
| `05 — Mobile`            | 390 adaptations                                                                                                    |
| `06 — Flows`             | Six workflow diagrams and the eighteen click paths                                                                 |
| `07 — Prototype`         | Prototype wiring for the eighteen required workflows                                                               |
| `08 — Developer Handoff` | Token map, component map, responsive rules, interaction notes, data needs per screen                               |
| `99 — Archive`           | Superseded explorations                                                                                            |

## 2. Sample-data notice

Required by D-062, placed in three locations: a banner on `00 — Cover`, a note in the `08 — Developer Handoff` header, and a small marker on any frame showing costs or prices.

Wording: `All figures shown are sample data for design purposes. They are internally consistent with the calculation specification but are not the business's real costs or supplier prices.`

Sample values, consistent with the worked examples so on-screen arithmetic actually adds up:

|                                               |                                                   |
| --------------------------------------------- | ------------------------------------------------- |
| PLA Basic Filament                            | ₱1.203083 / g, 2,300 g on hand                    |
| Mechanical switch                             | ₱8.476778 / pc, 87 pc on hand                     |
| Key ring                                      | ₱2.500000 / pc · Plastic bag ₱1.200000 / pc       |
| Electricity                                   | ₱12.50 / kWh · Bambu Lab P2S ₱12.00 / hour, 110 W |
| Labour                                        | ₱150.00 / hour · Overhead ₱95.00 / working hour   |
| Clickable Keychain, 3-switch: production cost | ₱80.58                                            |
| Same, full cost with overhead                 | ₱92.93                                            |
| Shopee price at 40% target                    | ₱166.54, expected contribution margin 48.0%       |
| Loses money below / covers overhead above     | ₱86.65 / ₱99.92                                   |
| Sample run: 20 started, 12 accepted, 8 failed | ₱82.93 per unit, ₱535.89 production loss          |
| Sample sale: ₱120.00 on Shopee                | contribution ₱15.12, 15.7%                        |

## 3. Workflow priorities

Screen effort follows use frequency, not screen count.

| Priority       | Workflows                                                             | Treatment                                                                                                                            |
| -------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| P1, daily      | Record a sale · Record a production run · Check stock                 | Designed first, at all three widths, with every state                                                                                |
| P2, weekly     | Record a purchase and receive · Read the dashboard · Review low stock | All three widths, every state                                                                                                        |
| P3, occasional | Create a product and its recipe · Read a cost breakdown · Set pricing | All three widths; this is where the product's meaning lives, so it gets the most design attention per screen despite lower frequency |
| P4, setup      | Onboarding · Settings · Import                                        | Desktop and mobile; tablet inherits desktop                                                                                          |
| P5, reference  | Reports · Valuation · Movements                                       | Desktop plus one mobile exemplar per pattern                                                                                         |

## 4. Navigation architecture

**1440.** Persistent left sidebar, 240px. Group `Operate`: Dashboard, Items, Purchases, Production, Sales, Inventory. Group `Understand`: Products, Reports. Footer: Settings, then account. Active item uses `--color-surface-accent` with `--color-accent-text` and a 2px left indicator.

**768.** The same sidebar collapsed to a 64px icon rail. Labels on hover and on focus. A rail is used rather than a hamburger because at this width the vertical space exists and a hidden nav costs a tap on every navigation.

**390.** Bottom tab bar, five destinations: Dashboard, Production, Sales, Inventory, More. `More` opens a sheet holding Items, Purchases, Products, Reports, Settings. A floating action button offers Record a sale, Start a production run, Record a purchase, Adjust stock.

The five tabs are the daily and weekly rhythm; everything occasional is one tap deeper. Products is deliberately not a tab: defining a product is desk work.

## 5. Screen inventory

**115 frames.** Counts are per width, and the tier decides which widths a screen gets.

### Tier 1 — all three widths (22 screens, 66 frames)

Sign in · Dashboard · Items list · Item detail · Purchases list · Purchase form · Receiving · Products list · Recipe tab · Cost tab · Pricing tab · Production list · Start a run · Run output · Run review · Run completed · Sales list · Sale form with live profit panel · Sale detail · Inventory on hand · Movements · Adjust stock

### Tier 2 — desktop and mobile (12 screens, 24 frames)

Onboarding steps 1–6 · Valuation · Reports index · Report: product cost breakdown · Report: sales profitability · Report: estimate versus actual · Report: failures and waste

The eight remaining reports use one shared report template; three exemplars prove it under different data shapes — a breakdown, a time series, a comparison.

### Tier 3 — desktop only (25 frames)

Forgot password · Set a new password · Expired link · Item form · Supplier list, form, detail · Allocation preview · Receipt confirmation · Product form · Product overview · Variants tab · Opening balances · Run detail locked · Settings: business, units, equipment, utilities, labour, overhead, channels, pricing defaults · Import: upload, mapping, dry-run errors · Export and backup · People · Permission denied · Not found

## 6. Wireframe order

Low fidelity first, on `03 — Desktop`, validated before any styling. This order front-loads the screens that can invalidate the others.

1. Cost breakdown, because it decides how much vertical room a product needs
2. Sale form with the live profit panel, because it is the tightest information density in the product
3. Production run review, because the abnormal-loss explanation has to fit without a scroll
4. Dashboard, because it can only be laid out once the report figures exist
5. A data table, as the pattern every list inherits
6. Purchase form with the allocation preview
7. Pricing tab
8. Everything else

Validation gate before high fidelity: walk workflows W-2, W-4 and W-5 end to end in low fidelity and confirm no step needs a screen that does not exist.

## 7. Information hierarchy

One rule per screen type, applied consistently.

| Screen type    | First                                                    | Second                                    | Third                           |
| -------------- | -------------------------------------------------------- | ----------------------------------------- | ------------------------------- |
| List           | The identity of the row, and the one number that matters | Status                                    | Supporting attributes           |
| Detail         | The headline figure                                      | Its derivation                            | Metadata and history            |
| Form           | The field being filled                                   | The consequence of filling it, shown live | Help                            |
| Cost breakdown | The two cost figures                                     | The components that make them             | The rates behind each component |
| Sale           | Contribution profit                                      | What reduced it                           | The line items                  |
| Dashboard      | Money and stock right now                                | What needs attention                      | What happened recently          |

The hero figure on any screen uses `--text-value-lg` and is the only element permitted `--shadow-accent-glow`, once per view.

## 8. Responsive structures

**1440.** Sidebar 240 plus content to a 1280 maximum. Two-column forms where fields are short and related. Tables show every column. Detail screens use a 2/3 content and 1/3 aside split, the aside holding summary figures that must stay visible.

**768.** Icon rail 64 plus fluid content. Forms collapse to one column. Tables show priority 1 and 2 columns. The detail aside moves below the content, except on the sale form where the live profit panel stays pinned to the bottom of the viewport, because watching the profit change is the point of the screen.

**390.** No persistent nav; bottom tabs. One column throughout. Tables become record cards. Any panel that must remain visible becomes a sticky summary bar. Multi-step forms become genuine steps with a progress indicator rather than a long scroll.

## 9. Table-to-mobile transformation

1. Every table declares column priorities. Priority 1 is the row's identity plus the one number that matters.
2. 1440 all columns · 768 priority 1 and 2 · 390 record cards.
3. A record card carries the identity as its title, the priority-1 number right-aligned and typographically dominant, at most three priority-2 facts as label-value pairs, and a status badge. Tapping opens the detail.
4. **No horizontal scrolling of a data table on mobile.** The single exception is a deliberate matrix report, which gets a pinned first column and an explicit scroll affordance.
5. Footer totals never disappear. They become a sticky summary bar above the list.
6. Filters become a bottom sheet behind a button showing the active count.
7. Bulk selection is not offered on mobile. It is a desk action.

Column priorities are fixed in `phase3-ia-flows-permissions.md` section 3 and are not revisited during design.

## 10. Form patterns

- Labels above fields, always. Placeholders are examples, never labels.
- Helper text sits below and is persistent, not a tooltip, wherever it prevents a costly mistake. The spool-factor helper is the clearest case.
- Required fields marked on the label. Optional fields say `Optional` in the helper.
- Validation on blur, not on keystroke. Money and quantity fields format on blur and revert to raw on focus.
- Errors sit below the field in `--color-danger`, with an icon, and are referenced by `aria-describedby`.
- A form that changes a figure shows that figure updating live in view. The purchase allocation preview and the sale profit panel are both instances of this pattern.
- Destructive or irreversible confirmations name the record and the consequence.
- Line-item tables inside forms, used by purchases, recipes, runs and sales, share one component with an add-line control at the foot and a remove control per row.
- Multi-step forms show `Step n of m` and allow skipping only where the spec says so.

## 11. Dashboard structure

1440, top to bottom: setup-incomplete banner when relevant · a seven-card stat row wrapping to two rows · overhead recovery and VAT threshold side by side · low stock and below-target margin side by side · costs that went up · three activity columns.

390: setup banner · quick-record actions · stat cards as a swipeable carousel with the money figures first · overhead recovery · low stock · below-target margin · activity as a single list.

Every card states a number that a report can reproduce. **No card exists that cannot be traced to a report.**

## 12. Required states

Every operational screen ships all eleven. A screen without them is not finished.

| State               | Rule                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| Loading             | Skeletons in the real layout's shape. No full-page spinners                     |
| Empty, first use    | What the screen is for, and the one action that fills it                        |
| Empty, filtered     | Which filter excluded everything, and a clear control                           |
| Partial             | Content present with missing inputs flagged. Styled as information, not failure |
| Default             | —                                                                               |
| Success             | Inline confirmation naming what changed, including the resulting figure         |
| Warning             | Non-blocking, such as a waste rate above 100%                                   |
| Error, field        | Beside the field, naming the rule and how to satisfy it                         |
| Error, request      | Retryable, preserving entered data. Never discards a form                       |
| Permission denied   | Names the role required. Never a bare 403                                       |
| Destructive confirm | Names the record and the consequence                                            |

## 13. CSV import workflow

Four frames at desktop, three at mobile (mapping is desktop-only; a column-mapping grid does not work at 390 and pretending otherwise produces a screen nobody can use).

1. **Template choice** — thirteen templates in dependency order, each showing what it creates and what it depends on, with out-of-order templates disabled and the reason shown.
2. **Upload** — drag target with idle, hover, uploading, success, too-large and wrong-type states.
3. **Mapping** — source column to target field, auto-matched with correction. States: matched, unmatched, ignored, conflict.
4. **Dry run** — the count that would be created, updated and skipped, the error list with row numbers, and a download of the original rows plus `error_field` and `error_message` columns. Nothing is written. Apply is a separate deliberate action.

## 14. Report layouts

One template: title and description · date range and filters · a summary strip of two to four figures · the table or chart · a total row · export. Three exemplars prove it under a breakdown, a time series and a comparison.

Charts follow the rules in the token document: animate once on first paint, never on filter change, always accompanied by a text summary, never relying on colour alone.

## 15. Print and export layouts

Two print stylesheets, designed as frames rather than left to the browser.

- **Report print**: white background, no sidebar, no interactive affordances, repeating table header on each page, filters and date range printed in the header, page numbers, and the sample-data notice where applicable.
- **Cost breakdown print**: one product per page, the full derivation expanded, every rate and its effective date, and a generated-on timestamp. This is the artefact that goes to an accountant or a customer, so it must stand alone without the application.

Charts print in greyscale correctly because of the chart-1 to chart-3 luminance separation.

## 16. Accessibility requirements

Gates for Phase 7 QA, not aspirations.

| Requirement             | Target                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Text contrast           | 4.5:1 minimum. Measured values are in the token document; `#6B7689` at 4.59:1 is the floor                   |
| UI component boundaries | 3:1. `--color-border-control` at 3.44:1 is the input outline. A card hairline is not a control boundary      |
| Graphical objects       | 3:1, or a 1px `--color-border-strong` stroke where a palette value falls below it                            |
| Focus                   | Visible on every interactive element: 2px `--color-border-focus` ring with a 2px offset. Never removed       |
| Focus order             | Follows visual order. Dialogs trap focus and return it on close                                              |
| Touch targets           | 44 by 44 minimum on mobile; 32 minimum with 8px spacing on desktop                                           |
| Colour alone            | Never the sole carrier of meaning. Every status badge carries a word; every inventory badge carries a number |
| Charts                  | Text summary before the chart; series labelled directly where space allows rather than by legend colour      |
| Forms                   | Every control labelled; errors linked by `aria-describedby`; required state programmatic, not only visual    |
| Live regions            | The sale profit panel announces contribution profit on change, politely                                      |
| Motion                  | `prefers-reduced-motion: reduce` turns transitions off                                                       |
| Zoom                    | Usable at 200% without loss of content or horizontal scrolling                                               |
| Headings                | One `h1` per screen, no skipped levels                                                                       |

## 17. Prototype requirements

Eighteen workflows wired on `07 — Prototype`, with the starting points listed in `phase3-ia-flows-permissions.md` section 5: business setup, add a material, record a purchase, receive inventory, create a product, create a BOM, view a cost breakdown, adjust a target margin, record a production run, record failed units, record waste, complete a production run, record a sale, view contribution profit, review inventory movements, import through CSV, handle import errors, view a low-stock alert.

Transitions use `--motion-base` for in-page changes and `--motion-panel` for dialogs and sheets. No prototype transition animates a number.

## 18. Visual QA checklist

Run before presenting anything. Screenshot evidence at 2x for every item marked with a camera; a geometry check alone does not catch clipping.

| #   | Check                                                                   | Method                                                |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Every colour is a bound variable; no raw hex                            | Script audit of fills and strokes                     |
| 2   | Every text node uses a text style                                       | Script audit                                          |
| 3   | Every frame uses auto layout; no absolute positioning inside containers | Script audit                                          |
| 4   | No detached instances                                                   | Script audit                                          |
| 5   | Layer and frame naming consistent                                       | Script audit                                          |
| 6   | Text contrast measured, not eyeballed                                   | Computed per pair, recorded in a table                |
| 7   | Focus states present on every interactive component                     | Camera                                                |
| 8   | Touch targets at or above 44px on every 390 frame                       | Measured                                              |
| 9   | Long item names do not clip                                             | Camera, with a 60-character name in the longest field |
| 10  | Large monetary values do not clip                                       | Camera, with ₱1,234,567.89 in every money column      |
| 11  | Empty values render as an em dash, never as 0                           | Camera                                                |
| 12  | Tabular figures on every money and quantity column                      | Camera, comparing two rows of differing digits        |
| 13  | All eleven states exist for every operational screen                    | Inventory count against the list                      |
| 14  | Cost breakdown arithmetic on screen actually adds up                    | Recompute each visible sum by hand                    |
| 15  | Units visible beside every quantity                                     | Camera                                                |
| 16  | Terminology matches the D-049 vocabulary table                          | Text audit of every string against the table          |
| 17  | No horizontal scroll on any 390 frame                                   | Camera                                                |
| 18  | Sticky totals present where a table has a footer total                  | Camera                                                |
| 19  | Prototype connections complete for all eighteen workflows               | Click through each                                    |
| 20  | Sample-data notice present on cover, handoff and every costed frame     | Camera                                                |
| 21  | No flag-palette colour anywhere, including charts                       | Script audit for `#fcd116`, `#e5484d`, `#1452f0`      |
| 22  | Chart series distinguishable in greyscale                               | Desaturated screenshot                                |
| 23  | Nothing resembles government branding or naming                         | Review                                                |
| 24  | Every screen at 390, 768 and 1440 inspected individually                | Camera per frame                                      |

Item 16 exists because nothing in Figma enforces the vocabulary, and terminology drift is the most likely way this design diverges from the approved content.

## 19. Developer handoff contents

Produced on `08 — Developer Handoff` during Phase 7, ahead of the Phase 8 document: the variable-to-Tailwind token map, the Figma-component-to-code-component map, responsive rules per breakpoint, interaction notes, motion notes, icon inventory, asset inventory, and data requirements per screen.

## 20. Build sequence for Phase 7

1. Create the ten pages
2. Foundations: variable collections, then colour, text and effect styles, then grids
3. Primitives with all states
4. Domain components with all states
5. Low-fidelity desktop in the order in section 6
6. Validate workflows W-2, W-4, W-5
7. High-fidelity desktop
8. Tablet
9. Mobile
10. Flows
11. Prototype
12. Handoff documentation
13. Visual QA against section 18
14. Corrections
15. Present for approval

Checkpoints where I stop and show you progress rather than running to the end: after step 2, after step 4, after step 6, and after step 7.
