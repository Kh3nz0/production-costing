import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './pg';

let t: TestDb;
let owner: string;
let outsider: string;
let org: string;
let equipment: string;

beforeAll(async () => {
  t = await createTestDb();
  owner = await t.createUser('rates-owner@example.test');
  outsider = await t.createUser('rates-outsider@example.test');
  org = await t.asUser(owner, async () => {
    const r = await t.db.query<{ create_organization: string }>(
      `select public.create_organization('Rate test')`,
    );
    return r.rows[0]!.create_organization;
  });
  equipment = await t.asUser(owner, async () => {
    const r = await t.db.query<{ id: string }>(
      `insert into public.equipment(org_id,name,purchase_price_cents,created_by)
       values ($1,'Machine',1200000,$2) returning id`,
      [org, owner],
    );
    return r.rows[0]!.id;
  });
});
afterAll(async () => t.close());

describe('dated equipment rate history', () => {
  it('stores the recovery calculation with annual allowances spread over the period', async () => {
    await t.asUser(owner, async () => {
      await t.db.query(
        `select public.add_equipment_rate($1,'2026-01-01',36,4380,120000,60000,'Original')`,
        [equipment],
      );
      const r = await t.db.query<{ hourly_recovery_rate: string }>(
        `select hourly_recovery_rate from public.equipment_rate_versions where equipment_id=$1`,
        [equipment],
      );
      // (₱12,000 + (₱1,200 + ₱600) × 3 years) / 4,380 hours.
      expect(r.rows[0]?.hourly_recovery_rate).toBe('3.97260274');
    });
  });

  it('resolves three versions by business date while preserving earlier versions', async () => {
    await t.asUser(owner, async () => {
      await t.db.query(`select public.add_equipment_rate($1,'2026-04-01',36,4000,120000,60000)`, [
        equipment,
      ]);
      await t.db.query(`select public.add_equipment_rate($1,'2026-07-01',36,3600,120000,60000)`, [
        equipment,
      ]);
      const r = await t.db.query<{ on_date: string; rate: string | null }>(
        `select d::text as on_date, (public.equipment_rate_on($1,d)).hourly_recovery_rate::text as rate
         from unnest(array['2025-12-31'::date,'2026-01-01','2026-03-31','2026-04-01','2026-06-30','2026-07-01']) d`,
        [equipment],
      );
      expect(r.rows.map((x) => x.rate)).toEqual([
        null,
        '3.97260274',
        '3.97260274',
        '4.35000000',
        '4.35000000',
        '4.83333333',
      ]);
      await t.db.query(`update public.equipment set purchase_price_cents=2400000 where id=$1`, [
        equipment,
      ]);
      const old = await t.db.query<{ hourly_recovery_rate: string }>(
        `select hourly_recovery_rate from public.equipment_rate_versions where equipment_id=$1 order by effective_from`,
        [equipment],
      );
      expect(old.rows.map((x) => x.hourly_recovery_rate)).toEqual([
        '3.97260274',
        '4.35000000',
        '4.83333333',
      ]);
      await expect(
        t.db.query(
          `update public.equipment_rate_versions set hourly_recovery_rate=0 where equipment_id=$1`,
          [equipment],
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        t.db.query(`delete from public.equipment_rate_versions where equipment_id=$1`, [equipment]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        t.db.query(`select public.add_equipment_rate($1,'2026-07-01',36,3600,0,0)`, [equipment]),
      ).rejects.toThrow();
    });
  });

  it('refuses another org and anonymous access', async () => {
    await t.asUser(outsider, async () => {
      const r = await t.db.query(`select * from public.equipment_rate_versions`);
      expect(r.rows).toHaveLength(0);
      await expect(
        t.db.query(`select public.add_equipment_rate($1,'2027-01-01',36,4000,0,0)`, [equipment]),
      ).rejects.toThrow();
    });
    await t.asAnon(async () => {
      await expect(t.db.query(`select * from public.equipment_rate_versions`)).rejects.toThrow();
    });
  });

  it('refuses forged rate authorship and a non-energy electricity unit', async () => {
    await t.asUser(owner, async () => {
      const gram = await t.db.query<{ id: string }>(
        `select id from public.units where code='g' limit 1`,
      );
      await expect(
        t.db.query(
          `insert into public.utility_rates(org_id,unit_id,rate_per_unit,effective_from,created_by)
         values($1,$2,12,'2028-01-01',$3)`,
          [org, gram.rows[0]!.id, owner],
        ),
      ).rejects.toThrow(/energy unit/);
      const kwh = await t.db.query<{ id: string }>(
        `select id from public.units where code='kWh' limit 1`,
      );
      await expect(
        t.db.query(
          `insert into public.utility_rates(org_id,unit_id,rate_per_unit,effective_from,created_by)
         values($1,$2,12,'2028-01-01',$3)`,
          [org, kwh.rows[0]!.id, outsider],
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });
});

describe('the other dated rate families', () => {
  it('keeps utility, labour, overhead and channel versions and selects the date in force', async () => {
    await t.asUser(owner, async () => {
      const unit = await t.db.query<{ id: string }>(
        `select id from public.units where code='kWh' limit 1`,
      );
      const unitId = unit.rows[0]?.id;
      if (!unitId) throw new Error('kWh unit missing');
      const activity = await t.db.query<{ id: string }>(
        `insert into public.labor_activities(org_id,name,created_by) values($1,'Assembly',$2) returning id`,
        [org, owner],
      );
      const channel = await t.db.query<{ id: string }>(
        `insert into public.sales_channels(org_id,name,created_by) values($1,'Direct',$2) returning id`,
        [org, owner],
      );
      const activityId = activity.rows[0]!.id;
      const channelId = channel.rows[0]!.id;
      const category = await t.db.query<{ id: string }>(
        `insert into public.overhead_categories(org_id,name,created_by) values($1,'Subscriptions',$2) returning id`,
        [org, owner],
      );
      for (const [when, utility, labour, pool, commission] of [
        ['2026-01-01', '11.00000000', '90.00000000', '950000', '0.010000'],
        ['2026-04-01', '12.00000000', '95.00000000', '1000000', '0.020000'],
        ['2026-07-01', '13.00000000', '100.00000000', '1100000', '0.030000'],
      ]) {
        await t.db.query(
          `insert into public.utility_rates(org_id,unit_id,rate_per_unit,effective_from,created_by)
           values($1,$2,$3,$4,$5)`,
          [org, unitId, utility, when, owner],
        );
        await t.db.query(
          `insert into public.labor_rate_versions(org_id,activity_id,hourly_rate,effective_from,created_by)
           values($1,$2,$3,$4,$5)`,
          [org, activityId, labour, when, owner],
        );
        await t.db.query(`select public.add_overhead_version($1,$2,100,$3::jsonb)`, [
          org,
          when,
          JSON.stringify([{ category_id: category.rows[0]!.id, amount_cents: pool }]),
        ]);
        await t.db.query(
          `insert into public.channel_fee_versions(org_id,channel_id,effective_from,commission_rate,created_by)
           values($1,$2,$3,$4,$5)`,
          [org, channelId, when, commission, owner],
        );
      }
      const cases = [
        ['utility_rates', 'rate_per_unit', '12.00000000', 'utility_type', 'electricity'],
        ['labor_rate_versions', 'hourly_rate', '95.00000000', 'activity_id', activityId],
        ['overhead_versions', 'rate', '100.00000000', 'method', 'per_attended_hour'],
        ['channel_fee_versions', 'commission_rate', '0.020000', 'channel_id', channelId],
      ];
      for (const [table, column, expected, key, value] of cases) {
        const r = await t.db.query<{ value: string }>(
          `select ${column}::text as value from public.${table}
           where org_id=$1 and ${key}=$2 and effective_from <= '2026-06-15'
           order by effective_from desc,id desc limit 1`,
          [org, value],
        );
        expect(r.rows[0]?.value).toBe(expected);
        const all = await t.db.query(
          `select id from public.${table} where org_id=$1 order by effective_from,id`,
          [org],
        );
        expect(all.rows).toHaveLength(3);
      }
      await expect(
        t.db.query(`update public.utility_rates set rate_per_unit=0 where org_id=$1`, [org]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it('calculates F-15 overhead from category lines in one saved version', async () => {
    await t.asUser(owner, async () => {
      const category = await t.db.query<{ id: string }>(
        `insert into public.overhead_categories(org_id,name,created_by)
         values($1,'Workspace',$2) returning id`,
        [org, owner],
      );
      const lines = JSON.stringify([{ category_id: category.rows[0]!.id, amount_cents: '950000' }]);
      const saved = await t.db.query<{ add_overhead_version: string }>(
        `select public.add_overhead_version($1,'2027-01-01',100,$2::jsonb)`,
        [org, lines],
      );
      const version = await t.db.query<{ monthly_pool_cents: string; rate: string }>(
        `select monthly_pool_cents::text as monthly_pool_cents,rate from public.overhead_versions where id=$1`,
        [saved.rows[0]!.add_overhead_version],
      );
      expect(version.rows[0]).toMatchObject({ monthly_pool_cents: '950000', rate: '95.00000000' });
      const detail = await t.db.query(
        `select id from public.overhead_version_lines where overhead_version_id=$1`,
        [saved.rows[0]!.add_overhead_version],
      );
      expect(detail.rows).toHaveLength(1);
      await expect(
        t.db.query(`select public.add_overhead_version($1,'2027-02-01',100,$2::jsonb)`, [
          org,
          JSON.stringify([{ category_id: category.rows[0]!.id, amount_cents: '-1' }]),
        ]),
      ).rejects.toThrow();
    });
  });
});
