import { ButtonLink } from '@/components/ui/button-link';
import { ResetPasswordForm } from './reset-password-form';

export const metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (error !== undefined) {
    const expired = error === 'link_expired';
    const browserMismatch = error === 'browser_mismatch';
    return (
      <>
        <h1 className="text-title text-text-primary">
          {expired ? 'That link has expired' : 'That link could not be verified'}
        </h1>
        <p className="text-body mt-2 text-text-secondary">
          {expired
            ? 'Reset links are valid for one hour. Request a new one and it will arrive in a moment.'
            : browserMismatch
              ? 'Request a new link and open it in the same browser where you requested it.'
              : 'Request a new link and try again.'}
        </p>
        <ButtonLink href="/forgot-password">Send a new link</ButtonLink>
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
