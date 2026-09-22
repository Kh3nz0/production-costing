import { expect, test, type Locator, type Page } from '@playwright/test';
import { seed } from './seed';
import { openRoute, signIn } from './sign-in';

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

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let step = 0; step < 100; step += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((node) => document.activeElement === node)) return;
  }
  throw new Error(`Could not reach ${await target.getAttribute('name')} by tabbing`);
}

/**
 * Choose an option with the keyboard, by typing it.
 *
 * Type-ahead rather than arrow keys, because arrow keys do not move a native
 * select in headless Chromium — probed directly: `ArrowDown` on a focused
 * select left the value empty, while typing the option's name selected it. A
 * person at a real browser can use either; only one of them can be checked
 * here, and typing is as genuinely a keyboard gesture as arrowing (F-83).
 */
async function chooseByKeyboard(page: Page, target: Locator, name: string): Promise<void> {
  await tabTo(page, target);
  const options = await target.locator('option').allTextContents();
  expect(
    options.map((option) => option.trim()),
    `${name} is missing from the picker`,
  ).toContain(name);
  await page.keyboard.type(name);
  await expect(target.locator('option:checked')).toHaveText(name);
}

test.describe('keyboard-only completion', () => {
  test.skip(
    email === undefined || password === undefined,
    'Set E2E_EMAIL and E2E_PASSWORD to run the keyboard flows.',
  );

  test.beforeEach(async ({ page }) => {
    await seed(email!, password!);
    await signIn(page, email!, password!);
  });

  test('every control on Record a sale is reachable by tabbing', async ({ page }) => {
    await openRoute(page, '/sales/new');

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
          ('labels' in node ? (node as HTMLInputElement).labels?.[0]?.textContent?.trim() : null) ??
          node.textContent?.trim().slice(0, 30) ??
          node.tagName;
        return `${node.tagName.toLowerCase()}:${name}`;
      });
      if (described !== null) reached.add(described);
    }

    for (const control of [
      'input:sale_date',
      'select:channel_id',
      'input:Quantity',
      'input:notes',
    ]) {
      const found = reached.has(control);
      expect(found, `${control} was never focused while tabbing`).toBe(true);
    }
    // The submit button is the end of the flow and must be reachable.
    expect(
      [...reached].some((entry) => entry.toLowerCase().includes('save sale')),
      'Save sale was never focused while tabbing',
    ).toBe(true);
  });

  test('a sale can be recorded without a mouse', async ({ page }) => {
    await openRoute(page, '/sales/new');

    await chooseByKeyboard(page, page.getByLabel('Product').first(), 'End-to-end widget');
    await tabTo(page, page.getByLabel(/^quantity$/i).first());
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('1');
    await tabTo(page, page.getByLabel(/unit price/i).first());
    await page.keyboard.type('120');

    const save = page.getByRole('button', { name: /save sale/i });
    await tabTo(page, save);
    await expect(save).toBeFocused();
    await page.keyboard.press('Enter');

    await page.waitForURL('**/sales');
    await expect(page.getByRole('heading', { name: 'Sales' })).toBeVisible();
  });

  test('a purchase can be saved and received without a mouse', async ({ page }) => {
    await openRoute(page, '/purchases/new');

    await chooseByKeyboard(page, page.getByLabel('Item').first(), 'End-to-end filament');
    await tabTo(page, page.getByLabel(/^Quantity/).first());
    await page.keyboard.type('10');
    await tabTo(page, page.getByLabel('Price per unit').first());
    await page.keyboard.type('2');
    await tabTo(page, page.getByRole('button', { name: 'Save purchase' }));
    await page.keyboard.press('Enter');
    await page.waitForURL('**/purchases/*');

    const receive = page.getByRole('button', { name: 'Receive now' });
    await tabTo(page, receive);
    await page.keyboard.press('Enter');
    await expect(receive).toHaveCount(0);
  });

  test('a production run can be started and completed without a mouse', async ({ page }) => {
    await openRoute(page, '/production/new');

    await chooseByKeyboard(page, page.getByLabel('Product'), 'End-to-end keyboard product');
    await tabTo(page, page.getByLabel('How many good units do you want'));
    await page.keyboard.type('1');
    await tabTo(page, page.getByRole('button', { name: 'Start run' }));
    await page.keyboard.press('Enter');
    await page.waitForURL('**/production/*');

    await tabTo(page, page.getByLabel('Accepted units'));
    await page.keyboard.type('1');
    await tabTo(page, page.getByLabel('Failed units'));
    await page.keyboard.type('0');
    const complete = page.getByRole('button', { name: 'Complete run' });
    await tabTo(page, complete);
    await page.keyboard.press('Enter');
    await expect(complete).toHaveCount(0);
  });
});

test.describe('the sale form on a phone', () => {
  test.skip(
    email === undefined || password === undefined,
    'Set E2E_EMAIL and E2E_PASSWORD to run the phone flow.',
  );
  test.use({ viewport: { width: 390, height: 844 } });

  test('S9: the fields are usable at 390px', async ({ page }) => {
    await seed(email!, password!);
    await signIn(page, email!, password!);

    await openRoute(page, '/sales/new');

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

  test('S9: a scripted sale is saved within 20 seconds at 390px', async ({ page }) => {
    await seed(email!, password!);
    await signIn(page, email!, password!);
    await openRoute(page, '/sales/new');

    // Measure the ready form, the three required edits, and the server save.
    // Sign-in and fixture creation happen before the clock starts. This is a
    // This is the Playwright timing check specified in the S9 test plan. It
    // measures the browser flow, not a person's entry speed.
    const started = performance.now();
    await page.getByLabel('Product').first().selectOption({ label: 'End-to-end widget' });
    await page
      .getByLabel(/^quantity$/i)
      .first()
      .fill('1');
    await page
      .getByLabel(/unit price/i)
      .first()
      .fill('120');
    await page.getByRole('button', { name: 'Save sale' }).click();
    await page.waitForURL('**/sales');
    await expect(page.getByRole('heading', { name: 'Sales' })).toBeVisible();

    const elapsedMs = performance.now() - started;
    console.log(`390px sale saved in ${(elapsedMs / 1000).toFixed(2)} seconds`);
    expect(elapsedMs, 'sale entry and save exceeded 20 seconds at 390px').toBeLessThan(20_000);
  });
});
