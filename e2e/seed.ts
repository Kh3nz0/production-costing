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

export interface SeededRoutes {
  itemId: string;
  productId: string;
  purchaseId: string;
  runId: string;
}

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

export async function seed(email: string, password: string): Promise<SeededRoutes> {
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

  // Match getCurrentOrg(): the browser and the API seed must choose the same
  // organisation when the account belongs to more than one.
  const orgs = (await api(
    'organizations?select=id,name&archived_at=is.null&order=name.asc,id.asc&limit=1',
    token,
  )) as { id: string; name: string }[];
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

  const existing = (await api(
    `items?select=id,name&org_id=eq.${orgId}&item_type=eq.finished_product`,
    token,
  )) as { id: string; name: string }[];

  const units = (await api('units?select=id,code&code=eq.pc&limit=1', token)) as {
    id: string;
    code: string;
  }[];
  const piece = units[0]!.id;

  let widget = existing.find((item) => item.name === 'End-to-end widget')?.id;
  if (widget === undefined) {
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
    widget = item[0]!.id;
    await api('rpc/record_opening_balance', token, {
      method: 'POST',
      body: JSON.stringify({ p_item_id: widget, p_qty: 50, p_unit_cost: 80 }),
    });
  }

  // The keyboard flows need a material to purchase and a product with a recipe
  // to make. Keep these named fixtures in the throwaway end-to-end org only.
  const grams = (await api('units?select=id&code=eq.g&limit=1', token)) as { id: string }[];
  const materials = (await api(
    `items?select=id,name&org_id=eq.${orgId}&item_type=eq.raw_material`,
    token,
  )) as { id: string; name: string }[];
  let material = materials.find((item) => item.name === 'End-to-end filament')?.id;
  if (material === undefined) {
    const created = (await api('items', token, {
      method: 'POST',
      body: JSON.stringify({
        org_id: orgId,
        name: 'End-to-end filament',
        item_type: 'raw_material',
        base_unit_id: grams[0]!.id,
        purchase_unit_id: grams[0]!.id,
        purchase_to_base_factor: 1,
        created_by: userId,
      }),
    })) as { id: string }[];
    material = created[0]!.id;
    await api('rpc/record_opening_balance', token, {
      method: 'POST',
      body: JSON.stringify({ p_item_id: material, p_qty: 100000, p_unit_cost: 1 }),
    });
  }

  const products = (await api(
    `items?select=id,name&org_id=eq.${orgId}&item_type=eq.finished_product`,
    token,
  )) as { id: string; name: string }[];
  let product = products.find((item) => item.name === 'End-to-end keyboard product')?.id;
  if (product === undefined) {
    product = (await api('rpc/create_product', token, {
      method: 'POST',
      body: JSON.stringify({
        p_org_id: orgId,
        p_name: 'End-to-end keyboard product',
        p_sku: 'E2E-KEYBOARD',
        p_base_unit_id: piece,
        p_expected_failure_rate: 0,
      }),
    })) as string;
  }
  await api('rpc/save_product_recipe', token, {
    method: 'POST',
    body: JSON.stringify({
      p_item_id: product,
      p_lines: [
        {
          line_type: 'material',
          ref_item_id: material,
          qty_per_unit: 1,
          unit_id: grams[0]!.id,
          waste_rate: 0,
        },
      ],
      p_notes: 'End-to-end keyboard flow',
    }),
  });

  const routePurchases = (await api(
    `purchases?select=id&org_id=eq.${orgId}&reference_no=eq.E2E-ROUTE&limit=1`,
    token,
  )) as { id: string }[];
  let purchaseId = routePurchases[0]?.id;
  if (purchaseId === undefined) {
    const purchases = (await api('purchases', token, {
      method: 'POST',
      body: JSON.stringify({
        org_id: orgId,
        reference_no: 'E2E-ROUTE',
        purchase_date: new Date().toISOString().slice(0, 10),
        notes: 'Accessibility route fixture',
        created_by: userId,
      }),
    })) as { id: string }[];
    purchaseId = purchases[0]!.id;
  }

  const routeLines = (await api(
    `purchase_lines?select=id&purchase_id=eq.${purchaseId}&limit=1`,
    token,
  )) as { id: string }[];
  if (routeLines.length === 0) {
    await api('purchase_lines', token, {
      method: 'POST',
      body: JSON.stringify({
        org_id: orgId,
        purchase_id: purchaseId,
        item_id: material,
        qty_ordered: 1,
        qty_received: 1,
        purchase_unit_id: grams[0]!.id,
        unit_price_cents: 100,
        created_by: userId,
      }),
    });
  }

  const routeRuns = (await api(
    `production_runs?select=id&org_id=eq.${orgId}&notes=eq.Accessibility%20route%20fixture&limit=1`,
    token,
  )) as { id: string }[];
  const runId =
    routeRuns[0]?.id ??
    ((await api('rpc/start_production_run', token, {
      method: 'POST',
      body: JSON.stringify({
        p_item_id: product,
        p_planned_qty: 1,
        p_notes: 'Accessibility route fixture',
      }),
    })) as string);

  return { itemId: widget, productId: product, purchaseId, runId };
}
