import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ready, signIn } from './sign-in';

/**
 * S14: zero axe violations per route.
 *
 * WCAG 2.0 A/AA and 2.1 A/AA, which is what the design was measured against in
 * phase 7. Violations are printed with the rule, the impact and the selector,
 * because "3 violations" is not something anybody can act on.
 */

const PUBLIC_ROUTES = ['/sign-in', '/forgot-password'];

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
  '/reports/inventory-on-hand',
  '/settings/business',
  '/settings/equipment',
  '/settings/import',
  '/more',
  '/onboarding/business',
];

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

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
      await page.goto(route);
      await ready(page);
      await audit(page, route);
    });
  }
});

test.describe('signed-in routes', () => {
  test.skip(
    email === undefined || password === undefined,
    'Set E2E_EMAIL and E2E_PASSWORD to audit the signed-in routes.',
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page, email!, password!);
  });

  for (const route of SIGNED_IN_ROUTES) {
    test(`${route} has no axe violations`, async ({ page }) => {
      await page.goto(route);
      await ready(page);
      await audit(page, route);
    });
  }
});
