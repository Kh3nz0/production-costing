import Link from 'next/link';
import { ResetPasswordForm } from './reset-password-form';

export const metadata = { title: 'Choose a new password — Production Costing' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // An expired link lands here rather than on sign-in, so it can say what
  // happened instead of leaving the user on a form that looks like it ignored
  // them.
  if (error !== undefined) {
    return (
      <>
        <h1 className="text-title text-text-primary">That link has expired</h1>
        <p className="text-body mt-2 text-text-secondary">
          Reset links are valid for one hour. Request a new one and it will arrive in a moment.
        </p>
        <Link
          href="/forgot-password"
          className="text-body mt-6 inline-flex h-control-lg w-full items-center justify-center rounded-control bg-accent px-5 font-medium text-text-inverse transition-colors duration-[120ms] ease-out hover:bg-accent-hover"
        >
          Send a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-title text-text-primary">Choose a new password</h1>
      <p className="text-body mt-1 text-text-secondary">
        You are signed in through a recovery link. Set a new password to finish.
      </p>
      <ResetPasswordForm />
    </>
  );
}
