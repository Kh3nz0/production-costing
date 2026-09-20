# Production cost, inventory and profit

What it actually costs to make what you sell. Private business app, first use case Bloop (3D printing), architecture industry-neutral.

The design, the requirements and the decision log live in [`docs/`](docs/). Start with [`docs/phase8-build-order.md`](docs/phase8-build-order.md) — it holds the fourteen stages and each one's "done when".

## Running it

```bash
pnpm install
pnpm dev
```

`pnpm verify` runs the whole gate: types, lint, format, tests. CI runs the same four plus a build.

### Two things about the toolchain

**pnpm is not installed on this machine.** Everything below was run through `npx --yes pnpm@9.15.9 <script>`, which works but is slow. To get the bare `pnpm` command, run once (it needs your password, which is why it was not run for you):

```bash
sudo corepack enable pnpm
```

**Node is 20.11.1, and that is the constraint that shaped the pins.** Two current tools need a newer Node than that:

| Tool                  | Needs        | Why                                                   |
| --------------------- | ------------ | ----------------------------------------------------- |
| vitest 4+             | Node ≥ 20.12 | its rolldown dependency imports `node:util.styleText` |
| vite 7 config loading | Node ≥ 20.19 | `require()` of an ES module                           |

So vitest is pinned to **3.2.7**, and `vitest.config.mts` deliberately exports a plain object instead of calling `defineConfig`. That import is the CJS entry point, and requiring vite's ESM build is what fails; a plain object is the same config without the risk. Both problems disappear on **Node 20.19.x**, which is a patch-level move inside the same LTS line. Worth doing before S14, when Playwright joins; not worth doing mid-stage.

Telemetry is on by default in Next. To turn it off: `pnpm next telemetry disable`.

## The database

`supabase/migrations/` holds the schema. There is no hosted project wired up yet: put your URL and anon key in `.env.local` (see `.env.example`) and run the migrations from the Supabase dashboard's SQL editor, or with `supabase db push` once the CLI is installed.

The RLS tests do not need any of that. `src/test/pg.ts` runs the migrations against **PGlite**, which is PostgreSQL compiled to WebAssembly, so the policies are executed by a real Postgres with no Docker and no network. What it does not cover is stated in that file: Supabase's Auth service and PostgREST are not present, so the tests prove the database refuses the rows, not that the HTTP layer in front of it does.

## Where the money rules live

[`src/lib/decimal.ts`](src/lib/decimal.ts) and [`src/lib/money.ts`](src/lib/money.ts), with [`src/lib/money.test.ts`](src/lib/money.test.ts) asserting the worked examples from `docs/phase3-calculations.md`.

Three rules are enforced rather than documented:

- **Money is exact integer centavos**, held as a `bigint`. A thousand-row total is exact by construction.
- **Intermediates are never rounded.** `Money.timesExact` and `dividedByExact` return an unrounded `Decimal`. `Money.fromDecimal` is the single rounding boundary, and it rounds half-up, not banker's — the owner checks figures on a phone calculator.
- **`number` cannot reach a monetary value.** The `Numeric` type is `string | Decimal` only, so the float coercion that D-079 bans is a compile error, not a lint warning. `fromInteger` is the one sanctioned door for a genuine integer.

## Design tokens

[`src/app/globals.css`](src/app/globals.css) is generated from the Figma file's `Tokens` collection. Figma variable → Tailwind key → CSS property is mapped in `docs/phase8-handoff.md` section 3. Do not invent a value there that does not exist in Figma.
