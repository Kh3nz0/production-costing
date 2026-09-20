import { ButtonLink } from '@/components/ui/button-link';

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface-sunken px-4 py-9">
      <main className="w-full max-w-form-sm rounded-panel border border-border-strong bg-surface p-7 text-center shadow-card">
        <p className="text-value-lg text-text-tertiary">404</p>
        <h1 className="text-heading mt-2 text-text-primary">That page does not exist</h1>
        <p className="text-body mt-2 text-text-secondary">
          The link may be out of date, or the record may have been archived. Nothing has been
          changed.
        </p>
        <ButtonLink href="/dashboard">Go to the dashboard</ButtonLink>
      </main>
    </div>
  );
}
