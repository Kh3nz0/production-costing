import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';
import { toDecimal } from '@/lib/decimal';

/**
 * The restore rehearsal runs in CI, where Postgres and `pg_dump` exist. This
 * machine has neither, so the dump-and-restore round trip cannot be proven
 * here — but the SQL it runs can be, against the same harness the rest of the
 * suite uses.
 *
 * That matters: a CI job that fails on a typo in the seed teaches nothing about
 * backups and costs a push to find out.
 */

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());

const script = (name: string) =>
  readFileSync(join(process.cwd(), 'scripts', name), 'utf8')
    // `set local` needs a transaction; the harness runs statements directly.
    .replaceAll('set local role', 'set role');

it('the seed builds the F-01 stock, and the valuation can be compared on', async () => {
  const owner = await t.createUser('rehearsal@costed.test');
  const clean = (name: string) =>
    script(name)
      .replace(/insert into auth\.users[\s\S]*?on conflict do nothing;/, '')
      .replaceAll('11111111-1111-1111-1111-111111111111', owner)
      .replace(/select set_config\([\s\S]*?false\);/g, '')
      .replace(/set role \w+;/g, '');

  await t.asUser(owner, async () => {
    await t.db.exec(clean('restore-seed.sql'));
  });

  const rows = await t.asUser(owner, async () => {
    const r = await t.db.query<{ name: string; qty_on_hand: string; avg_unit_cost: string }>(
      'select name,qty_on_hand,avg_unit_cost from public.items order by name',
    );
    return r.rows;
  });

  // F-01's worked example, which is why these figures rather than arbitrary
  // ones: if a restore ever loses numeric precision, these are the digits that
  // show it.
  const filament = rows.find((row) => row.name.startsWith('PLA'))!;
  const swtch = rows.find((row) => row.name.startsWith('Mechanical'))!;
  expect(toDecimal(filament.avg_unit_cost).toFixed(6)).toBe('1.218545');
  expect(toDecimal(swtch.avg_unit_cost).toFixed(6)).toBe('8.476778');
  expect(toDecimal(filament.qty_on_hand).toFixed(0)).toBe('1940');

  // And the summary CI compares the two databases on has to say something.
  const summary = await t.asUser(owner, async () => {
    const r = await t.db.query<{ string_agg: string | null }>(clean('restore-valuation.sql'));
    return r.rows[0]!.string_agg;
  });
  expect(summary, 'the valuation summary is empty, so CI would compare nothing').not.toBeNull();
  expect(summary).toContain('PLA Basic Filament');
  expect(summary).toContain('1.218545');
});
