#!/usr/bin/env bash
# Claude Code SessionStart hook — prints current focus from work.md so the
# session starts grounded in what's actually in flight.
set -euo pipefail

REPO="$(git -C "$(dirname "$0")/../.." rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "${REPO:-}" ] && exit 0
WORK="$REPO/docs/work.md"
[ ! -f "$WORK" ] && exit 0

echo "=== current focus (docs/work.md) ==="
awk '/^## Now/{flag=1; next} /^## /{flag=0} flag' "$WORK" | sed '/^$/d' | head -20
echo ""
echo "=== next up ==="
awk '/^## Next/{flag=1; next} /^## /{flag=0} flag' "$WORK" | sed '/^$/d' | head -10
