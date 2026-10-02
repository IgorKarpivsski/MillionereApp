#!/usr/bin/env bash
# Runs all migrations + SQL tests against a throwaway database.
#
#   DATABASE_URL  Postgres URL of a server you can create databases on.
#                 Default: local socket as the current user.
#   SHIM=1        Apply supabase/local/supabase_shim.sql first (plain Postgres).
#                 Leave unset when running against `supabase start`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BASE_URL="${DATABASE_URL:-postgresql:///postgres}"
DB="fm_test_$(date +%s)_$$"
PSQL=(psql -v ON_ERROR_STOP=1 -X -q)

"${PSQL[@]}" "$BASE_URL" -c "create database $DB"
cleanup() { "${PSQL[@]}" "$BASE_URL" -c "drop database if exists $DB with (force)" >/dev/null 2>&1 || true; }
trap cleanup EXIT

TEST_URL="${BASE_URL%/*}/$DB"
[[ "$BASE_URL" == postgresql:///* ]] && TEST_URL="postgresql:///$DB"

if [[ "${SHIM:-1}" == "1" ]]; then
  "${PSQL[@]}" "$TEST_URL" -f "$ROOT/supabase/local/supabase_shim.sql"
fi

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  "${PSQL[@]}" "$TEST_URL" -f "$f"
done

fail=0
for t in "$ROOT"/supabase/tests/*.sql; do
  if "${PSQL[@]}" "$TEST_URL" -f "$ROOT/supabase/tests/_helpers.psql" -f "$t" >/tmp/fm_test_out 2>&1; then
    echo "PASS     $(basename "$t")"
  else
    echo "FAIL     $(basename "$t")"; sed 's/^/         /' /tmp/fm_test_out; fail=1
  fi
done

# Concurrency: 20 parallel claims of the same bonus must pay exactly once.
uid=$("${PSQL[@]}" "$TEST_URL" -At -c \
  "insert into auth.users (is_anonymous) values (true) returning id")
for i in $(seq 1 20); do
  "${PSQL[@]}" "$TEST_URL" -At -c "
    set role authenticated;
    select set_config('request.jwt.claims', '{\"sub\":\"$uid\",\"role\":\"authenticated\"}', false);
    select public.claim_welcome_bonus();" >/dev/null 2>&1 &
done
wait
paid=$("${PSQL[@]}" "$TEST_URL" -At -c \
  "select coins || '/' || (select count(*) from wallet_transactions where user_id = '$uid') from wallets where user_id = '$uid'")
if [[ "$paid" == "500/1" ]]; then
  echo "PASS     concurrency: 20 parallel welcome-bonus claims paid once ($paid)"
else
  echo "FAIL     concurrency: expected 500/1, got $paid"; fail=1
fi

exit $fail
