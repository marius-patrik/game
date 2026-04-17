---
name: Multi-CLI dispatch
description: How + when to dispatch execution work to Claude Code, Codex, and Gemini CLIs
type: project
---

# Multi-CLI dispatch

The overseer can dispatch execution agents to any of three CLIs via `scripts/dispatch-cli.sh`. Each one runs in a detached tmux session so work continues in the background and the user can attach to watch.

## When to use which

- **Claude (via `Agent` tool in Claude Code)** — default. Best role adherence + richest tool surface. Use when available.
- **Claude (via `dispatch-cli.sh claude`)** — when you want a detached session the user can attach to with `tmux attach`. Same capability as the `Agent` tool, different invocation path.
- **Codex (`dispatch-cli.sh codex`)** — fallback when Claude hits rate limit. Non-interactive `codex exec`. Shown in practice to complete multi-commit work reliably (shipped PR #104 + #105 after Claude sub-agent rate-limited mid-run). Rate limits hit at ~evening Bratislava local time.
- **Gemini (`dispatch-cli.sh gemini`)** — second fallback. Headless `gemini -p` + `-y` (auto-approve tool calls, since the agent can't pause for confirmation). Less battle-tested on this repo; prefer Codex first.

## Dispatch pattern

```bash
# From the overseer seat, when rate-limited or for parallel work:
scripts/dispatch-cli.sh <cli> <role> <issue#> <branch>

# Examples:
scripts/dispatch-cli.sh codex execution 96 feat/character-system
scripts/dispatch-cli.sh gemini frontend 93 feat/hud-rebuild
```

The script:
1. `git worktree add` under `.claude/worktrees/agent-<cli>-<issue>/`.
2. Installs deps (`bun install`).
3. Builds a self-contained prompt that references the role file, CLAUDE.md, the plan (if one exists), and the issue body.
4. Spawns the CLI inside a tmux session named `agent-<issue>-<cli>`.
5. Mirrors stdout to `.claude/dispatch-logs/<session>-<timestamp>.log`.

## Monitoring

- **Live**: `tmux attach -t agent-<issue>-<cli>` (detach with `Ctrl-b d`).
- **Tail log**: `tail -f .claude/dispatch-logs/<session>-*.log`.
- **Completion**: poll `gh pr list --search "head:<branch>"` or watch for a commit on the branch. tmux doesn't notify the overseer on completion — the PR itself is the signal.

## Claude Desktop terminal integration

If the user is running Claude Desktop and wants the terminal visible in-app, they can:
1. Open the Claude Desktop app.
2. Use its built-in terminal or an integrated iTerm/Terminal window.
3. `tmux attach -t agent-<issue>-<cli>` — the detached tmux session surfaces in that window.

No special integration needed from this side — tmux sessions are terminal-agnostic.

## Prompt contract (all CLIs)

The dispatch script builds a prompt that:
- Tells the agent which worktree it must operate in (CLI agents don't auto-cd the way Claude Code sub-agents do).
- Points it at the role file + CLAUDE.md + pitfalls.
- Supplies the plan path if one exists, or tells it to `gh issue view <N>` for scope.
- Forbids touching the primary checkout or other worktrees.
- Requires preflight before PR open.
- Explicitly says: "Do NOT merge. Overseer merges."

## Lessons from 2026-04-17 session

- Claude sub-agents dispatched via `Agent` tool have a richer tool surface than `codex exec` or `gemini -p`. Use them first when rate-limit budget allows.
- Codex's `codex exec` handles multi-commit work well and can fix rate-limited Claude work in a single follow-up run.
- Rate limits cross-pollinate: the user's Anthropic account + Codex login + Gemini login can all hit caps in the same session if pushed hard. Budget accordingly.
- When a Claude sub-agent's completion notification shows a truncated result mid-sentence OR says "You've hit your limit", the PR may still be openable by finishing from the overseer seat in that same worktree — see [pitfalls.md](pitfalls.md) "Recovering a rate-limited agent".
- tmux sessions don't produce completion notifications like the Agent tool does. The overseer must poll PR state.

## Evolution plan

Each overseer session should:
- Pick the cheapest CLI that still gives full capability for the task.
- Prefer Codex for long, multi-commit infrastructure work (schema + migration + test suite updates).
- Prefer Gemini for narrowly-scoped client polish where its faster turnaround outweighs capability gaps.
- Reserve Claude Code for orchestration, design, and recovery of half-finished agent work.

If a pattern here stops holding true (e.g. Gemini's tool surface expands, Codex's rate limit tightens), update this file + `scripts/dispatch-cli.sh` in the same PR.
