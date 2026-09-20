'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordReset, type FormState } from '../actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

const initial: FormState = {};

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  if (state.sent !== undefined) {
    return (
      <>
        <h1 className="text-title text-text-primary">Reset your password</h1>
        <p className="text-body mt-3 text-text-secondary">
          Check your email. If an account exists for {state.sent}, a reset link is on its way. The
          link expires in one hour.
        </p>
        <p className="mt-6">
          <Link href="/sign-in" className="text-body-sm text-accent-text underline">
            Back to sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-title text-text-primary">Reset your password</h1>
      <p className="text-body mt-1 text-text-secondary">
        Enter the email address you sign in with. If an account exists, we will send a reset link.
      </p>

      <form action={action} className="mt-6 flex flex-col gap-4">
        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
        />

        {state.error !== undefined ? (
          <p role="alert" className="text-caption text-danger">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" fullWidth disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-4">
        <Link href="/sign-in" className="text-body-sm text-accent-text underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
