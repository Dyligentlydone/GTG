#!/usr/bin/env bash
# Spins up a throwaway Postgres, applies migrations + seed, runs supabase/tests/*.sql, tears down.
# Usage: bash scripts/test-db.sh        (override binaries with PG_BIN=/path/to/postgres/bin)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---------- locate Postgres binaries ----------
if [[ -z "${PG_BIN:-}" ]]; then
  if command -v pg_config >/dev/null 2>&1 && [[ -x "$(pg_config --bindir)/initdb" ]]; then
    PG_BIN="$(pg_config --bindir)"
  elif [[ -x /usr/lib/postgresql/16/bin/initdb ]]; then
    PG_BIN=/usr/lib/postgresql/16/bin
  else
    echo "Cannot find Postgres binaries; set PG_BIN" >&2
    exit 1
  fi
fi
PSQL="$PG_BIN/psql"

# ---------- Postgres refuses to run as root: run the server as the 'postgres' user ----------
RUN_AS=()
if [[ "$(id -u)" == "0" ]]; then
  if id postgres >/dev/null 2>&1; then
    if command -v runuser >/dev/null 2>&1; then RUN_AS=(runuser -u postgres --)
    else RUN_AS=(sudo -u postgres); fi
  else
    echo "Running as root and no 'postgres' user exists; run as a normal user instead" >&2
    exit 1
  fi
fi

# Runs a command as the server's OS user (bash 3.2-safe for an empty RUN_AS on macOS).
as_pg() {
  if [[ ${#RUN_AS[@]} -gt 0 ]]; then "${RUN_AS[@]}" "$@"; else "$@"; fi
}

# ---------- temp cluster on a free port ----------
WORK="$(mktemp -d "${TMPDIR:-/tmp}/gtg-db.XXXXXX")"
chmod 755 "$WORK"
DATA="$WORK/data"
SOCK="$WORK/sock"
mkdir -p "$SOCK"
if [[ ${#RUN_AS[@]} -gt 0 ]]; then chown -R postgres "$WORK"; fi

free_port() {
  local p
  for _ in $(seq 1 50); do
    p=$(( 20000 + RANDOM % 30000 ))
    if ! (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then echo "$p"; return; fi
  done
  echo "No free port found" >&2; return 1
}
PORT="$(free_port)"

cleanup() {
  as_pg "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "==> initdb ($PG_BIN) in $WORK, port $PORT"
as_pg "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust --encoding=UTF8 --no-locale >/dev/null
as_pg "$PG_BIN/pg_ctl" -D "$DATA" -l "$WORK/postgres.log" -w \
  -o "-p $PORT -k $SOCK -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off -c full_page_writes=off" \
  start >/dev/null

export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
export PGOPTIONS='--client-min-messages=warning'
run_sql() { "$PSQL" -X -q -v ON_ERROR_STOP=1 "$@"; }

run_sql -c "create database gtg_test" >/dev/null
export PGDATABASE=gtg_test

echo "==> stub Supabase auth schema and roles"
run_sql <<'SQL'
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
SQL

echo "==> migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "    $(basename "$f")"
  run_sql -f "$f"
done

echo "==> seed"
run_sql -f "$ROOT/supabase/seed.sql"

echo "==> tests"
failed=0
for f in "$ROOT"/supabase/tests/*.sql; do
  name="$(basename "$f")"
  if out="$(run_sql -f "$f" 2>&1)"; then
    echo "    PASS $name"
  else
    echo "    FAIL $name"
    echo "$out" | sed 's/^/      /'
    failed=$((failed + 1))
  fi
done

if [[ $failed -gt 0 ]]; then
  echo "==> $failed test file(s) failed"
  exit 1
fi
echo "==> all DB tests passed"
