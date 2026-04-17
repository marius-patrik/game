#!/usr/bin/env bash
# Dispatch a role-based agent to Claude Code, Codex, or Gemini via tmux.
#
# Why tmux: the agent runs detached so the overseer can continue. The user
# can attach at any time with `tmux attach -t <session>` to watch progress.
#
# Usage:
#   scripts/dispatch-cli.sh <cli> <role> <issue#> <branch>
#
# Examples:
#   scripts/dispatch-cli.sh codex execution 96 feat/character-system
#   scripts/dispatch-cli.sh gemini frontend 85 feat/cinematic-portal
#   scripts/dispatch-cli.sh claude backend 97 feat/equipment
#
# Exits non-zero on argument/setup errors. The agent itself runs in tmux and
# its success/failure is observed via git state + PR creation, not this script.

set -euo pipefail

CLI=${1:-}
ROLE=${2:-}
ISSUE=${3:-}
BRANCH=${4:-}

if [[ -z "$CLI" || -z "$ROLE" || -z "$ISSUE" || -z "$BRANCH" ]]; then
  echo "Usage: $0 <cli: claude|codex|gemini> <role: execution|frontend|backend|reviewer|architect> <issue#> <branch>" >&2
  exit 2
fi

case "$CLI" in claude|codex|gemini) ;; *) echo "Unknown CLI: $CLI" >&2; exit 2;; esac
case "$ROLE" in execution|frontend|backend|reviewer|architect|overseer) ;; *) echo "Unknown role: $ROLE" >&2; exit 2;; esac

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

ROLE_FILE=".claude/commands/spawn-${ROLE}-agent.md"
if [[ ! -f "$ROLE_FILE" ]]; then
  echo "Missing role file: $ROLE_FILE" >&2
  exit 3
fi

# Plan file is optional — execution-oriented roles prefer one; architect drafts one.
PLAN_FILE="docs/plans/${ISSUE}-"
PLAN_PATH=$(ls ${PLAN_FILE}*.md 2>/dev/null | head -1 || true)

# Worktree naming: agent-<cli>-<issue> for clarity in `git worktree list`.
WT_NAME="agent-${CLI}-${ISSUE}"
WT_PATH=".claude/worktrees/${WT_NAME}"

if [[ -d "$WT_PATH" ]]; then
  echo "Worktree already exists at $WT_PATH. Aborting so we don't stomp it." >&2
  echo "Remove with: git worktree remove -f $WT_PATH && git branch -D $BRANCH" >&2
  exit 4
fi

git fetch origin main --quiet
git worktree add -b "$BRANCH" "$WT_PATH" origin/main

# Install deps in the new worktree (fresh worktrees skip node_modules).
(cd "$WT_PATH" && bun install --frozen-lockfile >/dev/null 2>&1 || bun install >/dev/null 2>&1)

# Build the prompt. Deliberately self-contained — agents in non-Claude CLIs
# don't have the auto-reminder layer that Claude Code sub-agents get.
PROMPT=$(cat <<EOF
You are a ${ROLE} execution agent for the marius-patrik/game repo at ${REPO_ROOT}.
Your worktree is at ${WT_PATH} (branch ${BRANCH}, based on origin/main).

## Bootstrap
Read ${REPO_ROOT}/.claude/commands/spawn-${ROLE}-agent.md and follow it.
Also read:
- ${REPO_ROOT}/CLAUDE.md
- ${REPO_ROOT}/.claude/memory/project.md
- ${REPO_ROOT}/.claude/memory/pitfalls.md
- ${REPO_ROOT}/.claude/memory/multi-cli.md

## Assignment
- Issue: #${ISSUE}
- Branch: ${BRANCH}
- Plan: ${PLAN_PATH:-"(no plan file — read the GitHub issue body directly via 'gh issue view ${ISSUE}' and execute the plan described there)"}

## Contract
- Work ONLY inside ${WT_PATH}. Do not touch the primary repo checkout or other worktrees.
- No hacky solutions. No stubs. No TODOs that defer the spec.
- Run preflight (bun run check, bun run typecheck, bun test) before opening the PR.
- Open the PR when CI is expected to be green. Do NOT merge — overseer merges.
- Leave a terse final report: PR number + URL, key files touched, anything worth appending to .claude/memory/pitfalls.md.

Start by reading the bootstrap files now.
EOF
)

SESSION="agent-${ISSUE}-${CLI}"
LOG_DIR=".claude/dispatch-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${SESSION}-$(date +%Y%m%d-%H%M%S).log"

# Kill any existing session with this name so re-dispatch is idempotent.
tmux kill-session -t "$SESSION" 2>/dev/null || true

case "$CLI" in
  claude)
    # Claude CLI: interactive with pre-loaded prompt via --print. Use --dangerously-skip-permissions only if the user has opted in.
    tmux new-session -d -s "$SESSION" -c "$WT_PATH" "claude --print $(printf %q "$PROMPT") 2>&1 | tee $(printf %q "$REPO_ROOT/$LOG_FILE")"
    ;;
  codex)
    # Codex: non-interactive via `codex exec`. Let it run to completion.
    tmux new-session -d -s "$SESSION" -c "$WT_PATH" "codex exec $(printf %q "$PROMPT") 2>&1 | tee $(printf %q "$REPO_ROOT/$LOG_FILE")"
    ;;
  gemini)
    # Gemini: -p for headless, -y to auto-accept tool calls (agents can't pause to ask).
    tmux new-session -d -s "$SESSION" -c "$WT_PATH" "gemini -y -p $(printf %q "$PROMPT") 2>&1 | tee $(printf %q "$REPO_ROOT/$LOG_FILE")"
    ;;
esac

echo "Dispatched: $CLI / $ROLE / #$ISSUE → $WT_PATH"
echo "tmux session: $SESSION"
echo "Log tail:     tail -f $LOG_FILE"
echo "Attach:       tmux attach -t $SESSION"
echo "Kill:         tmux kill-session -t $SESSION"
