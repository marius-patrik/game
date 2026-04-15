# Work

Single source of truth for what's being done, what's next, and what's parked.

Format: one line per item, linked to its GitHub issue. Move items up as they're picked; strike through and move to Done when shipped.

---

## Now

_Nothing in flight._ Pick from **Next**.

## Next

- [ ] **Wire client ↔ server Colyseus connection** — join `game` room from client, render other players' cubes, emit `move` on input. [#3](../../issues/3)
- [ ] **Better Auth + SQLite setup** — signup/login routes, session cookie, user table via Drizzle. [#4](../../issues/4)
- [ ] **Single-binary deploy pipeline** — `bun build --compile` embedding client static assets into the server binary. [#8](../../issues/8)
- [ ] **Role-gated admin route** — `/admin/*` reads session, redirects if not `role=admin`. Server enforces on REST endpoints. [#5](../../issues/5)
- [ ] **First zone** — a named zone ("lobby") with spawn point, bounds, max occupancy. Zone transition API stub. [#6](../../issues/6)
- [ ] **Biome + typecheck in CI** — GitHub Actions workflow runs on PR. [#7](../../issues/7)

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

_Empty — project just bootstrapped._
