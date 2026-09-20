# Phase 9 — Build log

One entry per stage. Each records what was built, what the stage's "done when" required, and how it was verified. Stages are defined in `phase8-build-order.md` section 3.

---

## S0 — The project runs

**Done when:** `pnpm dev` serves; TS strict with zero errors; Tailwind theme keys match the Figma variable names exactly; lint and format in CI; versions pinned in the lockfile; `decimal.js` and a money type in place before any arithmetic exists.

**Status: done.** Verified 19 September 2026.

| Requirement                 | Evidence                                                                                                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dev server serves           | Next 16.3.5 on `localhost:3000`, page renders, zero console errors                                                                                                                                                                                   |
| TS strict, zero errors      | `tsc --noEmit` clean, with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `verbatimModuleSyntax` on top of `strict`                                                                                                     |
| Theme keys match Figma      | `src/app/globals.css` generated from the `Tokens` collection; browser-verified that `--color-accent`, `--color-border-strong`, `--color-brand-bloop`, `--color-chart-6`, `--radius-card` and `--spacing-content-max` all resolve to the Figma values |
| Lint and format in CI       | `.github/workflows/ci.yml` runs typecheck, lint, format:check, test, build on push and PR                                                                                                                                                            |
| Versions pinned             | Every dependency is an exact version, no ranges; `pnpm-lock.yaml` committed; CI uses `--frozen-lockfile`                                                                                                                                             |
| decimal.js and a money type | `src/lib/decimal.ts`, `src/lib/money.ts`, 22 passing tests in `src/lib/money.test.ts`                                                                                                                                                                |

**The spacing scale was the one thing worth verifying in the browser rather than trusting.** Figma's scale is not linear — `space-6` is 24 and `space-7` is 32 — so Tailwind's default multiplier would have produced 28 and gone unnoticed. Confirmed in the running page: `py-9` computes to 48px, the Figma value, not Tailwind's 36px.

**Geist was silently not loading.** `next/font` sets `--font-geist-sans` on `<html>`, but the Tailwind utilities read `--font-sans`, which still held the default system stack. The page rendered in San Francisco and looked close enough to pass a glance. Fixed by mapping the two in `@theme`; verified `getComputedStyle(document.body).fontFamily` now reports `GeistSans`.

### Three corrections to the design source, found while generating the theme

Generating the theme from the live Figma variables rather than transcribing the handoff table surfaced three stale values. The handoff has been corrected in all three cases; Figma was the source of truth.

| What                 | Handoff said | Figma says | Cause                                                                                             |
| -------------------- | ------------ | ---------- | ------------------------------------------------------------------------------------------------- |
| `brand/bloop`        | `#96062A`    | `#980B2D`  | D-089 replaced the PNG-sampled hex with the vector's true colour; the token map was never updated |
| `brand/bloop-deep`   | `#7A0422`    | `#7C0724`  | same                                                                                              |
| `brand/bloop-subtle` | `#F7E6EA`    | `#F8E7EB`  | same                                                                                              |
| `surface-raised`     | absent       | `#FFFFFF`  | token existed in Figma, missing from the map                                                      |
| `radius/pill`        | `9999`       | `999`      | transcription                                                                                     |

A fourth was wrong in Figma itself: `shadow/accent-glow` still used `rgb(30 63 212 / 0.24)` — `#1E3FD4`, the accent retired by D-084. A glow is meant to be the accent's own light, so it was updated to `#1552F0` in the file and in the handoff.

### Toolchain, and the Node constraint behind it

Pinned: Next 16.3.5, React 19.3.0, Tailwind 4.3.3, TypeScript 5.9.3, ESLint 9.39.5, Prettier 3.9.8, decimal.js 10.6.0, vitest 3.2.7.

Two deliberate pin-downs, both forced by Node 20.11.1 on the build machine:

- **vitest 3.2.7 rather than 4 or 5.** vitest 5 declares Node ≥ 22. vitest 4 declares Node ≥ 20 but its rolldown dependency imports `node:util.styleText`, added in Node 20.12 — so it fails at startup on 20.11.1 despite the declared range.
- **No `vitest.config.ts`.** vitest 3 resolves vite 7, whose config loader hits `require()` of an ES module, unsupported before Node 20.19. The config only supplied a path alias the tests never used, so it was deleted rather than worked around.
- **TypeScript 5.9.3 rather than 7.0.2.** The TS 7 native port is out, but the stage's bar is "zero errors" and a well-supported compiler is the cheaper way to hold it.

