'use client';

import { useActionState } from 'react';
import { signIn, type FormState } from '../actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

const initial: FormState = {};

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        autoFocus
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      {state.error !== undefined ? (
        <p role="alert" className="text-caption text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
