import { useEffect, useRef } from "react";

type MoveFn = (pos: { x: number; y: number; z: number }) => void;

const SPEED = 4;
const SEND_HZ = 20;
const TICK_HZ = 60;
const BOUNDS = 18;

export function useMovement({
  enabled,
  initial,
  onSend,
}: {
  enabled: boolean;
  initial: { x: number; y: number; z: number };
  onSend: MoveFn;
}) {
  const keys = useRef<Record<string, boolean>>({});
  const pos = useRef({ ...initial });
  const lastPos = useRef({ ...initial });

  useEffect(() => {
    if (!enabled) return;
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let last = performance.now();
    let sinceSend = 0;
    const interval = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const k = keys.current;
      let dx = 0;
      let dz = 0;
      if (k.w || k.arrowup) dz -= 1;
      if (k.s || k.arrowdown) dz += 1;
      if (k.a || k.arrowleft) dx -= 1;
      if (k.d || k.arrowright) dx += 1;
      if (dx || dz) {
        const len = Math.hypot(dx, dz);
        pos.current.x = Math.max(
          -BOUNDS,
          Math.min(BOUNDS, pos.current.x + (dx / len) * SPEED * dt),
        );
        pos.current.z = Math.max(
          -BOUNDS,
          Math.min(BOUNDS, pos.current.z + (dz / len) * SPEED * dt),
        );
      }
      sinceSend += dt;
      const moved =
        Math.abs(pos.current.x - lastPos.current.x) > 0.001 ||
        Math.abs(pos.current.z - lastPos.current.z) > 0.001;
      if (sinceSend >= 1 / SEND_HZ && moved) {
        onSend({ ...pos.current });
        lastPos.current = { ...pos.current };
        sinceSend = 0;
      }
    }, 1000 / TICK_HZ);
    return () => clearInterval(interval);
  }, [enabled, onSend]);

  return pos;
}