**Recommendation, not yet acted on: move to Node 20.19.x before S14.** It is a patch-level move inside the same LTS line and it clears both constraints above. S14 adds Playwright, which is the point at which fighting an old Node stops being cheap. Not done mid-stage, and not done without asking, because it is a change to the machine rather than to the repo.

`pnpm` itself is not installed. Everything was run through `npx --yes pnpm@9.15.9`. `sudo corepack enable pnpm` gets the bare command and needs the owner's password, so it was left for him.

### What S0 deliberately does not contain

No components, no routes beyond `/`, no Supabase client, no schema. The page at `/` is a token and type proof sheet that renders real `Money` arithmetic — it exists so the stage's claims are visible, and it is expected to be deleted at S1.

---

## S1 — The owner can sign in, nobody else can read the data

**Done when:** owner reaches the dashboard; a user in another org receives zero rows from every table, proven by a test authenticated as that user; no public sign-up route; a recovery link lands on the reset screen, not the dashboard.

**Status: done.** 20 September 2026.

| Requirement                                     | Status                                                                                                                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Another org receives zero rows from every table | **Proven.** 19 assertions in `src/test/rls.test.ts` against a real Postgres, and the three externally observable cases re-checked against the live project                                                        |
| No public sign-up route                         | **Proven.** `src/test/auth-routes.test.ts` sweeps the route directories, the public path list, and the source for `auth.signUp(`                                                                                  |
| Owner reaches the dashboard                     | **Proven.** Owner signed in against the live project and reached `/dashboard`; the org query returned an empty result rather than an error, so RLS permitted the read and there was simply nothing to read        |
| Recovery link lands on the reset screen         | **Proven for the expired path, one manual step outstanding.** The expired-link screen and the middleware rule are verified. Clicking a live emailed link is the one thing that needs a human and has not been run |

### The live project agreed with the WASM Postgres

Supabase project `wdluhlpjvjwfyytvduhs`, migration applied through the SQL editor, returned `Success. No rows returned.` The three cases observable from outside were then checked against it directly:

| Case                             | PGlite predicted | Live project returned               |
| -------------------------------- | ---------------- | ----------------------------------- |
| Signed out, read `organizations` | refused outright | `42501 permission denied`, HTTP 401 |
| Signed out, read `memberships`   | refused outright | `42501 permission denied`, HTTP 401 |
| Signed out, call `my_org_ids`    | allowed, empty   | `[]`, HTTP 200                      |

All three match, including the deliberate asymmetry in the third: the tables refuse an anonymous reader, while the function answers with an empty set so the client has no special case to write. That agreement is the evidence that D-106 is sound — the WASM Postgres is telling the truth rather than telling us what we want to hear.

The owner's account was created in the dashboard, since there is no sign-up route by design. The password was typed by the owner directly into the preview pane and was never seen or handled here.

### How the RLS is proven without Docker

There is no Docker, no Supabase CLI, no psql and no Homebrew on this machine, so a local Supabase stack was not an option. `src/test/pg.ts` runs the migration files verbatim against **PGlite** — PostgreSQL 18.3 compiled to WebAssembly — and reproduces Supabase's own `auth.uid()` definition, deliberately literally, so the policy SQL under test is byte for byte what will ship.

The sweep reads the table list out of `information_schema` rather than naming tables, so a table added in a later stage is covered the moment it exists, and a table that forgets `enable row level security` fails the file. A table with no `org_id` throws with an explanation rather than being quietly skipped.

Proven: another org's owner sees zero rows from every table, cannot name org A's id directly, cannot see its members, cannot rename it, cannot add itself to it. A user with no membership sees nothing. Signed out is refused outright rather than shown an empty table, which is the correct shape: `anon` holds no grants at all.

Not covered, stated rather than implied: Supabase's Auth service and PostgREST are not present. These tests prove the database refuses the rows. They do not prove the HTTP layer in front of it.

### Two things the migration had to change

**`insert ... returning id` on organizations is refused under RLS.** RETURNING is subject to the SELECT policy, and at the instant a founder creates an org they are not yet a member of it, so the row they just wrote is invisible to them. Two client-side inserts cannot found an org — they cannot even be attempted.

