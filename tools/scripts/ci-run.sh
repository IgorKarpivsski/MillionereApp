#!/usr/bin/env bash
# Runs a command; on failure, surfaces the tail of its output as a GitHub
# annotation (readable from the API / PR checks without downloading raw logs).
#   tools/scripts/ci-run.sh <label> <command...>
set -uo pipefail
label="$1"; shift
out="$(mktemp)"
"$@" 2>&1 | tee "$out"
status=${PIPESTATUS[0]}
if [ "$status" -ne 0 ]; then
  tail -n 60 "$out" | sed -e 's/%/%25/g' -e 's/\r//g' | awk 'BEGIN{ORS="%0A"} {print}' > "$out.enc"
  echo "::error title=${label} failed::$(cat "$out.enc")"
fi
exit "$status"
