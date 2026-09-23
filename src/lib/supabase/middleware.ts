import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { isPublicPath, RECOVERY_COOKIE } from '@/lib/auth-routes';

export { RECOVERY_COOKIE };

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // The callback must exchange its PKCE code before an old session is
  // refreshed. A failed refresh signs out and removes every pending verifier.
  if (pathname === '/auth/callback') return response;

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser, not getSession: it revalidates the token with Supabase rather than
  // trusting a cookie the browser could have been handed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const inRecovery = request.cookies.get(RECOVERY_COOKIE)?.value === '1';

  // A recovery link is a real sign-in: it creates a session. Without this check
  // the user lands on the dashboard with their old password still working and
  // no prompt to change it, which is the whole point of the link. The recovery
  // flag therefore outranks the ordinary "signed in, go to the dashboard" rule.
  if (user && inRecovery && pathname !== '/reset-password') {
    const url = request.nextUrl.clone();
    url.pathname = '/reset-password';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    // Come back here once signed in, but only for a path inside this app.
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (user && !inRecovery && (pathname === '/sign-in' || pathname === '/forgot-password')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