That pushed founding into `create_organization()`, a `security definer` function that writes the org and its owner membership in one transaction (D-105). It is strictly better than the alternative: the two rows now appear together or not at all, so an org with no members — a row nobody can read and nobody can delete — is no longer reachable. A test asserts no such orphan exists.

With founding inside the function, the direct insert path became dead surface and was removed: there is no insert policy on `organizations` and no insert grant, and `memberships_insert` simplified from a four-clause check to `my_role(org_id) = 'owner'`.

**`pgcrypto` is not needed.** `gen_random_uuid()` has been in Postgres core since 13. Dropping the extension makes the migration runnable anywhere, which is what let the tests run it at all.

### The recovery-link trap, closed structurally

A recovery link is a real sign-in: it creates a session. On a previous project that meant the user landed on the dashboard with their old password still working and no prompt to change it — the link achieved nothing.

Here the callback marks the session with an httpOnly cookie and the middleware treats that flag as outranking the ordinary "signed in, go to the dashboard" rule, so a recovery session cannot reach any route except `/reset-password` until the password actually changes (D-108). A cookie rather than a query parameter because a query parameter is lost on the first redirect, which is exactly how the bug comes back. An expired link lands on the same screen and explains itself instead of dropping the user on sign-in.

### A token collision worth knowing about

The Figma space scale is not linear — `space-6` is 24 and `space-7` is 32 — so overriding Tailwind's numeric spacing keys also changes what `h-9` and `h-10` mean. `h-10` became 64px and every input rendered at 64px instead of 40px; `h-9` became 48px, so every medium button would have been 48px instead of 36px.

Caught by measuring the rendered control in the browser rather than reading the class name. Fixed with explicit control-height tokens (D-107): spacing tokens are for layout, and a control's height is its own dimension with its own name.

### What S1 does not contain

No items, no units, no sidebar. The dashboard is a placeholder that reads the org through RLS and says so on the page; the real dashboard is S10, after the reports that stand behind its figures exist. The `permission-denied` screen carries the approved copy but nothing routes to it yet: it needs the non-owner roles, which arrive when staff do.

---

## S2 — Units and items exist and can be found

**Done when:** an item is created with a purchase unit, base unit and factor; list filters by type and searches name and SKU; an invalid conversion is refused with the spec's message; archive hides it from pickers and keeps it in history.

**Status: done.** 20 September 2026. 78 tests passing.

| Requirement                                        | Evidence                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Item with purchase unit, base unit and factor      | PLA Basic Filament created live as a spool of 1,000 g consumed in grams. A purchase unit without a factor is refused by a table constraint, not a form check |
| Filters by type, searches name and SKU             | Verified live: `?q=FIL-PLA` found it by SKU, `?type=packaging` returned the empty state                                                                      |
| Invalid conversion refused with the spec's message | _"There is no conversion between Gram and Piece for Blank Keycap. Set how many Gram are in one Piece on the item first."_                                    |
| Archive hides from pickers, keeps history          | Archived it live: gone from the list, still readable at its URL, revealed by Show archived, restored again                                                   |

### The pack-of-90 trap

F-04 rule 1 says conversion is automatic between units sharing a dimension. Taken alone that is wrong for the most ordinary case in this business. A pack and a piece are both `count`, so dimension arithmetic would convert **one pack of 90 switches into one piece**, and every material cost downstream would be wrong by a factor of ninety — silently, with no error to notice.

`convert_to_base()` therefore orders its cases deliberately: the base unit converts one to one; then the item's own purchase-to-base factor; then dimension factors; then it refuses, naming both units. Step two sits above step three, and a test asserts that order so it cannot quietly flip back.

### Supabase grants anon everything, and the tests did not know

The live project disagreed with the test suite. Supabase ships `ALTER DEFAULT PRIVILEGES` granting `anon` and `authenticated` everything on every new table in `public`, and PGlite has no such default — so the harness was flattering the migration rather than checking it. Four real defects were hiding behind that:

