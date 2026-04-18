# Plan: #111 — Game-feel polish pass (particles, shaders, screen shake, frosted glass, glow)

**Status:** draft
**Owner agent:** execution
**Branch:** `feat/polish-pass`

## Context

Big visual pass that elevates the client from prototype to polished alpha. Every action gets visible feedback; UI + scene share a unified visual language (frosted glass + glow). Lands after HUD (#93), hotbar (#94), keybinds (#95), dialog (#109) so the unified tokens can target the final HUD shape. Bundles with #121 cell-shading where the two scopes overlap.

## Chosen approach

- **Three-point lighting per zone** via a `lightingProfile` declared on each zone. Default profile is a warm key + cool fill + rim. Zones override for mood.
- **Post-processing stack** via `@react-three/postprocessing`: bloom (glow pickup), subtle chromatic aberration on hit, vignette. One `<EffectComposer />` mounted at scene root.
- **Design tokens file** `apps/client/src/styles/tokens.css` — single source of truth for panel colors, radii, glow intensities, blur strengths. Every HUD surface migrates to these tokens. Grep for inline color literals in `.tsx` should return empty afterwards.
- **Unified "glass" variant** for shadcn-primitive components (`Card`, `Dialog`, `Tooltip`, `Popover`, `Toast`) — translucent backdrop + `backdrop-filter: blur(12px)` + inner glow border.
- **Screen shake + camera effects** via a dedicated `useScreenShake()` hook that drives camera offset for a few frames. Severity tiers: hit (tiny), boss-land (medium), level-up (zoom punch).
- **Particles** via `three-nebula` presets in `apps/client/src/game/fx/presets/` — reusable emitters for level-up burst, pickup trail, mob death, hazard embers, ability-use pulse.
- **Quality tier** respects ADR-0002: mobile skips chromatic aberration + caps particle counts; desktop gets the full stack.

## Key files

**New**
- `apps/client/src/styles/tokens.css` — color + radius + glow + blur tokens.
- `apps/client/src/game/fx/ScreenShake.ts` — hook + camera mutator.
- `apps/client/src/game/fx/presets/{levelUp,pickup,mobDeath,hazardEmber,abilityUse}.ts` — three-nebula emitter presets.
- `apps/client/src/game/fx/PostProcessing.tsx` — EffectComposer + tiered bloom/chromatic/vignette.
- `apps/client/src/game/fx/qualityTier.ts` — per-device tier resolution (desktop/mobile → preset stack).
- `apps/client/src/components/ui/glass.tsx` — shared glass variant applied to `Card`/`Dialog`/etc.

**Edit**
- `apps/client/src/game/Scene.tsx` — mount PostProcessing, load zone `lightingProfile`.
- `apps/client/src/game/zones/*.tsx` — declare `lightingProfile` per zone.
- Every component with inline color styling (`apps/client/src/game/*.tsx`) — migrate to tokens.
- `apps/client/src/components/ui/{card,dialog,tooltip,popover,toast}.tsx` — apply glass variant.
- `apps/client/src/game/GameView.tsx` — wire level-up banner / quest toast / pickup to fx presets.
- `apps/client/src/game/HitVignette.tsx` — trigger screen shake on hit.

## Verify

- Desktop 1440×900: every action produces visible feedback within 100ms (level-up, ability use, hit, pickup, quest complete).
- Mobile 390×812: FPS stays ≥30; particle counts capped; chromatic aberration skipped.
- Grep for inline hex/rgba in `apps/client/src/**/*.tsx` after the migration — should be empty (or only in `tokens.css`).
- Every shadcn panel reads as frosted-glass + glow border.
- Progress bars animate fill transitions (~120ms ease-out).
- Bundle delta ≤200KB gzipped from baseline (flag in PR body).
- Responsive check via `preview_resize` at 360, 768, 1024, 1440, 1920 — no layout breakage.
- Before/after screenshots for ≥6 HUD surfaces in PR body.
- `bun run check` + `bun run typecheck` clean.

## Out of scope

- Cell-shading / outlines (#121 — bundle only if the visual direction overlaps).
- Music + sound design.
- Character model detail.
- Gameplay balance.

## Retro
_(filled after merge)_
