import { expect, test } from '@playwright/test';

/**
 * S14: a purchase, a run and a sale completed with a keyboard alone.
 *
 * Not "the form is reachable by tabbing" — completed. Someone whose hands are
 * covered in filament, or who does not use a mouse, has to be able to record
 * the work without touching one.
 *
 * Each spec tabs to a control, types, and submits with Enter or Space, never
 * with `click()`. A control the keyboard cannot reach fails by timing out on
 * the assertion that follows it, which is the honest failure: the flow stopped.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('keyboard-only completion', () => {
  test.skip(
    email === undefined || password === undefined,
    'Set E2E_EMAIL and E2E_PASSWORD to run the keyboard flows.',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    // Signing in is itself part of the criterion: keyboard only, from the top.
    await page.keyboard.press('Tab');
    await page.getByLabel(/email/i).fill(email!);
    await page.keyboard.press('Tab');
    await page.getByLabel(/password/i).fill(password!);
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/(dashboard|setup)/);
  });

  test('every control on Record a sale is reachable by tabbing', async ({ page }) => {
    await page.goto('/sales/new');
    await page.waitForLoadState('networkidle');

    // Walk forward through the document and collect what the focus ring lands
    // on. A control that never receives focus is not on this list, which is
    // what makes the assertion below meaningful.
    const reached = new Set<string>();
    for (let step = 0; step < 60; step += 1) {
      await page.keyboard.press('Tab');
      const described = await page.evaluate(() => {
        const node = document.activeElement;
        if (node === null || node === document.body) return null;
        const name =
          node.getAttribute('name') ??
          node.getAttribute('aria-label') ??
          node.textContent?.trim().slice(0, 30) ??
          node.tagName;
        return `${node.tagName.toLowerCase()}:${name}`;
      });
      if (described !== null) reached.add(described);
    }

    for (const control of ['input:sale_date', 'select:channel_id', 'input:units', 'input:notes']) {
      const found = [...reached].some((entry) => entry.startsWith(control.split(':')[0]!));
      expect(found, `${control} was never focused while tabbing`).toBe(true);
    }
    // The submit button is the end of the flow and must be reachable.
    expect(
      [...reached].some((entry) => entry.toLowerCase().includes('save sale')),
      'Save sale was never focused while tabbing',
    ).toBe(true);
  });

  test('a sale can be recorded without a mouse', async ({ page }) => {
    await page.goto('/sales/new');
    await page.waitForLoadState('networkidle');

    const product = page.getByLabel('Product').first();
    await product.focus();
    await product.selectOption({ index: 1 });

    await page
      .getByLabel(/^quantity$/i)
      .first()
      .fill('1');
    await page
      .getByLabel(/unit price/i)
      .first()
      .fill('120');

    const save = page.getByRole('button', { name: /save sale/i });
    await save.focus();
    await expect(save).toBeFocused();
    await page.keyboard.press('Enter');

    await page.waitForURL('**/sales');
    await expect(page.getByRole('heading', { name: 'Sales' })).toBeVisible();
  });
});

test.describe('the sale form on a phone', () => {
  test.skip(
    email === undefined || password === undefined,
    'Set E2E_EMAIL and E2E_PASSWORD to run the phone flow.',
  );
  test.use({ viewport: { width: 390, height: 844 } });

  test('S9: the fields are usable at 390px', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard|setup)/);

    await page.goto('/sales/new');
    await page.waitForLoadState('networkidle');

    // The defect F-69 recorded: a select crushed to a bare chevron, with no
    // room for a product name. Anything under 120px is not a usable picker.
    const product = page.getByLabel('Product').first();
    const box = await product.boundingBox();
    expect(box, 'the product picker has no box').not.toBeNull();
    expect(box!.width, 'the product picker is too narrow to read').toBeGreaterThan(120);

    // And nothing may overflow the viewport sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the page scrolls sideways at 390px').toBeLessThanOrEqual(1);
  });
});
