# Work

Single source of truth for what's being done, what's next, and what's parked.

**Rule for the overseer picking this up cold:** if **Now** is empty, take the top of **Next**, draft a plan in `docs/plans/`, then dispatch an execution (or specialist) agent. Do not stop for permission — the scope is already agreed in the linked issue. If **Next** is empty, run the `maintenance` skill before asking the user.

**Rule for an execution agent:** the overseer assigns you exactly one issue + branch. Do not pick from this file — the overseer dispatches.

---

## Now

- **#81** reconcile missing drizzle migrations 0003/0004 via a procedural TS reconciler in `migrate.ts` (fixes `playerProgress.test.ts` regressions; plan: [docs/plans/81-reconcile-migrations.md](plans/81-reconcile-migrations.md)).

## Next

- **#85** cinematic portal transition (theatre.js camera pan + radial wipe, replaces plain fade from #60). Frontend. Depends on #81 merging so the test harness is clean.
- **#86** healer mob archetype + arena hazard zone. Backend + shared. Serialize after any other in-flight `mobs.ts` change per pitfalls.md.

## Backlog

Post-alpha ship targets. Previous backlog blocks closed in #58-60, #62, #64-68, #76-77, #80, #83.

**Larger post-alpha systems:**
- [ ] **Per-class skill trees** — warrior/mage/rogue pick at first level-up; each class gets their own Cleave / Heal / Dash variants. Requires a design pass on stat curves — needs an ADR before implementation.
- [ ] **Seasonal / daily quests** — rotating reset via a cron-style generator.

## Done

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