| Defect                                                      | Consequence                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `anon` held 28 grants in `public`                           | An anonymous reader got 200 and an empty body where it should have been refused. Nothing leaked, because RLS still returned no rows — but "refused" and "allowed, and there happened to be nothing" stop being the same answer the moment a policy is edited |
| `delete from items` affected zero rows and reported success | Worse than an error. RLS with no DELETE policy deletes nothing silently, so the application would have confirmed an archive that never happened                                                                                                              |
| Same silent no-op on `unit_dimensions`                      | Reference data no tenant should be able to touch                                                                                                                                                                                                             |
| `create_organization()` callable signed out                 | 0001 revoked it from PUBLIC, which does not remove an explicit grant to `anon`                                                                                                                                                                               |

Migration `0003` revokes the defaults and states every grant per table and per verb. `memberships` is now the only table a tenant may delete from; everything else archives.

**The harness was fixed first.** `src/test/pg.ts` now applies Supabase's default privileges before running the migrations, and all four defects failed immediately. Three invariants were added: `anon` holds zero grants, `memberships` is the only deletable table, and nobody can insert an organization directly. The live project was then re-checked and now matches the suite on all six tables.

This is the single most valuable thing S2 produced. A test that reproduces the platform's defaults catches a class of mistake that a test against bare Postgres cannot see at all.

### Two mistakes in my own work

**I broke D-079.** `Number.parseFloat` in the stock-status check. The lint rule banned the bare global, and a member expression walked straight past it. Fixed, and the rule now covers `Number.parseFloat` and `Number.parseInt` — found by writing one myself, which is recorded in the rule's comment.

**The client form dragged the server into the browser.** `item-form.tsx` imported `@/lib/items`, which imports the cookie-reading Supabase client. Split into `@/lib/item-types` for the pure helpers, and `import 'server-only'` added to the server client so the next occurrence is an import error rather than a bundle trace.

### Scope pulled forward, deliberately

The "set up your business" step comes from S13's onboarding. Every table is `org_id not null`, so there was nowhere to put an item until an organization existed and S2 could not be demonstrated at all. Only the name is collected; equipment, labour, overhead and channels stay in S13.

The 240px sidebar was also built here rather than later, because every screen from S3 onward needs it and retrofitting it across forty frames is worse. Destinations that arrive in a later stage render as plain text with their stage number rather than as links — enforced, not remembered: typed routes will not compile a link to a route that does not exist.

---

## S3 — A purchase becomes stock with a derived cost

**Done when:** the F-01 worked example produces ₱1.218545/g and ₱8.476778/pc to eight places; allocation previewed before saving; allocations reconcile to the extras total exactly; quantity base disabled with its reason on mixed units; `receive_purchase` is transactional under a concurrent-receipt test.

**Status: four of five proven, one not testable here. Verified end to end against the live project.** 20 September 2026. 110 tests passing.

| Requirement                                        | Evidence                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 to eight places                               | `1.21854500` and `8.47677778`, from allocations of ₱137.09 and ₱42.91 landing the lines at ₱2,437.09 and ₱762.91                                          |
| Allocation previewed before saving                 | The New purchase aside recomputes on every keystroke from the same `Money.allocate` the receive path uses                                                 |
| Allocations reconcile exactly                      | Seven awkward splits asserted, including the residual-centavo cases                                                                                       |
| Quantity base disabled with its reason             | _"Allocate by quantity is unavailable because this purchase mixes grams and pieces."_ Refused by the database and greyed out with that reason in the form |
| `receive_purchase` transactional under concurrency | **Not testable on PGlite**, which is a single connection. See below                                                                                       |

F-02 is proven too, though it belongs to S4's ledger: two receipts of one item produce ₱1.20308261 per gram across 2,300 g, and a stock value of ₱2,767.09 — the spec's figures exactly. Two lines naming the same item on one purchase apply in sequence, so the second sees the average the first produced.

### The concurrency gap, stated plainly

PGlite is one connection, so two simultaneous receipts cannot be issued. What is proven: the purchase row is locked `for update` before anything else, the status check then refuses a second receipt outright, and every item lock is taken up front in `id` order so two receipts touching the same items queue rather than deadlock.

What is not proven is that those locks behave as intended under genuine parallelism. That needs a real Postgres with two connections, and it is the second thing on the list — after S14's Playwright work — that argues for the Node upgrade and a local Supabase. Recorded rather than quietly skipped.

### One rule, two implementations, pinned together

