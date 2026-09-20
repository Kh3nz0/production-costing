import { ButtonLink } from '@/components/ui/button-link';
import { ResetPasswordForm } from './reset-password-form';

export const metadata = { title: 'Choose a new password' };

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
