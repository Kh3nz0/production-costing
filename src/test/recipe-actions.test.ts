import { expect, it, vi } from 'vitest';
import { saveRecipe } from '@/app/(app)/products/actions';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn(async () => ({ data: 'recipe', error: null })) }));
vi.mock('@/lib/org', () => ({ requireOrg: async () => ({ id: 'org' }) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

it('permits F-05 waste above 100% while rejecting a negative waste rate', async () => {
  const form = new FormData();
  form.set('item_id', 'product');
  const line = {
    line_type: 'material',
    ref_id: 'material',
    qty: '18.4',
    unit_id: 'g',
    waste_percent: '125',
    amount: '',
    notes: '',
  };
  form.set('lines', JSON.stringify([line]));
  expect(await saveRecipe({}, form)).toEqual({ saved: true });
  expect(rpc).toHaveBeenCalledWith('save_product_recipe', {
    p_item_id: 'product',
    p_notes: null,
    p_lines: [
      {
        line_type: 'material',
        ref_item_id: 'material',
        qty_per_unit: '18.4',
        unit_id: 'g',
        waste_rate: '1.250000',
        notes: null,
      },
    ],
  });
  rpc.mockClear();
  form.set('lines', JSON.stringify([{ ...line, waste_percent: '-1' }]));
  expect(await saveRecipe({}, form)).toEqual({ error: 'Waste cannot be negative.' });
  expect(rpc).not.toHaveBeenCalled();
});

it('requires an explicit other-cost amount while accepting a recorded zero', async () => {
  rpc.mockClear();
  const form = new FormData();
  form.set('item_id', 'product');
  const line = {
    line_type: 'other_cost',
    ref_id: '',
    qty: '',
    unit_id: '',
    waste_percent: '',
    amount: '',
    notes: '',
  };
  form.set('lines', JSON.stringify([line]));
  expect(await saveRecipe({}, form)).toEqual({
    error: 'Enter the amount for each other-cost line.',
  });
  expect(rpc).not.toHaveBeenCalled();
  form.set('lines', JSON.stringify([{ ...line, amount: '0' }]));
  expect(await saveRecipe({}, form)).toEqual({ saved: true });
});