The allocation happens twice: in `allocate_cents()` when a purchase is received, and in `Money.allocate` for the preview shown before anything is saved. A preview that disagreed with what gets saved would be worse than no preview, so a test runs seven cases through both and asserts identical output, plus that each reconciles to the total.

### A bug the ledger ordering was hiding

`rebuild_item_balances()` picked each item's latest movement with `order by occurred_at desc, id desc`. Both parts are wrong. `occurred_at` is business time, so every movement from a purchase dated 16 September carries the same timestamp; `created_at` would tie too, because `now()` is transaction-stable. That left a random uuid deciding which row was "latest" — so the rebuild could reproduce a mid-transaction balance and disagree with the cache.

Found by the test asserting rebuild equals cache, which failed on a purchase with two lines. `inventory_movements` now carries `seq bigint generated always as identity`: an append-only ledger's truth is the order it was appended in, and that is now what it is ordered by.

### The ledger cannot be written by hand

`inventory_movements` has a select policy and nothing else — no insert, update or delete policy at all, and only `select` granted. Rows are written solely by `receive_purchase`, which is security definer. The cache and the ledger therefore cannot be made to disagree by anything the client does, which is asserted directly: an insert, an update and a delete are each refused.

### Another D-079 violation, caught by my own lint

Two `Number(...)` coercions in the purchase actions, converting bigint centavos for the insert. `bigint` to `number` is a silent precision cliff at 2^53. Centavos are passed as strings now; PostgREST accepts a numeric string for a bigint column.

### Verified live, not only in tests

Built the worked example through the interface against Supabase project `wdluhlpjvjwfyytvduhs`.

**Before saving**, the New purchase aside showed ₱137.09 against PLA Basic Filament and ₱42.91 against Mechanical Switch, "Allocated ₱180.00, which matches exactly", and the per-unit figures ₱1.218545 / g and ₱8.476778 / pc. That is the preview requirement met literally: the numbers appear before anything is written.

**After receiving**, the stored figures are the same numbers: line totals ₱2,300.00 and ₱720.00, added costs ₱137.09 and ₱42.91, landed ₱2,437.09 and ₱762.91, unit costs ₱1.218545 / g and ₱8.476778 / pc. The purchase closed to editing and the Items list shows 2,000 g and 90 pc on hand at those costs, valued ₱2,437.09 and ₱762.91.

The status badges came out right off each item's own reorder point without being asked to: the switch reads **Low** at 90 against a reorder point of 120, the filament **In stock** at 2,000 against 500. The list shows the unit cost at two places and the detail at six, which is the display rule rather than a coincidence.

**Two defects the live walkthrough found:**

The preview threw `[DecimalError] Invalid argument` on the form's **first render**. `Money.parse(extras.shipping ?? '0')` looks safe and is not: an untouched input is `''`, which is neither null nor undefined, so `??` passes it straight through. The most likely input the preview will ever receive was the one that crashed it. Empty now reads as zero, and three tests cover the untouched, empty-line and partly-typed states.

A missing space rendered "₱1.218545 / gfrom ₱2,437.09". Cosmetic, and the sort of thing only reading the real output catches.

---

## S4 — Stock is a ledger, not a number

**Done when:** every change is a movement carrying resulting quantity and average; `rebuild_item_balances` reproduces every cached figure exactly; an opening balance needs no purchase; an adjustment requires a reason; negative stock refused with the spec's message; valuation as of a past date correct after later receipts.

**Status: done.** 20 September 2026. 131 tests passing, verified end to end against the live project.

| Requirement                                               | Evidence                                                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Every change is a movement carrying the resulting balance | A three-step history reads back as opening balance → purchase → waste, at 300 / 2,300 / 2,290, with an average on every row |
| `rebuild_item_balances` reproduces every cached figure    | Asserted after adjustments as well as receipts                                                                              |
| An opening balance needs no purchase                      | 300 g at ₱1.10 with nothing bought, worth ₱330.00                                                                           |
| An adjustment requires a reason                           | Blank and null both refused, and the reason is kept on the movement                                                         |
| Negative stock refused with the spec's message            | _"This would leave -40 g of PLA Basic. Record a purchase or an opening balance first, or reduce the quantity."_             |
| Valuation as of a past date, after later receipts         | See below                                                                                                                   |

### Valuation is a lookup, and that is the point

