import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';
import { formatPercent, formatQuantity, formatRate, groupDigits, toDecimal } from '@/lib/decimal';
import { Money } from '@/lib/money';
import { SettingForm } from '../setting-form';

// The stored method is an enum; these are the words docs/phase4-content-screens.md
// uses for it. A raw `per_attended_hour` on screen is a leak, not a label.
const OVERHEAD_METHOD: Record<string, string> = {
  per_attended_hour: 'Per working hour',
  percent_of_direct_cost: 'As a percentage of production cost',
  flat_per_unit: 'A flat amount per unit',
  none: 'Not spread',
};

const sections = [
  ['business', 'Business'],
  ['equipment', 'Equipment'],
  ['utilities', 'Utility rates'],
  ['labour', 'Labour'],
  ['overhead', 'Overhead'],
  ['channels', 'Sales channels'],
] as const;

type Row = Record<string, unknown>;
type Section = (typeof sections)[number][0];

// Explicit text projections keep financial values exact before JSON parsing.
const projections = {
  equipment:
    'id,name,category,purchase_price_cents::text,purchase_date,status,rated_power_watts::text,measured_avg_power_watts::text,notes,created_at',
  equipment_rate_versions:
    'id,equipment_id,effective_from,cost_recovery_period_months,expected_productive_hours::text,maintenance_allowance_cents::text,repair_allowance_cents::text,hourly_recovery_rate::text,notes,created_at',
  utility_rates:
    'id,utility_type,rate_per_unit::text,unit_id,effective_from,source_reference,notes,created_at',
  labor_activities:
    'id,name,attended,default_duration::text,duration_unit_id,status,notes,created_at',
  labor_rate_versions: 'id,activity_id,hourly_rate::text,effective_from,notes,created_at',
  overhead_versions:
    'id,effective_from,method,monthly_pool_cents::text,expected_monthly_attended_hours::text,rate::text,percent::text,created_at',
  overhead_categories: 'id,name,notes,created_at',
  sales_channels: 'id,name,status,notes,created_at',
  channel_fee_versions:
    'id,channel_id,effective_from,commission_rate::text,payment_rate::text,fixed_fee_cents::text,notes,created_at',
} as const;

function input(
  name: string,
  label: string,
  options: {
    type?: string;
    required?: boolean;
    defaultValue?: string;
    hint?: string;
    readOnly?: boolean;
  } = {},
) {
  return (
    <label className="text-body-sm flex min-w-0 flex-col gap-1 text-text-primary">
      {label}
      <input
        name={name}
        type={options.type ?? 'text'}
        required={options.required}
        readOnly={options.readOnly}
        defaultValue={options.defaultValue}
        step={options.type === 'number' ? 'any' : undefined}
        className={`h-field rounded-control border border-border-control px-3 ${options.readOnly ? 'bg-surface-sunken text-text-secondary' : 'bg-surface text-text-primary'}`}
      />
      {options.hint && <span className="text-caption text-text-secondary">{options.hint}</span>}
    </label>
  );
}

function form(kind: string, title: string, fields: React.ReactNode) {
  return (
    <SettingForm kind={kind} title={title}>
      {fields}
    </SettingForm>
  );
}

function picker(name: string, label: string, rows: Row[]) {
  return (
    <label className="text-body-sm flex flex-col gap-1 text-text-primary">
      {label}
      <select
        name={name}
        required
        className="h-field rounded-control border border-border-control bg-surface px-3"
      >
        <option value="">Choose</option>
        {rows.map((row) => (
          <option key={String(row.id)} value={String(row.id)}>
            {String(row.name ?? row.code)}
          </option>
        ))}
      </select>
    </label>
  );
}

