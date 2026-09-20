import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface-sunken px-4 py-9">
      <main className="w-full max-w-[480px] rounded-panel border border-border-strong bg-surface p-7 text-center shadow-card">
        <p className="text-value-lg text-text-tertiary">404</p>
        <h1 className="text-heading mt-2 text-text-primary">That page does not exist</h1>
        <p className="text-body mt-2 text-text-secondary">
          The link may be out of date, or the record may have been archived. Nothing has been
          changed.
        </p>
        <Link
          href="/dashboard"
          className="text-body mt-6 inline-flex h-control-md items-center justify-center rounded-control bg-accent px-4 font-medium text-text-inverse transition-colors duration-[120ms] ease-out hover:bg-accent-hover"
        >
          Go to the dashboard
        </Link>
      </main>
    </div>
  );
}
