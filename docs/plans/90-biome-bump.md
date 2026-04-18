# Plan: #90 — Biome 1.9.4 → 2.x bump

**Status:** draft
**Owner agent:** execution
**Branch:** `chore/biome-2x-bump`

## Context

`bun outdated` flags `@biomejs/biome` at 1.9.4; current is 2.4.12. Biome 2.x has breaking config changes + rule renames + a different default recommended set. Not urgent (no CVE; current version runs green) but worth a narrow chore PR so feature PRs aren't dragged into migration noise.

## Chosen approach

- **Two-commit PR** — commit 1 is the dep bump + `bunx biome migrate` (config schema rewrite only). Commit 2 is the `bun run check:fix` autofix sweep. Keeping them separate lets `git bisect` tell us whether a later regression was the schema migration or the autofix.
- Keep the same rule set the repo already opted into; only accept rule renames automatically. Surface any dropped-rule / new-default mismatch in the PR body so the user can review behavior changes.
- Update any `biome-ignore` comments that reference renamed rule IDs.

## Key files

**Edit**
- `package.json` — `@biomejs/biome` bump to `^2.4.x`.
- `biome.json` — schema migration (via `bunx biome migrate`).
- `**/*` — formatting drift from autofix (commit 2).
- `apps/server/src/index.ts` or wherever the `/** biome-ignore */` for the BunWebSockets `.app` cast lives — confirm the rule ID still resolves.

## Verify

- `bun run check` + `bun run typecheck` clean on the PR.
- CI green (lint job uses the new Biome).
- Git diff restricted to deps + config + formatting; no logic changes.
- PR body lists any rule-set behavior shifts (e.g. "Biome now defaults to `useConst` off — preserved via override").

## Out of scope

- New rule opt-ins — separate PR if we want to adopt any new recommended rules.
- Logic refactors flagged by new rules — file a follow-up issue instead.
- Prettier replacement / re-evaluation — Biome stays.

## Retro
_(filled after merge)_
