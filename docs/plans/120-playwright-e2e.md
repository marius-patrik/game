# Plan: #120 — Playwright end-to-end script covering the full player flow

**Status:** draft
**Owner agent:** execution
**Branch:** `chore/playwright-e2e`

## Context

Every agent must preview-verify before opening a PR; a scripted end-to-end Playwright run + screenshot gallery turns that guarantee into something CI can enforce and the user can skim.

## Chosen approach

- **Single Chromium target.** Speed matters more than cross-browser coverage at this stage. Add Firefox/WebKit later if a bug demands it.
- **Script lives in `apps/client/e2e/`.** Uses `@playwright/test`. The script starts via `bun run test:e2e` which:
  1. Starts server + client dev (reuses if already running).
  2. Waits for `/health` + `:3000`.
  3. Runs the test suite.
  4. Uploads a screenshot per assertion to `apps/client/e2e/screenshots/<timestamp>/`.
- **Helper module** `apps/client/e2e/helpers/` exposes `signup()`, `createCharacter()`, `enterLobby()`, `travelTo(zone)`, `equip(itemId)`, `allocateSkill(skillId, slot)`, `logout()` — one function per step. New features add one helper + one step; the full-flow script recomposes them.
- **CI**: new GitHub Actions job `e2e` runs after `check` + `typecheck`. Uploads screenshots as artifacts.
- **Evolving contract**: every feature PR that adds a step to the full flow (e.g. #98 skills) MUST add the corresponding helper call + assertion. Ship-feature skill updated to require this.

## Key files

**New**
- `apps/client/e2e/full-flow.spec.ts` — the 17-step flow from the verification plan (signup → create char → lobby → click-move → NPC interact → vendor → inventory equip → skill allocate → portal → damage → logout/login).
- `apps/client/e2e/helpers/{signup,character,lobby,travel,inventory,skills,dialog,logout}.ts`
- `apps/client/playwright.config.ts` — Chromium only, `baseURL: http://localhost:3000`, retries=1, screenshots on every assertion.
- `.github/workflows/e2e.yml` — runs against `preview_start`-equivalent commands; uploads screenshots.

**Edit**
- `apps/client/package.json` — `test:e2e`, `test:e2e:ui` scripts; add `@playwright/test` devDependency; add `playwright install` step to `postinstall` if feasible (or document as setup).
- Root `package.json` — add `test:e2e` filter alias.
- `.claude/skills/ship-feature/SKILL.md` — add step: "if your feature changes the full flow, update `apps/client/e2e/full-flow.spec.ts` + relevant helper."
- `CLAUDE.md` — note the new test command under Run.

## Verify

- `bun run test:e2e` runs locally, end-to-end, green.
- Gallery folder populates with one screenshot per major step.
- CI job `e2e` runs on PR; uploads gallery as an artifact.
- A contributor can add a new helper + step in ≤10 lines of code.
- Script tolerates both fresh + returning accounts.
- `bun run check` + `bun run typecheck` clean with the new deps.

## Out of scope

- Visual regression diffing (pixel-by-pixel snapshots — too brittle at this stage).
- Mobile viewport runs (separate job, file after this PR).
- Load / concurrency tests.
- Multi-browser matrix.

## Retro
_(filled after merge)_

---

## Resume note — 2026-04-18 re-dispatch

Previous Codex agent was interrupted mid-run. Partial work on **`origin/chore/playwright-e2e-wip`**.

**First action:**
```bash
git fetch origin
git checkout -b chore/playwright-e2e origin/main
git merge origin/chore/playwright-e2e-wip --no-edit
# resolve any Biome 2.x formatting conflicts in favor of Biome output
bun install
```

Inherited from WIP (inspect + validate):
- `apps/client/playwright.config.ts` — new
- `apps/client/e2e/` — new dir (helpers + specs; check coverage vs plan)
- `apps/client/src/e2e/gameBridge.ts` — possibly an in-app bridge (questionable — e2e shouldn't ship in src bundle; may need relocation)
- `.github/workflows/ci.yml` — new e2e job
- `package.json` / `apps/client/package.json` — `@playwright/test` devDep + `test:e2e` script
- `.claude/skills/ship-feature/SKILL.md` / `CLAUDE.md` — doc updates
- Modified: `GameView.tsx`, `HitVignette.tsx`, `Scene.tsx`, `VendorPanel.tsx`, `CharacterNew.tsx`, `rsbuild.config.ts`, `tsconfig.json`, `quests/dailyRotator.ts` — check if these are data-testid additions for e2e (keep) or scope creep (revert)

**Audit the non-e2e file changes carefully.** If they're data-testid additions only, keep them. If they're behavior changes, revert — e2e doesn't modify production behavior.

Complete remaining #120 scope per the plan above.
