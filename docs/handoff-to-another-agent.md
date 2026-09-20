# Handoff to another agent

Written 20 September 2026, at the end of S4. Read this first, then `phase8-build-order.md` section 3 for the stage you are picking up.

## What this is

A private, responsive web app that computes the true cost of producing physical products. First use case is the owner's 3D-printing business, **Bloop**, but the architecture is industry-neutral and must stay that way — never design exclusively around 3D printing.

The owner is Khenzo Bacani. He is a designer who builds, rebuilding frontend knowledge, and he reads everything you write.

## The rules you are working under

These came from the owner and are not yours to relax.

- **Work one stage at a time. Stop at the end of each and wait for explicit approval.** Do not start the next stage because the current one went well.
- **A stage is done when its "done when" is observably true**, not when the code looks finished. The done-when lists are in `phase8-build-order.md` section 3.
- **The worked examples in `phase3-calculations.md` are the test fixtures.** If an implementation disagrees with a worked example, the implementation is wrong until proven otherwise.
- **Do not invent business figures.** Sample data is already established and internally consistent; extend it, do not replace it. Label anything temporary.
- **Never say "best practice".** Give the concrete consequence instead.
- **Push back on vague instructions** with concrete alternatives, and state what you rejected.
- **Distinguish facts, assumptions, recommendations and approved decisions.** Keep the decision log current.
- No emojis. Concise. Lead with the answer. Real Markdown. Tables for comparisons. Explain accounting terms in plain language.
- **Do not change anything in the eGOV Icons Figma file** (`LmAeP5UTbwQL0xnGHwVjjZ`). Read-only reference.

## Where everything is

| What                                      | Where                                                             |
| ----------------------------------------- | ----------------------------------------------------------------- |
| The app                                   | `/Users/khenzobacani/Desktop/claude/production-costing`           |
| Specification, phases 1–8                 | `docs/`                                                           |
| **Every decision and why**                | `docs/decision-log.md` — D-001 to D-120                           |
| **Every defect found and how**            | `docs/phase7-status-and-qa.md` — F-01 to F-47                     |
| **What each stage actually did**          | `docs/phase9-build-log.md`                                        |
| The stage list and done-whens             | `docs/phase8-build-order.md` section 3                            |
| Every formula with a worked example       | `docs/phase3-calculations.md`                                     |
| Token map, component map, route inventory | `docs/phase8-handoff.md`                                          |
| Every interface string                    | `docs/phase4-content-screens.md`, `docs/phase4-content-system.md` |
| Figma design file                         | key `vHvJDjDOhZQWysnl02Sxth`, 70 frames, tokens and components    |

**Read `decision-log.md` and `phase7-status-and-qa.md` before writing code.** They are long, and they are the difference between continuing this project and starting a parallel one. Most of the traps below are recorded there with the reasoning.

## State at handoff

S0 to S4 are done, verified against the live database, and committed as five commits on `main`. 131 tests pass. Working tree clean.

```
dfa38aa S4: stock is a ledger, not a number
a5f6a5b S3: a purchase becomes stock with a derived cost
220040a S2: units and items exist and can be found
5ea01cb S1: the owner can sign in, nobody else can read the data
4e77c8c S0: the project runs
```

Built: auth and RLS, units and items, purchases with landed-cost allocation, the inventory ledger with adjustments, opening balances and past-date valuation. Routes: `/sign-in`, `/forgot-password`, `/reset-password`, `/setup`, `/dashboard`, `/items`, `/items/new`, `/items/[id]`, `/purchases`, `/purchases/new`, `/purchases/[id]`, `/inventory`, `/inventory/movements`, `/inventory/valuation`, `/inventory/adjust`.

Live data in the Supabase project: one org (Bloop), two items (PLA Basic Filament, Mechanical Switch), one received purchase reproducing the F-01 worked example, one waste movement.

**Next stage is S5:** rates, dated and never overwritten.

## How to run anything

**`pnpm` is not installed on this machine.** Every command goes through npx:

```bash
cd /Users/khenzobacani/Desktop/claude/production-costing
npx --yes pnpm@9.15.9 test
npx --yes pnpm@9.15.9 typecheck
npx --yes pnpm@9.15.9 lint
npx --yes pnpm@9.15.9 build
```

Running `pnpm` directly fails. `sudo corepack enable pnpm` would fix it but needs the owner's password, so it has been left to him.

**Node is 20.11.1**, and that constraint shaped the pins. vitest is held at 3.2.7 because vitest 4's rolldown dependency needs `node:util.styleText` from Node 20.12; `vitest.config.mts` exports a plain object rather than calling `defineConfig`, because that import is the CJS entry and requiring vite's ESM build needs Node 20.19. Do not "upgrade" either without moving Node first.

**Never start a dev server with a bash command.** The launch config lives at `/Users/khenzobacani/Desktop/claude/.claude/launch.json` under the name `production-costing` — note that is the _parent_ directory, not the app directory, because that is where the harness looks.

## The migration loop, which needs the owner

You cannot apply migrations. There is no Docker, no Supabase CLI, no psql, and the anon key cannot run DDL. The loop is:

1. Write `supabase/migrations/000N_name.sql`.
2. Prove it with the PGlite tests (below) — they run the migration files verbatim.
3. `pbcopy < supabase/migrations/000N_name.sql` and tell the owner to paste it at
   `https://supabase.com/dashboard/project/wdluhlpjvjwfyytvduhs/sql/new` and hit Run.
