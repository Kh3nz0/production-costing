import Link from 'next/link';

export const metadata = { title: 'Permission denied — Production Costing' };

export default function PermissionDeniedPage() {
  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <div className="max-w-[560px] rounded-card border border-border-strong bg-surface p-6">
        <h1 className="text-heading text-text-primary">This page is for owners</h1>
        <p className="text-body mt-2 text-text-secondary">
          Your role is Production, which covers production runs and stock. Ask the owner if you need
          access.
        </p>
        <Link
          href="/dashboard"
          className="text-body-sm mt-4 inline-block text-accent-text underline"
        >
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
