import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '@/lib/supabase/middleware';

vi.mock('@/lib/env', () => ({
  env: { supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'test-key' },
}));
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }));

const getUser = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createServerClient).mockReturnValue({ auth: { getUser } } as unknown as ReturnType<
    typeof createServerClient
  >);
});

describe('auth middleware', () => {
  it('leaves a recovery callback and its verifier untouched before code exchange', async () => {
    const request = new NextRequest(
      'http://localhost:3000/auth/callback?type=recovery&code=valid',
      {
        headers: { cookie: 'sb-test-auth-token-code-verifier=stored-verifier' },
      },
    );

    const response = await updateSession(request);

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(request.cookies.get('sb-test-auth-token-code-verifier')?.value).toBe('stored-verifier');
  });

  it('still checks protected routes', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await updateSession(new NextRequest('http://localhost:3000/dashboard'));

    expect(getUser).toHaveBeenCalledOnce();
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/sign-in?next=%2Fdashboard',
    );
  });
});
