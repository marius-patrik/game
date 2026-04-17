/**
 * Camera arm + tilt presets. The game declares which profile is active; the
 * user only controls Y-rotation (yaw) via mouse drag or pointer-lock.
 *
 * - `arm`    — distance from the chase target in meters.
 * - `tilt`   — polar angle from vertical in radians (smaller = higher-angle top-down).
 * - `height` — vertical offset of the chase target above the player's feet.
 */
export type CameraProfileId = "combat" | "dialog" | "wide";

export type CameraProfile = {
  arm: number;
  tilt: number;
  height: number;
};

const DEG = Math.PI / 180;

export const CAMERA_PROFILES: Record<CameraProfileId, CameraProfile> = {
  combat: { arm: 6, tilt: 55 * DEG, height: 1.1 },
  dialog: { arm: 3, tilt: 70 * DEG, height: 1.3 },
  wide: { arm: 10, tilt: 45 * DEG, height: 1.1 },
};

/**
 * Transition duration (ms) when `setCameraProfile` is called without an
 * explicit override. Chosen to feel snappy but never jarring.
 */
export const DEFAULT_CAMERA_TRANSITION_MS = 650;

type ProfileState = {
  id: CameraProfileId;
  transitionMs: number;
  changedAt: number;
};

type Listener = (state: ProfileState) => void;

const listeners = new Set<Listener>();
let state: ProfileState = {
  id: "combat",
  transitionMs: 0,
  changedAt: 0,
};

export function getCameraProfileState(): ProfileState {
  return state;
}

export function setCameraProfile(id: CameraProfileId, transitionMs?: number): void {
  if (state.id === id) return;
  state = {
    id,
    transitionMs: transitionMs ?? DEFAULT_CAMERA_TRANSITION_MS,
    changedAt: performance.now(),
  };
  for (const fn of listeners) fn(state);
}

export function subscribeCameraProfile(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== "undefined") {
  // Dev hook: the verification plan calls `setCameraProfile("dialog")` from
  // the preview console to smoke-test the transition. Exposing it on
  // `window` keeps dev access one-line without shipping any new UI.
  (window as unknown as { setCameraProfile?: typeof setCameraProfile }).setCameraProfile =
    setCameraProfile;
}
