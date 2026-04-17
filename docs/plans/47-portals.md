# Plan: #47 — Visible portals + zone polish

**Status:** shipped
**Owner agent:** execution (mixed frontend + backend, frontend-leaning)
**Branch:** `feat/portals`

## Context
Zone travel already works via the HUD dropdown (`travel(zoneId)` in `apps/client/src/net/room.ts`). The inventory, HP, level, and position persistence-across-zones plumbing is shipped (#19, #25). What's missing is the *feel* — a visible portal you walk into, and two zones that look different enough that the transition is meaningful. This PR adds portals as a first-class entity in `Zone` config, triggers travel on overlap, and gives arena a visual theme distinct from lobby.

## Chosen approach
Server is the source of truth for portal-overlap detection (anti-cheat: client can't teleport at will). Server emits a `"zone-exit"` message to a client whose position enters a portal radius; client calls existing `travel(nextZone)`. Portal rendering is pure client — no new Schema. Zone palette is parameterized in `Zone` config so palettes are consistent across client + server view. Keep the HUD dropdown so dev can still teleport instantly.

## File impact

**Shared (`packages/shared/src/`)**
- `zones.ts` — **edit**:
  - Add `Portal = { to: ZoneId; pos: Vec3; radius: number }`.
  - Add `Theme = { sky: "city" | "sunset" | "warehouse" | "forest" | "apartment" | "dawn" | "park"; ground: string; grid: string; fog: { near: number; far: number } }`. Use the existing `drei` Environment preset string literal type.
  - Extend `Zone`: `portals: Portal[]`, `theme: Theme`.
  - `lobby`:
    - portals: `[{ to: "arena", pos: { x: 15, y: 0.5, z: 0 }, radius: 1.5 }]`
    - theme (dark default): preserve the current look (`city` + `#18181b`/`#27272a` grid, fog 12→40).
  - `arena`:
    - portals: `[{ to: "lobby", pos: { x: -35, y: 0.5, z: 0 }, radius: 1.5 }]`
    - theme: `sunset` preset + warmer ground (`#3f1d2a`) + grid `#7c2d12`/`#451a03`, fog 18→55.

**Server (`apps/server/src/`)**
- `rooms/GameRoom.ts` — **edit**:
  - In `tick(dt)` (currently empty), iterate `this.state.players`. For each alive player, check each `zone.portals[i]`. If `dx² + dz² < r²`, and not already "pending exit" (one-shot per entry), mark pending + `client.send("zone-exit", { to: portal.to })`. Clear the pending flag after 2s so re-entry works.
  - Save position to DB before sending (reuse `savePlayerLocation`) — ensures a reconnect mid-swap doesn't lose position.
  - New private `handleZoneTick()` extracted from `tick` so the shape stays readable.

**Client (`apps/client/src/`)**
- `game/Portals.tsx` — **new**:
  - Render one portal per `zone.portals` entry in the current zone.
  - Visual: `drei` `Float` containing a `torusGeometry` (radius 1.2, tube 0.2) with strong emissive + `Sparkles` inner core. Animated rotation.
  - Respect `TierAwareLOD` for mobile (drop inner Sparkles count, fewer torus segments on low tier).
- `game/Scene.tsx` — **edit**: pull `zoneId` from props (currently not passed in); look up `ZONES[zoneId]` and pass `zone.portals` into `<Portals />`. Also apply `zone.theme` — replace the hardcoded dark/light palette with `zone.theme` + theme-provider preference layered on top. Specifically: theme-provider decides light/dark; `zone.theme` supplies per-zone accents (ground, grid, fog, preset).
  - Move the existing palette object into a `resolveZonePalette(zone, resolvedTheme)` helper in a new `apps/client/src/game/zonePalette.ts`.
- `game/GameView.tsx` — **edit**: pass `zoneId={room.zoneId}` into `<Scene />`.
- `net/useRoom.ts` — **edit**:
  - `room.onMessage("zone-exit", (msg: { to: ZoneId }) => { travel(msg.to); })`.
  - Ensure `travel` is stable (already via `setZoneId` in the hook).

## Risks / unknowns
- **Zone travel race.** Client receives `zone-exit` mid-move. `travel()` tears down the room + joins new one. Inventory persistence already handles this (save on leave, load on join). Verify end-to-end: walk into portal → leave room → save → join → load → inventory intact. This is a manual-smoke item in the acceptance.
- **Portal on client vs server positions.** Server uses the authoritative server-side `Player.x/z`. Client renders based on interpolated server snapshots. There's no desync-exploit risk — the server gate is authoritative.
- **Arena theme unintended side effects.** The `TierAwareLOD` system reads quality tier, not zone. Palette swap must not disturb LOD decisions. The new `zonePalette` helper returns a plain object; LOD is unchanged.
- **Scene.tsx conflict surface.** Mobs (#45) adds `<Mobs />` to `<Scene />`. This PR refactors palette handling and adds `<Portals />`. Merge order (chat → portals → mobs) means mobs rebases last; that's the agent that must reconcile.

## Acceptance mapping (from issue #47)
1. ✅ Walk into lobby portal → arrive in arena with state preserved — server detection + existing travel + persistence (#19, #25).
2. ✅ Walk into arena portal → return to lobby — symmetric.
3. ✅ Arena visually distinct — `zone.theme` palette swap.
4. ✅ HUD dropdown still works — not removed; only adds portals as an additional trigger.
5. ✅ Mobile + desktop frame-rate targets — LOD-aware portal visuals.
6. ✅ typecheck + check + CI green.

## Out of scope
- Level/key-gated portals
- Cinematic transition between zones
- >2 zones
- Zone-dependent gameplay rules (mob counts, weather)
- Minimap

## Retro
_(filled after merge)_