4. Wait for him to confirm. Then verify against the live project before claiming the stage is done.

Migrations are append-only once applied. Never edit `0001`–`0005`; add `0006`.

**Verify the live project with curl and the anon key** (in `.env.local`). Anon must be refused on every table:

```bash
KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2-)
curl -s -o /dev/null -w "%{http_code}\n" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "https://wdluhlpjvjwfyytvduhs.supabase.co/rest/v1/items?select=id"   # expect 401
```

A fresh function may answer 404 for a minute while PostgREST reloads its schema cache. That is not a failure.

## Traps that have already cost time

Every one of these is a defect that actually happened. The reasoning is in the decision and QA logs.

**Floats cannot touch money or quantities (D-079).** `Numeric` is `string | Decimal`; `number` is deliberately absent so the coercion is a compile error. Lint also bans `parseFloat`, `parseInt`, `Number(...)` and `Number.parseFloat`. This has been violated three times — twice by me — so assume you will try it too. Money is exact integer centavos as a `bigint`; `Money.fromDecimal` is the only rounding boundary, half-up, never banker's.

**The PGlite test harness reproduces Supabase's default privileges, on purpose (D-110).** Supabase grants `anon` everything on every new table in `public`. Without that line in `src/test/pg.ts` the suite flatters the migration: four real defects hid behind it, the worst being a `delete` that affected zero rows and reported success. **Every new table needs its grants stated per verb and `anon` revoked**, and the sweep in `src/test/rls.test.ts` will fail you if you forget `enable`/`force row level security`.

**The ledger is append-only and has no insert policy at all (D-115).** Movements are written only by `security definer` RPCs. Do not add an insert policy to `inventory_movements` — that is what makes the cache and the ledger unable to disagree.

**Order the ledger by `seq`, never by `occurred_at` or `id` (D-113).** `occurred_at` is business time and ties across a whole purchase; `created_at` ties too because `now()` is transaction-stable; `id` is a random uuid. Ordering by those let `rebuild_item_balances` reproduce a mid-transaction balance.

**Every list pages with `.range()` and ends its `.order()` chain with a unique column (D-080).** PostgREST caps responses at 1000 rows and `.limit()` cannot raise it.

**The item's purchase-to-base factor outranks dimension conversion (D-109).** A pack and a piece are both `count`, so dimension arithmetic alone turns one pack of 90 switches into one piece — silently, with every material cost wrong by ninety.

**Mutations that touch stock or cost are Postgres functions over RPC, not client write sequences (D-078).** They need `select ... for update` on the item row, taken in `id` order so concurrent calls queue rather than deadlock.

**`insert ... returning id` is refused under RLS** when the caller cannot yet see the row — RETURNING is subject to the SELECT policy. This is why founding an org is `create_organization()`.

**Server-only code must not reach a Client Component.** `src/lib/supabase/server.ts` has `import 'server-only'`. Pure helpers live in `*-types.ts` files; queries live beside the server client.

**Typed routes are on.** A `Link` or `redirect` to a runtime-built string needs an explicit cast with a comment saying what validates it. `next typegen` runs as part of `typecheck`, so route types exist before `tsc`.

**Display formatters use a real minus, U+2212, with the sign outside the currency symbol (D-120).** `toJSON` keeps the ASCII hyphen because it is a data value.

**The Figma space scale is not linear, so `h-9` is 48px and not 36px (D-107).** Control heights have their own tokens: `control-sm`, `control-md`, `control-lg`, `field`. Never size a control from the spacing scale.

**Verify by reading the rendered output, not the JSX.** Six of the last twelve defects were only visible in the running page: a preview that crashed on its first render, two different minus glyphs side by side, a filter that never fired, a missing space, a page title falling back to the layout default.

## Two gaps left open, both with the same fix

**`receive_purchase` is not proven under genuine concurrency.** PGlite is a single connection, so two simultaneous receipts cannot be issued. The locking is written and reasoned about; it is not demonstrated. **S8's production runs consume the same stock through the same locks, so close this before S8.**

**Playwright cannot run at S14** for the same Node reason as vitest.

Both are fixed by moving to **Node 20.19.x** — a patch-level move inside the same LTS line — and installing the Supabase CLI for a local Postgres with real connections. Recommend it to the owner in the gap between stages, not mid-stage. He has not agreed to it yet.

## Also outstanding

- The Figma file's `Item detail` frame exists, but tablet and mobile frames for it do not, by agreement (D-075).
- `/permission-denied` carries approved copy but nothing routes to it: it needs the non-owner roles, which arrive when staff do.
- The dashboard still says "Stage S2" and is a placeholder by design. The real one is S10, after the reports that stand behind each figure exist.

## What S5 requires

From `phase8-build-order.md`: _"Editing a rate creates a version; the previous stays readable; the rate in force on a date resolves correctly across three versions; equipment hourly recovery is computed and stored, not recomputed on read."_

Frames: Settings — Equipment, Labour, Overhead, Channels, Business. Data model in `phase3-data-model.md` section 5, which specifies four explicit rate tables rather than one polymorphic one, and says why. Content in `phase4-content-screens.md`.

The immutability requirement is the whole point: a rate version must never be updated in place, because a completed production run's cost has to stay reproducible after a rate changes. S8 has a test for exactly that.