Value an item at 31 March: 300 g, ₱330.00. Receive 2,000 g dated 16 September. Re-value 31 March: **still 300 g, still ₱330.00.** A movement recorded later cannot change what an earlier date was worth, because every row stores the balance and average it produced rather than the reader re-adding history.

Confirmed live as well: 19 September reports nothing on hand, 20 September reports ₱3,126.89 — which is the ₱3,200.00 of received stock less the ₱73.11 of waste recorded against it.

### Three rules the ledger now enforces

**An adjustment never moves the unit cost.** Only a purchase does, because only a purchase involves money changing hands. Six units lost at ₱2.50 records −₱15.00 of value and leaves the average at ₱2.50 (D-117).

**An opening balance is only valid as an item's first movement.** Allowing one later would make it a back door for setting the average directly, and that figure has to stay derived from what was actually paid. A second one is refused, and the form does not offer items that already have history (D-118).

**Unknown cost stays unknown.** Stock whose cost nobody has established values at null, not ₱0.00, and contributes nothing to a total. It is not worthless; it is worth an amount nobody has worked out, and a guess inside a total is worse than a visible gap. Both the on-hand and valuation pages say so on the page (D-119).

### A reading of the spec, stated

The Adjust stock screen offers four options — Stock count, Damage, Waste, Correction — which map onto three ledger movement types. A count and a correction both record an `adjustment`; damage and waste record themselves. That is deliberate: the ledger has to distinguish a real loss of goods from a correction of the record, because the failures-and-waste report depends on that line being drawn. The reason field carries the specifics either way.

### Three defects the live walkthrough found

**The valuation page listed items that were not held.** The filter read `r.quantity !== '0'`, and `quantity` is `numeric(20,6)` arriving as `'0.000000'`, so it never matched — every item appeared at zero and the page then reported them all as having no established cost. It also carried a meaningless `Number.isFinite(1)` left over from an edit. Now filtered through `toDecimal(...).gt(0)`.

**Two different minus signs sat in adjacent columns.** The movements table showed `−60 g` with a real minus and `-₱73.11` with a hyphen, because `Money.format` used ASCII. Every display formatter now uses U+2212; `toJSON` keeps the hyphen, because that is a data value rather than a display one (D-120).

**And fixing that surfaced a third:** `formatRate(-1.5)` produced `₱−1.50`, with the sign inside the currency symbol. The peso was being prefixed to digits that carried their own minus. A test written for the second defect caught it.

---

## S5 — Rates exist, are dated, are never overwritten

**Status: done.** 20 September 2026. Migration `0006_dated_rates.sql` is live. The Business, Equipment, Utility rates, Labour, Overhead and Sales channels settings routes are built. 137 tests pass.

PGlite applies the migration verbatim. Tests cover three effective dates for equipment, utility, labour, overhead and channel fees; equipment rates remain unchanged after the equipment purchase price changes; direct edits to version rows are refused. The equipment calculation counts annual maintenance and repairs across the chosen recovery period (D-061). Overhead category lines and their derived pool and rate save in one RPC (D-121); the F-15 example yields ₱95.00 per attended hour from ₱9,500 and 100 hours.

The route builds with `next build --webpack`. The standard Turbopack build is blocked here by an internal process port binding error; it has not provided a build verdict.

Live migration 0006 was reported successful by the owner on 20 September. The live PostgREST API recognizes all ten new tables and the three rate functions; anonymous requests to each returned 401. Currency editing in Business is temporarily read-only because historical purchase and stock rows have no currency snapshot (D-122); changing the organization code would relabel old amounts.

The owner supplied screenshots of the signed-in Business and Equipment pages after 0006. Both render without clipping at desktop width. Business shows the Bloop values and the currency explanation. Equipment showed its add form and the correct empty history state before the first save.

The live owner-session walkthrough then saved an equipment rate of ₱12.50/hour effective 1 January from a ₱50,000 sample price, 4,000 hours and zero allowances. The screenshot exposed F-48: the history showed only `12.5`, so the inputs could not be checked from the page. The revised history now shows currency, per-hour units, the stored 8-place rate and an expandable input list. After correcting the equipment price to the documented ₱48,000 sample and adding a 2 January version, the rendered page shows **₱12.00/hour In force** and the old **₱12.50/hour Superseded**, with both sets of inputs still readable. The old numeric rate did not move when the equipment price changed.

