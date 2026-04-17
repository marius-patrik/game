# Plan: #108 — Custom 3D cursor + reusable ground-targeting system

**Status:** shipped
**Owner agent:** frontend
**Branch:** `feat/cursor-targeting`

## Context

The 3D scene currently uses the system cursor; clicks show only a small yellow ring at the destination. Two gaps:

1. No tactile feedback at the cursor itself — nothing tells the player "here is where I'm pointing" while the mouse hovers.
2. No reusable "cast-in-space" targeting primitive. Dash today is a facing-direction blink (`skill.range` from `lastPos` delta) — it ignores where the player is actually looking.

This PR ships the cursor + targeting primitives in one go so the next ability batch (#98 meteor/blink/AOE) can slot in without rearchitecting.

Runs in parallel with #96 (character system) — no file overlap.

## Approach

### 3D cursor

- **`apps/client/src/game/cursor/Cursor3D.tsx`** — R3F component mounted inside `<Scene>`.
  - Reads `screenCursor` state from `cursorStore` (mouse coords in CSS pixels, or canvas center when pointer is locked).
  - Every frame: builds an NDC ray via `useThree().raycaster`, intersects an implicit `y=0` plane, writes the resulting world pos into the same store as `groundCursor`.
  - Renders a small always-visible 3D crosshair at the ground position: thin ring + cardinal ticks; tone-mapped off so it reads clean on dark grounds.
- **`cursorStore.ts`** — tiny vanilla subscribe/snapshot store (same pattern as `cameraProfiles.ts`). Holds `{ screen: {x,y}, ground: {x,y,z} | null, locked: boolean }`. No zustand — it's three fields, pure ref reads in the hot path.
- **System cursor hide** — CSS rule on `[data-theme="game"] canvas, [data-theme="game"] [data-cursor-hide]` → `cursor: none`. Scoped so shadcn/HUD overlays still get the OS pointer.
- **Screen-center mode** — when `document.pointerLockElement === document.body`, the store writes `{ x: innerWidth/2, y: innerHeight/2 }`; otherwise it follows `mousemove`. One listener at the window level.

### Click animation

- **`apps/client/src/game/cursor/ClickBurst.tsx`** — R3F component. Listens on `gl.domElement` for `pointerdown`. On each click, spawns a ripple ring (radius 0 → 1.2m over 350ms, fade out) plus a 14-spark particle burst at the **current ground cursor**. Recycles buffers — cap at 8 concurrent bursts.

### Targeting module

- **`apps/client/src/game/targeting/targetingStore.ts`** — similar subscribe store holding the currently active request: `{ active: boolean, shape: 'circle'|'cone'|'rect', rangeMax, rangeMin, origin: Vec3, onConfirm: (pos)=>void, onCancel: ()=>void }`.
- **`useTargeting.ts`** — public hook:
  - `useTargetingActive()` → boolean, for callers that need to suppress other clicks (ground-click move).
  - `startTargeting(opts)` → imperative; sets store active. Returns a cancel token.
  - Internally mounts window-level listeners for Escape (cancel), right-click (cancel), left-click (confirm). Listeners are mounted **only while active** and torn down on cancel/confirm.
  - Mobile: treats first tap inside the canvas as "preview" (already visible via ground cursor), second tap as confirm. Right-click equivalent is a dedicated HUD "cancel" button OR long-press — we go with two-finger tap / a pointer-down → pointerup within 150ms on a second touch. Simpler: keep it as "tap canvas → confirm; tap outside / press cancel button → cancel." HUD ability button already has a cancel state.
- **`Targeter.tsx`** — R3F component. Reads targeting store. When `active`:
  - `shape === 'circle'`: renders a range disc (translucent, at ground) + a reticule ring at the clamped cursor pos. Reticule goes red if cursor is out of range; we **clamp to range edge** (not reject) — click confirms the clamped pos. Documented choice below.
  - `shape === 'cone'`: renders wedge from `origin` toward cursor, spanning `params.angleDeg`.
  - `shape === 'rect'`: renders an axis-aligned rectangle centered on cursor with `params.width/height`.
  - Only `circle` is used in this PR. `cone` + `rect` exist as stubs so #98 can wire meteor (circle) / cleave-aoe (cone) / line-skill (rect) without hook changes.
- **`MoveCircle.tsx`** — always-on subtle ring at `cursorStore.ground`; rotates slowly, subtle white with slight blue inner. Rendered inside `<Scene>` even when targeter inactive.
- **`DashTargeter` / ActionBar wiring** — in `ActionBar.tsx`, when the player clicks the Dash button (or presses hotkey), call `startTargeting({ shape:'circle', rangeMax: SKILL_CATALOG.dash.range, origin: selfPos, onConfirm: pos => room.send('cast', { skillId:'dash', target: pos }) })`. The existing cooldown tracking stays in ActionBar — but we move the "mark on cooldown" step to fire on `onConfirm`, not on initial click, so cancelling dash doesn't burn the cooldown.

### Server: range-validated target dash

- `packages/shared/src/skills.ts` — no schema change needed; only types.
- `apps/server/src/rooms/GameRoom.ts` — `CastMessage` gets `target?: Vec3`. `handleCast` dash branch: if target provided and within `skill.range + 0.25` (epsilon), move to target (clamped to zone bounds); otherwise fall back to the existing facing-direction blink (keyboard hotkey path without targeter). This keeps backward-compat with the existing hotkey flow and gives the targeter the behaviour the issue specifies.

### Out-of-range policy

**Choice: clamp to max-range edge + red reticule during hover.** Rejecting out-of-range clicks feels punishing and confuses touch users; clamping preserves intent. The red hover tint remains so the player sees that the final landing spot isn't where their cursor is.

### Cursor-lock coexistence

- With Ctrl-lock ON: system cursor is captured. `cursorStore.locked` is true. `Cursor3D` uses screen-center as the source ray, so the 3D cursor is always dead-center; yaw on the chase camera orbits the view around it. Ground projection is camera-centered — exactly what a FPS / MMO cam-lock expects.
- With Ctrl-lock OFF: normal mouse follow.
- Transitions fire from the existing `pointerlockchange` listener; no new plumbing.

### Files

**New**
- `apps/client/src/game/cursor/cursorStore.ts`
- `apps/client/src/game/cursor/Cursor3D.tsx`
- `apps/client/src/game/cursor/ClickBurst.tsx`
- `apps/client/src/game/targeting/targetingStore.ts`
- `apps/client/src/game/targeting/useTargeting.ts`
- `apps/client/src/game/targeting/Targeter.tsx`
- `apps/client/src/game/targeting/MoveCircle.tsx`
- `apps/client/src/game/targeting/shapes.ts` — shape-specific renderers (`CircleTargeter`, `ConeTargeter`, `RectTargeter`).
- `apps/client/src/game/targeting/index.ts` — barrel.

**Edit**
- `apps/client/src/game/Scene.tsx` — mount `<Cursor3D />`, `<ClickBurst />`, `<MoveCircle />`, `<Targeter />`; guard `onGroundClick` against firing when targeter is active.
- `apps/client/src/game/ActionBar.tsx` — rewire `cast("dash")` through targeter; keep direct cast for hotkey as the no-target fallback (also works when no cursor target — rare).
- `apps/client/src/styles/globals.css` — hide system cursor inside `[data-theme="game"]`.
- `apps/server/src/rooms/GameRoom.ts` — accept optional target on cast; validate range; dash to clamped pos.
- `apps/server/src/rooms/GameRoom.ts` — `CastMessage` type extended.
- `apps/client/src/game/GameView.tsx` — pass `selfPosRef` into `ActionBar` so dash targeter can read origin.

**Tests (none)** — no test runner yet per CLAUDE.md. Verified via preview smoke.

## Tradeoffs

- Two tiny vanilla stores (cursorStore, targetingStore) rather than zustand — hot path is per-frame ref reads, and we already use the same subscribe pattern in cameraProfiles. Avoids forcing every scene component through zustand + re-renders.
- Shape-polymorphic Targeter instead of one component per shape — easier to add shapes and matches the "reusable" brief.
- `clamp-to-edge` instead of `reject-out-of-range` — preserves user intent, fewer re-tries.
- Dash hotkey keeps its facing-direction fallback so it remains usable without aiming (e.g. mid-panic). Targeter is the preferred path from the ability bar.

## Retro

- **Landed as designed.** `useTargeting` + `Targeter` + `MoveCircle` + `Cursor3D` + `ClickBurst` + range-validated server dash all shipped together. Preview-verified: blue range ring, reticule, click-to-confirm (player dashed + mana dropped), right-click / Escape cancel, ability-button toggle.
- **Gotcha #1 (file extension):** Initially wrote `shapes.ts` with JSX inside — SWC treats `.ts` as non-JSX. Renamed to `.tsx`. Typecheck caught it quickly but the stale HMR bundle lingered in the browser with scary-looking errors. Lesson: rename → hard reload.
- **Gotcha #2 (cursor-lock click path):** With pointer lock ON the system pointer is frozen at the lock entry point, so R3F's `e.point` on the ground mesh is stale. Had to branch in `Scene.tsx` to use the shared ground-cursor ray when `peekLocked()` is true — otherwise move-to-here clicks in cam-lock mode would always land on the same spot. Worth capturing in pitfalls.md for the next ability PR that uses `e.point`.
- **Gotcha #3 (ability button cancel while aiming):** Disabled buttons don't fire `onClick`, which killed the "click dash again to cancel" toggle on desktop. Fix was to make the button stay enabled while aiming and branch on source. Keeps the UX symmetric with the Escape and right-click cancels.
- Reusability pay-off will land in #98: `ConeTargeter` and `RectTargeter` render paths are wired but unused; new ability just calls `startTargeting({ shape: 'cone', ... })` and the hook + handlers are unchanged.
