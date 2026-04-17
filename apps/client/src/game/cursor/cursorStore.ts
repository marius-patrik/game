/**
 * Global (per-tab) cursor state shared between the 3D cursor component and
 * consumers (targeting, click-to-move, click-burst). Not a zustand store —
 * the hot path is per-frame ref reads from R3F components, and we only need
 * a minimal subscribe/snapshot pair.
 *
 * - `screen`: last known CSS-pixel cursor position. When pointer lock is
 *   active this always reports the viewport centre so the 3D cursor lives
 *   dead-centre of the camera.
 * - `ground`: latest ground-plane (y=0) projection of the cursor ray.
 *   Written every frame by `Cursor3D`. Consumers read the mutable ref
 *   directly via `peekGround()` — no React renders per frame.
 * - `locked`: true when `document.pointerLockElement === document.body`,
 *   reflects the ChaseCamera's cursor-lock mode.
 */
import { useSyncExternalStore } from "react";

type Vec2 = { x: number; y: number };
type Vec3 = { x: number; y: number; z: number };

type CursorState = {
  screen: Vec2;
  ground: Vec3 | null;
  locked: boolean;
};

const state: CursorState = {
  screen: { x: 0, y: 0 },
  ground: null,
  locked: false,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function snapshot(): CursorState {
  return state;
}

/** Write the screen-space cursor position. Triggers React subscribers. */
export function setScreenCursor(x: number, y: number): void {
  if (state.screen.x === x && state.screen.y === y) return;
  state.screen = { x, y };
  emit();
}

/** Write the latest ground projection. Mutates in place and does NOT
 * emit — called every frame by Cursor3D. Consumers that need the value
 * each frame read `peekGround()` directly (no React re-render). */
export function setGroundCursor(pos: Vec3 | null): void {
  if (pos === null) {
    if (state.ground === null) return;
    state.ground = null;
    emit();
    return;
  }
  if (state.ground === null) {
    state.ground = { x: pos.x, y: pos.y, z: pos.z };
    emit();
    return;
  }
  state.ground.x = pos.x;
  state.ground.y = pos.y;
  state.ground.z = pos.z;
}

/** Write the current pointer-lock state. */
export function setCursorLocked(locked: boolean): void {
  if (state.locked === locked) return;
  state.locked = locked;
  emit();
}

/** Read the current ground cursor without subscribing (hot-path safe). */
export function peekGround(): Vec3 | null {
  return state.ground;
}

/** Read the current screen cursor without subscribing. */
export function peekScreen(): Vec2 {
  return state.screen;
}

/** Read the current lock state without subscribing. */
export function peekLocked(): boolean {
  return state.locked;
}

/** React hook for components that need to re-render on cursor-lock flip. */
export function useCursorLockedReactive(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => snapshot().locked,
    () => false,
  );
}
