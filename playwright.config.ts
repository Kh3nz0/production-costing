import { readFileSync } from 'node:fs';
import type { PlaywrightTestConfig } from '@playwright/test';

// The seed talks to Supabase directly, so it needs the same `.env.local` the
// app reads. Next loads that for the app; nothing loads it for a test runner,
// and adding a dependency to read four lines is not worth it.
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match !== null && process.env[match[1]!] === undefined) {
    process.env[match[1]!] = match[2]!;
  }
}

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
          // Build once and audit the same production server that ships. This
          // also keeps route compilation outside individual test timings.
          command: './scripts/e2e-server.sh',
          url: baseURL,
          // Reusing a stray dev server made the audit depend on whatever
          // happened to own this port. A second invocation now fails clearly.
          reuseExistingServer: false,
          // Let the shell run its EXIT trap and release the interprocess lock.
          gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
          timeout: 300_000,
        },
      }
    : {}),
};

export default config;
