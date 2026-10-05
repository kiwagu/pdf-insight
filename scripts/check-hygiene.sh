#!/usr/bin/env bash
# Repository hygiene gate: refuses secret-looking tokens, tracked env files and
# machine-specific absolute paths. Findings are reported as file:line only, never the
# matched text, so a real key never reaches terminal or CI logs.
# Exit codes: 0 clean, 1 findings, 2 scan error.
set -uo pipefail
export LC_ALL=C.UTF-8
cd "$(git rev-parse --show-toplevel)"

status=0
keep_worst() { [ "$1" -gt "$status" ] && status=$1; return 0; }

scan() {  # $1 = PCRE pattern, $2 = label
  local out rc
  # Matches stay in $out and only their file:line prefix is printed; git's own error
  # messages go straight to stderr.
  out=$(git grep --untracked --no-color -nIP -e "$1" -- .); rc=$?
  case $rc in
    0) cut -d: -f1,2 <<<"$out" >&2; echo "hygiene: $2 found" >&2; return 1 ;;
    1) return 0 ;;
    *) echo "hygiene: scan error (git grep exit $rc)" >&2; return 2 ;;
  esac
}

# '*/.env' and '*/.env.*' catch env files in subdirectories ('*' also matches '/').
if ! tracked_env=$(git ls-files -- '.env' '.env.*' '*/.env' '*/.env.*' \
  'supabase/functions/.env' 'infra/dev/functions.env' ':!*.example'); then
  echo "hygiene: scan error (git ls-files failed)" >&2
  keep_worst 2
elif [ -n "$tracked_env" ]; then
  echo "hygiene: env file tracked: $tracked_env" >&2
  keep_worst 1
fi
scan '(sk-ant-[A-Za-z0-9_-]{30,}|sb_secret_[A-Za-z0-9_-]{30,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})' 'secret-looking tokens' || keep_worst $?
scan '(/home/[A-Za-z0-9_-]+/|/Users/[A-Za-z0-9_-]+/)' 'absolute home paths' || keep_worst $?

[ "$status" -eq 0 ] && echo "hygiene: OK"
exit "$status"
