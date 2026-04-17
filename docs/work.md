# Work

Single source of truth for what's being done, what's next, and what's parked.

**Rule for the overseer picking this up cold:** if **Now** is empty, take the top of **Next**, draft a plan in `docs/plans/`, then dispatch an execution (or specialist) agent. Do not stop for permission — the scope is already agreed in the linked issue. If **Next** is empty, run the `maintenance` skill before asking the user.

**Rule for an execution agent:** the overseer assigns you exactly one issue + branch. Do not pick from this file — the overseer dispatches.

---

## Now

- **#106** sell dialog grid UI — small UX fix, can ship in parallel with the big queue. Standalone, no dependencies.
- **#107** game-feel — floating sphere players + dynamic camera arm + FOV slider + cursor-lock toggle. **Prerequisite for #96 customizer + #108 cursor.**

## Next

Full user-requested rebuild + polish, dependency-ordered:

1. **#108** 3D cursor + ground targeting system (reusable for cast-in-space abilities) — depends on #107.
2. **#96** character system — customizer (renders sphere from #107), persistence, multi-char. Schema foundation for downstream.
3. **#97** equipment slots + weapon-driven primary/secondary attacks — depends on #96.
4. **#98** skill system + skills tab + ultimate slot — depends on #97.
5. **#93** HUD rebuild (XP/HP/MP bars bottom, top-left tab pane, top-right sidebar, unified toasts, **current-equipment tab**) — depends on #96/#97/#98.
6. **#110** compass/radar at top — depends on #93.
7. **#94** hotbar redesign (2W+2S+U+2I+2P) — depends on #93/#97/#98.
8. **#95** unified InteractionPrompt + full keybinds + auto-pickup — depends on #93/#94/#107.
9. **#109** Skyrim-style dialog system — depends on #95/#107.
10. **#99** draggable window/tab system (ADR + impl) — depends on #93.
11. **#101** seasonal / daily quests rotator — depends on #96.
12. **#111** game-feel polish pass (particles, shaders, screen shake, frosted-glass UI, glow, unified visual style) — depends on everything prior.
13. **#102** final audit / pitfalls / cleanup — absolute last.

## Infrastructure

- **Multi-CLI dispatch** (`scripts/dispatch-cli.sh`) — overseer can dispatch work to Claude Code, Codex, or Gemini in detached tmux sessions. See [.claude/memory/multi-cli.md](../.claude/memory/multi-cli.md). User can `tmux attach -t agent-<issue>-<cli>` to watch.

## Backlog

Previous backlog blocks closed in #58-60, #62, #64-68, #76-77, #80, #83, #87-89.

**Maintenance chores:**
- [ ] **#90** bump Biome 1.9.4 → 2.x — config-schema migration + autofix sweep, narrow chore PR.

## Superseded
- **#91** per-class skill trees ADR — closed; the class-less skill allocator in #98 covers the same design surface more simply.

## Done

