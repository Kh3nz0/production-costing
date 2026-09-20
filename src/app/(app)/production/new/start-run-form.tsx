'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { startRun } from '../actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { formatPercent, toDecimal } from '@/lib/decimal';

export function StartRunForm({
  products,
}: {
  products: { id: string; name: string; failure_rate: string | null }[];
}) {
  const [state, action, pending] = useActionState(startRun, {});
  const [itemId, setItemId] = useState(products[0]?.id ?? '');
  const [planned, setPlanned] = useState('');

  const product = products.find((p) => p.id === itemId);

  // "Start 22 to get 20 good units." Planning 20 starts for 20 accepted is how
  // a run quietly comes up short: the failures you expect have to be started
  // too (F-11).
  let readout: string | null = null;
  if (product && planned !== '') {
    try {
      const wanted = toDecimal(planned);
      const rate = product.failure_rate === null ? null : toDecimal(product.failure_rate);
      if (wanted.gt(0) && rate !== null && rate.lt(1)) {
        const start = wanted.dividedBy(toDecimal('1').minus(rate)).ceil();
        readout = `Start ${start.toFixed(0)} to get ${wanted.toFixed(0)} good units. At a ${formatPercent(rate)} expected failure rate, ${start.toFixed(0)} starts should give you ${wanted.toFixed(0)} accepted units.`;
      } else if (rate === null) {
        readout =
          'This product has no expected failure rate, so nobody can say how many to start. Set one on the product before running it.';
      }
    } catch {
      readout = null;
    }
  }

  return (
    <form action={action} className="mt-6 flex max-w-form-lg flex-col gap-4">
      <Select
        label="Product"
        name="item_id"
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}

        required
      >
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </Select>

      <Field
        label="How many good units do you want"
        name="planned_qty"
        type="number"
        step="any"
        min="1"
        value={planned}
        onChange={(e) => setPlanned(e.target.value)}
        helper="The number you want to end up with, not the number to start."
        required
      />

      {readout !== null ? (
        <p className="text-body-sm rounded-control bg-surface-sunken px-4 py-3 text-text-primary">
          {readout}
        </p>
      ) : null}

      <Field label="Run date" name="run_date" type="date" helper="Optional. Defaults to today." />
      <Field label="Notes" name="notes" />

      {state.error !== undefined ? (
        <p role="alert" className="text-body-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Starting…' : 'Start run'}
        </Button>
        <Link href="/production" className="text-body-sm text-text-secondary underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
