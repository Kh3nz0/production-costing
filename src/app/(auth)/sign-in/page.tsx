import Link from 'next/link';
import { SignInForm } from './sign-in-form';
import { safeRedirectPath } from '@/lib/auth-routes';

export const metadata = { title: 'Sign in — Production Costing' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <>
      <h1 className="text-title text-text-primary">Sign in</h1>
      <p className="text-body mt-1 text-text-secondary">
        Your production costs, inventory and profit in one place.
      </p>

      <SignInForm next={safeRedirectPath(next)} />

      <p className="mt-4">
        <Link href="/forgot-password" className="text-body-sm text-accent-text underline">
          Forgot your password?
        </Link>
      </p>

      <p className="text-caption mt-6 border-t border-border-strong pt-4 text-text-tertiary">
        This is a private system. Accounts are created by the owner.
      </p>
    </>
  );
}