The live equipment is labelled `SAMPLE DATA`. The owner confirmed that sample figures are the intended data until the system is built and real figures can be entered. The short sample name can be made more descriptive later; it does not block the S5 rate and history criteria.

---

## S6 — A product has a recipe and a cost that explains itself

**Status: done.** 20 September 2026. 158 tests pass, and every criterion was confirmed on the rendered page in a live owner session. The owner confirmed applying `0007_products_and_recipes.sql` on 20 September 2026. Live PostgREST requests recognize all three new tables and both functions and reject anonymous access with 401 / 42501. The owner also confirmed applying `0008_recipe_required_values.sql`, whose required-value constraint is covered by PGlite tests. The Products list, New product, Recipe and Cost routes are built. Live rendering and the F-07 sample walkthrough are still required before this stage is done.

The new database functions create a product and its detail row in one transaction, and save an active recipe with a new revision after a completed run locks the old one. The recursive trigger rejects direct and transitive cycles by the product's name. Tests cover both cycle forms, unit conversion refusal, wrong item type, tenant access, and preserved locked lines.

The cost calculation uses exact decimal inputs and versions effective on the selected date. Machine electricity is derived from hours, watts and the utility rate, normalized to kWh. Missing item cost, rate, power, overhead or failure estimate is named and excluded where applicable. The F-07 test reproduces the documented component rows, ₱76.5552 visible direct cost, ₱80.5844 production cost and ₱92.9344 full cost, rounding to ₱92.93. The failure allowance is calculated before rounding. A separate rounding row appears only when needed to make displayed amounts add to their totals (D-123); the F-07 sample needs no adjustment row. Expanded rows expose additional exact rate digits when the six-place display has rounded them. The business date follows the organization's time zone.

All existing monetary and quantity API reads now explicitly request numeric and bigint values as text (F-50), including items, purchases, stock valuation, movements and settings. A regression passes real JSON bytes through the installed Supabase SDK and preserves values beyond JS number precision; `toDecimal` rejects runtime numbers so an incorrect type assertion cannot conceal the same mistake. Recipe quantity conversion matches the existing database conversion, including item-specific pack factors and large six-place quantities. Another regression found that a missing recipe value passed the original SQL CHECK; 0008 adds the explicit non-null requirement (F-51). No applied migration was edited.

### The live walkthrough, and what it cost to get a figure that could be checked

The F-07 walkthrough was entered by hand in a signed-in session: equipment power draw, a ₱12.50/kWh utility rate, Assembly and Packing at ₱150.00/hour, a ₱9,500 ÷ 100 hour overhead rule, two new items, their opening balances, the product and its seven recipe lines. Four defects surfaced, none of them in the arithmetic and all of them in whether a reader could tell the arithmetic was right.

| Found | What the page did                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-55  | The utility rate read `₱12.50 / unit`. Per kWh and per Wh differ by a thousand in every electricity row and rendered identically                  |
| F-56  | `₱95.00 / hour` with no way to see the ₱9,500 and the 100 hours behind it, although F-48 had already settled that a derived rate shows its inputs |
| F-57  | An opening-balance picker offering "Choose an item" when every item was disqualified, with the reason as a footnote below the dead control        |
| —     | The overhead row label repeated its own section heading word for word                                                                             |

**The result, and where it differs from the printed example.**

| Row                | Live              | F-07     |
| ------------------ | ----------------- | -------- |
| PLA Basic Filament | ₱23.5423          | ₱23.2436 |
| Mechanical Switch  | ₱25.4303          | ₱25.4303 |
| Key Ring           | ₱2.5000           | ₱2.5000  |
| Plastic Bag        | ₱1.2000           | ₱1.2000  |
| Machine time       | ₱4.2000           | ₱4.2000  |
| Electricity        | ₱0.4813           | ₱0.4813  |
| Assembly, Packing  | ₱15.0000, ₱4.5000 | same     |
| Overhead           | ₱12.3500          | ₱12.3500 |

One row differs, and it is data rather than calculation. F-07 assumes the filament had blended a 300 g opening balance at ₱1.10 into the F-01 receipt, giving ₱1.20308261. The live item never had that opening balance, so its average is the receipt's own landed cost, ₱1.218545, and 19.32 × 1.218545 = ₱23.5423 exactly (D-125).

