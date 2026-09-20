'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { RECOVERY_COOKIE, safeRedirectPath } from '@/lib/auth-routes';

export interface FormState {
  error?: string;
  sent?: string;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

type RedirectTarget = Parameters<typeof redirect>[0];

/**
 * The cast is unavoidable and deliberate: typed routes verify route literals,
 * and this value arrives from a query string at runtime. safeRedirectPath is
 * what makes it safe, not the type.
 */
function safeNext(value: string): RedirectTarget {
  return safeRedirectPath(value) as RedirectTarget;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, 'email');
  const password = text(formData, 'password');
  const next = safeNext(text(formData, 'next'));

  if (email === '' || password === '') {
    return { error: 'Enter your email address and password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // One message for a wrong password and an unknown address alike. Telling
    // them apart would confirm which addresses have accounts on a system whose
    // accounts are created by invitation only.
    return { error: 'That email address and password do not match.' };
  }

  revalidatePath('/', 'layout');
  redirect(next);
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = text(formData, 'email');
  if (email === '') {
    return { error: 'Enter the email address you sign in with.' };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?type=recovery`,
  });

  // Always the same answer, whether or not an account exists.
  return { sent: email };
}

export async function setNewPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = text(formData, 'password');
  const confirm = text(formData, 'confirm');

  if (password.length < 10) {
    return { error: 'Use at least 10 characters.' };
  }
  if (password !== confirm) {
    return { error: 'Those two passwords are not the same.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    return { error: 'That link has expired. Request a new one and it will arrive in a moment.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  // The recovery flag is what pins the user to this screen. Clear it only once
  // the password has actually changed.
  const cookieStore = await cookies();
  cookieStore.delete(RECOVERY_COOKIE);

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/sign-in');
}
