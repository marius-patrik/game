# Plan: #121 — Borderlands-style cell shading + outlines + Karlson feel

**Status:** draft
**Owner agent:** execution
**Branch:** `feat/cell-shading`

## Context

Aesthetic direction: Borderlands-style cell-shaded look (3-step diffuse banding + thick black outlines) + Karlson-style kinetic feel (camera punch on impact, tight movement, kinetic dust particles). Gives the game a strong identity + unifies the visual language. Overlaps partially with #111 polish; bundled or serialized based on conflict inspection at dispatch time.

## Chosen approach

- **Cell shader via `@lamina/material`** layered banding on top of PBR diffuse. Each scene mesh's material gets replaced (or wrapped) by a `CellMaterial` that accepts the underlying diffuse color + banding count (default 3).
- **Outlines via postprocessing's `OutlineEffect`** (part of `@react-three/postprocessing`). Thick (2–3px desktop; 1–2px mobile). Applies to all `outlineable` meshes; non-visible meshes (UI planes, HUD-in-scene) are tagged to exclude.
- **Per-zone palette override** — each zone declares `cellPalette: { dark, mid, bright }` so lobby reads warm and arena reads cool.
- **Karlson kinetic polish**:
  - Camera punch on hit/landing — uses the `useScreenShake()` hook (from #111 if shipped, otherwise add it here as a self-contained helper).
  - Dust kick on player landing — three-nebula emitter.
  - Ember trail on dash — extends #108's dash animation with three-nebula trail.
  - Hit-spark burst on ability connect — emitter preset.
  - Hotbar button pulse on press — CSS keyframe on the button's inner ring.
- **Performance tier**: mobile skips the outline pass OR uses cheap inverted-hull; desktop gets the full pass.

## Key files

**New**
- `apps/client/src/game/fx/CellMaterial.ts` — lamina-based cell shader.
- `apps/client/src/game/fx/OutlinePass.tsx` — wraps `OutlineEffect`, reads tier.
- `apps/client/src/game/fx/presets/{dustKick,emberTrail,hitSpark}.ts` — three-nebula emitters.
- `apps/client/src/game/zones/palettes.ts` — per-zone cell palette (warm/cool).

**Edit**
- `apps/client/src/game/Scene.tsx` — mount OutlinePass inside the EffectComposer from #111 (or alongside).
- `apps/client/src/game/Player.tsx` — swap material to CellMaterial; wire dust/ember emitters to landing + dash events.
- Every `<mesh>` in zone components — apply CellMaterial.
- `apps/client/src/game/ActionBar.tsx` — button-press pulse animation.

## Verify

- Lobby scene adopts the warm cell-shaded palette + thick black outlines on every mesh.
- Arena scene reads as a cool palette; same outline treatment.
- Dash emits ember trail that follows the arc; landing kicks dust particles.
- Ability connect produces a hit-spark burst.
- Mobile 390×812: outlines thinned or skipped (ADR-0002); FPS ≥30.
- Desktop 1440×900: outlines 2–3px; FPS ≥60.
- `preview_screenshot` of lobby + arena in PR body shows the visual direction clearly.
- Bundle delta ≤80KB gzipped from baseline.
- `bun run check` + `bun run typecheck` clean.

## Out of scope

- Full NPR pipeline (specular stylization, hatching) — banding only.
- Per-mesh cell palette overrides (one palette per zone is enough).
- Non-scene UI shader work (handled by #111's tokens).

## Retro
_(filled after merge)_
