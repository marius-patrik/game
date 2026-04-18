# ADR-0003 · Draggable window/tab system backend

**Status:** accepted
**Date:** 2026-04-18

## Context

Issue #99 replaces the fixed TopLeftPane tab switcher with a persistent window/tab system: tabs reorder within a bar, drag out into floating panels, merge back into another window, and restore after reload.

The drag backend has to satisfy four constraints at once:

- Keep the client bundle impact modest.
- Work cleanly with React 18 and the repo's existing HUD component model.
- Preserve keyboard-friendly sortable interactions where practical.
- Respect ADR-0002 by degrading to a non-floating mobile/coarse-pointer layout instead of shipping a fragile touch drag experience.

## Decision

Use **dnd-kit** for tab drag-and-drop and keep floating-window move/resize as small local pointer handlers.

Why this split:

- `dnd-kit` gives sortable tab bars, cross-window drops, drag overlays, and keyboard sensor support without the weight and indirection of `react-dnd`.
- Native HTML5 drag-and-drop is a poor fit for this HUD. It behaves inconsistently across browsers, has weak touch support, and would fight custom tab ghosts and window merging.
- A full custom pointer-only DnD system would duplicate solved collision/sorting work and expand the maintenance surface for the biggest HUD change in the wave.
- Floating window movement/resizing is simpler than tab sorting. Keeping that part local avoids adding more dependencies than the actual tab problem needs.

On coarse-pointer/mobile devices, the system intentionally disables drag-out and floating windows. Tabs collapse back to the existing pill-style single-column interaction. This keeps the feature usable on touch without forcing an awkward mobile drag UX.

## Consequences

- `apps/client/package.json` carries `@dnd-kit/core` and `@dnd-kit/sortable`.
- Persistent layout state lives in a dedicated zustand store keyed by layout id. Tabs are stored as ids only; rendered content stays in React.
- The desktop HUD now has two interaction layers:
  - `dnd-kit` for tab reorder / merge / drag-out.
  - lightweight pointer handlers for floating-window move / resize.
- Closed single-tab floating panels restore from the top-right tracker menu instead of disappearing from the layout permanently.
- Mobile behavior remains intentionally simpler than desktop. Any future request for touch drag-out would require a separate acceptance pass, not a silent expansion of this ADR.

## Rejected alternatives

**`react-dnd`**
Rejected because it is heavier than needed for this repo's current HUD surface and brings a more adapter-heavy API for a single tab/window cluster.

**Native HTML5 drag-and-drop**
Rejected because touch/mobile behavior is too brittle and custom drag ghost behavior is awkward.

**Custom pointer-events tab DnD**
Rejected because the sorting and collision logic would be bespoke, large, and easy to regress.
