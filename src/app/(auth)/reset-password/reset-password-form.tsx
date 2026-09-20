'use client';

import { useActionState } from 'react';
import { setNewPassword, type FormState } from '../actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

const initial: FormState = {};

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(setNewPassword, initial);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <Field
        label="New password"
        helper="At least 10 characters."
        name="password"
        type="password"
        autoComplete="new-password"
        autoFocus
        required
      />
      <Field
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />

      {state.error !== undefined ? (
        <p role="alert" className="text-caption text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? 'Saving…' : 'Save new password'}
      </Button>
    </form>
  );
}
