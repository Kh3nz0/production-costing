/**
 * Give the end-to-end account something to sell.
 *
 * Through the REST API rather than the interface: the specs that follow measure
 * the sale form, and a fixture that has to fill in four other forms first fails
 * for reasons that have nothing to do with what is being tested. Every call
 * goes through the same row level security the app does — this is the account's
 * own data, written as the account.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function api(path: string, token: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${text}`);
  return text === '' ? null : JSON.parse(text);
}

export async function seed(email: string, password: string): Promise<void> {
  const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!auth.ok) throw new Error(`sign in: ${auth.status} ${await auth.text()}`);
  const token = ((await auth.json()) as { access_token: string }).access_token;

  // The user id is in the token's payload; `created_by` is not defaulted,
  // because in the app it is always set explicitly by the code that writes.
  const userId = (
    JSON.parse(Buffer.from(token.split('.')[1]!, 'base64').toString()) as { sub: string }
  ).sub;

  const orgs = (await api('organizations?select=id&limit=1', token)) as { id: string }[];
  const orgId =
    orgs.length > 0
      ? orgs[0]!.id
      : ((await fetch(`${url}/rest/v1/rpc/create_organization`, {
          method: 'POST',
          headers: {
            apikey: anon,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_name: 'End to end' }),
        }).then((r) => r.json())) as string);

  const existing = (await api(`items?select=id&item_type=eq.finished_product&limit=1`, token)) as {
    id: string;
  }[];
  if (existing.length > 0) return;

  const units = (await api('units?select=id,code&code=eq.pc&limit=1', token)) as {
    id: string;
    code: string;
  }[];
  const piece = units[0]!.id;

  const item = (await api('items', token, {
    method: 'POST',
    body: JSON.stringify({
      org_id: orgId,
      name: 'End-to-end widget',
      item_type: 'finished_product',
      base_unit_id: piece,
      purchase_unit_id: piece,
      purchase_to_base_factor: 1,
      created_by: userId,
    }),
  })) as { id: string }[];

  await fetch(`${url}/rest/v1/rpc/record_opening_balance`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_item_id: item[0]!.id, p_qty: 50, p_unit_cost: 80 }),
  });
}
