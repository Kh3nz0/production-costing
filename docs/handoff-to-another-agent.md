# Handoff to another agent

Updated 22 September 2026. Read this, then `phase9-build-log.md` for what each stage actually did and `phase7-status-and-qa.md` for every defect and how it was found.

## What this is

**Costed** — a private, responsive web app that computes the true cost of producing physical products. First use case is the owner's 3D-printing business, **Bloop**, but the architecture is industry-neutral and must stay that way.

The owner is Khenzo Bacani. He is a designer who builds, rebuilding frontend knowledge, and he reads everything you write.

## The rules you are working under

These came from the owner and are not yours to relax.

- **A stage is done when its "done when" is observably true**, not when the code looks finished. Report partial completion as partial.
- **The worked examples in `phase3-calculations.md` are the test fixtures.** If an implementation disagrees with one, the implementation is wrong until proven otherwise.
- **Do not invent business figures**, and do not invent a design token that is not in Figma.
- **Never say "best practice".** Give the concrete consequence.
- **Push back on vague instructions** with concrete alternatives, and state what you rejected.
- No emojis. Concise. Lead with the answer. Tables for comparisons. Explain accounting terms in plain language.
- **Do not change anything in the eGOV Icons Figma file** (`LmAeP5UTbwQL0xnGHwVjjZ`). Read-only reference.

## State

All fourteen stages are built. **306 unit and database tests pass locally.** Migrations `0001`–`0017` are applied to the live project. Both hosted CI jobs, verify and PostgreSQL restore rehearsal, have passed on the prior commit; CI has not yet run the recovery-link correction.

| Stage              | State                                                                                                                                                                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0, S2–S8, S10–S13 | Done and verified live                                                                                                                                                                                                                                                                                           |
| S1                 | Sign-in, tenant isolation and the absence of a sign-up page are proven. Live Auth disables API signups (`disable_signup: true`). A live emailed recovery link failed code exchange and was mislabeled expired; the recovery flow has been corrected locally, but a fresh emailed-link click remains outstanding. |
| S9                 | Five criteria of five under the specified Playwright timing method. A scripted 390px sale saved in 0.93, 0.48, 0.48 and 0.79 seconds, measured from first edit through the saved page. This measures the browser flow, not a person's entry speed.                                                               |
| S14                | Six criteria of six. The dump/restore rehearsal passed in CI; live concurrent receipts produced one movement; keyboard flows passed; all 54 rendered route variants passed axe across two accounts. Tier-1 screens also passed at 390px and 768px. The audits cover their seeded states.                         |

**Optional usability check.** On a real phone or a 390px browser viewport, time a person recording a sale and note any hesitation or blocked touch target. The written S9 test plan specifies “Playwright, measured” for the under-20-second check, and that check passed. Its scripted speed does not establish a person's entry time.

**Remaining S1 check.** With the corrected app running at `http://localhost:3000` (the configured site URL), request a new password recovery email from `/forgot-password` for an existing account whose inbox you control. Open the newest link in the same browser profile and confirm it lands on `/reset-password` with the new-password form, rather than `/dashboard` or an error page. Do not reset the throwaway browser-test account unless its credentials are updated afterward. The first live click landed on `?error=link_expired` after one minute; that label was misleading because every exchange error used it. The exact upstream error was not recorded. The callback now carries a per-request PKCE flow id, skips stale-session refresh before exchange and classifies failures. The live `e2e/auth-config.spec.ts` check passes with `disable_signup: true`.

**Later design work.** Dark mode needs the Figma dark token values; do not invent them. Some native selects and empty states still predate the shared components, though the audited route states pass axe.

The earlier 92-check browser manifest passed in one live production run with both throwaway accounts, including `/setup`, concurrent receipt, keyboard purchase/run/sale, 28 Tier-1 width audits at 390px and 768px, saved Sale detail, and a 0.79-second scripted 390px sale. The timed sale check also passed three earlier repetitions. The 93-check production browser suite passed in one live run after the setting changed to `disable_signup: true`; the scripted 390px sale saved in 0.44 seconds.

## How to run anything

**`pnpm` is not installed.** Use the pinned Node and invoke pnpm through npx:

```bash
cd /Users/khenzobacani/Desktop/claude/production-costing
nvm use
npx --yes pnpm@9.15.9 test        # 306 tests, PGlite, no Docker or network
npx --yes pnpm@9.15.9 typecheck
npx --yes pnpm@9.15.9 lint
npx --yes pnpm@9.15.9 build
```

Turbopack builds in hosted CI. Some sandboxes deny the local worker port it needs; use `next build --webpack` there. `COSTED_E2E_WEBPACK=1` selects that fallback for the browser server script.

