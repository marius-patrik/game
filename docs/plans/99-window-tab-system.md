# Plan: #99 — Draggable window/tab system (VSCode-style)

**Status:** draft
**Owner agent:** frontend — architect sub-task for ADR
**Branch:** `feat/window-tab-system`

## Context

Shared tab container for Map / Quests / Chat / Info / Inventory / Skills with drag-out / drag-in / reorder behavior akin to VSCode / Chrome tabs.

**Biggest single UI change of the wave.** ADR first, then impl.

## ADR (required, in-PR)

`docs/decisions/0003-window-tab-system.md` — decides the DnD backend:
- **dnd-kit** — modern, tree-shakes well, ~18KB gzipped. Excellent touch/keyboard a11y. First-choice.
- **react-dnd** — canonical but heavier (~45KB) and older API.
- **Native HTML5 DnD** — zero deps but fragile on mobile/touch, poor keyboard a11y.
- **Custom pointer-events** — max flexibility, lots of code surface.

Pick one in the ADR, justify. Expected pick: **dnd-kit** (keeps bundle small + a11y clean).

## Architecture

- `<TabWindow id="tw-left">` — container. Holds a tab bar + content area.
- `<Tab id="map" title="Map">...</Tab>` — registered children.
- `useLayoutStore` — zustand + persist. Shape:
  ```ts
  {
    windows: Record<windowId, { tabs: tabId[], activeTab: tabId, pos?: {x,y}, size?: {w,h}, floating: boolean }>,
    tabs: Record<tabId, { title, iconKey, content: React.ReactNode }>,
  }
  ```
- Drag a tab header → ghost preview. Drop target zones:
  - Another window's tab bar → merge (splice into that window).
  - Empty area of the viewport → creates a floating window at the pointer.
- Floating windows: draggable by title bar, resizable via a corner grip, closable via 'X'. Close = merge back into the original window (remember origin).
- Reorder within a tab bar via sortable drag.

## Mobile behavior

- Detect via `matchMedia("(pointer: coarse)")` — on touch/mobile, disable all drag-out behavior. Tabs behave as simple pill tabs. Layout collapses to a single column — no floating windows.

## Key files

**New**
- `docs/decisions/0003-window-tab-system.md`.
- `apps/client/src/components/ui/tab-window/TabWindow.tsx`.
- `apps/client/src/components/ui/tab-window/Tab.tsx`.
- `apps/client/src/components/ui/tab-window/FloatingWindow.tsx`.
- `apps/client/src/state/layoutStore.ts`.

**Edit**
- `apps/client/src/game/TopLeftPane.tsx` (from #93) — replace its hand-rolled tab switcher with `<TabWindow>` + `<Tab>` children.
- `apps/client/package.json` — add `@dnd-kit/core` + `@dnd-kit/sortable`.

## Verify

- Desktop:
  - Drag Map tab out → becomes a floating window at the drop point.
  - Drag it back onto Info's tab bar → merges (now both tabs share that window).
  - Reorder: drag Chat before Map within the left window → order persists.
  - Reload → exact same layout (positions, grouping, active tab).
- Mobile: tabs behave as plain pills, no drag.
- Bundle diff: `@dnd-kit/core` + `@dnd-kit/sortable` together ≤50KB gzipped. Flag in PR.
- `bun run check` + `bun run typecheck` clean.

## Risks

- **Bundle creep**: verify tree-shaking. If @dnd-kit pulls in more than expected, ADR considers an alternative.
- **Rendering cost**: floating windows are absolutely-positioned; don't re-mount tab content on drag (use portals or keep mounted, toggle visibility).
- **Mobile regression**: a floating window on mobile would be unusable. Guard with the matchMedia check + unit-test the collapsed layout.

## Out of scope

- Save/load layout presets.
- Multi-monitor support.
- Tear-out to OS window.

## Retro
_(filled after merge)_

---

## Resume note — 2026-04-18 re-dispatch

Previous Codex agent was interrupted by transport error mid-run. Partial work on **`origin/feat/draggable-tabs-wip`**.

**First action:**
```bash
git fetch origin
git checkout -b feat/draggable-tabs origin/main
git merge origin/feat/draggable-tabs-wip --no-edit
# resolve any Biome 2.x formatting conflicts in favor of Biome output
bun install
```

Inherited from WIP:
- `docs/decisions/0003-window-tab-system.md` — ADR (check + extend if needed)
- `apps/client/src/components/ui/tab-window/` — new tab-window component dir
- `apps/client/src/state/layoutStore.ts` + `.test.ts` — new persistent layout state
- `apps/client/package.json` + `bun.lock` — new DnD dep (likely @dnd-kit)
- `GameView.tsx`, `TopLeftPane.tsx`, `TopMenu.tsx` — modified

Complete remaining #99 scope per the plan above.
