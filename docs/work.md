# Work

Single source of truth for what's being done, what's next, and what's parked.

**Rule for the overseer picking this up cold:** if **Now** is empty, take the top of **Next**, draft a plan in `docs/plans/`, then dispatch an execution (or specialist) agent. Do not stop for permission — the scope is already agreed in the linked issue. If **Next** is empty, run the `maintenance` skill before asking the user.

**Rule for an execution agent:** the overseer assigns you exactly one issue + branch. Do not pick from this file — the overseer dispatches.

---

## Now

_Nothing in flight._ HUD redesign + backlog sweep landed.

## Next

_Next is empty — pick from Backlog or run `maintenance`._

## Backlog

Post-alpha ship targets. The previous backlog block closed in #58/#59/#60.

- [ ] **Party / group system** — partyId on Player schema, `/party invite` + `/party accept` chat commands, shared XP when members are within 10m of a kill, party-member HP pips in the HUD.
- [ ] **Per-class skill trees** — warrior/mage/rogue pick at first level-up; each class gets their own Cleave / Heal / Dash variants. Requires a design pass on stat curves.
- [ ] **Cinematic portal transition** — theatre.js-scripted zone swap (camera pan + particle wipe) to replace the plain fade added in #60.
- [ ] **Mob variety beyond the three archetypes** — ranged caster with actual projectiles, a "healer" mob that buffs nearby allies, an environment hazard zone.
- [ ] **Admin moderation tools** — kick/ban from the admin/sessions page, mute a chat user, revoke a session token.
- [ ] **Mobile touch polish** — double-tap to equip/use, long-press to open an item tooltip, equipment-slot drawer that fits 390×844 without crowding the ActionBar.
- [ ] **Chat moderation** — profanity filter, DMs, /block <name> list.
- [ ] **Seasonal / daily quests** — rotating reset via a cron-style generator.

## Done

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
