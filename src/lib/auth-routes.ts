/**
 * Which routes are reachable without a session, and where it is safe to send
 * someone after signing in. Kept out of the middleware so both rules can be
 * tested without standing up Supabase.
 */

/** Set by the auth callback when the link that signed you in was a recovery link. */
export const RECOVERY_COOKIE = 'pc-recovery';

/**
 * The complete list of routes reachable without a session.
 *
 * There is no sign-up route and there must never be one: accounts are created
 * by the owner. `src/test/auth-routes.test.ts` fails if one appears here or on
 * disk.
 */
export const PUBLIC_PATHS = [
  '/sign-in',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Sanitise a `?next=` value.
 *
 * `//evil.example` is a protocol-relative URL that a browser treats as
 * absolute, so rejecting a leading double slash is what stops this being an
 * open redirect. A backslash is rejected too, because some browsers normalise
 * it to a forward slash.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (typeof value !== 'string' || value === '') return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (value.includes('\\')) return fallback;
  return value;
}
