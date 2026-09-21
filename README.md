# Costed

_Production cost, inventory and profit._

What it actually costs to make what you sell. Private business app, first use case Bloop (3D printing), architecture industry-neutral.

The design, the requirements and the decision log live in [`docs/`](docs/). Start with [`docs/phase8-build-order.md`](docs/phase8-build-order.md) — it holds the fourteen stages and each one's "done when".

## Running it

```bash
pnpm install
pnpm dev
```

`pnpm verify` runs the whole gate: types, lint, format, tests. CI runs the same four plus a build.

### Two things about the toolchain

**pnpm is not installed on this machine.** Everything below runs through `npx --yes pnpm@9.15.9 <script>`, which works but is slow. To get the bare `pnpm` command, run once (it needs your password, which is why it was not run for you):

```bash
sudo corepack enable pnpm
```

**Node is pinned to 20.20.2 by `.nvmrc`**, installed through the `nvm` that was already on this machine — in your home directory, with nothing touched in `/usr/local` and no password needed. Start any session with:

```bash
nvm use
```

It was 20.11.1 until 21 September 2026, and that constraint shaped two pins that can now be revisited: **vitest is held at 3.2.7** because vitest 4 needs `node:util.styleText` from 20.12, and **`vitest.config.mts` exports a plain object** rather than calling `defineConfig`, because that import is the CJS entry and requiring vite's ESM build needs 20.19. Both are now safe to move; neither has been moved, because a working test suite is not worth risking for tidiness on the same afternoon the runtime changed.

The upgrade also freed the standard **Turbopack build**: `pnpm build` works. It had been failing on an internal port binding since S0, and every build in this project until now used `next build --webpack`.

## The database

`supabase/migrations/` holds the schema. The app reads the project URL and publishable anon key from `.env.local` (see `.env.example`). Apply new migrations to the hosted project before using the features they add. The hosted project is current through `0017_deduplicate_overhead_import.sql` as of 21 September 2026.

The RLS tests do not need any of that. `src/test/pg.ts` runs the migrations against **PGlite**, which is PostgreSQL compiled to WebAssembly, so the policies are executed by a real Postgres with no Docker and no network. What it does not cover is stated in that file: Supabase's Auth service and PostgREST are not present, so the tests prove the database refuses the rows, not that the HTTP layer in front of it does.

Before release, run `pnpm e2e` with `E2E_EMAIL` and `E2E_PASSWORD` set for the throwaway test account. The authenticated browser checks skip without them. The CI workflow also runs a PostgreSQL dump and restore rehearsal on each push or pull request; its first hosted run needs a Git remote.

## Where the money rules live

[`src/lib/decimal.ts`](src/lib/decimal.ts) and [`src/lib/money.ts`](src/lib/money.ts), with [`src/lib/money.test.ts`](src/lib/money.test.ts) asserting the worked examples from `docs/phase3-calculations.md`.

Three rules are enforced rather than documented:

- **Money is exact integer centavos**, held as a `bigint`. A thousand-row total is exact by construction.
- **Intermediates are never rounded.** `Money.timesExact` and `dividedByExact` return an unrounded `Decimal`. `Money.fromDecimal` is the single rounding boundary, and it rounds half-up, not banker's — the owner checks figures on a phone calculator.
- **`number` cannot reach a monetary value.** The `Numeric` type is `string | Decimal` only, so the float coercion that D-079 bans is a compile error, not a lint warning. `fromInteger` is the one sanctioned door for a genuine integer.

## Design tokens

[`src/app/globals.css`](src/app/globals.css) is generated from the Figma file's `Tokens` collection. Figma variable → Tailwind key → CSS property is mapped in `docs/phase8-handoff.md` section 3. Do not invent a value there that does not exist in Figma.
