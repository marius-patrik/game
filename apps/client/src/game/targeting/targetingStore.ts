/**
 * Imperative store for the currently active "cast-in-space" targeting
 * request. At most one request is active at a time — starting a new one
 * implicitly cancels any prior (`cancelActiveTargeting()` is called by
 * `startTargeting`). Pattern mirrors the vanilla subscribe/snapshot used
 * in `cameraProfiles.ts` and `cursorStore.ts`.
 */
import { useSyncExternalStore } from "react";

type Vec3 = { x: number; y: number; z: number };

export type TargeterShape = "circle" | "cone" | "rect";

export type TargeterRequest = {
  /** Caller-supplied identity string (e.g. skill id) — used to dedupe
   * `startTargeting` from an ability that's already mid-aim. */
  source: string;
  shape: TargeterShape;
  rangeMax: number;
  rangeMin: number;
  /** Circle: unused. Cone: half-angle in radians. Rect: width. */
  paramA: number;
  /** Cone/rect: length along ray. */
  paramB: number;
  color: string;
  outOfRangeColor: string;
  /** Resolved with the (possibly range-clamped) target position. */
  onConfirm: (pos: Vec3) => void;
  /** Called when user cancels via Escape, right-click, or an overriding
   * `startTargeting()` request. */
  onCancel: () => void;
};

export type TargeterStartOptions = Omit<Partial<TargeterRequest>, "onConfirm" | "source"> & {
  source: string;
  shape: TargeterShape;
  onConfirm: (pos: Vec3) => void;
};

const DEFAULT: Omit<TargeterRequest, "source" | "shape" | "onConfirm"> = {
  rangeMax: 6,
  rangeMin: 0,
  paramA: 0,
  paramB: 0,
  color: "#38bdf8",
  outOfRangeColor: "#ef4444",
  onCancel: () => {},
};

let active: TargeterRequest | null = null;
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

function snapshotActive(): TargeterRequest | null {
  return active;
}

function snapshotActiveSource(): string | null {
  return active ? active.source : null;
}

export function peekActive(): TargeterRequest | null {
  return active;
}

/** Replaces any currently active targeting request with a new one. The old
 * request's `onCancel` fires so abilities can clean up cooldown reservations. */
export function startTargeting(opts: TargeterStartOptions): void {
  if (active) {
    try {
      active.onCancel();
    } catch {
      // Caller's cancel handler should not be able to corrupt store state.
    }
  }
  const next: TargeterRequest = {
    ...DEFAULT,
    ...opts,
    onCancel: opts.onCancel ?? DEFAULT.onCancel,
  };
  active = next;
  emit();
}

export function cancelActiveTargeting(): void {
  if (!active) return;
  const req = active;
  active = null;
  emit();
  try {
    req.onCancel();
  } catch {
    // Swallow handler throws — the store has already cleared.
  }
}

export function confirmActiveTargeting(pos: Vec3): void {
  if (!active) return;
  const req = active;
  active = null;
  emit();
  try {
    req.onConfirm(pos);
  } catch {
    // Ditto.
  }
}

/** React hook — returns the full active request object. Re-renders only
 * when the active request changes identity (start/confirm/cancel), not on
 * mouse moves. */
export function useActiveTargeting(): TargeterRequest | null {
  return useSyncExternalStore(subscribe, snapshotActive, () => null);
}

/** React hook — returns just the active source id. Use in non-rendering
 * consumers like click-to-move guards to minimise renders. */
export function useActiveTargetingSource(): string | null {
  return useSyncExternalStore(subscribe, snapshotActiveSource, () => null);
}
