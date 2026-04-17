---
name: planning
description: Draft a plan in docs/plans/ before dispatching an execution agent. Forces explicit choices, tradeoffs, and file-impact estimates.
---

# planning

Every non-trivial feature gets a plan written **before** code is touched. Plans live in [docs/plans/](../../../docs/plans/) as `<issue>-<slug>.md`. They persist so future agents (and the user) can see why choices were made.

Small chore PRs (dep bumps, typo fixes) don't need a plan.

## Plan template

```markdown
# Plan: #<issue> — <title>

**Status:** draft | in-progress | shipped | superseded
**Owner agent:** <role> (<agent-id if dispatched>)
**Branch:** feat/<short>

## Context
Why this matters. What triggered it. What upstream work it depends on.

## Options considered
1. **<option A>** — description, pros, cons.
2. **<option B>** — description, pros, cons.
3. (etc.)

## Chosen approach
Which option, and why. Explicit about tradeoffs accepted.

## File impact
- `apps/server/src/logger.ts` — new
- `apps/server/src/index.ts` — migrate pino config
- `apps/server/package.json` — add `pino-roll`
- (etc.)

## Risks / unknowns
- What could go wrong
- What we don't yet know (and what we'll do if it breaks)

## Acceptance mapping
Quote each bullet from the issue's Acceptance and note how this plan satisfies it.

## Out of scope
Things adjacent that a reader might expect but aren't being done here. File as follow-up issues if needed.

## Retro (filled after merge)
- What actually shipped vs planned
- What diverged and why
- Lessons for pitfalls.md or future plans
```

## When to write a plan

Overseer writes the plan before dispatching an execution agent. For complex or architecturally significant work, spawn an **architect agent** to draft it first.

## Plan review

For non-trivial plans, spawn a **reviewer agent** or **architect agent** to critique the draft before dispatching execution. Catching a bad design choice at planning time is 10x cheaper than at review time.

## After shipping

Update the plan's **Status** to `shipped` and fill the **Retro** section. If lessons are non-obvious, also append to [.Codex/memory/pitfalls.md](../../memory/pitfalls.md).