- [x] **#92** bug sweep (#104) — fixed the interaction prompt/drop leak, hardened the level-up banner dismissal, isolated the 3D scene palette from app dark mode, tightened viewport overflow, moved Mercer + Elder Cubius out of their stalls, stabilized player color, and added travel/leave diagnostics.
- [x] **#100** portal polish + pickup fly-to-player + lobby safe-zone visual (#103) — rebuilt portals as vertical rotating gates with a proximity pulse, added local-intent pickup fly animation, and mounted a lobby safe-zone ground ring.
- [x] **#86** healer mob + arena hazard zone (#89) — 4th `MobKind` ("healer", 20 HP, 4 HP/s heal to mobs within 3m, skips self + caps at maxHp). New `HazardZone` schema + `HazardSystem` (arena seeds one 5m-radius 3-dps circle). Scripted-spawn via new `spawnSpecificKind()` + `respawnKind` preserves archetype across respawn. Six new tests (72 pass total). Zero balance changes from plan; mobile draw-call budget preserved.
- [x] **#85** cinematic portal transition (#88) — 1.2s DOM-overlay cinematic driven by `@theatre/core` sequence (camera push + radial wipe + white flash + fade-in). New `apps/client/src/game/cinematics/` module, preferences-store persisted `skipCinematics` escape hatch in Settings. Bundle delta +34 KB gzipped (budget 100 KB). Zero `@theatre/studio` in `apps/client/src/**`. First real use of theatre.js in the project.
- [x] **#81** reconcile missing drizzle migrations 0003/0004 (#87) — new `apps/server/src/db/reconcile.ts` runs after `migrate()`, PRAGMA-checks `player_progress`, conditionally ALTERs in the 11 missing columns, and `CREATE TABLE IF NOT EXISTS`es `chat_message`. Idempotent against fresh + drifted DBs. Chosen over the issue's Option A because SQLite has no `ADD COLUMN IF NOT EXISTS`. Also fixed 3 long-standing `playerProgress.test.ts` failures by extending its inline CREATE TABLE. Agent rate-limited at ~80%; overseer finished the last 20%.
- [x] **#73** party / group system (#83) — `Player.partyId` on schema, `/party invite|accept|leave|status` chat commands with leader promotion + 60s invite TTL + 4-member cap, shared XP at 60% for members within 10m of the kill, new `PartyPanel` HP/mana pips in the HUD, zone-scoped (traveling drops from party). Backend agent hit rate-limit mid-run; overseer finished remaining 60% from seat.
- [x] **#72** chat moderation (#80) — profanity filter with 14 unit tests, `/block` + `/unblock` per-user list persisted in new `chat_block` table (migration 0005), cross-zone `/w <name>` DMs via `matchMaker.remoteRoomCall`. Also surfaced pitfall: migrations 0003 + 0004 were never registered in `_journal.json` — filed as #81.
- [x] **Social + ops wave 1** — **#70** mobile touch polish (#77: double-tap equip, long-press ItemTooltipDrawer via vaul, responsive HUD breakpoints), **#71** admin moderation (#76: kick / mute / revoke session endpoints + `/admin/sessions` action buttons + mute state in `GameRoom.handleChat`).
- [x] **Alpha-polish leftovers all shipped** — combat feel, UX polish, mob behaviour. Five PRs: crit hits + killed-by death cause (#64), SFX polish + minimap POI icons (#65), inventory-full toast (#66), boss enrage charge at <50% HP (#67), caster mob ranged projectile (#68). Covers all 8 items deferred from #62.
- [x] **Alpha polish pass** (#62) — ZoneDecor in lobby (pillars + market stalls + fountain + perimeter hedge) and arena (crumbled obelisks + firepit + darker perimeter); HitVignette (red radial flash + 180ms shake on HP loss); LevelUpBanner (spring-scaled "+3 stat points" pop); QuestToast (slide-in on quest ready-to-turn-in); InteractionPrompt sprite trimmed so NPC labels don't eat the screen at close range. Floating centerpiece moved to y=6 so it stops competing with gameplay.
- [x] **HUD consolidation + free camera + proximity prompts + backlog sweep** — ActionBar (skills + inventory), SidePanel tabs (Map / Quests / Chat), TopMenu 3-dots (travel / theme / settings / admin / sign-out), clickable stat card, QuestTracker. OrbitControls re-added with constrained zoom + rotate + chase target. E-key NPC interact + auto-pickup. Basic attack moved into the ability list as "Strike". Closed four backlog items: gated portals (level-req), persisted skill cooldowns (migration 0004), chat persistence (new `chat_message` table), and admin live-sessions page. Boss AOE telegraph + zone-transition fade followed in #60.
- [x] **Alpha-playable milestone** — click-only controls [#53](../../pull/53), camera + compositional models + minimap + settings + SFX + tutorial [#54](../../pull/54), stats/mana/skills/equipment/gold/vendor/quests/mob variety [#55](../../pull/55). 70 MB single-binary (arm64) built from `bun run build:release`; preview smoke confirmed HP/Mana/XP/Gold HUD, chase-arm camera, skill hotbar, NPCs in lobby, portal to arena with caster + boss mobs.
- [x] Demoable MVP block (Wave 1): chat [#46](../../pull/49), portals [#47](../../pull/50), mobs [#45](../../pull/51).
- [x] Client legacy decorators for Colyseus schema. [#14](../../issues/14)
- [x] Wire client ↔ server Colyseus connection. [#3](../../issues/3)
- [x] Better Auth + SQLite gating the GameRoom. [#4](../../issues/4)
- [x] Role-gated admin route with live player/room data. [#5](../../issues/5)
- [x] First named zone with spawn + bounds. [#6](../../issues/6)
- [x] Single-binary deploy pipeline — `bun run build:release` → `dist/game-server`. [#8](../../issues/8)
- [x] Biome + typecheck in CI — `.github/workflows/ci.yml` runs on every PR. [#7](../../issues/7)
- [x] Server-side logging rotation — `pino-roll` daily + 20 MB, 7-day retention. [#16](../../issues/16)
- [x] Overseer/execution agent infra — spawn commands, dispatch skill, role-scoped bootstraps. [#30](../../pull/30)
- [x] Fresh-clone dev boot — `embedded.ts` + `migrations-embedded.ts` reset to stubs. [#29](../../issues/29) / [#31](../../pull/31)
- [x] `/flush` handoff command + ADR-0002 mobile+desktop invariant.
