#!/usr/bin/env bash
# Print a self-contained dispatch prompt for an execution agent.
#
# Usage: ./scripts/dispatch.sh <role> <issue#> <branch> [preconditions]
#   role:   overseer | execution | planning | review
#   issue:  numeric (e.g. 16)
#   branch: e.g. feat/log-rotation
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

ROLE="${1:?role required}"
ISSUE="${2:?issue number required}"
BRANCH="${3:?branch name required}"
PRECONDS="${4:-none}"

ROLE_FILE=".claude/commands/spawn-${ROLE}-agent.md"
[ -f "$ROLE_FILE" ] || { echo "no role file: $ROLE_FILE" >&2; exit 1; }

# Find a matching plan file (docs/plans/<N>-*.md). Warn if missing.
PLAN="$(ls docs/plans/${ISSUE}-*.md 2>/dev/null | head -1)"
if [ -z "$PLAN" ]; then
  echo "WARN: no plan found at docs/plans/${ISSUE}-*.md — draft one before dispatching." >&2
  PLAN="docs/plans/${ISSUE}-<slug>.md (MISSING — overseer must draft)"
fi

cat <<EOF
You are a ${ROLE} agent for the marius-patrik/game repo.
Your assigned checkout is ${REPO}.

## Bootstrap
Read ${REPO}/${ROLE_FILE} and follow it. That file has your full role brief, required reading, and execution flow.

## Assignment
- Issue: #${ISSUE}
- Branch: ${BRANCH}
- Plan: ${PLAN}
- Preconditions: ${PRECONDS}

## Return
When the PR is open and CI is green:
- PR number + URL
- 2-4 bullets of what landed
- Anything worth adding to .claude/memory/pitfalls.md
- Whether you updated the plan's Status / Retro

Do NOT merge the PR. The overseer merges.
EOF
