import { readMoveIntent } from "@/input/intentStore";
import type { MoveIntent } from "@/input/types";
import { useKeyboardSource } from "@/input/useKeyboardSource";
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
  const pos = useRef({ ...initial });
  const lastPos = useRef({ ...initial });

  useKeyboardSource(enabled);

  useEffect(() => {
    if (!enabled) return;
    let last = performance.now();
    let sinceSend = 0;
    const intent: MoveIntent = { x: 0, z: 0 };
    const interval = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      readMoveIntent(intent);
      if (intent.x || intent.z) {
        pos.current.x = Math.max(-BOUNDS, Math.min(BOUNDS, pos.current.x + intent.x * SPEED * dt));
        pos.current.z = Math.max(-BOUNDS, Math.min(BOUNDS, pos.current.z + intent.z * SPEED * dt));
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