**Node is pinned to 20.20.2** in `.nvmrc`. The earlier 20.11.1 constraint no longer applies. Vitest remains at 3.2.7; changing it has not been part of the release gate.

## The migration loop, which needs the owner

The publishable anon key cannot run DDL. No migration after `0017` is pending.

1. Write `supabase/migrations/00NN_name.sql`.
2. Prove it with the PGlite tests, which run the migration files verbatim.
3. `pbcopy < supabase/migrations/00NN_name.sql`, and tell him to paste it at
   `https://supabase.com/dashboard/project/wdluhlpjvjwfyytvduhs/sql/new`.
4. Wait for confirmation, then verify against the live project.

Migrations are append-only once applied. Verify with curl and the anon key from `.env.local`: every table must answer **401** and every function **404** to an anonymous caller.

## Traps that have already cost time

Every one of these is a defect that actually happened.

**Floats cannot touch money or quantities (D-079).** `Numeric` is `string | Decimal`; `number` is deliberately absent. Lint also bans `parseFloat`, `parseInt`, `Number(...)` and their `Number.` forms. **This rule has now caught nine violations, every one written by an agent who knew about it.** It catches date parsing and percentage widths too, and it has never once been wrong.

**The wire format is where the bugs are, not the arithmetic.** Every serious defect in this project has been at a boundary. `numeric` arriving as a JS float (F-50). `Money.toString()` — the _display_ string — fed into a number input, so the panel promised ₱6.00 and the database stored nothing (F-68). Import templates whose column names were written from the spec's prose instead of from the files, so twelve of thirteen looked for columns that do not exist (F-78). The maths has never been wrong. **Check the format, the column name and the type at every boundary you cross.**

**Verify by reading the rendered output, not the JSX.** Most defects here were only visible on the running page: a preview that crashed on first render, two minus glyphs side by side, a 100% margin on a sale that lost money, a machine row whose rate times quantity did not equal its cost.

**A derived figure must show its inputs.** This has now happened six times — F-48, F-55, F-56, F-61, F-63, F-70 — and is the single most common defect in the project. If a number is a quotient, a sum or a rate, the screen shows what it came from.

**Unknown is not zero (D-119, D-126).** Stock with no established cost contributes nothing to a total rather than ₱0.00, one uncosted line makes a whole sale's cost unknown, and a purchase against uncosted stock takes the price just paid rather than averaging against a guessed zero.

**Movements arrive in business-time order (D-128).** Every movement stores the balance it produced, which is what makes past valuation a lookup. A movement dated behind existing history is refused, by date rather than by instant.

**Role guards use `coalesce(my_role(org)::text,'')`, never a bare `not in` (D-127).** `my_role` returns NULL for a non-member and `NULL not in (...)` is NULL, so the guard passed the people it existed to stop. This was a live cross-tenant write (F-60).

**Every paged query ends its order chain with a unique column (D-080).** PostgREST caps at 1000 rows and `.limit()` cannot raise it.

**Every new table needs grants stated per verb and `anon` revoked (D-110)**, and the sweep in `rls.test.ts` fails you if you forget `enable`/`force row level security`.

**Mutations that touch stock or cost are Postgres functions over RPC (D-078)**, taking `select ... for update` on item rows in `id` order so concurrent calls queue rather than deadlock.

**`insert ... returning id` is refused under RLS** when the caller cannot yet see the row.

**Server-only code must not reach a Client Component.** Pure helpers live in `*-types.ts` files; a `server-only` module cannot be imported by a test, which is why `metrics-periods.ts` exists.

**Typed routes are on.** A `Link` or `redirect` to a runtime-built string needs an explicit cast with a comment saying what validates it.

**The Figma space scale is not linear, so `h-9` is 48px and not 36px (D-107).** Control heights have their own tokens.

**Tests must not depend on today.** A fixture that mixes `now()` with fixed dates passes until midnight (F-71).

## Where the shape of the thing lives

| What                                      | Where                                         |
| ----------------------------------------- | --------------------------------------------- |
| Every decision and why                    | `docs/decision-log.md` — D-001 to D-131       |
| Every defect and how it was found         | `docs/phase7-status-and-qa.md` — F-01 to F-89 |
| What each stage did                       | `docs/phase9-build-log.md`                    |
| Every formula with a worked example       | `docs/phase3-calculations.md`                 |
| Token map, component map, route inventory | `docs/phase8-handoff.md`                      |
| Every interface string                    | `docs/phase4-content-screens.md`              |
| Figma design file                         | key `vHvJDjDOhZQWysnl02Sxth`                  |

**One definition per figure.** `src/lib/metrics.ts` computes every dashboard number and the reports call the same functions, so a card and a report cannot disagree. A report returns rows carrying both a display string and a data string, so the CSV cannot disagree with the screen. Prefer adding to those over writing a parallel query.
