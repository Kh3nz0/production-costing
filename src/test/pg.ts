import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

/**
 * A real Postgres for the RLS tests.
 *
 * PGlite is PostgreSQL compiled to WebAssembly, so the policies under test are
 * executed by the same engine that will run them in Supabase, and the migration
 * files are applied verbatim rather than paraphrased. No Docker, so this runs in
 * CI and on a laptop unchanged.
 *
 * What it does not cover, stated rather than implied: Supabase's Auth service
 * and PostgREST are not here. This harness proves the database refuses the rows,
 * which is the security boundary. It does not prove the HTTP layer in front of
 * it. Session handling and the redirect rules are covered separately by the
 * route tests.
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

/**
 * The parts of Supabase a migration leans on. `auth.uid()` is reproduced from
 * Supabase's own definition so that the policy SQL in the migration is byte for
 * byte what ships — if this shim and the real thing ever diverge, the test is
 * worth less, so it is kept deliberately literal.
 */
const SUPABASE_SHIM = `
  create schema if not exists auth;

  create table if not exists auth.users (
    id    uuid primary key default gen_random_uuid(),
    email text unique
  );

  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;

  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
  end
  $$;

  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant select on auth.users to authenticated;

  -- Supabase grants anon and authenticated everything on every table created in
  -- the public schema, through ALTER DEFAULT PRIVILEGES. Reproducing that here is the
  -- difference between a test that flatters the migration and one that checks
  -- it: without this line a migration that forgets to revoke anon still passes,
  -- and the live project answers an anonymous reader with 200 and an empty body
  -- where the test expected 401. That gap was found on the live database, not
  -- here, which is exactly once too often.
  alter default privileges in schema public
    grant all on tables to anon, authenticated;
  alter default privileges in schema public
    grant all on functions to anon, authenticated;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated;
`;

export interface TestDb {
  readonly db: PGlite;
  /** Run the rest of the callback as this user id, as PostgREST would. */
  asUser<T>(userId: string, fn: () => Promise<T>): Promise<T>;
  /** Run the rest of the callback signed out. */
  asAnon<T>(fn: () => Promise<T>): Promise<T>;
  /** Insert into the stubbed auth.users and return the id. */
  createUser(email: string): Promise<string>;
  close(): Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const db = await PGlite.create();
  await db.exec(SUPABASE_SHIM);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);
  }
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (cause) {
      throw new Error(`Migration ${file} failed: ${(cause as Error).message}`, { cause });
    }
  }

  async function reset(): Promise<void> {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }

  return {
    db,
    async asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
      await db.exec(`
        select set_config('request.jwt.claims', '${JSON.stringify({ sub: userId })}', false);
        set role authenticated;
      `);
      try {
        return await fn();
      } finally {
        await reset();
      }
    },
    async asAnon<T>(fn: () => Promise<T>): Promise<T> {
      await db.exec(`
        select set_config('request.jwt.claims', '', false);
        set role anon;
      `);
      try {
        return await fn();
      } finally {
        await reset();
      }
    },
    async createUser(email: string): Promise<string> {
      const result = await db.query<{ id: string }>(
        `insert into auth.users (email) values ($1) returning id`,
        [email],
      );
      const row = result.rows[0];
      if (row === undefined) {
        throw new Error(`Could not create user ${email}`);
      }
      return row.id;
    },
    async close(): Promise<void> {
      await db.close();
    },
  };
}

/**
 * How a table relates to a tenant, which decides what "correct" means when the
 * sweep reads it as somebody else.
 *
 * - `tenant`: every row belongs to exactly one org. Another org must see none.
 * - `shared`: a null org_id is seeded reference data everyone may read; a
 *   non-null org_id is one org's own addition and must be scoped like a tenant
 *   row. `units` is the only one of these.
 * - `reference`: no org_id at all, the same for everyone, readable by all and
 *   writable by none. `unit_dimensions` is the only one of these.
 */
export type TableKind = 'tenant' | 'shared' | 'reference';

export interface ClassifiedTable {
  readonly table: string;
  readonly kind: TableKind;
  /** The column that says which org a row belongs to, where there is one. */
  readonly orgColumn: string | null;
}

/**
 * Every table in `public`, classified. Read out of the catalogue rather than
 * listed by hand, so a table added in a later stage is swept the moment it
 * exists.
 *
 * A table is only allowed to be `reference` if it is on the explicit list below.
 * Anything else without an `org_id` fails loudly here, because an unscoped
 * business table is the one mistake this sweep exists to catch and it must never
 * be possible to make it quietly.
 */
const REFERENCE_TABLES = new Set(['unit_dimensions']);

export async function publicTables(db: PGlite): Promise<ClassifiedTable[]> {
  const result = await db.query<{
    table_name: string;
    columns: string[];
    org_id_nullable: boolean | null;
  }>(
    `select c.table_name,
            array_agg(c.column_name::text) as columns,
            bool_or(c.column_name = 'org_id' and c.is_nullable = 'YES') as org_id_nullable
     from information_schema.columns c
     join pg_tables t on t.tablename = c.table_name and t.schemaname = c.table_schema
     where c.table_schema = 'public'
     group by c.table_name
     order by c.table_name`,
  );

  return result.rows.map((row) => {
    if (row.columns.includes('org_id')) {
      return {
        table: row.table_name,
        kind: row.org_id_nullable === true ? ('shared' as const) : ('tenant' as const),
        orgColumn: 'org_id',
      };
    }
    if (row.table_name === 'organizations') {
      return { table: row.table_name, kind: 'tenant' as const, orgColumn: 'id' };
    }
    if (REFERENCE_TABLES.has(row.table_name)) {
      return { table: row.table_name, kind: 'reference' as const, orgColumn: null };
    }
    throw new Error(
      `Table public.${row.table_name} has no org_id and is not declared reference data. ` +
        `Every business table must carry org_id (docs/phase3-data-model.md section 0). ` +
        `If this really is reference data, add it to REFERENCE_TABLES in src/test/pg.ts ` +
        `and say why in the migration.`,
    );
  });
}
