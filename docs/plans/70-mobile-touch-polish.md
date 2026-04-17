# Plan: #70 — Mobile touch polish (ADR-0002)

**Status:** shipped
**Owner agent:** frontend
**Branch:** `feat/mobile-touch-polish`

## Context
Alpha-polish landed all the gameplay + HUD features, but touch UX at 390×844 is thin: inventory slots rely on hover, tooltips don't render on tap, ActionBar crowds the chat keyboard. ADR-0002 makes mobile a first-class target — this PR brings touch parity without regressing desktop.

## Chosen approach
- Dual-handler on each `ActionBar` inventory slot: `onClick` (keeps desktop hover semantics) + `onPointerDown` starts a long-press timer; double-tap within 300ms triggers equip/use via `dispatchItem()`; 500ms hold opens the item tooltip drawer.
- Bottom-sheet tooltip uses `vaul` (already in `package.json` per pitfalls / existing deps — confirm before adding). Shows slot + stat bonuses + drop/equip/use footer.
- `SidePanel` detects `VisualViewport.height` shrinking (keyboard up) and auto-collapses when the chat tab is active.
- Narrow-viewport fixes: ProgressBar uses `max-w-full` + truncate, QuestTracker stacks vertically at <480px, HitVignette opacity caps so it doesn't over-saturate small screens.

## File impact

**Client (`apps/client/src/game/`)**
- `ActionBar.tsx` — **edit**: per-slot handlers (single-tap tooltip, double-tap equip/use, long-press drawer). Track last-tap time per slot in a ref.
- `ItemTooltipDrawer.tsx` — **new**: `vaul` `Drawer.Root` rendering inside a portal; receives `itemId` + action callbacks. Use existing `getItem(itemId)` for stats.
- `SidePanel.tsx` — **edit**: subscribe to `window.visualViewport` resize; on shrink when `tab === "chat"`, collapse automatically. Restore on keyboard dismiss.
- `ProgressBar.tsx`, `QuestTracker.tsx`, `HitVignette.tsx`, `LevelUpBanner.tsx` — **edit**: narrow-viewport class fixes (`max-w-[90vw]`, `text-[10px]` fallbacks, `min-w-0` on flex children).

**Utility (`apps/client/src/lib/`)**
- `useLongPress.ts` (new, optional) — generic hook returning `{ onPointerDown, onPointerUp, onPointerLeave, onPointerCancel }` wired to a configurable `durationMs`. Cancel on movement > 8px to avoid triggering while scrolling.

**Shared** — none.

## Risks / unknowns
- `vaul` may not be installed. Check `apps/client/package.json`; if missing, either add (small dep) or fall back to a shadcn Sheet. `vaul` is preferable for bottom-sheet feel on mobile.
- Double-tap threshold — 300ms standard, but tune if QA (manual preview at 390×844) shows false triggers.
- Don't break shadcn Button opt-in sfx wiring added in #65 — the inventory slots aren't shadcn Buttons but raw divs, so no conflict expected.

## Acceptance mapping
1. ✅ Double-tap equip/use — `ActionBar.tsx` per-slot pointer logic.
2. ✅ Long-press tooltip drawer — `ItemTooltipDrawer.tsx` + `useLongPress.ts`.
3. ✅ Chat keyboard doesn't hide ActionBar — `SidePanel.tsx` auto-collapse on viewport shrink.
4. ✅ 390×844 layout fits — narrow-viewport class fixes across HUD components.
5. ✅ 1440×900 desktop parity — verify hover still opens tooltip, no regression on click-to-equip.
6. ✅ Biome + typecheck clean.

## Out of scope
- Swipe to switch SidePanel tabs
- Haptic feedback API
- Landscape-orientation layout

## Retro
_(filled after merge)_
