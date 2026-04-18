---
name: multi-cli-dispatch
description: Dispatch execution work to Claude Code, Codex, or Gemini via scripts/dispatch-cli.sh. Use when rate-limited on Claude, when the user wants to watch progress in a detached tmux session, or for parallel work across CLIs.
---

# multi-cli-dispatch

The overseer can dispatch agents to any of three CLIs via `scripts/dispatch-cli.sh`. Each runs in a detached tmux session so work continues in the background and the user can `tmux attach` to watch.

## When to use which

- **Claude (via `Agent` tool in Claude Code)** — default. Best role adherence + richest tool surface. Use when budget allows.
- **Claude (via `dispatch-cli.sh claude`)** — when you want a detached session the user can attach to with `tmux attach`. Same capability as the `Agent` tool, different invocation path.
- **Codex (`dispatch-cli.sh codex`)** — primary fallback when Claude hits rate limit. Non-interactive `codex exec`. Shown to complete multi-commit work reliably (shipped PR #104 + #105 after Claude sub-agent rate-limited mid-run). Rate limits hit at ~evening Bratislava local time.
- **Gemini (`dispatch-cli.sh gemini`)** — second fallback. Headless `gemini -p` + `-y` (auto-approve tool calls, since the agent can't pause for confirmation). Less battle-tested on this repo; prefer Codex first.

## Dispatch

```bash
# From the overseer seat, when rate-limited or for parallel work:
scripts/dispatch-cli.sh <cli> <role> <issue#> <branch>

# Examples:
scripts/dispatch-cli.sh codex execution 96 feat/character-system
scripts/dispatch-cli.sh gemini execution 93 feat/hud-rebuild
scripts/dispatch-cli.sh claude planning 98 docs/plans/98-skills-allocator.md
```

Valid roles: `overseer | execution | planning | review` (see `.claude/commands/spawn-*-agent.md`).

The script:
1. `git worktree add` under `.claude/worktrees/agent-<cli>-<issue>/`.
2. Installs deps (`bun install`).
3. Builds a self-contained prompt that references the role file, `CLAUDE.md`, the plan (if one exists), and the issue body.
4. Spawns the CLI inside a tmux session named `agent-<issue>-<cli>`.
5. Mirrors stdout to `.claude/dispatch-logs/<session>-<timestamp>.log`.

## Monitoring

- **Live**: `tmux attach -t agent-<issue>-<cli>` (detach with `Ctrl-b d`).
- **Tail log**: `tail -f .claude/dispatch-logs/<session>-*.log`.
- **Completion**: poll `gh pr list --search "head:<branch>"` or watch for a commit. tmux doesn't notify — the PR itself is the signal.

## Claude Desktop terminal integration

If the user is running Claude Desktop with a visible terminal, `tmux attach -t agent-<issue>-<cli>` surfaces the session in that window. No extra integration needed — tmux is terminal-agnostic.

## Prompt contract (all CLIs)

The dispatch script builds a prompt that:
- Tells the agent which worktree it must operate in (CLI agents don't auto-cd the way Claude Code sub-agents do).
- Points it at the role file + `CLAUDE.md` + `.claude/memory/pitfalls.md`.
- Supplies the plan path if one exists, or tells it to `gh issue view <N>` for scope.
- Forbids touching the primary checkout or other worktrees.
- Requires preflight before PR open.
- Explicitly says: "Do NOT merge. Overseer merges."

## Lessons from the 2026-04-17 session

- Claude sub-agents dispatched via the `Agent` tool have a richer tool surface than `codex exec` or `gemini -p`. Use them first when rate-limit budget allows.
- Codex's `codex exec` handles multi-commit work well and can fix rate-limited Claude work in a single follow-up run.
- Rate limits cross-pollinate: the user's Anthropic + Codex + Gemini accounts can all hit caps in the same session if pushed hard. Budget accordingly.
- When a Claude sub-agent's completion notification shows a truncated result mid-sentence OR says "You've hit your limit", the PR may still be openable by finishing from the overseer seat in that same worktree — see `.claude/memory/pitfalls.md` "Recovering a rate-limited agent".
- tmux sessions don't produce completion notifications like the `Agent` tool does. The overseer must poll PR state.

## Evolution

Each overseer session should:
- Pick the cheapest CLI that still gives full capability for the task.
- Prefer Codex for long, multi-commit infrastructure work (schema + migration + test suite updates).
- Prefer Gemini for narrowly-scoped client polish where faster turnaround outweighs capability gaps.
- Reserve Claude Code for orchestration, design, and recovery of half-finished agent work.

If a pattern stops holding (e.g. Gemini's tool surface expands, Codex's rate limit tightens), update this skill + `scripts/dispatch-cli.sh` in the same PR.
