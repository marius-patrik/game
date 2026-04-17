import { type Zone, clampToBounds } from "@game/shared";
import { useEffect, useRef } from "react";

type Vec3 = { x: number; y: number; z: number };
type MoveFn = (pos: Vec3) => void;

const SPEED = 4.5;
const SEND_HZ = 20;
const TICK_HZ = 60;
const ARRIVE_EPSILON = 0.06;

/**
 * Drives the local player's position toward a caller-owned `moveTarget`.
 *
 * Every tick, the hook lerps the local position toward the target at
 * {@link SPEED} u/s and sends keyframes to the server at {@link SEND_HZ}.
 * When the target is reached (within {@link ARRIVE_EPSILON}) the hook
 * calls `onArrive`. The local position is clamped to `zone.bounds`.
 *
 * `initial` is a snapshot of the authoritative spawn — whenever it
 * changes (zone swap, respawn) the local position resyncs to it and the
 * current move target is dropped.
 */
export function useClickControls({
  enabled,
  initial,
  zone,
  moveTarget,
  onArrive,
  onSend,
}: {
  enabled: boolean;
  initial: Vec3;
  zone: Zone;
  moveTarget: Vec3 | null;
  onArrive: () => void;
  onSend: MoveFn;
}): void {
  const pos = useRef<Vec3>({ ...initial });
  const lastSent = useRef<Vec3>({ ...initial });

  const initialKey = `${initial.x}|${initial.y}|${initial.z}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally resync only on spawn/zone change
  useEffect(() => {
    pos.current = { ...initial };
    lastSent.current = { ...initial };
  }, [initialKey]);

  useEffect(() => {
    if (!enabled) return;
    let last = performance.now();
    let sinceSend = 0;
    const interval = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (moveTarget) {
        const dx = moveTarget.x - pos.current.x;
        const dz = moveTarget.z - pos.current.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= ARRIVE_EPSILON) {
          onArrive();
        } else {
          const step = Math.min(SPEED * dt, dist);
          pos.current.x += (dx / dist) * step;
          pos.current.z += (dz / dist) * step;
          const clamped = clampToBounds(pos.current, zone);
          pos.current.x = clamped.x;
          pos.current.z = clamped.z;
        }
      }

      sinceSend += dt;
      const moved =
        Math.abs(pos.current.x - lastSent.current.x) > 0.001 ||
        Math.abs(pos.current.z - lastSent.current.z) > 0.001;
      if (sinceSend >= 1 / SEND_HZ && moved) {
        onSend({ ...pos.current });
        lastSent.current = { ...pos.current };
        sinceSend = 0;
      }
    }, 1000 / TICK_HZ);
    return () => clearInterval(interval);
  }, [enabled, onSend, onArrive, zone, moveTarget]);
}
