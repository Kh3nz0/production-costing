'use client';

import { useActionState } from 'react';
import { createOrganization, type ActionState } from '../actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

const initial: ActionState = {};

export function SetupForm() {
  const [state, action, pending] = useActionState(createOrganization, initial);

  return (
    <form action={action} className="mt-6 flex max-w-form-sm flex-col gap-4">
      <Field
        label="Business name"
        name="name"
        defaultValue="Bloop"
        helper="You can change this later in Settings."
        autoFocus
        required
      />

      {state.error !== undefined ? (
        <p role="alert" className="text-caption text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Setting up…' : 'Create my business'}
      </Button>
    </form>
  );
}
