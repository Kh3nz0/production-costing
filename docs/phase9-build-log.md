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
