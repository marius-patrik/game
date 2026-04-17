import { useCallback, useEffect, useRef } from "react";

type Options = {
  onLongPress: () => void;
  durationMs?: number;
  /** Max pointer drift (px) before we treat it as a scroll and cancel. */
  movementTolerancePx?: number;
};

/**
 * Generic long-press detector. Fires `onLongPress` after the user holds
 * a pointer down for `durationMs` without moving more than
 * `movementTolerancePx` pixels. Returns pointer handlers to spread onto
 * the target element.
 *
 * Returned `cancel` clears any pending timer — callers use it when a
 * different gesture (double-tap, click) has just consumed the press so
 * the long-press doesn't also fire.
 */
export function useLongPress({ onLongPress, durationMs = 500, movementTolerancePx = 8 }: Options) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      startRef.current = { x: e.clientX, y: e.clientY };
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        onLongPress();
      }, durationMs);
    },
    [onLongPress, durationMs],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = startRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dx * dx + dy * dy > movementTolerancePx * movementTolerancePx) clear();
    },
    [clear, movementTolerancePx],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    cancel: clear,
  };
}
