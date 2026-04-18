#!/usr/bin/env bash
# Launch a Claude Code session in a chosen role.
#
# Usage: ./scripts/spawn-agent.sh <role> [extra notes]
#   role: overseer | execution | planning | review
#
# Defaults to overseer if no role given.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

ROLE="${1:-overseer}"
shift || true
EXTRA="${*:-}"

CMD_FILE=".claude/commands/spawn-${ROLE}-agent.md"
if [ ! -f "$CMD_FILE" ]; then
  echo "Unknown role: $ROLE" >&2
  echo "Available:" >&2
  ls .claude/commands/spawn-*-agent.md 2>/dev/null | sed 's|.claude/commands/spawn-||;s|-agent.md||' >&2
  exit 1
fi

# Strip the frontmatter (between the first two '---' lines) from the command
# body to use as the prompt.
PROMPT="$(awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2{print}' "$CMD_FILE")"
if [ -n "$EXTRA" ]; then
  PROMPT="$PROMPT

## Additional notes from user
$EXTRA"
fi

if command -v claude >/dev/null 2>&1; then
  exec claude "$PROMPT"
else
  echo "claude CLI not found on PATH." >&2
  echo "Start your Claude Code session and paste the following prompt:" >&2
  echo "---" >&2
  printf '%s\n' "$PROMPT"
fi
