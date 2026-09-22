import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/auth/callback/route';
import { RECOVERY_COOKIE } from '@/lib/auth-routes';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/middleware', () => ({ RECOVERY_COOKIE: 'pc-recovery' }));

const exchangeCodeForSession = vi.fn();

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/auth/callback?${query}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createClient).mockResolvedValue({
    auth: { exchangeCodeForSession },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
});

describe('auth callback', () => {
  it('sends a valid recovery code to reset with a recovery-only cookie', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(request('type=recovery&code=valid'));

    expect(exchangeCodeForSession).toHaveBeenCalledWith('valid');
    expect(response.headers.get('location')).toBe('http://localhost:3000/reset-password');
    expect(response.cookies.get(RECOVERY_COOKIE)).toMatchObject({
      value: '1',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('keeps an ordinary sign-in callback out of recovery mode', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(request('code=valid'));

    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    expect(response.cookies.get(RECOVERY_COOKIE)).toBeUndefined();
  });

  it('shows the reset screen for an expired recovery code', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') });

    const response = await GET(request('type=recovery&code=expired'));

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/reset-password?error=link_expired',
    );
    expect(response.cookies.get(RECOVERY_COOKIE)).toBeUndefined();
  });
});
