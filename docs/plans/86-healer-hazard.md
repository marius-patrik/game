# Plan: #86 — Healer mob archetype + arena hazard zone

**Status:** shipped
**Owner agent:** backend → execution
**Branch:** `feat/healer-hazard`
**PR:** [#89](https://github.com/marius-patrik/game/pull/89)

## Context

Arena combat today is binary: one of three mob archetypes (grunt / caster / boss) swings at the player; the player swings back. Issue #86 adds two always-on positional systems to change arena pacing:
1. **Healer mob** — low-HP support caster that passively heals nearby mobs in a 3m radius. Forces the player to prioritize targets instead of DPSing whatever's closest.
2. **Hazard zone** — static orange-telegraphed ground circle that ticks damage to anyone standing in it. Always-on threat independent of mob AI.

Both are small, well-scoped additions. Should not collide with any other mob work.

**Serialization constraint:** [.claude/memory/pitfalls.md](../../.claude/memory/pitfalls.md) flags `apps/server/src/rooms/systems/mobs.ts` as a merge hotspot — multiple mob PRs in a single session rebase poorly on the per-mob step computation. No other mob work is in flight right now, so we're clear to ship this solo.

## Options considered

1. **Healer = a new `MobKind`** — fourth archetype entry in `mobs.ts`, heal-tick inside the existing per-mob loop.
   - ✅ Minimal surface. Reuses existing infrastructure (spawn weights, runtime state, respawn timer).
   - ✅ Matches the cadence of #67 (boss enrage) and #68 (caster kite + bolts).
2. **Healer = a dedicated system** — separate `HealerSystem` class parallel to `MobSystem`.
   - ❌ Over-engineered for a single archetype. Duplicates spawn + respawn + find-nearest code.

3. **Hazard = a new `HazardSystem` + new `HazardZone` Schema** — server-authoritative, state broadcast via GameRoomState, client reads and renders.
   - ✅ Clean separation — hazards have nothing to do with mob AI.
   - ✅ Extensible — a future "rolling hazard" or "expanding circle" needs only the system, not the schema shape.
4. **Hazard = a Mob with `kind="hazard"` and special-cased logic in mobs.ts** — repurpose the mob entity.
   - ❌ Conceptually wrong (hazards don't move, don't have HP, don't drop loot).
   - ❌ Bloats MobKind and mobs.ts.

## Chosen approach

**Option 1 + 3.** Healer becomes the fourth `MobKind`; hazard zone gets its own Schema class + tick system.

### Healer archetype (mobs.ts)

```ts
const HEALER: MobArchetype = {
  kind: "healer",
  speed: 0.8,                  // drifts, doesn't chase
  maxHp: 20,                   // soft target — dies in ~2 player hits
  contactRange: 0.8,           // irrelevant; healer doesn't melee
  contactDamage: 0,            // no damage
  contactCooldownMs: 99999,    // guarantees the contact path never fires
  detectRadius: 6,             // range at which it starts "supporting"
  lootTable: [
    { value: "mana_potion", weight: 70 },
    { value: "ring_spark", weight: 20 },
    { value: "soul", weight: 5 },
  ],
  xpBonus: 10,
  goldDrop: [3, 8],
  spawnWeight: 0,              // excluded from random spawn mix
};
```

**Heal tick:** inside the per-mob loop, if `kind === "healer"`, **skip the approach-player path entirely** (drift via small random jitter or stand still — lean towards stand still to keep implementation simple). Instead, iterate `this.mobs` and add `HEALER_TICK_HP` (e.g. 4 HP) per 1s heal tick to every mob within `HEALER_HEAL_RADIUS` (3m), capped at each mob's `maxHp`. Skip self. Track `lastHealAt` on the healer's runtime entry.

**Spawn:** healer stays out of `ZONE_SPAWN_MIX` (weight 0) so it's never randomly spawned. Instead, introduce a `spawnSpecificKind(kind)` method on `MobSystem` that picks a spawn position and spawns a specific kind regardless of weights. `GameRoom.onCreate` calls `mobSystem.spawnSpecificKind("healer")` after `mobSystem.start()` in the arena zone only.

**Shared type update:** extend `MobArchetypeId` in `packages/shared/src/combat.ts` from `"grunt" | "caster" | "boss"` to `"grunt" | "caster" | "boss" | "healer"`. This cascades into `DeathCause` narrowings on the client automatically.

### Hazard zone (new)

**Shared schema** (packages/shared/src/schema.ts):
```ts
export class HazardZone extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") radius = 0;
  @type("number") dps = 0;     // damage per second (applied in tickMs chunks)
}
// add to GameRoomState:
@type({ map: HazardZone }) hazards = new MapSchema<HazardZone>();
```

**Server system** (apps/server/src/rooms/systems/hazards.ts, new):
- Constructor takes the hazards map, `getPlayers`, `damagePlayer`, `now`, and a tick cadence (default 500ms).
- `addHazard({ x, z, radius, dps })` creates a HazardZone in the map.
- `tick(dtMs)` — for each hazard, for each alive player whose XZ distance <= radius, apply `dps * (tickMs / 1000)` damage via `damagePlayer(id, dmg, { kind: "world" })`. Uses the existing `DeathCause: { kind: "world" }` payload.

**GameRoom wiring**:
- Instantiate `HazardSystem` in `onCreate`.
- Call `hazardSystem.tick(dtMs)` in the main simulate loop, adjacent to `mobSystem.tick(dtMs)`.
- For the arena zone specifically, `hazardSystem.addHazard({ x: 0, z: 0, radius: 5, dps: 3 })` after system construction.

### Client

**HazardZone.tsx** (apps/client/src/game/, new):
- Iterates `state.hazards` via the same useMap-style hook as other schema collections.
- Per-hazard: renders a flat radial `Ring` (drei) at y=0.02, orange tint, with a pulsing inner fill via `@react-spring/three` opacity loop. Single draw call per hazard.
- GameView mounts a `<Hazards />` wrapper inside the Canvas near the existing ZoneDecor.

**Healer mesh tint:**
- Look at the existing `Mobs.tsx` / wherever the Mob component branches on `kind`. Healer uses the caster mesh base but tinted **green** via material prop override. Don't add a new model — tint-only.
- Add a tiny sprite halo above the healer's head (drei `Html` or a small `Sparkles` cluster) so it's easy to spot at a glance.

**Minimap POI:**
- Minimap already draws mob POIs per #65. Add:
  - Healer: small green `+` (or use existing "plus" icon from `lucide-react` if it fits).
  - Hazard: small orange `!` at the hazard center.
- Update the minimap POI derivation function (probably `apps/client/src/game/Minimap.tsx`) to include hazards as a separate layer.

### Tests

**mobs.test.ts** (add cases):
- `healer heals mobs within radius` — construct system with 1 healer + 2 grunts (one within 3m, one outside), tick through 1s, assert the inner grunt gained HEALER_TICK_HP while the outer did not.
- `healer does not heal self` — tick; healer's HP is unchanged.
- `healer heal caps at maxHp` — pre-damage a grunt to HP=max-1, heal_tick of 4 should cap at maxHp, not maxHp+3.

**hazards.test.ts** (new):
- `player in hazard takes dps*tick damage` — 2 ticks at 500ms, dps=3, assert cumulative 3 HP.
- `player outside hazard takes no damage`.
- `dead player is not damaged`.

## File impact

**New**
- `apps/server/src/rooms/systems/hazards.ts` — HazardSystem
- `apps/server/src/rooms/systems/hazards.test.ts`
- `apps/client/src/game/HazardZone.tsx` — R3F overlay + optional inner pulse

**Edit**
- `packages/shared/src/schema.ts` — add `HazardZone` class + `hazards` map on `GameRoomState`
- `packages/shared/src/combat.ts` — extend `MobArchetypeId` union with `"healer"`
- `apps/server/src/rooms/systems/mobs.ts`:
  - Add `HEALER` archetype to the per-archetype block and `ARCHETYPES` map
  - Extend `MobKind` type
  - Add `HEALER_HEAL_RADIUS`, `HEALER_TICK_HP`, `HEALER_TICK_MS` constants
  - Per-tick branch: if `kind === "healer"`, skip player-chase path, run heal-tick if cooldown elapsed
  - Add `spawnSpecificKind(kind: MobKind)` method
- `apps/server/src/rooms/systems/mobs.test.ts` — add 3 healer cases
- `apps/server/src/rooms/GameRoom.ts`:
  - Instantiate `HazardSystem`
  - Wire `hazardSystem.tick(dtMs)` adjacent to `mobSystem.tick`
  - In arena init path, call `mobSystem.spawnSpecificKind("healer")` + `hazardSystem.addHazard({...})`
- `apps/client/src/game/Mobs.tsx` (or wherever Mob meshes live) — healer kind branch: tint green, optional halo
- `apps/client/src/game/GameView.tsx` — mount `<HazardZones />` inside Canvas
- `apps/client/src/game/Minimap.tsx` — add healer + hazard POI layers

**Do not change**
- `apps/server/drizzle/**` — no schema migration needed; hazard/healer state is runtime only, not persisted.
- `apps/client/src/state/**` — no new store.

## Balancing knobs (initial values, easy to tune later)

| Knob | Value | Rationale |
|---|---|---|
| `HEALER_HEAL_RADIUS` | 3m | Close enough to be threatening, far enough to see at a glance |
| `HEALER_TICK_HP` | 4 HP / 1s | Counters ~40% of a typical player DPS on the boss at level 3 |
| `HEALER_MAX_HP` | 20 HP | Dies in 2 normal hits; rewards priority play |
| Hazard `radius` | 5m | Visible from across the arena; forces positioning choice |
| Hazard `dps` | 3 | Low enough to survive a brief cross-through; threatening if camped |
| Hazard tick cadence | 500ms | 2 ticks/s feels consistent with mob contact-hit cadence |

## Risks / unknowns

- **Mob-on-mob heal skirts contract.** Current architecture damages player → mob and mob → player. Mob → mob *healing* is a new direction. The implementation is literally `otherMob.hp = Math.min(otherMob.maxHp, otherMob.hp + HEALER_TICK_HP)` and broadcasts automatically via the schema, so this is mostly cosmetic — but any future anti-cheat pipeline that assumes HP-only-changes-via-player-actions will need to relax that.
- **Hazard visuals on mobile.** Ring + pulse uses 1 mesh + 1 shader. Should be within budget, but verify `<150` draw calls in 390×844 per ADR-0002.
- **Boss-healer interaction.** Healer spawns near the boss → boss stays alive longer → fight feels grindy if healer isn't killed first. This is intentional and what the issue asks for. If playtesting shows it's too swingy, nerf `HEALER_TICK_HP` first, then `HEALER_HEAL_RADIUS`.
- **Respawn timer for healer.** Existing `respawnDelayMs = 8000` applies to all mobs; healer respawning in 8s after being killed could feel nagging. Consider a `spawnSpecificKind`-marked mob that doesn't auto-respawn, OR respawns on a longer timer (e.g. 30s). Start with the existing 8s behavior, adjust if it feels bad.

## Acceptance mapping (from #86)

1. ✅ Arena spawns 1 healer + 1 hazard on create — `GameRoom.onCreate` explicit spawn calls.
2. ✅ Standing in the hazard ticks HP ~3/0.5s with hit vignette — `hazardSystem.tick` + existing damage path triggers `HitVignette`.
3. ✅ Healer heals boss observable — per-tick heal inside mob loop.
4. ✅ Kill healer first → boss HP trends normally after — natural consequence of heal-tick removal on healer death.
5. ✅ Mobile parity preserved — visuals are 1 mesh + 1 shader per hazard, 0 new geometry for healer (tint only).
6. ✅ Biome + typecheck + tests + CI clean.

## Verification checklist for the agent

1. `bun run check` + `bun run typecheck` clean.
2. New tests: `bun test apps/server/src/rooms/systems/mobs.test.ts` (includes 3 new healer cases), `bun test apps/server/src/rooms/systems/hazards.test.ts` (3 new cases). All pass.
3. Full server suite: `bun --filter @game/server test` → 66+6 = 72 tests passing.
4. Preview smoke: `preview_start client` + `preview_start server`. Travel to arena, confirm:
   - Healer visible (green tint), standing near the boss.
   - Hazard circle visible (orange ring at center).
   - Player steps into hazard → HP ticks down + hit vignette fires.
   - Hitting the boss while healer is alive → HP recovers between hits.
   - Killing the healer → boss HP trends down on subsequent hits.
   - Minimap shows `+` (healer) and `!` (hazard) icons.
5. Mobile viewport `preview_resize 390x844` — no FPS drop vs. a pre-change baseline, draw calls still under 150.

## Out of scope

- Multiple healers per arena — 1 is enough for now; scaling is a follow-up.
- Hazard movement / expansion — static circles only.
- Audio cues for hazard tick damage — can layer via `useGameSfx` later.
- Healer shield / buff effects — heal only.
- Hazard types beyond damage-on-enter — no poison, slow, silence.

## Retro

**Shipped in PR [#89](https://github.com/marius-patrik/game/pull/89) — 72/72 server tests pass.**

### What went well
- **Plan held up.** Option 1+3 landed as designed: healer is a 4th `MobKind` entry reusing `ARCHETYPES` + spawn/respawn machinery; hazard is its own shared Schema class + `HazardSystem` tick. No restructuring of `mobs.ts`'s per-mob step computation was needed, so the merge-hotspot risk flagged in pitfalls.md didn't bite.
- **Balancing values were right first time.** All six initial knobs (HEALER_HEAL_RADIUS=3, HEALER_TICK_HP=4, HEALER_TICK_MS=1000, hazard radius=5, dps=3, tickMs=500) survived playtest without tuning. Hazard kills a standing 120-HP player in ~20s — matches the "survive a brief cross-through" intent.
- **Tests ran in one shot.** 3 healer cases + 3 hazard cases wrote cleanly against `MapSchema`-backed harnesses; no runtime Colyseus decoration surprises.

### What surprised us
- **Respawn needs a "kind-sticky" map.** `spawnMob()` pulled its kind from the zone's weighted mix on respawn, which would have turned a dead healer into a random grunt/caster 8s later. Added `respawnKind: Map<mobId, MobKind>` to preserve the archetype for scripted spawns. Thin surface (one set on kill, one consult on respawn-due), but worth calling out for any future fixed-archetype spawns (e.g. named minibosses).
- **Damage-cause plumbing needed `applyWorldDamage`.** The existing `applyMobContactDamage` embeds `{ kind: "mob", mobKind }` in the death-cause stamp — not reusable for a hazard. Cloned it into a sibling `applyWorldDamage` that stamps `{ kind: "world" }`. Cheap; keeps mob death-cause shape strictly mob-typed. If a third damage category appears (e.g. friendly-fire, environmental-fall), factor the shared body then.
- **Preview harness flakes on programmatic travel.** Calling `travel('arena')` via fiber inspection + `send('move', {x:15,z:0})` occasionally bounces the player between zones because the server's portal detector fires before the client's zoneId-triggered rejoin lands. UI-driven travel in the preview still works, but scripted verification needs to call `travel()` once and wait — not re-move after the zone flip. Filed as a note in pitfalls below.

### Non-obvious takeaways
- **Mob-on-mob schema mutations "just work."** Adding `other.hp = Math.min(...)` inside the healer tick broadcasts via Colyseus without any new infrastructure, because mutations to existing `Mob` fields are already watched. Future anti-cheat will need to relax any "HP only changes through player actions" invariant, but we don't have one yet.
- **First-tick cadence gotcha.** The heal loop uses `now - lastHealAt >= HEALER_TICK_MS` with `lastHealAt ?? 0`. First tick at `now=1000ms` fires immediately (1000-0 >= 1000). This is intentional but subtle — tests assume it.
- **Adding a shared `@type` didn't reorder Player decorators.** Was slightly worried because decorator order matters for Colyseus field-id assignment, but HazardZone was appended as a new class + new map field on `GameRoomState`; existing Player shape was untouched.

### For next time
- **Tint-only healer stayed within budget.** One extra ring mesh for the halo + color swap via React props. No new geometry. Bundle delta: negligible. This pattern is the default for future archetype variants (e.g. "enraged grunt", "elite caster") — never add a new GLB.
- **If we add multiple hazards per zone**, the current HazardSystem already iterates a `MapSchema<HazardZone>` so it scales without refactor. The choice to put hazards in their own MapSchema (vs. as Mobs) paid off — the client-side ring renderer stayed tiny because it doesn't share any mob mesh plumbing.
