# Handoff to another agent

Rewritten 21 September 2026, with every stage built. Read this, then `phase9-build-log.md` for what each stage actually did and `phase7-status-and-qa.md` for every defect and how it was found.

## What this is

**Costed** — a private, responsive web app that computes the true cost of producing physical products. First use case is the owner's 3D-printing business, **Bloop**, but the architecture is industry-neutral and must stay that way.

The owner is Khenzo Bacani. He is a designer who builds, rebuilding frontend knowledge, and he reads everything you write.

## The rules you are working under

These came from the owner and are not yours to relax.

- **A stage is done when its "done when" is observably true**, not when the code looks finished. Report partial completion as partial — this project has three stages recorded as "n of m" because they are.
- **The worked examples in `phase3-calculations.md` are the test fixtures.** If an implementation disagrees with one, the implementation is wrong until proven otherwise.
- **Do not invent business figures**, and do not invent a design token that is not in Figma.
- **Never say "best practice".** Give the concrete consequence.
- **Push back on vague instructions** with concrete alternatives, and state what you rejected.
- No emojis. Concise. Lead with the answer. Tables for comparisons. Explain accounting terms in plain language.
- **Do not change anything in the eGOV Icons Figma file** (`LmAeP5UTbwQL0xnGHwVjjZ`). Read-only reference.

## State

All fourteen stages are built. **297 tests pass.** Migrations `0001`–`0016` are applied to the live project.

| Stage          | State                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| S0–S8, S10–S13 | Done and verified live                                                                                                                    |
| S9             | Four criteria of five. The timed 20-second sale entry at 390px has not been run — it is now possible, and needs a person with a stopwatch |
| S14            | Three of six. Zero axe violations, keyboard-only completion and a `pg_dump` restore all need tooling this machine cannot run              |

**Open, with one shared fix.** Three S14 criteria, the `receive_purchase` concurrency proof that has been open since S3, and Playwright all need **Node 20.19.x** — a patch move inside the same LTS line as the installed 20.11 — plus the Supabase CLI for a local Postgres with real connections. Recommend it between stages; it needs the owner's password.

**Open, needing the owner.** Dark mode: the tokens are in the Figma file and _not_ in `globals.css`, and the README forbids inventing one. It needs a node-specific Figma URL to read them from.

**Open, small.** Seventeen raw `<select>` elements that predate the `Select` component, and `EmptyState` adopted on two screens of many.

## How to run anything

**`pnpm` is not installed.** Every command goes through npx:

```bash
cd /Users/khenzobacani/Desktop/claude/production-costing
npx --yes pnpm@9.15.9 test        # 297 tests, PGlite, no Docker or network
npx --yes pnpm@9.15.9 typecheck
npx --yes pnpm@9.15.9 lint
npx --yes pnpm@9.15.9 next build --webpack
```

The plain `next build` is blocked here by a Turbopack port-binding error; `--webpack` works.

**Node is 20.11.1**, and that shaped the pins. vitest is held at 3.2.7 because vitest 4 needs `node:util.styleText` from 20.12; `vitest.config.mts` exports a plain object rather than calling `defineConfig`, because that import is the CJS entry and requiring vite's ESM build needs 20.19. Do not "upgrade" either without moving Node first.

## The migration loop, which needs the owner

You cannot apply migrations: no Docker, no Supabase CLI, no psql, and the anon key cannot run DDL.

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
| Every decision and why                    | `docs/decision-log.md` — D-001 to D-130       |
| Every defect and how it was found         | `docs/phase7-status-and-qa.md` — F-01 to F-78 |
| What each stage did                       | `docs/phase9-build-log.md`                    |
| Every formula with a worked example       | `docs/phase3-calculations.md`                 |
| Token map, component map, route inventory | `docs/phase8-handoff.md`                      |
| Every interface string                    | `docs/phase4-content-screens.md`              |
| Figma design file                         | key `vHvJDjDOhZQWysnl02Sxth`                  |

**One definition per figure.** `src/lib/metrics.ts` computes every dashboard number and the reports call the same functions, so a card and a report cannot disagree. A report returns rows carrying both a display string and a data string, so the CSV cannot disagree with the screen. Prefer adding to those over writing a parallel query.
