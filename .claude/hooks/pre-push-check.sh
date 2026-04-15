#!/usr/bin/env bash
# Claude Code PreToolUse hook — runs preflight checks before `git push` is
# executed via Bash. Install by wiring to PreToolUse with a Bash matcher in
# .claude/settings.json.
set -euo pipefail

INPUT="${1:-}"
case "$INPUT" in
  *"git push"*)
    REPO="$(git rev-parse --show-toplevel)"
    cd "$REPO"
    echo "[hook] running preflight before push..."
    bun run check >/dev/null 2>&1 || { echo "[hook] biome check failed — run 'bun run check:fix'"; exit 1; }
    bun run typecheck >/dev/null 2>&1 || { echo "[hook] typecheck failed"; exit 1; }
    echo "[hook] preflight ok"
    ;;
esac
