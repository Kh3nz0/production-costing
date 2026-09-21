import type { Page } from '@playwright/test';

/**
 * Sign in, and make sure the account has an organisation.
 *
 * A new account has none, so every signed-in route redirects to /setup until
 * one exists — which would otherwise make twenty-two route audits all audit the
 * same setup screen and pass, meaninglessly.
 */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|setup)/);

  if (page.url().includes('/setup')) {
    await page.getByLabel(/name/i).first().fill('End to end');
    await page
      .getByRole('button', { name: /create|save|continue/i })
      .first()
      .click();
    await page.waitForURL(/\/(dashboard|onboarding)/);
  }
}

/**
 * Wait for a page to have rendered.
 *
 * Not `networkidle`: a dev server's HMR websocket never lets the network go
 * idle, so that wait resolves on a timeout at random. One route sat for
 * seventeen minutes and then reported a violation that was really a hang
 * (F-82). The main landmark is the deterministic signal that the page is there.
 */
export async function ready(page: Page): Promise<void> {
  await page.locator('main').first().waitFor({ state: 'visible' });
}
