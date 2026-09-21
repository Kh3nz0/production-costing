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
