import {
  Decimal,
  formatCalculationRate,
  formatExactRate,
  formatPercent,
  roundHalfUp,
  toDecimal,
  type Numeric,
} from '@/lib/decimal';

export type CostInput =
  | {
      kind: 'item';
      id: string;
      name: string;
      quantity: Numeric;
      unit: string;
      unitCost: Numeric | null;
      source: string | null;
      netQuantity?: Numeric;
      inputUnit?: string;
      wasteRate?: Numeric;
    }
  | {
      kind: 'machine';
      id: string;
      name: string;
      hours: Numeric;
      rate: Numeric | null;
      rateDate: string | null;
      watts: Numeric | null;
      utilityRate: Numeric | null;
      utilityDate: string | null;
    }
  | {
      kind: 'labour';
      id: string;
      name: string;
      hours: Numeric;
      attended: boolean;
      rate: Numeric | null;
      rateDate: string | null;
    }
  | { kind: 'other'; id: string; name: string; amountCents: string };

export interface CostRow {
  id: string;
  label: string;
  amount: Decimal | null;
  displayAmount: Decimal | null;
  missing: string | null;
  inputs: { label: string; value: string }[];
}

export interface ProductCost {
  rows: CostRow[];
  missing: string[];
  directExact: Decimal;
  inventoryExact: Decimal;
  overheadExact: Decimal | null;
  fullExact: Decimal;
  displayDirect: Decimal;
  displayFailure: Decimal;
  displayRounding: Decimal;
  displayInventory: Decimal;
  displayOverhead: Decimal | null;
  displayFull: Decimal;
  displayFullRounding: Decimal;
  failureRate: Decimal | null;
  attendedHours: Decimal;
  overheadRule: {
    method: string;
    rate: Numeric | null;
    percent: Numeric | null;
    effectiveFrom: string;
  } | null;
}

const ZERO = new Decimal(0);
const FOUR = 4;

function rateInputs(label: string, rate: Decimal | null): CostRow['inputs'] {
  return [
    { label, value: rate === null ? 'Missing' : formatCalculationRate(rate) },
    ...(rate !== null && !rate.eq(roundHalfUp(rate, 6))
      ? [{ label: `Exact ${label.toLowerCase()} used`, value: formatExactRate(rate) }]
      : []),
  ];
}

/** Utility prices can be entered per Wh or kWh; machine consumption is in kWh. */
export function energyRatePerKwh(ratePerUnit: Numeric, unitFactorWh: Numeric): Decimal {
  const factor = toDecimal(unitFactorWh);
  if (factor.lte(0)) throw new RangeError('Energy unit factor must be above zero.');
  return toDecimal(ratePerUnit).times(1000).div(factor);
}

