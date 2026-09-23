import { expect, test } from '@playwright/test';

/**
 * S3's open gap, closed: `receive_purchase` under genuine concurrency.
 *
 * The locking has been written and reasoned about since S3 and never
 * demonstrated, because PGlite is a single connection and cannot issue two
 * simultaneous calls. This does it against the live project over HTTP, which is
 * real Postgres with real connections — a better proof than a local container,
 * because it is the database the app actually uses.
 *
 * What must hold: two simultaneous receipts of one purchase produce **one**
 * receipt. Not two, and not one-and-a-half. `receive_purchase` takes the
 * purchase row `for update` first, so the second call blocks until the first
 * commits and then finds the status already `received` and refuses (D-116).
 *
 * Get this wrong and the same delivery is added to stock twice, at which point
 * the average cost, the stock value and every product costed from it are wrong
 * and nothing on any screen says so.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

interface Session {
  token: string;
  userId: string;
  orgId: string;
}

async function rest(session: Session, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
}

async function json<T>(response: Response, what: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) throw new Error(`${what}: ${response.status} ${text}`);
  return JSON.parse(text) as T;
}

test.describe('receive_purchase under concurrency', () => {
  test.skip(
    email === undefined || password === undefined,
    'Set E2E_EMAIL and E2E_PASSWORD to run the concurrency proof.',
  );

  test('two simultaneous receipts produce exactly one receipt', async () => {
    test.setTimeout(120_000);

    const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { access_token: token } = await json<{ access_token: string }>(auth, 'sign in');
    const userId = (
      JSON.parse(Buffer.from(token.split('.')[1]!, 'base64').toString()) as { sub: string }
    ).sub;
    const session: Session = { token, userId, orgId: '' };
    const orgs = await json<{ id: string }[]>(
      await rest(session, 'organizations?select=id&limit=1'),
      'organizations',
    );
    session.orgId = orgs[0]!.id;

    const units = await json<{ id: string }[]>(
      await rest(session, 'units?select=id&code=eq.g&org_id=is.null&limit=1'),
      'units',
    );
    const gram = units[0]!.id;

    // A fresh item each run, so the assertion is about this delivery alone.
    const stamp = Date.now();
    const item = await json<{ id: string }[]>(
      await rest(session, 'items', {
        method: 'POST',
        body: JSON.stringify({
          org_id: session.orgId,
          name: `Concurrency filament ${stamp}`,
          item_type: 'raw_material',
          base_unit_id: gram,
          purchase_unit_id: gram,
          purchase_to_base_factor: 1,
          created_by: session.userId,
        }),
      }),
      'item',
    );
    const itemId = item[0]!.id;

    const purchase = await json<{ id: string }[]>(
      await rest(session, 'purchases', {
        method: 'POST',
        body: JSON.stringify({
          org_id: session.orgId,
          purchase_date: new Date().toISOString().slice(0, 10),
          reference_no: `CONC-${stamp}`,
          created_by: session.userId,
        }),
      }),
      'purchase',
    );
    const purchaseId = purchase[0]!.id;

    await json<unknown>(
      await rest(session, 'purchase_lines', {
        method: 'POST',
        body: JSON.stringify({
          org_id: session.orgId,
          purchase_id: purchaseId,
          item_id: itemId,
          qty_ordered: 1000,
          qty_received: 1000,
          purchase_unit_id: gram,
          unit_price_cents: 200,
          created_by: session.userId,
        }),
      }),
      'purchase line',
    );

    // Both calls are issued before either is awaited: two connections, one
    // purchase, at the same moment.
    const receive = () =>
      fetch(`${url}/rest/v1/rpc/receive_purchase`, {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_purchase_id: purchaseId }),
      });
    const [first, second] = await Promise.all([receive(), receive()]);
    const bodies = await Promise.all([first.text(), second.text()]);
    const statuses = [first.status, second.status];

    // Exactly one succeeded.
    const succeeded = statuses.filter((status) => status === 200).length;
    expect(
      succeeded,
      `expected one receipt to succeed, got ${succeeded}. Responses: ${bodies.join(' | ')}`,
    ).toBe(1);

    // And the one that lost says why, rather than failing obscurely.
    const refused = bodies.find((body) => body.includes('already been received'));
    expect(
      refused,
      `the losing call should be refused by the status check: ${bodies.join(' | ')}`,
    ).toBeDefined();

    // The delivery landed once. Two receipts would have made this 2000 g.
    const after = await json<{ qty_on_hand: string; avg_unit_cost: string }[]>(
      await rest(session, `items?select=qty_on_hand::text,avg_unit_cost::text&id=eq.${itemId}`),
      'item after',
    );
    expect(Number.parseFloat(after[0]!.qty_on_hand)).toBe(1000);
    expect(Number.parseFloat(after[0]!.avg_unit_cost)).toBeCloseTo(2, 6);

    // And the ledger holds one movement for it, not two.
    const movements = await json<{ id: string }[]>(
      await rest(
        session,
        `inventory_movements?select=id&source_table=eq.purchases&source_id=eq.${purchaseId}`,
      ),
      'movements',
    );
    expect(movements).toHaveLength(1);
  });
});