function history(
  title: string,
  rows: Row[],
  rateField: string,
  parentField?: string,
  parents?: Row[],
  units?: Row[],
) {
  // A utility rate without its unit is not a figure anyone can check: ₱12.50 per
  // kWh and ₱12.50 per Wh look identical here and differ by a thousand in the
  // electricity row of every cost breakdown. Name the unit the row was saved with.
  function unitCode(row: Row): string {
    return String(units?.find((u) => u.id === row.unit_id)?.code ?? 'unit');
  }
  function shownRate(row: Row): string {
    const value = String(row[rateField]);
    if (rateField === 'commission_rate') return formatPercent(value);
    if (
      rateField === 'hourly_recovery_rate' ||
      rateField === 'hourly_rate' ||
      rateField === 'rate'
    ) {
      return `${formatRate(value)} / hour`;
    }
    return `${formatRate(value)} / ${unitCode(row)}`;
  }
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const currentByParent = new Map<string, string>();
  for (const row of rows) {
    const key = parentField ? String(row[parentField]) : title;
    if (String(row.effective_from) <= today && !currentByParent.has(key)) {
      currentByParent.set(key, String(row.id));
    }
  }
  return (
    <section className="rounded-card border border-border-strong bg-surface p-6">
      <h2 className="text-heading-sm mb-2 text-text-primary">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-body-sm text-text-secondary">No rate recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={String(row.id)}
              className="text-body-sm flex flex-wrap justify-between gap-2 border-t border-border-strong py-2 text-text-primary"
            >
              {/* Overhead has one rule per date, so a label here only repeats the
                  section heading word for word. Every other history names the
                  thing the rate belongs to. */}
              {rateField !== 'rate' && (
                <span>
                  {parentField && parents
                    ? String(parents.find((p) => p.id === row[parentField])?.name ?? '')
                    : rateField === 'rate_per_unit'
                      ? String(row.utility_type)
                      : title}
                </span>
              )}
              <span className="tabular-nums">
                {String(row.effective_from)} · {shownRate(row)}
              </span>
              <span className="text-text-secondary">
                {String(row.effective_from) > today
                  ? 'Scheduled'
                  : currentByParent.get(parentField ? String(row[parentField]) : title) ===
                      String(row.id)
                    ? 'In force'
                    : 'Superseded'}
              </span>
              <span className="text-text-secondary">
                Recorded by you on {String(row.created_at).slice(0, 10)}
              </span>
              {rateField === 'commission_rate' && (
                // A channel's cut is commission plus payment fee plus a fixed
                // amount per order, and the pricing back-solve uses all three.
                // Showing only the commission leaves the other two stored and
                // unreadable, which is F-55 and F-56 over again.
                <details className="w-full text-text-secondary">
                  <summary className="cursor-pointer text-accent-text">
                    What this channel takes
                  </summary>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <div>
                      <dt>Commission</dt>
                      <dd className="tabular-nums">{formatPercent(String(row.commission_rate))}</dd>
                    </div>
                    <div>
                      <dt>Payment fee</dt>
                      <dd className="tabular-nums">{formatPercent(String(row.payment_rate))}</dd>
                    </div>
                    <div>
                      <dt>Fixed fee per order</dt>
                      <dd className="tabular-nums">
                        {Money.fromCentavos(BigInt(String(row.fixed_fee_cents))).format()}
                      </dd>
                    </div>
                    <div>
                      <dt>Total percentage taken</dt>
                      <dd className="tabular-nums">
                        {formatPercent(
                          toDecimal(String(row.commission_rate)).plus(
                            toDecimal(String(row.payment_rate)),
                          ),
                        )}
                      </dd>
                    </div>
                  </dl>
                </details>
              )}
              {rateField === 'rate' && (
                // F-48 again, on the other derived rate. ₱95.00 per hour is a
                // quotient, not an entry: without the pool and the hours beside
                // it, nobody can tell a correct rate from a mistyped one.
                <details className="w-full text-text-secondary">
                  <summary className="cursor-pointer text-accent-text">Rate inputs</summary>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <dt>Where the rate came from</dt>
                      <dd className="tabular-nums">
                        {Money.fromCentavos(BigInt(String(row.monthly_pool_cents))).format()}{' '}
                        monthly ÷{' '}
                        {row.expected_monthly_attended_hours === null
                          ? '—'
                          : formatQuantity(String(row.expected_monthly_attended_hours))}{' '}
                        expected hours
                      </dd>
                    </div>
                    <div>
                      <dt>Stored rate</dt>
                      <dd className="tabular-nums">
                        {row.rate === null
                          ? 'Not set'
                          : `₱${groupDigits(toDecimal(String(row.rate)).toFixed(8))} / hour`}
                      </dd>
                    </div>
                    <div>
                      <dt>How overhead is spread</dt>
                      <dd>{OVERHEAD_METHOD[String(row.method)] ?? String(row.method)}</dd>
                    </div>
                  </dl>
                </details>
              )}
              {rateField === 'hourly_recovery_rate' && (
                <details className="w-full text-text-secondary">
                  <summary className="cursor-pointer text-accent-text">Rate inputs</summary>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <div>
                      <dt>Recovery period</dt>
                      <dd>{String(row.cost_recovery_period_months)} months</dd>
                    </div>
                    <div>
                      <dt>Expected productive hours</dt>
                      <dd className="tabular-nums">
                        {formatQuantity(String(row.expected_productive_hours))}
                      </dd>
                    </div>
                    <div>
                      <dt>Annual maintenance allowance</dt>
                      <dd className="tabular-nums">
                        {Money.fromCentavos(
                          BigInt(String(row.maintenance_allowance_cents)),
                        ).format()}
                      </dd>
                    </div>
                    <div>
                      <dt>Annual repair allowance</dt>
                      <dd className="tabular-nums">
                        {Money.fromCentavos(BigInt(String(row.repair_allowance_cents))).format()}
                      </dd>
                    </div>
                    <div>
                      <dt>Stored hourly rate</dt>
                      <dd className="tabular-nums">
                        ₱{groupDigits(toDecimal(String(row.hourly_recovery_rate)).toFixed(8))} /
                        hour
                      </dd>
                    </div>
                    {row.notes !== null && row.notes !== undefined && String(row.notes) !== '' && (
                      <div className="sm:col-span-2">
                        <dt>Note</dt>
                        <dd>{String(row.notes)}</dd>
                      </div>
                    )}
                  </dl>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const title = sections.find(([key]) => key === section)?.[1] ?? 'Settings';
  return { title: `${title} — Production Costing` };
}

export default async function SettingsSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.some(([key]) => key === section)) notFound();
  const current = section as Section;
  const org = await requireOrg();
  const supabase = await createClient();
  async function rows(table: keyof typeof projections, order = 'name'): Promise<Row[]> {
    // The section chooses a projection at runtime; do not ask the SDK's
    // compile-time SELECT parser to combine different tables' column lists.
    const projection: string = projections[table];
    const { data, error } = await supabase
      .from(table)
      .select(projection)
      .eq('org_id', org.id)
      .order(order, { ascending: order !== 'effective_from' })
      .order('id')
      .range(0, 499);
    if (error) throw new Error(error.message);
    // A runtime projection string leaves the SDK unable to infer the row shape,
    // so it types the result as its parse-failure placeholder. The shape is
    // validated by the projections above, which name real columns per table.
    return (data ?? []) as unknown as Row[];
  }
  const [
    equipment,
    equipmentRates,
    utilities,
    activities,
    labourRates,
    overhead,
    overheadCategories,
    channels,
    channelRates,
    units,
  ] = await Promise.all([
    rows('equipment'),
    rows('equipment_rate_versions', 'effective_from'),
    rows('utility_rates', 'effective_from'),
    rows('labor_activities'),
    rows('labor_rate_versions', 'effective_from'),
    rows('overhead_versions', 'effective_from'),
    rows('overhead_categories'),
    rows('sales_channels'),
    rows('channel_fee_versions', 'effective_from'),
    supabase
      .from('units')
      .select('id,code')
      .eq('dimension_code', 'energy')
      .order('code')
      .order('id')
      .range(0, 499)
      .then(({ data }) => (data ?? []) as Row[]),
  ]);
  const business =
    current === 'business'
      ? (
          await supabase
            .from('organizations')
            .select('name,currency_code,locale,timezone,vat_registered')
            .eq('id', org.id)
            .single()
        ).data
      : null;

  return (
    <main className="mx-auto max-w-content-max px-4 py-6 lg:px-6 lg:py-9">
      <h1 className="text-title text-text-primary">Settings</h1>
      <p className="text-body mt-1 text-text-secondary">
        Changing a rate creates a new version from a date you choose. Older records keep the rate
        that applied when they were recorded.
      </p>
      <nav aria-label="Settings sections" className="my-6 flex flex-wrap gap-2">
        {sections.map(([key, label]) => (
          <Link
            key={key}
            href={`/settings/${key}` as '/settings/business'}
            aria-current={key === current ? 'page' : undefined}
            className={`text-body-sm rounded-pill px-3 py-2 ${key === current ? 'bg-surface-accent text-accent-text' : 'bg-surface text-text-secondary'}`}
          >
            {label}
          </Link>
        ))}
        {/* Import is a page of its own rather than a section of this one: it
            uploads a file and shows a dry run, which is not a settings form. */}
        <Link
          href="/settings/import"
          className="text-body-sm rounded-pill bg-surface px-3 py-2 text-text-secondary"
        >
          Import
        </Link>
      </nav>
      <div className="space-y-6">
        {current === 'business' &&
          business &&
          form(
            'business',
            'Business',
            <>
              {input('name', 'Business name', { required: true, defaultValue: business.name })}
              {input('currency_code', 'Currency', {
                defaultValue: business.currency_code,
                readOnly: true,
                hint: 'Existing purchases do not store a separate currency yet, so changing this would relabel their amounts.',
              })}
              {input('locale', 'Locale', { required: true, defaultValue: business.locale })}
              {input('timezone', 'Time zone', { required: true, defaultValue: business.timezone })}
              <label className="text-body-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  name="vat_registered"
                  defaultChecked={business.vat_registered}
                />{' '}
                VAT registered
              </label>
            </>,
          )}
        {current === 'equipment' && (
          <>
            {form(
              'equipment',
              'Add equipment',
              <>
                {input('name', 'Equipment name', { required: true })}
                {input('category', 'Category')}
                {input('purchase_price', 'Purchase price (₱)', { type: 'number', required: true })}
                {input('purchase_date', 'Purchase date', { type: 'date' })}
                {input('measured_avg_power_watts', 'Average power draw (watts)', {
                  type: 'number',
                })}
              </>,
            )}
            {equipment.length > 0 && (
              <section className="rounded-card border border-border-strong bg-surface p-6">
                <h2 className="text-heading-sm mb-3 text-text-primary">Equipment on record</h2>
                <div className="space-y-4">
                  {equipment.map((item) => (
                    <div key={String(item.id)} className="border-t border-border-strong pt-3">
                      <p className="text-body-sm font-medium text-text-primary">
                        {String(item.name)}
                      </p>
                      <p className="text-body-sm tabular-nums text-text-secondary">
                        Purchase price:{' '}
                        {Money.fromCentavos(BigInt(String(item.purchase_price_cents))).format()}
                        {item.measured_avg_power_watts
                          ? ` · Average draw: ${formatQuantity(String(item.measured_avg_power_watts), 'W')}`
                          : ''}
                      </p>
                      <details className="mt-2 text-body-sm">
                        <summary className="cursor-pointer text-accent-text">
                          Edit equipment details
                        </summary>
                        <div className="mt-3">
                          {form(
                            'equipment_details',
                            'Edit equipment details',
                            <>
                              <input type="hidden" name="equipment_id" value={String(item.id)} />
                              {input('name', 'Equipment name', {
                                required: true,
                                defaultValue: String(item.name),
                              })}
                              {input('purchase_price', 'Purchase price (₱)', {
                                type: 'number',
                                required: true,
                                defaultValue: Money.fromCentavos(
                                  BigInt(String(item.purchase_price_cents)),
                                )
                                  .toDecimal()
                                  .toFixed(2),
                              })}
                              {input('measured_avg_power_watts', 'Average power draw (watts)', {
                                type: 'number',
                                defaultValue:
                                  item.measured_avg_power_watts === null
                                    ? ''
                                    : String(item.measured_avg_power_watts),
                              })}
                              <p className="text-caption text-text-secondary sm:col-span-2">
                                Changing the purchase price affects new rates only. Saved rate
                                versions keep their stored value.
                              </p>
                            </>,
                          )}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {equipment.length > 0 &&
              form(
                'equipment_rate',
                'Add a new cost recovery rate',
                <>
                  {picker('equipment_id', 'Equipment', equipment)}
                  {input('effective_from', 'Effective from', {
                    type: 'date',
                    required: true,
                    hint: 'Anything recorded before this date keeps the previous rate.',
                  })}
                  {input('period_months', 'Recover its cost over (months)', {
                    type: 'number',
                    required: true,
                    defaultValue: '36',
                  })}
                  {input('productive_hours', 'Expected productive hours in that period', {
                    type: 'number',
                    required: true,
                  })}
                  {input('maintenance', 'Maintenance allowance per year (₱)', {
                    type: 'number',
                    defaultValue: '0',
                  })}
                  {input('repairs', 'Repair allowance per year (₱)', {
                    type: 'number',
                    defaultValue: '0',
                  })}
                  {input('notes', 'Reason for this rate', {
                    hint: 'Keep the reason with the version, especially when correcting a sample or changing an estimate.',
                  })}
                </>,
              )}
            {history(
              'Cost recovery per hour (₱)',
              equipmentRates,
              'hourly_recovery_rate',
              'equipment_id',
              equipment,
            )}
          </>
        )}
        {current === 'utilities' && (
          <>
            {form(
              'utility_rate',
              'Add a new utility rate',
              <>
                {input('utility_type', 'Utility', { defaultValue: 'electricity', required: true })}
                {picker('unit_id', 'Unit', units)}
                {input('rate_per_unit', 'Rate per unit (₱)', { type: 'number', required: true })}
                {input('effective_from', 'Effective from', { type: 'date', required: true })}
                {input('source_reference', 'Source reference')}
              </>,
            )}
            {history('Utility rate', utilities, 'rate_per_unit', undefined, undefined, units)}
          </>
        )}
        {current === 'labour' && (
          <>
            {form(
              'activity',
              'Add an activity',
              <>
                {input('name', 'Activity name', { required: true })}
                <label className="text-body-sm flex items-center gap-2">
                  <input type="checkbox" name="attended" defaultChecked /> Your hands are occupied
                </label>
              </>,
            )}
            {activities.length > 0 &&
              form(
                'labour_rate',
                'Add a new hourly rate',
                <>
                  {picker('activity_id', 'Activity', activities)}
                  {input('hourly_rate', 'Hourly rate (₱)', { type: 'number', required: true })}
                  {input('effective_from', 'Effective from', { type: 'date', required: true })}
                </>,
              )}
            {history('Hourly rate (₱)', labourRates, 'hourly_rate', 'activity_id', activities)}
          </>
        )}
        {current === 'overhead' && (
          <>
            {form(
              'overhead_category',
              'Add an overhead category',
              input('name', 'Category name', { required: true }),
            )}
            {overheadCategories.length > 0 &&
              form(
                'overhead',
                'Add a new overhead rate',
                <>
                  {overheadCategories.map((category) => (
                    <div key={String(category.id)}>
                      <input type="hidden" name="category_id" value={String(category.id)} />
                      {input('category_amount', `${String(category.name)} per month (₱)`, {
                        type: 'number',
                        defaultValue: '0',
                        required: true,
                      })}
                    </div>
                  ))}
                  {input('expected_hours', 'Expected working hours per month', {
                    type: 'number',
                    required: true,
                    hint: 'Hours where your hands are occupied.',
                  })}
                  {input('effective_from', 'Effective from', { type: 'date', required: true })}
                </>,
              )}
            {history('Overhead per working hour (₱)', overhead, 'rate')}
          </>
        )}
        {current === 'channels' && (
          <>
            {form(
              'channel',
              'Add a sales channel',
              input('name', 'Channel name', { required: true }),
            )}
            {channels.length > 0 &&
              form(
                'channel_rate',
                'Add new channel fees',
                <>
                  {picker('channel_id', 'Channel', channels)}
                  {input('effective_from', 'Effective from', { type: 'date', required: true })}
                  {input('commission_percent', 'Commission (%)', {
                    type: 'number',
                    defaultValue: '0',
                  })}
                  {input('payment_percent', 'Payment fee (%)', {
                    type: 'number',
                    defaultValue: '0',
                  })}
                  {input('fixed_fee', 'Fixed fee per order (₱)', {
                    type: 'number',
                    defaultValue: '0',
                  })}
                </>,
              )}
            {history('Commission rate', channelRates, 'commission_rate', 'channel_id', channels)}
          </>
        )}
      </div>
    </main>
  );
}
