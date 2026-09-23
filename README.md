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

`supabase/migrations/` holds the schema. The app reads the project URL and publishable key from `.env.local` (see `.env.example`). The legacy anon-key variable remains accepted while existing environments migrate. Apply new migrations to the hosted project before using the features they add. The hosted project is current through `0017_deduplicate_overhead_import.sql` as of 21 September 2026.

The RLS tests do not need any of that. `src/test/pg.ts` runs the migrations against **PGlite**, which is PostgreSQL compiled to WebAssembly, so the policies are executed by a real Postgres with no Docker and no network. What it does not cover is stated in that file: Supabase's Auth service and PostgREST are not present, so the tests prove the database refuses the rows, not that the HTTP layer in front of it does.

The complete production browser suite has passed with both throwaway accounts. The suite also checks that live Supabase Auth disables public account creation; this passed after **Allow new users to sign up** was turned off in the project dashboard. The CI workflow runs a PostgreSQL dump and restore rehearsal on each push or pull request. A live emailed password-recovery link also reached the new-password form, saved the new password and redirected to the dashboard.

## Deploying to Vercel

The repository has no production deployment recorded yet. The app needs no custom Vercel build configuration; import `Kh3nz0/production-costing` and use `main` as the production branch.

In the Vercel project:

1. Enable access to **System Environment Variables**. Recovery links use `VERCEL_URL` when a preview does not have an explicit site URL.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to Production and Preview. Both values come from the Supabase project Connect dialog. A publishable key is designed to ship in browser code; never put a secret or service-role key in a `NEXT_PUBLIC_` variable.
3. Add `NEXT_PUBLIC_SITE_URL=https://your-production-domain.example` to Production only. Preview deployments fall back to their generated Vercel URL.
4. Deploy `main`. Environment changes apply only to new deployments.

Then update Supabase **Authentication → URL Configuration**:

- **Site URL:** the exact production origin.
- **Redirect URLs:** the production callback (`https://your-production-domain.example/auth/callback*`), local development (`http://localhost:3000/**`), and the Vercel preview pattern (`https://*-<team-or-account-slug>.vercel.app/**`). The wildcard on the production callback carries the recovery flow id.

After those settings are saved and a new deployment is ready, run the existing browser suite against it:

```bash
E2E_BASE_URL=https://your-production-domain.example \
E2E_EMAIL=... E2E_PASSWORD=... \
E2E_SETUP_EMAIL=... E2E_SETUP_PASSWORD=... pnpm e2e
```

Finally, request one password-recovery email from the deployed site and confirm its link returns to the deployed `/reset-password` form.

## Where the money rules live

[`src/lib/decimal.ts`](src/lib/decimal.ts) and [`src/lib/money.ts`](src/lib/money.ts), with [`src/lib/money.test.ts`](src/lib/money.test.ts) asserting the worked examples from `docs/phase3-calculations.md`.

Three rules are enforced rather than documented:

- **Money is exact integer centavos**, held as a `bigint`. A thousand-row total is exact by construction.
- **Intermediates are never rounded.** `Money.timesExact` and `dividedByExact` return an unrounded `Decimal`. `Money.fromDecimal` is the single rounding boundary, and it rounds half-up, not banker's — the owner checks figures on a phone calculator.
- **`number` cannot reach a monetary value.** The `Numeric` type is `string | Decimal` only, so the float coercion that D-079 bans is a compile error, not a lint warning. `fromInteger` is the one sanctioned door for a genuine integer.

## Design tokens

[`src/app/globals.css`](src/app/globals.css) is generated from the Figma file's `Tokens` collection. Figma variable → Tailwind key → CSS property is mapped in `docs/phase8-handoff.md` section 3. Do not invent a value there that does not exist in Figma.

## The browser checks

`pnpm e2e` defines Playwright audits for every rendered route variant against WCAG 2.0 and 2.1 A and AA, plus Tier-1 screen audits at 390px and 768px with a horizontal-overflow check. It also checks both redirect-only pages, completes a purchase, a run and a sale with the keyboard alone, verifies that Sale detail displays saved monetary amounts, measures the sale form at 390px, times a scripted sale from first edit through save, and fires two simultaneous receipts of one purchase. Account-dependent checks skip until their credentials are supplied below. The scripted sale timing satisfies the Playwright measurement specified for S9; a person's entry time has not been measured.

It builds and starts the production app itself, so the audit covers the artifact that ships and route compilation is outside individual test timings (F-82). Point it at an existing deployment with `E2E_BASE_URL`. On macOS the server script uses `caffeinate` to prevent idle sleep during the run; keep the lid open (F-84). Only run one local `pnpm e2e` at a time; a lock makes a second run fail immediately instead of sharing build output or a server.

If Turbopack cannot bind its local worker port in a sandbox, set `COSTED_E2E_WEBPACK=1` for the same production browser suite using a Webpack build.

The signed-in checks need an account, supplied by the environment and never committed:

```bash
E2E_EMAIL=... E2E_PASSWORD=... pnpm e2e
```

Without them those specs skip and say so. There is no public sign-up route — that is S1's criterion — so a test account is created in the Supabase dashboard under Authentication, with **Auto Confirm User** ticked.

The `/setup` audit needs a second account that deliberately remains outside every organisation:

```bash
E2E_EMAIL=... E2E_PASSWORD=... \
E2E_SETUP_EMAIL=... E2E_SETUP_PASSWORD=... pnpm e2e
```
