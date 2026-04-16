# ADR-0002 · Mobile + desktop as first-class targets

**Status:** accepted
**Date:** 2026-04-16

## Context

The game must run well on both desktop browsers and mobile browsers. This is a product invariant, not a "polish later" item. Every UI surface, input system, asset pipeline decision, and performance budget has to respect it from the start.

## Decision

Support two input modalities and two performance tiers as equal citizens:

**Input.** Keyboard + mouse (desktop) and touch (mobile) are both primary. No "desktop first, mobile hack" or vice versa. A single input abstraction maps physical inputs → game actions; the HUD exposes on-screen controls on touch devices and hides them on pointer devices.

**Layout.** HUD and menus use fluid, responsive layouts. Test the two canonical viewports on every UI change:
- Desktop: 1440×900
- Mobile: 390×844 (iPhone 14-ish), portrait

Tailwind breakpoints drive responsive HUD; scene canvas always fills the viewport.

**Performance budgets.** Maintain two budgets:
- Desktop: 60 FPS at 1440p, scene draw calls < 500, texture memory < 256 MB.
- Mobile: 30 FPS at DPR-clamped resolution, scene draw calls < 150, texture memory < 64 MB.

Asset pipeline (Draco, KTX2, LOD) and post-processing are the main levers. Scenes must degrade gracefully — postprocessing off on mobile by default, simpler particle counts, no SSAO.

**Assets.** Every glTF ships with mobile LOD. Every texture ships as KTX2. No unbounded particle counts.

**Networking.** Input sampling rates are client-side and must not assume keyboard-frequency. Anti-cheat (#18) validates movement against per-modality rate limits (touch often produces fewer inputs per second than keyboard).

## Consequences

- All future UI issues must list "mobile viewport tested" in acceptance.
- `#17 Shadcn component set` plan is updated to include responsive/touch variants.
- `#18 Anti-cheat baseline` plan is updated: input rate limits are tiered (desktop vs mobile) or derived from a short warmup rather than a fixed threshold.
- `#20 Asset pipeline` plan is updated: KTX2 + Draco + LOD are required outputs, not optional.
- `#22 Particle FX` plan is updated: particle count is a budget knob, mobile reduces by 4×.
- Cinematics (`#23`) must be skippable and must not exceed mobile budget during playback.
- Admin UI (`/admin/*`) is desktop-first — not gameplay, does not need the same polish.
- FPS and draw-call overlays should be toggleable in dev builds.

Rejected: "desktop only for MVP" — retrofitting mobile responsiveness late is always more expensive than designing with both from day one.
