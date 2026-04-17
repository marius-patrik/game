# Plan: #100 — Portal polish + pickup fly-to-player + lobby safe-zone visual

**Status:** draft
**Owner agent:** frontend
**Branch:** `feat/portal-pickup-polish`

## Context

Three visual polish items to make the world feel more tactile and alive:
1. Portals feel flat — upgrade to a floating vertical rotating ring with particle halo.
2. Picking up an item currently just disappears — replace with a spring-arc fly-to-player animation.
3. Lobby safe-zone has no visible marker — add a subtle ground ring around the spawn area.

Runs in parallel with #92 (bug sweep) — no file overlap.

## Approach

**Portals (`Portals.tsx`)**
- Replace the current portal mesh with a vertical torus (drei `Ring` / custom `torusGeometry`) slowly rotating around Y axis.
- Inner: drei `Sparkles` concentrated within ~0.6m radius. Color matches the portal's destination zone hint (lobby portal → soft gold; arena portal → ember orange).
- Ground glow: a shallow radial-gradient plane (`circleGeometry` + custom shader or lamina layer) at y=0.01 beneath the torus.
- Proximity pulse: when a player is within 2m, ring pulses (scale 1.0 → 1.15 → 1.0) over 400ms and particle density doubles.

**Pickup animation (`WorldDrops.tsx` + new `PickupFly.tsx`)**
- When a drop is consumed server-side (player proximity or interact), the client-side drop component plays a 350ms spring-arc animation before despawning.
- Animation: @react-spring/three springs on position (→ player's center at y=1.2), scale (1 → 0), opacity (1 → 0).
- SFX: existing pickup blip fires at animation start.

**Lobby safe-zone ring**
- Confirm #92 excludes mobs from lobby. Then add a `<SafeZoneRing>` component rendering a thin glow ring (~16m radius, centered on lobby spawn) at y=0.02. Subtle — a ring, not a dome. Can be toggled via the quality tier preference (off on "low").

## File impact

- `apps/client/src/game/Portals.tsx` — rewrite the portal mesh; add proximity pulse.
- `apps/client/src/game/WorldDrops.tsx` — pipeline to the new pickup-fly component.
- `apps/client/src/game/PickupFly.tsx` — new; spring-arc animation for a single picked-up drop.
- `apps/client/src/game/SafeZoneRing.tsx` — new; lobby-only marker.
- `apps/client/src/game/Scene.tsx` (or GameView.tsx) — mount `<SafeZoneRing />` when zoneId === "lobby".

## Verify

- Portals visibly ring-rotate with particles. Proximity pulse triggers. Mobile 390×844 stays ≥30 FPS, particle count within ADR-0002 budget.
- Pickup: items fly to player smoothly over ~350ms. No pop-out-of-existence glitch.
- Lobby: safe zone ring visible near spawn. Disappears on travel to arena.
- `bun run check` + `bun run typecheck` clean.

## Risks

- Particle count blow-up on mobile — cap via quality tier.
- Drops despawning server-side before the client animation completes — synchronize by keeping the drop schema entry alive for ~400ms after pickup intent fires, OR run the animation purely locally on the pickup event.

## Out of scope

- Per-destination portal coloring beyond lobby/arena (future when more zones exist).
- Lobby safe-zone enforcement (that's #92 server-side).

## Retro
_(filled after merge)_
