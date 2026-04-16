---
description: Audit volatile state, persist anything load-bearing, then emit a minimal handoff so the session can be /cleared without losing context.
---

You are about to hand off to a fresh session. The new session will read **[CLAUDE.md](../../CLAUDE.md) + [.claude/memory/](../memory/) + [docs/work.md](../../docs/work.md) + GitHub** and nothing else. Anything that exists only in this conversation will be lost.

Your job in `/flush` is to **make sure nothing important lives only in conversation**. Do the audit. Fix gaps. Emit a short handoff. Then the user runs `/clear` and `/spawn-overseer-agent`.

## Step 1 — Audit volatile state

Run in parallel:

```bash
git worktree list
git status --short                # main checkout
gh pr list --state open
gh issue list --state open --limit 30
git log --oneline -10 main
```

For each worktree other than main, run `git -C <path> status --short` to find uncommitted work.

## Step 2 — Persist gaps

For anything volatile, move it into the repo:

- **Uncommitted WIP in a worktree** — either commit + push as a draft branch (`wip/<slug>`), or explicitly discard. Do not leave limbo.
- **Learnings not in [pitfalls.md](../memory/pitfalls.md)** — append any non-obvious gotcha you discovered this session. One bullet each, with the why.
- **Shipped items not reflected in [work.md](../../docs/work.md)** — move them from Next to Done.
- **Decisions the user made in chat but that live only in chat** — if they'd affect future scope, either file an issue, add an ADR under [docs/decisions/](../../docs/decisions/), or update the relevant plan in [docs/plans/](../../docs/plans/).
- **Open PRs with unresolved review comments** — note the PR number in `work.md` under Now so the next session sees it.

If in doubt: persist. The next session won't have your context.

## Step 3 — Emit the handoff

Print a **single compact block** with exactly these sections. Keep it under ~25 lines. This is what the user reads before `/clear`.

```
## Handoff — <YYYY-MM-DD HH:MM>

**In flight:**
- PR #N <title> — <state: CI green / awaiting review / conflicts>
- Worktree <path> — <branch>, <summary of WIP>

**Just shipped this session:**
- #N <title>
- #N <title>

**Next up (top of Next in work.md):**
- #N <title>

**Pitfalls added:**
- <one-liner> (or "none")

**Fresh session bootstrap:**
1. /clear
2. /spawn-overseer-agent
3. The overseer reads CLAUDE.md → memory → work.md → GitHub and picks up.
```

## Guardrails

- Do **not** summarize the conversation. The repo is the summary.
- Do **not** describe your reasoning. Decisions go into ADRs or `pitfalls.md`, not the handoff.
- Do **not** skip the audit. The whole point is catching gaps before they're lost.
- If you find nothing volatile, say so: "Handoff clean — repo state is authoritative."
