import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { TabBar } from '@/components/tab-bar';
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
    /**
     * The shell is exactly the viewport and never scrolls. Only the content
     * column does.
     *
     * Before this, the whole page scrolled as one, so the navigation and the
     * sign-out header slid away up the screen — on a long report you lost the
     * way out of it and had to scroll back to the top to go anywhere. Fixing
     * the shell and scrolling the content is what makes navigation permanent.
     */
    <div className="flex h-svh overflow-hidden bg-surface-sunken">
      <Sidebar email={user.email ?? ''} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-strong bg-surface px-4 py-2 lg:px-6">
          {/* The wordmark lives here below lg, where the sidebar is not shown. */}
          <span className="text-heading text-brand-bloop lg:hidden">Costed</span>
          <form action={signOut} className="ml-auto">
            <button
              type="submit"
              className="text-body-sm h-control-md rounded-control px-3 text-text-secondary transition-colors duration-fast hover:bg-surface-sunken"
            >
              Sign out
            </button>
          </form>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain pb-20 lg:pb-0">{children}</div>
        <TabBar />
      </div>
    </div>
  );
}
