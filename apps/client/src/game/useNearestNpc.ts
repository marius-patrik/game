import { type MutableRefObject, useEffect, useState } from "react";
import type { NpcSnapshot } from "@/net/useRoom";

type Vec3 = { x: number; y: number; z: number };

const TALK_RADIUS = 2.2;

/** Returns the NPC id that's currently in range of the local player, or undefined. */
export function useNearestNpc({
  enabled,
  npcs,
  selfPosRef,
}: {
  enabled: boolean;
  npcs: Map<string, NpcSnapshot>;
  selfPosRef: MutableRefObject<Vec3> | undefined;
}): NpcSnapshot | undefined {
  const [nearest, setNearest] = useState<NpcSnapshot | undefined>();

  useEffect(() => {
    if (!enabled) {
      setNearest(undefined);
      return;
    }
    const r2 = TALK_RADIUS * TALK_RADIUS;
    const id = setInterval(() => {
      const self = selfPosRef?.current;
      if (!self) return;
      let best: NpcSnapshot | undefined;
      let bestD = r2;
      for (const n of npcs.values()) {
        const dx = n.x - self.x;
        const dz = n.z - self.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      setNearest((prev) => (prev?.id === best?.id ? prev : best));
    }, 150);
    return () => clearInterval(id);
  }, [enabled, npcs, selfPosRef]);

  return nearest;
}
