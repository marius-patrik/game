# Work

Single source of truth for what's being done, what's next, and what's parked.

**Rule for the overseer picking this up cold:** if **Now** is empty, take the top of **Next**, draft a plan in `docs/plans/`, then dispatch an execution (or specialist) agent. Do not stop for permission — the scope is already agreed in the linked issue. If **Next** is empty, run the `maintenance` skill before asking the user.

**Rule for an execution agent:** the overseer assigns you exactly one issue + branch. Do not pick from this file — the overseer dispatches.

---

## Now

- **Verification sweep** — after the 2026-04-18 shipping wave (#96 character, #97 equipment, #101 daily quests, #106 sell-grid, #107 sphere/camera, #108 3D cursor, #115 char system, #116 setState hotfix, #117 daily quests, #118 equipment, #119 preview-verification infra), the overseer must drive the full player flow in the preview and flip the remaining `done-untested` rows in [docs/user-intents.md](user-intents.md) to `verified-preview`. Fix any regressions surfaced before continuing the next wave.

## Next

Dependency-ordered; each PR must be preview-verified before merge (see CLAUDE.md → Preview verification loop):

1. **#98** skill system + skills tab + ultimate slot — depends on #97 (shipped).
2. **#93** HUD rebuild (XP/HP/MP bars bottom, top-left tab pane, top-right sidebar, unified toasts, **current-equipment tab**) — depends on #96/#97/#98.
3. **#110** compass/radar at top (quests, mobs, portals, NPCs) — depends on #93.
4. **#94** hotbar redesign (2W+2S+U+2I+2P) — depends on #93/#97/#98.
5. **#95** unified InteractionPrompt + full keybinds + auto-pickup — depends on #93/#94/#107.
6. **#109** Skyrim-style dialog system — depends on #95/#107.
7. **#99** draggable window/tab system (ADR + impl) — depends on #93.
8. **#120** Playwright end-to-end test script (kept actively up to date) — can run parallel once HUD rebuild (#93) settles.
9. **#121** Borderlands cell shading + outlines + Karlson-style feel — can bundle with or precede #111.
10. **#111** game-feel polish pass (particles, shaders, screen shake, frosted-glass UI, glow) — depends on HUD + hotbar + dialog.
11. **#102** final audit / pitfalls / cleanup — absolute last.

## Infrastructure

- **Multi-CLI dispatch** (`scripts/dispatch-cli.sh`) — overseer can dispatch work to Claude Code, Codex, or Gemini in detached tmux sessions. See the [multi-cli-dispatch skill](../.claude/skills/multi-cli-dispatch/SKILL.md). `tmux attach -t agent-<issue>-<cli>` to watch.
- **Preview verification loop** — see [CLAUDE.md](../CLAUDE.md) § "Preview verification loop". Every merged PR must be reproduced in preview; flip the matching row(s) in [docs/user-intents.md](user-intents.md) to `verified-preview`.
- **User intent tracker** — [docs/user-intents.md](user-intents.md) carries every user-voiced ask (ui-1 .. ui-43) with status. Append on every new intent; flip on verification.

## Backlog

Previous backlog blocks closed in #58-60, #62, #64-68, #76-77, #80, #83, #87-89, #103-104, #112-119.

**Maintenance chores:**
- [ ] **#90** bump Biome 1.9.4 → 2.x — config-schema migration + autofix sweep, narrow chore PR.

## Superseded
- **#91** per-class skill trees ADR — closed; the class-less skill allocator in #98 covers the same design surface more simply.

## Done (2026-04-18 session)

- [x] **#119** preview verification loop + `docs/user-intents.md` — every PR must be driven through the preview before merge; intent tracker with 43 rows backfilled.
- [x] **#118** equipment slots + weapon-driven W1/W2 abilities (#97) — 10 abilities, 3 weapons + armors + rings, ability dispatch helper, +16 tests.
- [x] **#117** seasonal/daily quest rotator (#101) — UTC-seeded 3-quest rotation, `character_daily_progress` table, rollover logic, countdown header.
- [x] **#116** hotfix `GameRoom.setState(new GameRoomState())` + `CharacterGuard` ownership validation + Sphere Color label — unblocked all room joins after #115.
- [x] **#115** character system (#96) — multi-character per account, customizer, `character` / `character_progress` / `character_inventory` tables, backfill reconciler, REST `/api/characters`.
- [x] **#114** 3D cursor + reusable ground targeting (#108).
- [x] **#113** floating sphere + dynamic camera arm + FOV slider + cursor-lock (#107).
- [x] **#112** vendor sell-dialog grid (#106).
- [x] **#105** bug sweep follow-up (stable colors + NPC targeting).
- [x] **#104** bug sweep (#92) — persistence, level-up toast, dark mode scene isolation, viewport overflow, NPC placement, Elder Cubius interact, disconnects instrumentation, cube color stability.
- [x] **#103** portal polish + pickup fly-to-player + lobby safe-zone ring (#100).

## Done (earlier waves)

- [x] **#86** healer mob + arena hazard zone (#89).
- [x] **#85** cinematic portal transition (#88).
- [x] **#81** reconcile missing drizzle migrations 0003/0004 (#87).
- [x] **#73** party / group system (#83).
- [x] **#72** chat moderation (#80).
- [x] **#70** mobile touch polish (#77); **#71** admin moderation (#76).
- [x] Alpha-polish leftovers (#64-68), alpha polish pass (#62), HUD consolidation + free camera + proximity prompts (#58-60), alpha-playable milestone (#53-55), demoable MVP block (#45-47), Colyseus legacy decorators (#14), client↔server wiring (#3), better-auth + SQLite (#4), admin route (#5), first zone (#6), single-binary deploy (#8), CI (#7), log rotation (#16), overseer/execution infra (#30), fresh-clone dev boot (#29/#31), `/flush` + ADR-0002.
