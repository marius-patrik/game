---
name: ship-feature
description: End-to-end feature delivery — issue → branch → implement → PR → CI → merge → update work.md. Invoke when starting any new GitHub-issue-backed unit of work.
---

# ship-feature

Canonical flow for landing a feature in this repo. Each step is mandatory unless flagged optional.

## 1. Confirm scope + plan
- Read the linked GitHub issue. It must have explicit **Scope** and **Acceptance** sections. If not — update the issue before writing code.
- Read the plan at `docs/plans/<issue>-<slug>.md`. For non-trivial work, **a plan must exist** (written by the overseer or a planning agent). If missing, stop and ask the overseer to draft one.
- Read [docs/work.md](../../../docs/work.md). Move the item to **Now** (overseer does this, not the execution agent).

## 2. Branch
```bash
cd /Users/user/Documents/projects/game
git checkout main && git pull
git checkout -b feat/<short-name>
```
Always off fresh `main`. No rebases across PRs.

## 3. Implement
- Respect coding rules in [CLAUDE.md](../../../CLAUDE.md): strict TS, no `as any`, no dead code, no WHAT-comments.
- Shared state → `packages/shared`. Client code → `apps/client/src`. Server → `apps/server/src`.
- New server state → new Drizzle migration (`bun --cwd apps/server run db:generate`).

## 4. Preflight (before commit)
Invoke the `preflight` skill. It runs:
```bash
bun run check:fix
bun run typecheck
```
Both must be clean.

## 5. Commit
Conventional Commits. Subject ≤ 72 chars. Body explains WHY.
```
feat(scope): short description (#<issue>)
```

## 6. Push + PR
```bash
git push -u origin <branch>
gh pr create --title "<subject> (#<issue>)" --body "<summary + test plan + Closes #<n>>"
```

## 7. CI
Wait for checks. If failing, investigate the actual failure — never bypass with `--no-verify` or skip hooks.
```bash
gh pr checks <pr>
```

## 8. Request review (non-trivial PRs)
Overseer spawns a **review agent**. Execution agent does not self-merge.

## 9. Merge + cleanup
Overseer merges after review is clean:
```bash
gh pr merge <PR> --squash --delete-branch
git checkout main && git pull
```

## 10. Update work.md
Overseer invokes the `update-work` skill. Strike-through the item and add it to **Done** with the PR link.

## 11. Update plan retro + memory
- Fill the **Retro** section of `docs/plans/<issue>-<slug>.md` and set Status to `shipped`.
- If you discovered a non-obvious gotcha, append to [.claude/memory/pitfalls.md](../../memory/pitfalls.md).

## 12. Keep The Playwright Flow Current
- If your PR changes the core player journey, update `apps/client/e2e/full-flow.spec.ts` and the relevant helper under `apps/client/e2e/helpers/`.
- Treat the scripted flow as part of the acceptance surface, not optional follow-up.
