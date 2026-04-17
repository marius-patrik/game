import { useEffect } from "react";
import { peekGround } from "../cursor/cursorStore";
import {
  type TargeterStartOptions,
  cancelActiveTargeting,
  confirmActiveTargeting,
  peekActive,
  startTargeting as startTargetingStore,
  useActiveTargetingSource,
} from "./targetingStore";

type Vec3 = { x: number; y: number; z: number };

function clampToRange(origin: Vec3, target: Vec3, rangeMax: number): Vec3 {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= rangeMax || dist === 0) return { x: target.x, y: target.y, z: target.z };
  const scale = rangeMax / dist;
  return { x: origin.x + dx * scale, y: target.y, z: origin.z + dz * scale };
}

type OriginSource = () => Vec3;

type UseTargetingInputHandlersOpts = {
  /** Origin (typically the self-player position) used to clamp confirm
   * positions to rangeMax. The function is evaluated at confirm time so
   * the dash origin reflects the player's current pos, not the spot they
   * stood in when the targeter opened. */
  getOrigin: OriginSource;
};

/**
 * Mounts global input listeners for active targeting requests. Must be
 * rendered exactly once per `GameView`. Handles:
 *  - Left-click / touch: confirm at current cursor position (clamped to
 *    range and bounds — callers stay oblivious).
 *  - Right-click: cancel. Also stops the browser context menu when a
 *    targeter is active.
 *  - Escape key: cancel.
 *
 * The listeners are attached only when a request is active, so
 * non-targeting gameplay is unaffected.
 */
export function useTargetingInputHandlers({ getOrigin }: UseTargetingInputHandlersOpts): void {
  const source = useActiveTargetingSource();

  useEffect(() => {
    if (source == null) return;

    const onPointerDown = (e: PointerEvent) => {
      const req = peekActive();
      if (!req) return;
      const ground = peekGround();
      if (!ground) return;
      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
        cancelActiveTargeting();
        return;
      }
      if (e.button !== 0) return;
      // Clamp to rangeMax against the origin at confirm time.
      const origin = getOrigin();
      const clamped = clampToRange(origin, ground, req.rangeMax);
      // Don't stop propagation for left-click — downstream ground click
      // handlers are expected to skip when a targeter is active.
      confirmActiveTargeting(clamped);
    };

    const onContextMenu = (e: Event) => {
      e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const req = peekActive();
      if (!req) return;
      e.preventDefault();
      cancelActiveTargeting();
    };

    // `capture: true` so we see clicks before scene mesh handlers, and can
    // consume right-click cancels before contextmenu hits them.
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("contextmenu", onContextMenu, { capture: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("contextmenu", onContextMenu, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("keydown", onKey);
    };
  }, [source, getOrigin]);
}

/** Imperative API for ability callers. */
export function startTargeting(opts: TargeterStartOptions): void {
  startTargetingStore(opts);
}

/** Imperative cancel — used by ability callers to clear the targeter
 * when its trigger key is pressed a second time, etc. */
export function cancelTargeting(): void {
  cancelActiveTargeting();
}

export { useActiveTargetingSource };
