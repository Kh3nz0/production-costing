import { Money } from '@/lib/money';
import { toDecimal, type Numeric } from '@/lib/decimal';

/** Client-safe purchase vocabulary and the allocation preview. */

export const LANDED_COST_BASES = [
  {
    value: 'value',
    label: 'By value (recommended)',
    help: 'Spread in proportion to what each line cost. Always valid.',
  },
  {
    value: 'quantity',
    label: 'By quantity',
    help: 'Only available when every line is measured in the same kind of unit.',
  },
  {
    value: 'weight',
    label: 'By weight',
    help: 'Only available when every line carries a weight.',
  },
] as const;

export type LandedCostBase = (typeof LANDED_COST_BASES)[number]['value'];

export const PURCHASE_STATUS_LABEL = {
  draft: 'Draft',
  received: 'Received',
  partially_received: 'Partially received',
  cancelled: 'Cancelled',
} as const;

export type PurchaseStatus = keyof typeof PURCHASE_STATUS_LABEL;

export interface PreviewLine {
  /** Anything that identifies the row to the caller. */
  key: string;
  label: string;
  qty: string;
  unitPrice: string;
  lineDiscount?: string;
  weight?: string | null;
  /** Dimension of the unit the quantity is expressed in, for the base check. */
  dimension?: string | null;
  dimensionLabel?: string | null;
  /** Base units per purchase unit, for the per-unit figure. */
  factorToBase?: string | null;
  baseUnitCode?: string | null;
}

export interface PreviewRow {
  key: string;
  label: string;
  lineNet: Money;
  allocated: Money;
  landedTotal: Money;
  /** Null when the quantity in base units cannot be worked out. */
  unitCost: string | null;
  baseUnitCode: string | null;
}

export interface Preview {
  rows: PreviewRow[];
  extras: Money;
  linesSubtotal: Money;
  allocatedTotal: Money;
  /** True when every allocated share sums exactly to the extras. */
  reconciles: boolean;
  /** Set when the chosen base cannot be used, in the spec's words. */
  baseError: string | null;
}

/**
 * A form field's value as an amount.
 *
 * An empty input is zero, not an error. `?? '0'` does not cover this: an
 * untouched text input is `''`, which is neither null nor undefined, so it
 * reached Money.parse and threw on the preview's very first render.
 */
function amount(value: Numeric | null | undefined): Money {
  if (value === null || value === undefined || value === '') return Money.ZERO;
  return Money.parse(value);
}

function quantity(value: string | null | undefined): string {
  return value === null || value === undefined || value === '' ? '0' : value;
}

function lineNetOf(line: PreviewLine): Money {
  const gross = Money.fromDecimal(toDecimal(quantity(line.unitPrice)).times(quantity(line.qty)));
  return gross.minus(amount(line.lineDiscount));
}

/**
 * Why a base cannot be used, in the words the spec fixes.
 *
 * Quantity needs one unit dimension across every line: adding 800 g of filament
 * to 90 pieces of switches produces a meaningless divisor.
 */
export function baseUnavailableReason(base: LandedCostBase, lines: PreviewLine[]): string | null {
  if (lines.length === 0) return null;

  if (base === 'quantity') {
    const seen = new Map<string, string>();
    for (const line of lines) {
      if (line.dimension === null || line.dimension === undefined) continue;
      seen.set(line.dimension, line.dimensionLabel ?? line.dimension);
    }
    if (seen.size > 1) {
      const [a, b] = [...seen.values()];
      return `Allocate by quantity is unavailable because this purchase mixes ${a} and ${b}.`;
    }
  }

  if (base === 'weight') {
    const missing = lines.filter(
      (l) => l.weight === null || l.weight === undefined || l.weight === '',
    );
    if (missing.length > 0) {
      return 'Allocate by weight is unavailable because at least one line has no weight.';
    }
  }

  return null;
}

/**
 * The allocation preview shown on the New purchase screen before anything is
 * saved.
 *
 * It uses the same Money.allocate the receive path uses, and the database has a
 * second implementation of the identical rule in allocate_cents. A test pins
 * the two together, because a preview that disagrees with what gets saved is
 * worse than no preview.
 */
export function previewAllocation(
  base: LandedCostBase,
  extrasParts: { shipping?: Numeric; duties?: Numeric; other?: Numeric; discount?: Numeric },
  lines: PreviewLine[],
): Preview {
  const extras = amount(extrasParts.shipping)
    .plus(amount(extrasParts.duties))
    .plus(amount(extrasParts.other))
    .minus(amount(extrasParts.discount));

  const nets = lines.map(lineNetOf);
  const linesSubtotal = Money.sum(nets);
  const baseError = baseUnavailableReason(base, lines);

  const weights = lines.map((line, i) => {
    if (base === 'quantity') return quantity(line.qty);
    if (base === 'weight') return quantity(line.weight);
    return nets[i]!.toJSON();
  });

  let allocated: Money[];
  try {
    allocated = baseError === null ? extras.allocate(weights) : lines.map(() => Money.ZERO);
  } catch {
    // Weights that sum to zero, or a negative weight. The figures are simply
    // not shown rather than guessed at.
    allocated = lines.map(() => Money.ZERO);
  }

  const rows: PreviewRow[] = lines.map((line, i) => {
    const net = nets[i]!;
    const share = allocated[i]!;
    const landedTotal = net.plus(share);

    let unitCost: string | null = null;
    const factor = line.factorToBase;
    if (factor !== null && factor !== undefined && factor !== '' && quantity(line.qty) !== '0') {
      const qtyBase = toDecimal(line.qty).times(factor);
      if (qtyBase.gt(0)) {
        unitCost = landedTotal.dividedByExact(qtyBase).toFixed(6);
      }
    }

    return {
      key: line.key,
      label: line.label,
      lineNet: net,
      allocated: share,
      landedTotal,
      unitCost,
      baseUnitCode: line.baseUnitCode ?? null,
    };
  });

  const allocatedTotal = Money.sum(allocated);

  return {
    rows,
    extras,
    linesSubtotal,
    allocatedTotal,
    reconciles: baseError === null && allocatedTotal.equals(extras),
    baseError,
  };
}
