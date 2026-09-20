import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';
import { setupGaps } from '@/lib/metrics';
import { STEPS } from './steps';
import { OnboardingStep } from './onboarding-step';

/**
 * Six steps, every one skippable.
 *
 * Skipping is not a lesser path. Anything skipped is listed on the dashboard
 * until it is filled in, and any cost that needed it says what is missing
 * rather than guessing — which is the behaviour every stage before this one was
 * built to have. The wizard is a convenience over the settings screens, not a
 * gate in front of them.
 */

export async function generateMetadata({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const found = STEPS.find((entry) => entry.slug === step);
  return { title: `${found?.title ?? 'Set up'} — Production Costing` };
}

export default async function OnboardingPage({ params }: { params: Promise<{ step: string }> }) {
  const org = await requireOrg();
  const { step } = await params;
  const index = STEPS.findIndex((entry) => entry.slug === step);
  if (index === -1) notFound();
  const current = STEPS[index]!;

  const db = await createClient();
  const [units, business, gaps] = await Promise.all([
    db
      .from('units')
      .select('id,code')
      .eq('dimension_code', 'energy')
      .order('code')
      .order('id')
      .range(0, 99),
    db
      .from('organizations')
      .select('name,currency_code,locale,timezone')
      .eq('id', org.id)
      .maybeSingle(),
    setupGaps(org.id),
  ]);

  return (
    <main className="mx-auto max-w-[720px] px-6 py-9">
      <p className="text-caption text-text-secondary">Step {current.of} of 6</p>
      <h1 className="text-title mt-1 text-text-primary">Set up your business</h1>

      <nav aria-label="Setup steps" className="mt-4 flex flex-wrap gap-2">
        {STEPS.map((entry) => (
          <Link
            key={entry.slug}
            href={`/onboarding/${entry.slug}` as '/onboarding/business'}
            aria-current={entry.slug === current.slug ? 'step' : undefined}
            className={`text-caption rounded-pill px-3 py-2 ${entry.slug === current.slug ? 'bg-surface-accent text-accent-text' : 'bg-surface text-text-secondary'}`}
          >
            {entry.of}
          </Link>
        ))}
      </nav>

      <OnboardingStep
        step={current.slug}
        index={index}
        next={STEPS[index + 1]?.slug ?? null}
        energyUnits={(units.data ?? []) as { id: string; code: string }[]}
        business={
          (business.data as {
            name: string;
            currency_code: string;
            locale: string;
            timezone: string;
          } | null) ?? null
        }
        gaps={gaps}
      />
    </main>
  );
}