/** Calculation values stay exact. Four-place values are only for visible rows. */
export function calculateProductCost(
  lines: CostInput[],
  failureRate: Numeric | null,
  overhead: {
    method: string;
    rate: Numeric | null;
    percent: Numeric | null;
    effectiveFrom: string;
  } | null,
): ProductCost {
  const failure = failureRate === null ? ZERO : toDecimal(failureRate);
  if (failure.lt(0) || failure.gte(1)) throw new RangeError('Expected failure must be below 100%.');
  const rows: CostRow[] = [];
  const missing: string[] = [];
  if (failureRate === null) missing.push('Expected failure rate is not set');
  let attendedHours = ZERO;

  function add(
    id: string,
    label: string,
    amount: Decimal | null,
    problem: string | null,
    inputs: CostRow['inputs'],
  ): void {
    if (problem !== null) missing.push(problem);
    rows.push({
      id,
      label,
      amount,
      displayAmount: amount === null ? null : roundHalfUp(amount, FOUR),
      missing: problem,
      inputs,
    });
  }

  for (const line of lines) {
    if (line.kind === 'item') {
      const qty = toDecimal(line.quantity);
      const cost = line.unitCost === null ? null : toDecimal(line.unitCost);
      add(
        line.id,
        line.name,
        cost === null ? null : qty.times(cost),
        cost === null ? `${line.name}: no unit cost recorded` : null,
        [
          {
            label: 'Entered quantity',
            value:
              line.netQuantity === undefined
                ? `${qty.toString()} ${line.unit}`
                : `${toDecimal(line.netQuantity).toString()} ${line.inputUnit ?? line.unit}`,
          },
          {
            label: 'Waste',
            value: line.wasteRate === undefined ? '0%' : formatPercent(line.wasteRate),
          },
          {
            label: 'Quantity including waste, in base unit',
            value: `${qty.toString()} ${line.unit}`,
          },
          ...rateInputs('Unit cost', cost),
          { label: 'Cost source', value: line.source ?? 'Current item average' },
        ],
      );
    } else if (line.kind === 'machine') {
      const hours = toDecimal(line.hours);
      const rate = line.rate === null ? null : toDecimal(line.rate);
      const watts = line.watts === null ? null : toDecimal(line.watts);
      const utility = line.utilityRate === null ? null : toDecimal(line.utilityRate);
      add(
        `${line.id}-machine`,
        `${line.name} · machine time`,
        rate === null ? null : hours.times(rate),
        rate === null ? `${line.name}: no equipment rate in force` : null,
        [
          { label: 'Time', value: `${hours.toString()} h` },
          ...rateInputs('Hourly rate', rate),
          { label: 'Rate effective from', value: line.rateDate ?? 'Missing' },
        ],
      );
      const electricityProblem =
        watts === null
          ? `${line.name}: average power draw missing`
          : utility === null
            ? `${line.name}: no electricity rate in force`
            : null;
      add(
        `${line.id}-electricity`,
        `${line.name} · electricity`,
        electricityProblem === null ? hours.times(watts!).div(1000).times(utility!) : null,
        electricityProblem,
        [
          { label: 'Time', value: `${hours.toString()} h` },
          { label: 'Average power', value: watts === null ? 'Missing' : `${watts.toString()} W` },
          ...rateInputs('Electricity rate per kWh', utility),
          { label: 'Rate effective from', value: line.utilityDate ?? 'Missing' },
        ],
      );
    } else if (line.kind === 'labour') {
      const hours = toDecimal(line.hours);
      const rate = line.rate === null ? null : toDecimal(line.rate);
      if (line.attended) attendedHours = attendedHours.plus(hours);
      add(
        line.id,
        `${line.name} · labour`,
        rate === null ? null : hours.times(rate),
        rate === null ? `${line.name}: no labour rate in force` : null,
        [
          { label: 'Time', value: `${hours.toString()} h` },
          ...rateInputs('Hourly rate', rate),
          { label: 'Attended', value: line.attended ? 'Yes' : 'No' },
          { label: 'Rate effective from', value: line.rateDate ?? 'Missing' },
        ],
      );
    } else {
      const amount = toDecimal(line.amountCents).div(100);
      add(line.id, line.name, amount, null, [
        { label: 'Entered amount', value: amount.toFixed(2) },
      ]);
    }
  }

  const directExact = rows.reduce((sum, row) => sum.plus(row.amount ?? ZERO), ZERO);
  const inventoryExact = directExact.div(new Decimal(1).minus(failure));
  let overheadExact: Decimal | null = null;
  if (overhead === null) missing.push('No overhead rule is in force');
  else if (overhead.method === 'none') overheadExact = ZERO;
  else if (overhead.method === 'per_attended_hour' && overhead.rate !== null)
    overheadExact = attendedHours.times(toDecimal(overhead.rate));
  else if (overhead.method === 'percent_of_direct_cost' && overhead.percent !== null)
    overheadExact = directExact.times(toDecimal(overhead.percent));
  else if (overhead.method === 'flat_per_unit' && overhead.rate !== null)
    overheadExact = toDecimal(overhead.rate);
  else missing.push('Overhead rule is incomplete');

  const displayDirect = rows.reduce((sum, row) => sum.plus(row.displayAmount ?? ZERO), ZERO);
  const displayInventory = roundHalfUp(inventoryExact, FOUR);
  const displayFailure = roundHalfUp(inventoryExact.minus(directExact), FOUR);
  const displayRounding = displayInventory.minus(displayDirect).minus(displayFailure);
  const displayOverhead = overheadExact === null ? null : roundHalfUp(overheadExact, FOUR);
  const fullExact = inventoryExact.plus(overheadExact ?? ZERO);
  const displayFull = roundHalfUp(fullExact, FOUR);
  const displayFullRounding = displayFull.minus(displayInventory).minus(displayOverhead ?? ZERO);
  return {
    rows,
    missing,
    directExact,
    inventoryExact,
    overheadExact,
    fullExact,
    displayDirect,
    displayFailure,
    displayRounding,
    displayInventory,
    displayOverhead,
    displayFull,
    displayFullRounding,
    failureRate: failureRate === null ? null : failure,
    attendedHours,
    overheadRule: overhead,
  };
}
