#!/usr/bin/env bash
# Local Supabase stack for pdf-insight on the 5535x ports: up | down | status | reset
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
command -v docker >/dev/null || { echo "docker is required" >&2; exit 2; }
case "${1:-status}" in
  up)     bunx supabase start && bunx supabase status ;;
  down)   bunx supabase stop ;;
  reset)  bunx supabase db reset ;;
  status) bunx supabase status ;;
  *) echo "usage: $0 up|down|status|reset" >&2; exit 2 ;;
esac
