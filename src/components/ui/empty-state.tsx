import type { ReactNode } from 'react';

/**
 * What a screen says when it has nothing to show.
 *
 * These had drifted into two shapes: some a bordered card with a sentence and a
 * link, others a bare grey paragraph. An empty state is the first thing a new
 * owner sees on most of these screens, so it is the one state most likely to be
 * read closely and the one most often written last.
 *
 * It explains rather than apologises: what this screen is for, and the one
 * action that fills it.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mt-6 rounded-card border border-border-strong bg-surface px-6 py-8 text-center">
      <p className="text-heading-sm text-text-primary">{title}</p>
      <p className="text-body mx-auto mt-2 max-w-[48ch] text-text-secondary">{children}</p>
      {action === undefined ? null : <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