**The missing-rate case is the one that proves the display rule.** Costed at 2025-12-31, before any rate version exists, five inputs are named and excluded rather than counted as zero, and a **rounding adjustment** row appears:

```
exact direct cost      52.67262274
rows as displayed      52.6726
exact allowance         2.7722
visible allowance       2.7723
rounding adjustment     0.0001
```

The failure allowance is taken from the exact direct cost, so it is ₱2.7722; the displayed column needs ₱2.7723 to reach the stated total. Rather than absorb the centavo into the allowance, the page shows it as its own line (D-123). No such row appears in the complete case, because nothing there needs reconciling.

---

## 0009 — Unknown cost is not zero

**Applied live 20 September 2026**, confirmed by the owner. Between S6 and S7, not part of either.

`receive_purchase` valued uncosted stock at ₱0.00 when averaging, so 50 units nobody had costed plus 1,000 g bought at ₱1.10 stored ₱1.04761905 — below any price ever paid, and indistinguishable on screen from a correct figure (F-58). A null prior average now takes the received unit cost.

This reversed a position S4 took deliberately, with a test asserting it. The trade-off went to the owner in full: way A keeps stock value equal to money spent but understates the material cost; way B prices correctly but values the old pile above what was paid for it. He chose B — underpricing every unit sold is the failure this product exists to prevent (D-126).

160 tests. The new regression was run against the schema without `0009` and reproduced ₱1.04761905 before it passed. After applying, the live API answers 404 for anonymous calls to `receive_purchase`, matching the two untouched functions beside it, and 401 for an anonymous read of `items`.

No existing data needed repair: no purchase had ever been received against uncosted stock on the live project.

---

## S7 — Pricing answers the real question

**Done when:** margin and markup together; the trap example shows ₱100.00 and ₱84.00; the back-solve reproduces ₱154.88, ₱166.54, ₱185.05; **both** break-evens show ₱86.65 and ₱99.92; expected contribution margin shows 48.0% beside the 40% target; a 100% margin is refused.

**Status: built, awaiting the live walkthrough.** 191 tests pass, including all six clauses above as separate cases.

`src/lib/pricing.ts` holds F-08, F-09 and F-10. It is pure, exact, and refuses rather than returning a silent null: a margin at or above 100%, fees at or above 100%, a 100% discount each come back with the sentence the screen shows. The one idea the module exists to hold on to is that a price is built on the **full** cost, because a price has to recover overhead, while the contribution margin a sale later reports subtracts only the **production** cost, because overhead is never capitalised into stock (D-008). The two figures differ on purpose and the screen shows both.

| Clause           | Reproduced                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| The trap         | ₱60.00 cost at 40% gives ₱100.00 as a margin and ₱84.00 as a markup, ₱16.00 apart, each row carrying both percentages              |
| The back-solve   | ₱154.88 direct, ₱166.54 on Shopee at 7%, ₱185.05 with a 10% discount planned                                                       |
| The gap          | 48.0% expected contribution beside the 40% target, and the difference accounted for exactly as the ₱12.35 of overhead              |
| Both break-evens | ₱86.65 and ₱99.92, with ₱12.35 of contribution still standing at the higher one — the figure the old single break-even called zero |
| 100% refused     | In the calculation, in the server action, and in the database function                                                             |

Margin is measured against **net revenue**, not the list price. With a 10% discount planned, the ₱185.05 list price nets ₱154.89 and the margin describes that; measuring against ₱185.05 would report a margin on money that never arrives.

`0010_pricing_snapshots.sql` adds the snapshot table: both costs, the price, both break-evens, and the channel's terms **by value** in `inputs`, because an id alone would not survive the fee version being superseded, which is exactly when the question gets asked. Write-once by construction — select and nothing else is granted, so an attempt to edit one is refused at the grant rather than silently changing zero rows (the failure F-37 was raised for). Snapshots are written only by `save_pricing_snapshot`, called from a server action that recomputes every figure from the product's own cost: what the browser displayed is not evidence, and a snapshot exists to be evidence.

**Writing the snapshot tests found F-60**, a cross-tenant write reachable through four functions from S3 and S4. That is recorded above, under 0011.
