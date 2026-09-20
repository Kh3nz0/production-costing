'use server';

import { revalidatePath } from 'next/cache';
import { requireOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';
import { applyImport, dryRun, recordBatch } from '@/lib/importer';
import { errorCsv, type RowError } from '@/lib/import-types';

export interface ImportState {
  error?: string;
  orderError?: string;
  templateCode?: string;
  fileName?: string;
  csv?: string;
  totalRows?: number;
  wouldCreate?: number;
  wouldSkip?: number;
  errors?: RowError[];
  errorFile?: string;
  applied?: number;
}

async function userId(): Promise<string> {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  const id = data.user?.id;
  if (id === undefined) throw new Error('Not signed in.');
  return id;
}

/** The first pass. Validates every row, writes nothing but the batch record. */
export async function validateUpload(_previous: ImportState, data: FormData): Promise<ImportState> {
  try {
    const org = await requireOrg();
    const templateCode = String(data.get('template_code') ?? '');
    const file = data.get('file');
    if (!(file instanceof File) || file.size === 0) throw new Error('Choose a CSV file first.');
    const csv = await file.text();

    const result = await dryRun(org.id, templateCode, csv);
    if ('orderError' in result) return { orderError: result.orderError, templateCode };

    await recordBatch(org.id, await userId(), result, {
      dryRun: true,
      fileName: file.name,
      created: 0,
    });
    revalidatePath('/settings/import');
    return {
      templateCode,
      fileName: file.name,
      csv,
      totalRows: result.totalRows,
      wouldCreate: result.wouldCreate,
      wouldSkip: result.wouldSkip,
      errors: result.errors,
      // exactOptionalPropertyTypes: an explicitly undefined property is not the
      // same as an absent one, so the key is spread in or left out entirely.
      ...(result.errors.length === 0
        ? {}
        : { errorFile: errorCsv(result.columns, result.rows, result.errors) }),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not read that file.' };
  }
}

/** The second pass. Validates again, then writes. */
export async function applyUpload(_previous: ImportState, data: FormData): Promise<ImportState> {
  try {
    const org = await requireOrg();
    const templateCode = String(data.get('template_code') ?? '');
    const csv = String(data.get('csv') ?? '');
    const fileName = String(data.get('file_name') ?? '') || null;
    if (csv === '') throw new Error('Run the check again before applying.');

    const outcome = await applyImport(org.id, await userId(), templateCode, csv, fileName);
    if ('orderError' in outcome) return { orderError: outcome.orderError, templateCode };
    if ('errors' in outcome) {
      return {
        templateCode,
        errors: outcome.errors,
        errorFile: errorCsv(outcome.result.columns, outcome.result.rows, outcome.errors),
        error: 'The file changed since the check, and it now has errors.',
      };
    }
    revalidatePath('/settings/import');
    revalidatePath('/items');
    revalidatePath('/inventory');
    return { templateCode, applied: outcome.created };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not apply that import.' };
  }
}
