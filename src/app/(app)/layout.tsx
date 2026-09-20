import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { signOut } from '../(auth)/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The middleware already redirects an unauthenticated request. This is the
  // second lock: a layout that renders org data must never render it because a
  // matcher pattern was edited carelessly.
  if (user === null) {
    redirect('/sign-in');
  }

  return (
    <div className="flex min-h-svh bg-surface-sunken">
      <Sidebar email={user.email ?? ''} />
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-end border-b border-border-strong bg-surface px-6 py-2">
          <form action={signOut}>
            <button
              type="submit"
              className="text-body-sm rounded-control px-3 py-1 text-text-secondary transition-colors duration-[120ms] hover:bg-surface-sunken"
            >
              Sign out
            </button>
          </form>
        </header>
        {children}
      </div>
    </div>
  );
}
