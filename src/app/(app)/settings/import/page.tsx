import Link from 'next/link';
import { requireOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';
import { TEMPLATES } from '@/lib/import-types';
import { ImportForm } from './import-form';

export const metadata = { title: 'Import — Production Costing' };

export default async function ImportPage() {
  const org = await requireOrg();
  const db = await createClient();
  const { data } = await db
    .from('import_batches')
    .select(
      'id,template_code,file_name,status,dry_run,row_count,error_count,created_count,created_at',
    )
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(0, 49);
  const batches = (data ?? []) as {
    id: string;
    template_code: string;
    file_name: string | null;
    status: string;
    dry_run: boolean;
    row_count: number;
    error_count: number;
    created_count: number;
    created_at: string;
  }[];

  return (
    <main className="mx-auto max-w-content-max px-6 py-9">
      <Link href="/settings" className="text-caption text-accent-text underline">
        Settings
      </Link>
      <h1 className="text-title mt-1 text-text-primary">Import</h1>
      <p className="text-body mt-1 text-text-secondary">
        Thirteen templates, imported in order. An upload never writes on the first pass: it checks
        every row and tells you what would happen.
      </p>

      <ImportForm templates={TEMPLATES} />

      <section className="mt-8 rounded-card border border-border-strong bg-surface p-6">
        <h2 className="text-heading-sm text-text-primary">Past uploads</h2>
        {batches.length === 0 ? (
          <p className="text-body-sm mt-2 text-text-secondary">Nothing uploaded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border-subtle">
            {batches.map((batch) => (
              <li key={batch.id} className="flex flex-wrap justify-between gap-3 py-3">
                <span className="text-body-sm text-text-primary">
                  {batch.template_code}
                  {batch.file_name === null ? '' : ` · ${batch.file_name}`}
                </span>
                <span className="text-body-sm text-text-secondary">
                  {batch.created_at.slice(0, 10)} · {batch.dry_run ? 'Checked' : 'Applied'} ·{' '}
                  {batch.row_count} rows
                  {batch.error_count > 0 ? `, ${batch.error_count} errors` : ''}
                  {batch.dry_run ? '' : `, ${batch.created_count} created`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
