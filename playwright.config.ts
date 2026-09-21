import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * The end-to-end checks S14 asks for: zero axe violations per route, and
 * completing a purchase, a run and a sale with a keyboard alone.
 *
 * Unlike the vitest suite, these need the app actually running and a real
 * browser. They are a separate command on purpose — `pnpm verify` stays fast
 * and offline, and this is the slower gate you run before shipping.
 *
 * Signed-in routes need credentials, supplied by the environment rather than
 * committed:
 *
 *   E2E_EMAIL=... E2E_PASSWORD=... pnpm e2e
 *
 * Without them the authenticated specs skip and say so. The public routes are
 * always checked.
 */
// One port for the throwaway dev server, so a running `pnpm dev` on 3000 is
// never disturbed by a test run.
const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  // One worker: the specs sign into the same account and share its data.
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    // A phone and a laptop are different layouts in this app, and the timed
    // sale criterion is specifically at 390px.
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  ...(process.env.E2E_BASE_URL === undefined
    ? {
        webServer: {
          command: `npx --yes pnpm@9.15.9 next dev -p ${PORT}`,
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
};

export default config;
