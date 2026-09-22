import { expect, test } from '@playwright/test';
import { seed } from './seed';
import { openRoute, signIn } from './sign-in';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.skip(
  email === undefined || password === undefined,
  'Set E2E_EMAIL and E2E_PASSWORD to check a saved sale.',
);

test('a saved sale opens from the list with its recorded amounts', async ({ page }) => {
  const rows = await seed(email!, password!);
  await signIn(page, email!, password!);
  await openRoute(page, '/sales');

  await page.getByRole('table').locator(`a[href="/sales/${rows.saleId}"]`).click();
  await expect(page).toHaveURL((url) => url.pathname === `/sales/${rows.saleId}`);
  await expect(page.getByRole('heading', { name: 'E2E-ROUTE-SALE' })).toBeVisible();

  const breakdown = page.getByRole('heading', { name: 'What this sale earned' }).locator('..');
  const amount = (name: string) =>
    breakdown.getByText(name, { exact: true }).locator('..').locator('dd');
  await expect(amount('Revenue')).toHaveText('₱120.00');
  await expect(amount('Cost of goods sold')).toHaveText('₱80.00');
  await expect(amount('Contribution profit')).toHaveText('₱40.00');

  await page.setViewportSize({ width: 390, height: 844 });
  await amount('Contribution profit').scrollIntoViewIfNeeded();
  await expect(amount('Contribution profit')).toBeInViewport();
});
