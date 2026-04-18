# Plan: #110 — Compass / radar strip at top of HUD

**Status:** draft
**Owner agent:** execution
**Branch:** `feat/compass`

## Context

Horizontal compass strip at the top of the screen showing cardinal ticks + directional indicators for active quest objectives, hostile mobs, portals, and NPCs. Gives constant ambient awareness of nearby points of interest without opening the full map.

Depends on #93 (HUD rebuild; compass sits below the top-left tab pane or as a dedicated top-center strip). Safe to ship on a short-circuit if #93 lands first.

## Chosen approach

- **Pure client-side**: no shared schema / server changes. All POI data already flows via Colyseus state (mobs, npcs, drops). Quests come from `Player.quests` + `Player.dailyQuests`.
- **One new component** `Compass.tsx` at the top of the HUD tree — fixed-height strip, full-width on desktop, scales responsively.
- **Bearing math** extracted into `computeBearings.ts` as a pure function + unit test — deterministic + testable without a running scene.
- **Throttled update**: compass reads zustand state every 33ms (~30Hz), not every RAF tick, to keep paint cost low.
- **Category styling** drives a small palette declared inline in the component (reuses Tailwind tokens).

## Key files

**New**
- `apps/client/src/game/Compass.tsx` — horizontal strip with cardinal ticks + POI icons.
- `apps/client/src/game/compass/computeBearings.ts` — pure helpers: `bearingFromTo(player, target)`, `angleToScreenX(bearing, facing, fovDeg)`, `filterByRange(pois, maxMeters)`.
- `apps/client/src/game/compass/computeBearings.test.ts` — bun test covering edge cases (N-wrap, behind-player culling, zero-distance).

**Edit**
- `apps/client/src/game/GameView.tsx` (or wherever the HUD mounts post-#93) — mount `<Compass />`.
- `apps/client/src/game/cinematics/` hooks / `apps/client/src/game/DialogUI.tsx` (once #109 lands) — hide compass during cinematics / dialog.

## POI sources

| POI | Source | Color | Icon |
|---|---|---|---|
| Active quest objective | `player.quests` → resolve to mob id / location from quest registry | #facc15 (yellow), subtle pulse | arrow |
| Hostile mob | `state.mobs` within 40m | #ef4444 (red); boss variant = crosshair | dot / crosshair |
| Portal | zone-portal registry (hardcoded positions today; live later) | #60a5fa (blue) inner ring | circle-ring |
| NPC | `state.npcs` | #22c55e (green); vendor/questgiver variant by `kind` | square |

## Verify

- Compass visible at top of HUD in lobby + arena.
- N/E/S/W cardinal ticks rotate correctly as the player rotates.
- Nearby mobs appear as red dots at correct angular positions; disappear when killed / out of range.
- Active quest mark appears when a quest is accepted, pulses yellow.
- Portal marker visible from across the lobby.
- Compass hides during cinematic transitions + dialog.
- Mobile 390×812: compass compresses to a narrower strip, POI count capped at 8, still legible.
- Desktop wide (1440+): no layout clipping.
- `preview_inspect` confirms the compass component stays at the correct top offset across viewports.
- `bun run check` + `bun run typecheck` + `bun test` clean.

## Out of scope

- Minimap (separate Map tab already exists).
- Persisted compass preferences (always visible for now).
- Boss nameplate / health overlay on the compass.
- Zone-specific POI overlays.

## Retro
_(filled after merge)_
