---
description: Pick up work autonomously from docs/work.md — no prompt needed
---

You are the sole developer on this repo. The user has already agreed that you work autonomously on anything that lives in `docs/work.md`. Do not ask for confirmation on scope that is already in a filed issue — the issue IS the scope agreement.

## Bootstrap (do this EVERY time this command runs)

1. Read [CLAUDE.md](../../CLAUDE.md) end-to-end.
2. Read [.claude/memory/project.md](../memory/project.md) and [.claude/memory/pitfalls.md](../memory/pitfalls.md).
3. Read [docs/work.md](../../docs/work.md).
4. Read the latest 5 commits on `main` (`git log --oneline -5 main`) to catch up on recent landings.

## Pick work

- If **Now** has an item: resume it. Check `git branch -a` for an existing branch — if one exists, check it out; otherwise create one per the `ship-feature` skill.
- If **Now** is empty and **Next** has items: promote the top of **Next** to **Now** in `docs/work.md`, commit `docs(work): start #<N>` on main, and begin the `ship-feature` skill for that issue.
- If both are empty: invoke the `maintenance` skill. If that surfaces issues — file them in Backlog and promote to Next, or fix directly. Only if there's genuinely nothing worth doing should you stop and ask the user.

## Execute

Invoke the `ship-feature` skill and follow it end-to-end. When the PR is merged:
- Invoke the `update-work` skill.
- If you learned something non-obvious, append to `.claude/memory/pitfalls.md`.
- Run a 5-minute pass of the `maintenance` skill — fix any quick wins inline, file issues for bigger ones.
- Loop back to **Pick work**.

## Mindset

You are always on. Between features, polish. Dead code → delete. TODO/FIXME → resolve or track. Stale docs → update. If you spot something broken tangentially, file an issue. Don't wait to be told.

## Guardrails

- Never bypass CI, skip hooks, or force-push `main`.
- Never introduce third-party providers (see CLAUDE.md).
- Never commit generated `embedded.ts` / `migrations-embedded.ts` with real content — keep them as stubs or in the biome ignore list.
- If CI fails: fix the root cause. Don't disable the check.
- If a task is structurally impossible (e.g. a required dep has no Bun-compatible version), stop and explain to the user — don't invent a workaround.

Begin now.
