import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RECOVERY_COOKIE } from '@/lib/supabase/middleware';

/**
 * Where Supabase sends the browser back after a link is clicked.
 *
 * A recovery link is a real sign-in, so the only thing separating "reset your
 * password" from "you are now in the app" is this handler marking the session as
 * a recovery session. That mark is a cookie rather than a query parameter
 * because a query parameter is lost on the first redirect, which is exactly how
 * the bug reappears.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const flowId = searchParams.get('sb_flow_id');
  const isRecovery = type === 'recovery';

  // An expired link arrives with an error and no code. Send it to the reset
  // screen so it can explain itself, rather than to sign-in where the user is
  // left guessing why nothing happened.
  if (code === null) {
    const url = new URL(isRecovery ? '/reset-password' : '/sign-in', origin);
    url.searchParams.set(
      'error',
      searchParams.get('error_code') === 'otp_expired' ? 'link_expired' : 'link_invalid',
    );
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  if (error) {
    const url = new URL(isRecovery ? '/reset-password' : '/sign-in', origin);
    // A code-verifier failure is not proof that the email link expired.
    const reason =
      error.code === 'pkce_code_verifier_not_found'
        ? 'browser_mismatch'
        : error.code === 'otp_expired'
          ? 'link_expired'
          : 'link_invalid';
    url.searchParams.set('error', reason);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.redirect(
    new URL(isRecovery ? '/reset-password' : '/dashboard', origin),
  );

  if (isRecovery) {
    response.cookies.set(RECOVERY_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60,
    });
  }

  return response;
}
