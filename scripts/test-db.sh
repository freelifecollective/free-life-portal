#!/usr/bin/env bash
# Runs the migrations and RLS tests against a throwaway local Postgres. Needs Postgres 15+ binaries.
# Usage: scripts/test-db.sh
set -euo pipefail
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d /tmp/flc-pg.XXXXXX)"
PORT="${PGPORT_TEST:-54329}"
RUNAS=""
if [ "$(id -u)" = "0" ]; then RUNAS="runuser -u postgres --"; chown postgres "$WORK"; fi
run() { $RUNAS "$@"; }
cleanup() { run "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
run "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
run "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
PSQL=("$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X)
run "${PSQL[@]}" -d postgres -c "create database flc" >/dev/null
run "${PSQL[@]}" -d flc -f "$ROOT/supabase/tests/00_stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do run "${PSQL[@]}" -d flc -f "$f"; done
for f in "$ROOT"/supabase/tests/[1-9]*.sql; do echo "== $(basename "$f")"; run "${PSQL[@]}" -d flc -f "$f"; done
echo "ALL DATABASE TESTS PASSED"
