#!/usr/bin/env bash
# S14: a pg_dump restore into an empty database reproduces valuation to the
# centavo.
#
# A backup nobody has restored is a hope, not a backup. This builds the schema
# from the migration files, puts a known set of stock through it, dumps it,
# restores into an empty database and compares what each one says the stock is
# worth. If a dump ever loses a numeric's precision, a check constraint, or a
# function the valuation depends on, the two totals stop matching here rather
# than on the day you need the backup.
#
# Runs in CI, where Postgres and pg_dump exist. Locally it needs both on PATH.
set -euo pipefail

HOST="${PGHOST:-localhost}"
PORT="${PGPORT:-5432}"
USER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

psql_do() { psql -v ON_ERROR_STOP=1 -h "$HOST" -p "$PORT" -U "$USER" "$@"; }

echo "==> building the source database from the migration files"
psql_do -d postgres -c 'drop database if exists costed_source;' -c 'create database costed_source;'
psql_do -d costed_source -f scripts/supabase-shim.sql >/dev/null
for migration in supabase/migrations/*.sql; do
  echo "    $migration"
  psql_do -d costed_source -f "$migration" >/dev/null
done

echo "==> seeding a known quantity of stock"
psql_do -d costed_source -f scripts/restore-seed.sql >/dev/null

BEFORE=$(psql_do -d costed_source -At -f scripts/restore-valuation.sql)
echo "    valuation before the dump: $BEFORE"

echo "==> dumping and restoring into an empty database"
pg_dump -h "$HOST" -p "$PORT" -U "$USER" -d costed_source --no-owner --clean --if-exists --inserts > /tmp/costed.sql
psql_do -d postgres -c 'drop database if exists costed_restored;' -c 'create database costed_restored;'
# The dump includes the auth shim and public schema. Running the shim here
# would make the restore fail when it tries to create those objects again.
# --clean removes the destination's default public schema before recreating it.
psql_do -d costed_restored -f /tmp/costed.sql >/dev/null

AFTER=$(psql_do -d costed_restored -At -f scripts/restore-valuation.sql)
echo "    valuation after the restore: $AFTER"

if [ "$BEFORE" != "$AFTER" ]; then
  echo "FAIL: the restored database values the stock differently."
  echo "  before: $BEFORE"
  echo "  after:  $AFTER"
  exit 1
fi

if [ -z "$BEFORE" ]; then
  echo "FAIL: the valuation is empty, so this compared nothing."
  exit 1
fi

echo "PASS: the restore reproduces the valuation to the centavo."
