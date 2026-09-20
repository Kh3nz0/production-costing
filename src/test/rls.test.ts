import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, publicTables, type TestDb } from './pg';

/**
 * S1's done-when: "a user in another org receives zero rows from every table,
 * proven by a test authenticated as that user".
 *
 * The sweep below reads the table list out of the database rather than naming
 * tables, so a table added in a later stage is covered the moment it exists. A
 * new table that forgets `enable row level security` fails this file.
 */

let t: TestDb;
let ownerA: string;
let ownerB: string;
let stranger: string;
let orgA: string;
let orgB: string;

async function foundOrg(userId: string, name: string): Promise<string> {
  return t.asUser(userId, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      `select public.create_organization($1)`,
      [name],
    );
    const id = r.rows[0]?.create_organization;
    if (id === undefined) throw new Error(`Could not create org ${name}`);
    return id;
  });
}

beforeAll(async () => {
  t = await createTestDb();
  ownerA = await t.createUser('khenzo@bloop.ph');
  ownerB = await t.createUser('someone@other.example');
  stranger = await t.createUser('nobody@nowhere.example');
  orgA = await foundOrg(ownerA, 'Bloop');
  orgB = await foundOrg(ownerB, 'Other Company');
});

afterAll(async () => {
  await t.close();
});

describe('an owner sees their own org and nothing else', () => {
  it('reads exactly one organization', async () => {
    const rows = await t.asUser(ownerA, async () => {
      const r = await t.db.query<{ id: string; name: string }>(
        `select id, name from public.organizations`,
      );
      return r.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(orgA);
    expect(rows[0]?.name).toBe('Bloop');
  });

  it('reads exactly one membership', async () => {
    const rows = await t.asUser(ownerA, async () => {
      const r = await t.db.query<{ org_id: string }>(`select org_id from public.memberships`);
      return r.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.org_id).toBe(orgA);
  });

  it('resolves my_org_ids to that one org', async () => {
    const rows = await t.asUser(ownerA, async () => {
      const r = await t.db.query<{ my_org_ids: string }>(`select public.my_org_ids()`);
      return r.rows;
    });
    expect(rows.map((r) => r.my_org_ids)).toEqual([orgA]);
  });
});

describe('a user in another org receives zero rows from every table', () => {
  it("sees none of another org's rows, in every table that has an owner", async () => {
    const tables = (await publicTables(t.db)).filter((x) => x.kind !== 'reference');
    expect(tables.length).toBeGreaterThan(0);

    const counts = await t.asUser(ownerB, async () => {
      const out: Record<string, number> = {};
      for (const { table, orgColumn } of tables) {
        const r = await t.db.query<{ n: number }>(
          `select count(*)::int as n from public."${table}" where "${orgColumn}" = $1`,
          [orgA],
        );
        out[table] = r.rows[0]?.n ?? -1;
      }
      return out;
    });

    for (const [table, n] of Object.entries(counts)) {
      expect(n, `${table} leaked org A's rows to org B`).toBe(0);
    }
  });

  it('still sees its own org, so the policy is scoping rather than blocking', async () => {
    const own = await t.asUser(ownerB, async () => {
      const r = await t.db.query<{ id: string; name: string }>(
        `select id, name from public.organizations`,
      );
      return r.rows;
    });
    expect(own).toHaveLength(1);
    expect(own[0]?.id).toBe(orgB);
    expect(own[0]?.name).toBe('Other Company');
  });

  it('cannot read org A by naming its id directly', async () => {
    const rows = await t.asUser(ownerB, async () => {
      const r = await t.db.query(`select id from public.organizations where id = $1`, [orgA]);
      return r.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it('cannot see that org A has any members', async () => {
    const rows = await t.asUser(ownerB, async () => {
      const r = await t.db.query(`select id from public.memberships where org_id = $1`, [orgA]);
      return r.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it('cannot rename another org', async () => {
    await t.asUser(ownerB, async () => {
      const r = await t.db.query(`update public.organizations set name = 'Taken' where id = $1`, [
        orgA,
      ]);
      expect(r.affectedRows ?? 0).toBe(0);
    });
    const name = await t.asUser(ownerA, async () => {
      const r = await t.db.query<{ name: string }>(
        `select name from public.organizations where id = $1`,
        [orgA],
      );
      return r.rows[0]?.name;
    });
    expect(name).toBe('Bloop');
  });

  it('cannot add itself to another org', async () => {
    await t.asUser(ownerB, async () => {
      await expect(
        t.db.query(
          `insert into public.memberships (org_id, user_id, role, accepted_at, created_by)
           values ($1, $2, 'owner', now(), $2)`,
          [orgA, ownerB],
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });
});

describe('a user with no membership at all', () => {
  it('reads no tenant rows at all, and only shared rows that belong to nobody', async () => {
    const tables = await publicTables(t.db);
    const rows = await t.asUser(stranger, async () => {
      const out: Record<string, { total: number; owned: number; kind: string }> = {};
      for (const { table, kind, orgColumn } of tables) {
        const total = await t.db.query<{ n: number }>(
          `select count(*)::int as n from public."${table}"`,
        );
        // For a shared table, rows with a null org_id are seeded reference data
        // that everyone may read. Rows with an org_id belong to someone and
        // must not be visible.
        const owned =
          orgColumn === null
            ? { rows: [{ n: 0 }] }
            : await t.db.query<{ n: number }>(
                `select count(*)::int as n from public."${table}" where "${orgColumn}" is not null`,
              );
        out[table] = {
          total: total.rows[0]?.n ?? -1,
          owned: owned.rows[0]?.n ?? -1,
          kind,
        };
      }
      return out;
    });

    for (const [table, { total, owned, kind }] of Object.entries(rows)) {
      if (kind === 'tenant') {
        expect(total, `${table} leaked rows to a user with no membership`).toBe(0);
      } else {
        // reference and shared: readable, but nothing that belongs to an org.
        expect(owned, `${table} leaked somebody's rows to a user with no membership`).toBe(0);
      }
    }
  });

  it('resolves my_org_ids to nothing', async () => {
    const rows = await t.asUser(stranger, async () => {
      const r = await t.db.query(`select public.my_org_ids()`);
      return r.rows;
    });
    expect(rows).toHaveLength(0);
  });
});

describe('reference data', () => {
  it('is readable by any signed-in user', async () => {
    const dimensions = await t.asUser(stranger, async () => {
      const r = await t.db.query<{ code: string }>(
        `select code from public.unit_dimensions order by code`,
      );
      return r.rows.map((x) => x.code);
    });
    expect(dimensions).toEqual(['count', 'energy', 'length', 'mass', 'time', 'volume']);
  });

  it('cannot be written by a tenant', async () => {
    await t.asUser(ownerA, async () => {
      await expect(
        t.db.query(`insert into public.unit_dimensions (code, name) values ('mass', 'Mine')`),
      ).rejects.toThrow(/permission denied|row-level security|duplicate key/i);
      await expect(
        t.db.query(`update public.unit_dimensions set name = 'Mine' where code = 'mass'`),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });
  });

  it('lets an org see the seeded units without owning them', async () => {
    const seeded = await t.asUser(ownerA, async () => {
      const r = await t.db.query<{ n: number }>(
        `select count(*)::int as n from public.units where org_id is null`,
      );
      return r.rows[0]?.n ?? -1;
    });
    expect(seeded).toBeGreaterThan(0);
  });

  it('refuses an org that tries to edit a seeded unit', async () => {
    await t.asUser(ownerA, async () => {
      const r = await t.db.query(
        `update public.units set name = 'Hijacked' where org_id is null and code = 'g'`,
      );
      expect(r.affectedRows ?? 0).toBe(0);
    });
    const name = await t.db.query<{ name: string }>(
      `select name from public.units where org_id is null and code = 'g'`,
    );
    expect(name.rows[0]?.name).toBe('Gram');
  });

  it('refuses an org that tries to add a global unit', async () => {
    await t.asUser(ownerA, async () => {
      await expect(
        t.db.query(
          `insert into public.units (org_id, code, name, dimension_code, factor_to_dimension_base)
           values (null, 'zz', 'Sneaky', 'mass', 1)`,
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });
});
describe('signed out', () => {
  it('is refused outright rather than shown an empty table', async () => {
    await t.asAnon(async () => {
      await expect(t.db.query(`select id from public.organizations`)).rejects.toThrow(
        /permission denied/i,
      );
    });
  });

  it('can still call my_org_ids, and gets nothing', async () => {
    // Deliberate: revoking anon would turn a clean empty result into an error on
    // every signed-out request, which the client would have to special-case.
    const rows = await t.asAnon(async () => {
      const r = await t.db.query(`select public.my_org_ids()`);
      return r.rows;
    });
    expect(rows).toHaveLength(0);
  });
});

describe('every table is actually protected', () => {
  it('has row level security enabled and forced', async () => {
    const r = await t.db.query<{ tablename: string; rls: boolean; forced: boolean }>(
      `select c.relname as tablename, c.relrowsecurity as rls, c.relforcerowsecurity as forced
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
       order by c.relname`,
    );
    expect(r.rows.length).toBeGreaterThan(0);
    for (const row of r.rows) {
      expect(row.rls, `${row.tablename} has no row level security`).toBe(true);
      expect(row.forced, `${row.tablename} does not force RLS on its owner`).toBe(true);
    }
  });

  it('grants anon nothing', async () => {
    const r = await t.db.query<{ n: number }>(
      `select count(*)::int as n
       from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public'`,
    );
    expect(r.rows[0]?.n).toBe(0);
  });
});

describe('founding an organization', () => {
  it('creates the org and its owner membership together', async () => {
    const carol = await t.createUser('carol@example.test');
    const orgId = await foundOrg(carol, 'Carol Makes Things');

    const seen = await t.asUser(carol, async () => {
      const org = await t.db.query<{ name: string }>(
        `select name from public.organizations where id = $1`,
        [orgId],
      );
      const member = await t.db.query<{ role: string; accepted_at: string | null }>(
        `select role, accepted_at from public.memberships where org_id = $1`,
        [orgId],
      );
      return { org: org.rows, member: member.rows };
    });

    expect(seen.org[0]?.name).toBe('Carol Makes Things');
    expect(seen.member).toHaveLength(1);
    expect(seen.member[0]?.role).toBe('owner');
    expect(seen.member[0]?.accepted_at).not.toBeNull();
  });

  it('is the only way in: a direct insert is refused', async () => {
    await t.asUser(ownerA, async () => {
      await expect(
        t.db.query(`insert into public.organizations (name, created_by) values ('Sneaky', $1)`, [
          ownerA,
        ]),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });
  });

  it('refuses a blank name', async () => {
    await t.asUser(ownerA, async () => {
      await expect(t.db.query(`select public.create_organization('   ')`)).rejects.toThrow(
        /needs a name/i,
      );
    });
  });

  it('cannot be called signed out', async () => {
    await t.asAnon(async () => {
      await expect(t.db.query(`select public.create_organization('Anon Co')`)).rejects.toThrow(
        /permission denied/i,
      );
    });
  });

  it('leaves no organization without a member', async () => {
    const orphans = await t.db.query<{ n: number }>(
      `select count(*)::int as n from public.organizations o
       where not exists (select 1 from public.memberships m where m.org_id = o.id)`,
    );
    expect(orphans.rows[0]?.n).toBe(0);
  });
});

describe('grants are stated, not inherited', () => {
  it('gives anon nothing at all on any table', async () => {
    const r = await t.db.query<{ n: number }>(
      `select count(*)::int as n
       from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public'`,
    );
    expect(r.rows[0]?.n).toBe(0);
  });

  it('lets a tenant delete from memberships and nothing else', async () => {
    // Everything else in this schema is archived rather than deleted. A DELETE
    // grant with no DELETE policy is the dangerous combination: RLS removes no
    // rows and reports success, so the application shows a confirmation for
    // something that did not happen.
    const r = await t.db.query<{ table_name: string }>(
      `select distinct table_name
       from information_schema.role_table_grants
       where grantee = 'authenticated'
         and table_schema = 'public'
         and privilege_type = 'DELETE'
       order by table_name`,
    );
    expect(r.rows.map((x) => x.table_name)).toEqual(['memberships']);
  });

  it('never lets a tenant insert an organization directly', async () => {
    const r = await t.db.query<{ n: number }>(
      `select count(*)::int as n
       from information_schema.role_table_grants
       where grantee = 'authenticated'
         and table_schema = 'public'
         and table_name = 'organizations'
         and privilege_type = 'INSERT'`,
    );
    expect(r.rows[0]?.n).toBe(0);
  });
});
