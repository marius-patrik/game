#!/usr/bin/env bash
# Launch a fresh Claude Code session wired to pick up autonomous work.
# Usage: ./scripts/spawn-dev-agent.sh [extra notes to pass to the agent]
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

EXTRA="${*:-}"

# Compose the initial prompt. Reads the spawn-dev-agent command body and
# optionally appends the user's extra notes.
PROMPT="$(cat .claude/commands/spawn-dev-agent.md | sed -n '/^---$/,/^---$/!p')"
if [ -n "$EXTRA" ]; then
  PROMPT="$PROMPT

## Additional notes from user
$EXTRA"
fi

# Prefer `claude` CLI if installed; fall back to printing the prompt so the
# user can paste it into whichever client they prefer.
if command -v claude >/dev/null 2>&1; then
  exec claude "$PROMPT"
else
  echo "claude CLI not found on PATH." >&2
  echo "Start your Claude Code session and paste the following prompt:" >&2
  echo "---" >&2
  printf '%s\n' "$PROMPT"
fi
