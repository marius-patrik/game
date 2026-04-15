# Work

Single source of truth for what's being done, what's next, and what's parked.

Format: one line per item, linked to its GitHub issue. Move items up as they're picked; strike through and move to Done when shipped.

---

## Now

_Nothing in flight._ Pick from **Next**.

## Next

_Next unit is now one of the Backlog items. Pick and file an issue before picking up._

## Backlog

- [ ] Particle FX library — wire three-nebula, ship one spell effect as a reference.
- [ ] theatre.js cinematic intro — zone transition sequence.
- [ ] Shadcn component set — add `card`, `dialog`, `dropdown-menu`, `input`, `label`, `table`, `toast` (sonner wrapper).
- [ ] Admin players page — live player list via REST + polling (or WS subscription).
- [ ] Admin rooms page — Colyseus monitor iframe or custom view.
- [ ] Audio engine — Howler wrapper with positional audio bridging to R3F.
- [ ] Asset pipeline — gltf-transform, Draco, KTX2.
- [ ] Zone persistence — snapshot/restore per zone in SQLite.
- [ ] Anti-cheat baseline — input rate limits, movement validation.
- [ ] Combat loop — damage, spells, death/respawn.
- [ ] Inventory + progression persistence.
- [ ] Server-side logging rotation (pino to file).

## Done

- [x] Wire client ↔ server Colyseus connection. [#3](../../issues/3)
- [x] Better Auth + SQLite gating the GameRoom. [#4](../../issues/4)
- [x] Role-gated admin route with live player/room data. [#5](../../issues/5)
- [x] First named zone with spawn + bounds. [#6](../../issues/6)
- [x] Single-binary deploy pipeline — `bun run build:release` → `dist/game-server`. [#8](../../issues/8)
- [x] Biome + typecheck in CI — `.github/workflows/ci.yml` runs on every PR. [#7](../../issues/7)
