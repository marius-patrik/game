---
name: dispatch
description: Spawn an execution agent with a minimal self-bootstrapping prompt. Use this any time the overseer hands work off via the Agent tool.
---

# dispatch

Agents spawned via the Agent tool don't see slash commands. They see only the prompt you pass them. The role files in `.Codex/commands/spawn-<role>-agent.md` are the contract — the dispatch prompt should reference them, not duplicate them.

## Minimal dispatch prompt template

```
You are a <role> execution agent for the marius-patrik/game repo at /Users/user/Documents/projects/game.

## Bootstrap
Read /Users/user/Documents/projects/game/.Codex/commands/spawn-<role>-agent.md and follow it. That file has your full role brief, required reading list, and execution flow.

## Assignment
- Issue: #<N>
- Branch: <feat|fix|chore>/<slug>
- Plan: docs/plans/<N>-<slug>.md (read this first — it has the chosen approach, file impact, and acceptance mapping)
- Preconditions: <none | "X already installed", etc.>

## Return
When the PR is open and CI is green:
- PR number + URL
- 2–4 bullets of what landed
- Anything worth adding to .Codex/memory/pitfalls.md
- Whether you updated the plan's Status / Retro

Do NOT merge the PR. The overseer merges.
```

## Agent tool args

- `subagent_type: "general-purpose"`
- `isolation: "worktree"` — gives each agent its own checkout so multiple can run in parallel
- `run_in_background: true` — when you have other work to do (almost always; you'll be notified on completion)

## Choosing a role

- New file is mostly under `apps/client/`? → `frontend`
- New file is mostly under `apps/server/` or `packages/shared/`? → `backend`
- Cuts across both? → `execution` (generalist)
- It's design / planning, not code? → `architect`
- It's review of an existing PR? → `reviewer`

## Convenience script

```bash
./scripts/dispatch.sh <role> <issue#> <branch>
```

Prints a ready-to-paste dispatch prompt for the chosen role/issue/branch (looks up the plan path automatically). The overseer can then copy it into the Agent tool.

## Parallel dispatch

Multiple agents in parallel is safe **only when** they edit non-overlapping files. Common conflict surfaces:
- `apps/server/package.json` + `bun.lock` (any backend dep change)
- `apps/client/package.json` + `bun.lock` (any frontend dep change)
- `packages/shared/src/schema.ts` (any networked-state addition)
- `docs/work.md` and `AGENTS.md` (overseer-only — never touched by execution agents)

If two in-flight features will collide on one of these, dispatch sequentially or split the colliding piece into its own prep PR first.
