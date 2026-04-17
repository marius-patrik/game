# Plan: #102 — Final audit: pitfalls, cleanup, polish

**Status:** draft
**Owner agent:** reviewer-then-execution (single generalist, both hats)
**Branch:** `chore/final-audit`

## Context

LAST PR before presenting the wave to the user. Comb the codebase, fix anything the wave surfaced, polish anything rough.

## Scope (maintenance checklist expanded)

**Pitfalls**
- [ ] For each entry in `.claude/memory/pitfalls.md`, verify it's still reproducible in the CURRENT main. If fixed (e.g. by a merged PR), remove it. If still relevant, leave intact. If the pattern has been formalized into code (e.g. a helper), add a pointer to that code.

**Code hygiene**
- [ ] Grep `as any`, `@ts-ignore`, `@ts-expect-error` — each match must either have a biome-ignore with WHY, or be replaced with a proper type.
- [ ] Grep `TODO`, `FIXME`, `XXX`, `HACK` — expect zero. Fix or file.
- [ ] Biome warnings treated as errors — zero remaining.
- [ ] Unused exports (manual or knip-style): delete.
- [ ] Dead files (no imports): delete.

**Tests**
- [ ] `.skip(` / `.only(` → zero.
- [ ] Any logic added in the wave that lacks tests gets them, especially: ability dispatch (equip/skills), skill allocation, daily rotator determinism, character CRUD ownership, reconciler backfill.

**UI consistency**
- [ ] Every toast/notification routes through the unified toast module.
- [ ] Every interact prompt is `<InteractionPrompt>`.
- [ ] Every tab uses `<TabWindow>` + `<Tab>`.
- [ ] Every keyboard listener reads from `keybindsStore`.

**Persistence**
- [ ] Reconciler is idempotent on re-run against a healed DB.
- [ ] Character state survives: reload, server restart, schema-additive updates (simulated by resetting `migrations-embedded.ts` stub + reboot).

**Bundle & perf**
- [ ] `bun --filter @game/client run build` — compare gzipped sizes against the pre-wave baseline (record the baseline in this PR body). Investigate any >10% slip.
- [ ] Mobile 390×844 with hazards + mobs + portal + full HUD: ≥30 FPS, draw calls <150 (ADR-0002).

**Docs**
- [ ] `docs/work.md` — reflects final state. All completed issues moved to Done.
- [ ] `CLAUDE.md` — updated if any convention shifted.
- [ ] Stale path references in any docs: grep + fix.

**Smoke**
- [ ] Full flow: signup → customize → play → level up → allocate skill → equip weapon → use ability → kill mob → pick up drop → open inventory → switch tab → drag tab out (window system) → travel → die → respawn → log out → log in → pick other char. Desktop + mobile. Record result in PR body.

## Deliverable

A single audit PR that ships whatever fixes the above turns up. If the audit surfaces a big-enough issue that'd bloat this PR, file it as a follow-up.

## Out of scope

- NEW feature work.
- Dependency major bumps (biome, ts) — separate chores.
- Refactors that aren't directly driven by a pitfall or consistency check.

## Retro
_(filled after merge)_
