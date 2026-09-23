import { expect, test } from '@playwright/test';

test('Supabase Auth has public signups disabled', async ({ request }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  test.skip(
    !url || !publishableKey,
    'Set the Supabase URL and publishable key to check live Auth settings.',
  );

  const response = await request.get(`${url}/auth/v1/settings`, {
    headers: { apikey: publishableKey! },
  });
  expect(response.ok(), `Auth settings returned HTTP ${response.status()}`).toBe(true);

  const settings = (await response.json()) as { disable_signup?: boolean };
  expect(
    settings.disable_signup,
    'Disable “Allow new users to sign up” in Supabase Auth General Configuration. A hidden sign-up page does not close the public Auth API.',
  ).toBe(true);
});
