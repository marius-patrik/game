# Work

Single source of truth for what's being done, what's next, and what's parked.

**Rule for the overseer picking this up cold:** if **Now** is empty, take the top of **Next**, draft a plan in `docs/plans/`, then dispatch an execution (or specialist) agent. Do not stop for permission — the scope is already agreed in the linked issue. If **Next** is empty, run the `maintenance` skill before asking the user.

**Rule for an execution agent:** the overseer assigns you exactly one issue + branch. Do not pick from this file — the overseer dispatches.

---

## Now

_Nothing in flight._ Pick the top of **Next**.

## Next

_Next is empty — Wave 1 (#45/#46/#47) all landed. Demoable MVP achieved. Pick from Backlog or run `maintenance`._

- [ ] ~~[#46](../../issues/46) — Chat (global + zone channels)~~ ✅ merged (#49).
- [ ] ~~[#47](../../issues/47) — Visible portals + zone polish~~ ✅ merged (#50).
- [ ] ~~[#45](../../issues/45) — Hostile mobs + loot drops~~ ✅ merged (#51).

## Backlog

- [ ] Admin live-sessions view — cross-reference DB users with live Colyseus clients (currently `/admin/players` shows registered accounts only; `/admin/rooms` and overview already show live counts).
- [ ] Mob variety — types beyond default (ranged, boss), aggro tables, pathfinding. Follow-up to #45.
- [ ] Chat persistence + moderation — DB-backed history, profanity filter, DMs. Follow-up to #46.
- [ ] Gated portals + cinematic transition + minimap. Follow-up to #47.

## Done

- [x] Demoable MVP block (Wave 1): chat [#46](../../pull/49), portals [#47](../../pull/50), mobs [#45](../../pull/51). `bun run build:release` → 70 MB Linux/arm64 binary with embedded client + migrations. Two-browser smoke passed.
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
