# Plan: #45 — Hostile mobs + loot drops

**Status:** draft
**Owner agent:** execution (mixed frontend + backend)
**Branch:** `feat/mobs`

## Context
Combat (#24) and inventory/XP (#25) shipped, but the world has no hostile entities. Attacking other players works, but solo play is dull. This plan adds server-authoritative mobs that spawn per zone, chase the nearest player, deal contact damage, take damage from the existing attack loop, die, and drop loot from a weighted table. The existing `spawnDrop` + `WorldDrop` schema handle the drop side — this PR reuses them rather than adding a new ground-item concept.

## Chosen approach
Mobs live entirely on the server. They're a new Schema class in `@game/shared`, a new `MapSchema<Mob>` on `GameRoomState`, and a small system module that owns spawn + AI + cleanup. Combat is integrated by extending the `candidates` array in `handleAttack` to include mobs and by making `resolveAttack` accept a hybrid target. Client subscribes to the new map and renders a Mob per entry.

No new runtime dependencies. Reuses `SparkBurst` from `#22` for death FX and the existing `spawnDrop` + weighted-table spawning for loot.

## File impact

**Shared (`packages/shared/src/`)**
- `schema.ts` — add:
  - `Mob` class (`@type` fields: `id: string`, `kind: string`, `x/y/z: number`, `hp: number`, `maxHp: number`, `alive: boolean`).
  - On `GameRoomState`: `@type({ map: Mob }) mobs = new MapSchema<Mob>();`
- `index.ts` — re-exports automatically via `export * from "./schema"`.

**Server (`apps/server/src/`)**
- `rooms/systems/mobs.ts` — **new**. Exports `class MobSystem` with `start(room)`, `stop()`, `tick(dt)`, `tryAttack(attackerId, range, damage): MobAttackResult`, `onPlayerLeave(sessionId)`. Internally owns:
  - Spawn counts per zone: `lobby: 3`, `arena: 6`.
  - Spawn positions: random inside zone bounds, clamped away from zone.spawn by 4m so players don't spawn onto a mob.
  - Per-mob state: `target?: sessionId`, `lastAttackAt`, plus handle to `Mob` schema entity.
  - Tick (20Hz): for each alive mob, find nearest alive player within `detectRadius = 8`; if found, lerp position toward player at `mobSpeed = 1.8 u/s`; if within `contactRange = 1.2` and `now - lastAttackAt >= contactCooldown = 1000ms`, deal `contactDamage = 5` to that player (respecting invulnerability), update lastAttackAt.
  - Respawn: dead mobs removed from `state.mobs`; after `respawnDelayMs = 8000`, spawn a new one at a random in-bounds point.
  - Loot table: `heal_potion` weight 80, `sword` weight 18, `soul` weight 2. Reuse `room.spawnDrop(itemId, 1, mobPos)`.
- `rooms/GameRoom.ts` — edits:
  - Import and instantiate `MobSystem` in `onCreate`, call `mobs.start(this)`.
  - Hook into `onDispose` → `mobs.stop()`.
  - In `handleAttack`: build a unified `candidates: Combatant[]` array = players ∪ mobs. Key naming: prefix mob ids as `"mob:<id>"` so they don't collide with sessionIds. After `resolveAttack`, branch: if `result.targetId.startsWith("mob:")`, apply damage to mob schema + trigger drop on kill; else fall through to existing player-damage path.
  - Expose `spawnDrop` as `public` (currently private) so `MobSystem` can call it. Or pass a drop-callback into `mobs.start()`. **Prefer the callback pattern** to keep `MobSystem` decoupled from GameRoom internals.
  - In `onLeave`, call `mobs.onPlayerLeave(sessionId)` so mobs retarget.
  - Export a type `MobKillEvent` for the broadcast.
- `combat/resolveAttack.ts` — no changes. Current `Combatant` shape already fits mobs (they have `id`, `pos`, `alive`, `hp`).

**Shared (loot weighting utility)**
- `packages/shared/src/loot.ts` — **new**. Tiny utility:
  ```ts
  export type WeightedEntry<T> = { value: T; weight: number };
  export function pickWeighted<T>(table: WeightedEntry<T>[], rng: () => number = Math.random): T;
  ```
  Server-side only for now, but lives in shared so future client-side preview can reuse. Unit-tested with seeded RNG.

**Client (`apps/client/src/`)**
- `net/useRoom.ts` — add:
  - `MobSnapshot` type mirroring Mob schema.
  - `mobs: Map<string, MobSnapshot>` in `RoomState`.
  - Subscribe to `state.mobs.onAdd` / `onRemove` / per-entity `onChange`, same pattern as drops.
  - Listen for a new `"mob-killed"` server message for death-FX cue.
- `game/Mobs.tsx` — **new**. Renders one entity per `MobSnapshot`. Simple stylized mob:
  - Cone geometry, red emissive material, slight Float for idle bobbing.
  - HP bar: a `drei` `Billboard` with a thin plane scaled to `hp/maxHp`, red → green gradient.
  - Death: on snapshot loss, trigger a local `SparkBurst` at last-known position for 800ms before unmount.
- `game/Scene.tsx` — add `<Mobs mobs={mobs} />` next to `<Drops />`.
- `game/GameView.tsx` — pass `room.mobs` into `<Scene />`.
- No HUD changes required for this PR.

**Tests (reuse `bun test` runner as seen in `apps/server/src/combat/resolveAttack.test.ts`)**
- `apps/server/src/rooms/systems/mobs.test.ts` — unit tests for spawn, chase-movement math, contact-damage logic, loot-table picks with a seeded RNG.
- `packages/shared/src/loot.test.ts` — deterministic weighted-pick distribution check.

## Risks / unknowns
- **Schema conflict surface.** `packages/shared/src/schema.ts` is the single merge target. The chat PR (#46) does not add schema classes; portals (#47) does not either. Merge order: chat → portals → mobs, so this PR rebases last. Keep the diff to additions only.
- **GameRoom.ts conflict.** Portals (#47) adds a tick-time position check against portal radii. Chat (#46) adds a message handler. This PR adds a mob tick callback + attack integration. These don't overlap by line, but all three edit `onCreate` + `onLeave`. Agents should make edits near the bottom of each block to minimize conflict ranges.
- **Client-side perf on mobile.** 6 mobs × simple cone ≈ 6 extra draw calls. Well within the ADR-0002 mobile budget (<150 draw calls). SparkBurst death FX must honor `particleBudget` (already does).
- **Mob aggro stacking.** With multiple players, many mobs targeting the same player can one-shot a low-HP player. For this PR, cap total contact-damage-per-tick per player at 15. Documented in tests.
- **Respawn floods at low player count.** If all players leave, mobs keep respawning. Mitigation: if no alive players in zone for >30s, pause spawns (keep existing ones). Not a correctness issue, just sanity.

## Acceptance mapping (from issue #45)
1. ✅ Mobs visible on joining lobby — handled by Mob schema + Mobs.tsx renderer.
2. ✅ Attack hits nearest mob OR player — unified `candidates` in `handleAttack`.
3. ✅ Mob HP decreases → dies → drops item — MobSystem + spawnDrop callback.
4. ✅ Drop pickup adds to inventory — reuses existing pickup flow (no change).
5. ✅ Mob contact damages player — MobSystem contact-damage tick.
6. ✅ Works in both zones — per-zone config in MobSystem.
7. ✅ Mobile 30 FPS / desktop 60 FPS — 6 extra simple draw calls + Float animation.
8. ✅ typecheck + check + CI green — enforced by preflight.

## Out of scope
- Mob types beyond "default".
- Aggro tables / threat lists across multiple attackers.
- Pathfinding around obstacles.
- Mob animations beyond position interpolation.
- Persisting dead mobs or drop tables to DB.

## Retro
_(filled after merge)_
