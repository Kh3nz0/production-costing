'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveRecipe } from '../../actions';
import { Button } from '@/components/ui/button';
import type { RecipeLine, RecipeOptions } from '@/lib/products';
import { toDecimal } from '@/lib/decimal';

interface DraftLine {
  key: string;
  line_type: RecipeLine['line_type'];
  ref_id: string;
  qty: string;
  unit_id: string;
  waste_percent: string;
  amount: string;
  notes: string;
}

const LABELS: Record<RecipeLine['line_type'], string> = {
  material: 'Material',
  component: 'Component',
  packaging: 'Packaging',
  subassembly: 'Subassembly',
  machine_time: 'Machine time',
  labour: 'Labour',
  other_cost: 'Other cost',
};
const ITEM_TYPES: Record<string, string[]> = {
  material: ['raw_material', 'consumable'],
  component: ['purchased_component'],
  packaging: ['packaging'],
  subassembly: ['subassembly', 'finished_product'],
};
const CONTROL =
  'h-field w-full rounded-control border border-border-strong bg-surface px-3 text-body text-text-primary';

function fromSaved(line: RecipeLine): DraftLine {
  return {
    key: line.id,
    line_type: line.line_type,
    ref_id: line.ref_item_id ?? line.ref_equipment_id ?? line.ref_activity_id ?? '',
    qty: line.qty_per_unit ?? '',
    unit_id: line.unit_id ?? '',
    waste_percent: toDecimal(line.waste_rate).times(100).toString(),
    amount: line.amount_cents === null ? '' : toDecimal(line.amount_cents).div(100).toFixed(2),
    notes: line.notes ?? '',
  };
}
function blank(): DraftLine {
  return {
    key: crypto.randomUUID(),
    line_type: 'material',
    ref_id: '',
    qty: '',
    unit_id: '',
    waste_percent: '0',
    amount: '',
    notes: '',
  };
}

export function RecipeForm({
  productId,
  lines: saved,
  notes,
  options,
}: {
  productId: string;
  lines: RecipeLine[];
  notes: string | null;
  options: RecipeOptions;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<DraftLine[]>(() => saved.map(fromSaved));
  const [state, action, pending] = useActionState(saveRecipe, {});
  useEffect(() => {
    if (state.saved) router.refresh();
  }, [state.saved, router]);
  function change(key: string, values: Partial<DraftLine>): void {
    setLines((all) => all.map((line) => (line.key === key ? { ...line, ...values } : line)));
  }
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="item_id" value={productId} />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(lines.map((line) => ({ ...line, key: undefined })))}
      />
      {lines.length === 0 && (
        <p className="text-body-sm text-text-secondary">
          No recipe yet. Add what goes into one unit and a cost will be worked out from it.
        </p>
      )}
      {lines.map((line, index) => {
        const choices = ITEM_TYPES[line.line_type]
          ? options.items.filter(
              (item) =>
                ITEM_TYPES[line.line_type]?.includes(item.item_type) && item.id !== productId,
            )
          : line.line_type === 'machine_time'
            ? options.equipment
            : line.line_type === 'labour'
              ? options.activities
              : [];
        const isItem = line.line_type in ITEM_TYPES;
        return (
          <section
            key={line.key}
            className="rounded-card border border-border-strong bg-surface p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-heading-sm text-text-primary">Line {index + 1}</h2>
              <button
                type="button"
                onClick={() => setLines((all) => all.filter((x) => x.key !== line.key))}
                className="text-body-sm text-danger underline"
              >
                Remove
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-caption text-text-secondary">
                What kind of line?
                <select
                  className={CONTROL}
                  value={line.line_type}
                  onChange={(e) =>
                    change(line.key, {
                      line_type: e.target.value as DraftLine['line_type'],
                      ref_id: '',
                      unit_id: '',
                      qty: '',
                      amount: '',
                    })
                  }
                >
                  {Object.entries(LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {line.line_type !== 'other_cost' && (
                <label className="text-caption text-text-secondary">
                  {line.line_type === 'machine_time'
                    ? 'Equipment'
                    : line.line_type === 'labour'
                      ? 'Activity'
                      : 'Item'}
                  <select
                    className={CONTROL}
                    value={line.ref_id}
                    required
                    onChange={(e) => {
                      const item = options.items.find((x) => x.id === e.target.value);
                      change(line.key, {
                        ref_id: e.target.value,
                        unit_id: item?.base_unit_id ?? '',
                      });
                    }}
                  >
                    <option value="">Choose</option>
                    {choices.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {line.line_type === 'other_cost' ? (
                <label className="text-caption text-text-secondary">
                  Amount per unit (₱)
                  <input
                    className={CONTROL}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.amount}
                    required
                    onChange={(e) => change(line.key, { amount: e.target.value })}
                  />
                </label>
              ) : (
                <label className="text-caption text-text-secondary">
                  {isItem ? 'Quantity per unit' : 'Hours per unit'}
                  <input
                    className={CONTROL}
                    type="number"
                    min="0"
                    step="any"
                    value={line.qty}
                    required
                    onChange={(e) => change(line.key, { qty: e.target.value })}
                  />
                </label>
              )}
              {isItem && (
                <>
                  <label className="text-caption text-text-secondary">
                    Unit
                    <select
                      className={CONTROL}
                      value={line.unit_id}
                      required
                      onChange={(e) => change(line.key, { unit_id: e.target.value })}
                    >
                      <option value="">Choose</option>
                      {options.units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name} ({unit.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-caption text-text-secondary">
                    Waste (%)
                    <input
                      className={CONTROL}
                      type="number"
                      min="0"
                      step="any"
                      value={line.waste_percent}
                      onChange={(e) => change(line.key, { waste_percent: e.target.value })}
                    />
                    <span className="mt-1 block text-text-tertiary">
                      Added to the quantity above. If it already includes support and purge, leave
                      this at zero.
                    </span>
                    {line.waste_percent !== '' && toDecimal(line.waste_percent).gt(100) && (
                      <span role="status" className="mt-1 block text-warning">
                        More material will be wasted than used. Check that this is intended.
                      </span>
                    )}
                  </label>
                </>
              )}
              <label className="text-caption text-text-secondary">
                {line.line_type === 'other_cost' ? 'Name of cost' : 'Notes'}
                <input
                  className={CONTROL}
                  value={line.notes}
                  onChange={(e) => change(line.key, { notes: e.target.value })}
                />
              </label>
            </div>
          </section>
        );
      })}
      <button
        type="button"
        onClick={() => setLines((all) => [...all, blank()])}
        className="text-body-sm font-medium text-accent-text underline"
      >
        Add a line
      </button>
      <label className="block max-w-[620px] text-caption text-text-secondary">
        Recipe notes
        <input name="notes" defaultValue={notes ?? ''} className={CONTROL} />
      </label>
      {state.error && (
        <p role="alert" className="text-body-sm text-danger">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="text-body-sm text-success">
          Recipe saved.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save recipe'}
      </Button>
    </form>
  );
}
