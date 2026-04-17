import type { DropSnapshot } from "@/net/useRoom";
import { type MutableRefObject, useEffect, useRef } from "react";

type Vec3 = { x: number; y: number; z: number };

const PICKUP_RADIUS = 1.2;

/** Trigger `onPickup` for any drop the local player walks into. Debounced per drop
 * so we don't spam the server while the drop animation lingers. */
export function useAutoPickup({
  enabled,
  drops,
  selfPosRef,
  onPickup,
}: {
  enabled: boolean;
  drops: Map<string, DropSnapshot>;
  selfPosRef: MutableRefObject<Vec3> | undefined;
  onPickup: (dropId: string) => void;
}) {
  const pickedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    const r2 = PICKUP_RADIUS * PICKUP_RADIUS;
    const id = setInterval(() => {
      const self = selfPosRef?.current;
      if (!self) return;
      for (const d of drops.values()) {
        const dx = d.x - self.x;
        const dz = d.z - self.z;
        if (dx * dx + dz * dz <= r2 && !pickedRef.current.has(d.id)) {
          pickedRef.current.add(d.id);
          onPickup(d.id);
          // server removes the drop on success; prune local ids for ones that are
          // no longer present so we don't leak memory forever.
          setTimeout(() => pickedRef.current.delete(d.id), 2000);
        }
      }
    }, 120);
    return () => clearInterval(id);
  }, [enabled, drops, selfPosRef, onPickup]);
}
