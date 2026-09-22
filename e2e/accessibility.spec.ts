import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { REPORTS } from '../src/lib/report-types';
import { STEPS } from '../src/app/(app)/onboarding/[step]/steps';
import { SETTINGS_SECTIONS } from '../src/app/(app)/settings/sections';
import { seed, type SeededRoutes } from './seed';
import { openRoute, signIn, signInToSetup } from './sign-in';

/**
 * S14: zero axe violations per route.
 *
 * WCAG 2.0 A/AA and 2.1 A/AA, which is what the design was measured against in
 * phase 7. Violations are printed with the rule, the impact and the selector,
 * because "3 violations" is not something anybody can act on.
 */

const PUBLIC_ROUTES = ['/sign-in', '/forgot-password', '/reset-password'];

const SIGNED_IN_ROUTES = [
  '/dashboard',
  '/items',
  '/items/new',
  '/purchases',
  '/purchases/new',
  '/inventory',
  '/inventory/movements',
  '/inventory/valuation',
  '/inventory/adjust',
  '/products',
  '/products/new',
  '/production',
  '/production/new',
  '/sales',
  '/sales/new',
  '/reports',
  ...REPORTS.map((report) => `/reports/${report.slug}`),
  ...SETTINGS_SECTIONS.map(([section]) => `/settings/${section}`),
  '/settings/import',
  '/more',
  '/permission-denied',
  ...STEPS.map((step) => `/onboarding/${step.slug}`),
];

const SEEDED_ROUTES = [
  { name: '/items/[id]', path: (rows: SeededRoutes) => `/items/${rows.itemId}` },
  { name: '/purchases/[id]', path: (rows: SeededRoutes) => `/purchases/${rows.purchaseId}` },
  { name: '/products/[id]/cost', path: (rows: SeededRoutes) => `/products/${rows.productId}/cost` },
  {
    name: '/products/[id]/recipe',
    path: (rows: SeededRoutes) => `/products/${rows.productId}/recipe`,
  },
  {
    name: '/products/[id]/pricing',
    path: (rows: SeededRoutes) => `/products/${rows.productId}/pricing`,
  },
  { name: '/production/[id]', path: (rows: SeededRoutes) => `/production/${rows.runId}` },
  { name: '/sales/[id]', path: (rows: SeededRoutes) => `/sales/${rows.saleId}` },
];

const REDIRECT_ROUTES = [
  { from: '/', to: '/dashboard' },
  { from: '/settings', to: '/settings/business' },
];

// The fourteen Tier-1 screens have explicit 390px and 768px Figma frames.
// Sign in is public; these are the other thirteen, including seeded details.
const TIER_ONE_ROUTES = [
  ...[
    '/dashboard',
    '/items',
    '/inventory',
    '/inventory/movements',
    '/purchases',
    '/purchases/new',
    '/products',
    '/production',
    '/sales',
    '/sales/new',
  ].map((name) => ({ name, path: () => name })),
  {
    name: '/products/[id]/cost',
    path: (rows: SeededRoutes) => `/products/${rows.productId}/cost`,
  },
  {
    name: '/products/[id]/pricing',
    path: (rows: SeededRoutes) => `/products/${rows.productId}/pricing`,
  },
  { name: '/production/[id]', path: (rows: SeededRoutes) => `/production/${rows.runId}` },
];

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const setupEmail = process.env.E2E_SETUP_EMAIL;
const setupPassword = process.env.E2E_SETUP_PASSWORD;

async function audit(page: import('@playwright/test').Page, route: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const readable = results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    where: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
  }));
  expect(readable, `${route} has accessibility violations`).toEqual([]);
}

test.describe('public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} has no axe violations`, async ({ page }) => {
      await openRoute(page, route);
      await audit(page, route);
    });
  }
});

test.describe('signed-in routes', () => {
  let seeded!: SeededRoutes;

  test.skip(
    email === undefined || password === undefined,
    'Set E2E_EMAIL and E2E_PASSWORD to audit the signed-in routes.',
  );

  test.beforeAll(async () => {
    if (email !== undefined && password !== undefined) seeded = await seed(email, password);
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, email!, password!);
  });

  for (const route of SIGNED_IN_ROUTES) {
    test(`${route} has no axe violations`, async ({ page }) => {
      await openRoute(page, route);
      await audit(page, route);
    });
  }

  for (const route of REDIRECT_ROUTES) {
    test(`${route.from} redirects to ${route.to}`, async ({ page }) => {
      await page.goto(route.from);
      await expect(page).toHaveURL((url) => url.pathname === route.to);
    });
  }

  for (const route of SEEDED_ROUTES) {
    test(`${route.name} has no axe violations`, async ({ page }) => {
      const path = route.path(seeded);
      await openRoute(page, path);
      await audit(page, path);
    });
  }
});

test.describe('first-run route', () => {
  test.skip(
    setupEmail === undefined || setupPassword === undefined,
    'Set E2E_SETUP_EMAIL and E2E_SETUP_PASSWORD to audit /setup with an org-less account.',
  );

  test('/setup has no axe violations', async ({ page }) => {
    await signInToSetup(page, setupEmail!, setupPassword!);
    await openRoute(page, '/setup');
    await audit(page, '/setup');
  });
});

for (const width of [390, 768]) {
  test.describe(`Tier-1 routes at ${width}px`, () => {
    let seeded!: SeededRoutes;
    test.use({ viewport: { width, height: 844 } });

    test('/sign-in has no axe violations or page overflow', async ({ page }) => {
      await openRoute(page, '/sign-in');
      await audit(page, `/sign-in at ${width}px`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `/sign-in scrolls sideways at ${width}px`).toBeLessThanOrEqual(1);
    });

    test.describe('signed-in screens', () => {
      test.skip(
        email === undefined || password === undefined,
        'Set E2E_EMAIL and E2E_PASSWORD to audit the responsive screens.',
      );

      test.beforeAll(async () => {
        if (email !== undefined && password !== undefined) seeded = await seed(email, password);
      });

      test.beforeEach(async ({ page }) => {
        await signIn(page, email!, password!);
      });

      for (const route of TIER_ONE_ROUTES) {
        test(`${route.name} has no axe violations or page overflow`, async ({ page }) => {
          const path = route.path(seeded);
          await openRoute(page, path);
          await audit(page, `${path} at ${width}px`);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow, `${path} scrolls sideways at ${width}px`).toBeLessThanOrEqual(1);
        });
      }
    });
  });
}
