# Work

Single source of truth for what's being done, what's next, and what's parked.

**Rule for the overseer picking this up cold:** if **Now** is empty, take the top of **Next**, draft a plan in `docs/plans/`, then dispatch an execution (or specialist) agent. Do not stop for permission — the scope is already agreed in the linked issue. If **Next** is empty, run the `maintenance` skill before asking the user.

**Rule for an execution agent:** the overseer assigns you exactly one issue + branch. Do not pick from this file — the overseer dispatches.

---

## Now

_Nothing in flight._ Pick the top of **Next**.

## Next

_Next is empty — the #17→#25 block is all landed. Run the `maintenance` skill or file new issues before picking up more work._

Pick top-down. Each line is a filed issue with explicit Scope + Acceptance.

- [ ] ~~#17 — Shadcn component set~~ ✅ merged (#33).
- [ ] ~~#32 — Input abstraction~~ ✅ merged (#34).
- [ ] ~~#18 — Anti-cheat baseline~~ ✅ merged (#35).
- [ ] ~~#19 — Zone persistence~~ ✅ merged (#36).
- [ ] ~~#20 — Asset pipeline~~ ✅ merged (#37).
- [ ] ~~#21 — Audio engine~~ ✅ merged (#38).
- [ ] ~~#22 — Particle FX library~~ ✅ merged (#39).
- [ ] ~~#23 — theatre.js cinematic~~ ✅ merged (#40).
- [ ] ~~#24 — Combat loop~~ ✅ merged (#41).
- [ ] ~~#25 — Inventory + progression persistence~~ ✅ merged (#42).

## Backlog

- [ ] Admin players page — live player list via REST + polling (or WS subscription).
- [ ] Admin rooms page — Colyseus monitor iframe or custom view.

## Done

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
