import { redirect } from 'next/navigation';
import { SetupForm } from './setup-form';
import { getCurrentOrg } from '@/lib/org';

export const metadata = { title: 'Set up your business — Production Costing' };

export default async function SetupPage() {
  // Already set up: nothing to do here.
  if ((await getCurrentOrg()) !== null) {
    redirect('/dashboard');
  }

  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <p className="text-micro text-text-tertiary">First run</p>
      <h1 className="text-title mt-1 text-text-primary">Set up your business</h1>
      <p className="text-body mt-2 max-w-[68ch] text-text-secondary">
        Everything in this system belongs to a business: items, purchases, production runs and
        sales. Name yours and the rest becomes available.
      </p>
      <SetupForm />
      <p className="text-caption mt-6 max-w-[68ch] text-text-tertiary">
        Equipment, labour, overhead and sales channels are configured in the full onboarding flow,
        which arrives at stage S13. None of them is needed to start adding items.
      </p>
    </main>
  );
}
