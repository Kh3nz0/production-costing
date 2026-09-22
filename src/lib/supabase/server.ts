// Importing this from a Client Component is a build error rather than a
// mysterious bundle trace. It reads cookies, so it can only ever run on the
// server.
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';

/**
 * Server-side Supabase client. Reads and writes the session cookies so that a
 * Server Component, a Route Handler and a Server Action all see the same
 * session.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      // Recovery emails can be requested more than once before any link is
      // opened. Carry the flow id back so each code uses its own PKCE verifier.
      experimental: { appendPkceFlowIdToRedirects: true },
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
