import type { DropSnapshot } from "@/net/useRoom";
import { getItem } from "@game/shared/items";
import { animated, useSpring } from "@react-spring/three";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Color, type Group } from "three";

type Vec3 = { x: number; y: number; z: number };
type PickupIntentMap = Map<string, number>;

const ITEM_COLOR: Record<string, string> = {
  heal_potion: "#ef4444",
  mana_potion: "#38bdf8",
  sword: "#94a3b8",
  greataxe: "#a1a1aa",
  helm: "#f59e0b",
  cuirass: "#fb923c",
  ring_spark: "#a78bfa",
  soul: "#a78bfa",
};

const FLY_DURATION_MS = 350;
const TARGET_Y_OFFSET = 1.2;
const PICKUP_INTENT_TTL_MS = 2000;

/** Single flight instance — springs position toward the moving player, scales
 * down + fades over FLY_DURATION_MS, then asks the parent to drop it. */
export function PickupFly({
  drop,
  selfPosRef,
  onComplete,
}: {
  drop: DropSnapshot;
  selfPosRef: MutableRefObject<Vec3>;
  onComplete: (dropId: string) => void;
}) {
  const [{ t }, api] = useSpring(
    () => ({
      from: { t: 0 },
      to: { t: 1 },
      config: { tension: 220, friction: 26, clamp: true },
      onRest: () => onComplete(drop.id),
    }),
    [drop.id],
  );

  const def = getItem(drop.itemId);
  const isWeapon = def?.kind === "weapon";
  const isArmor = def?.kind === "armor";
  const color = useMemo(() => new Color(ITEM_COLOR[drop.itemId] ?? "#f59e0b"), [drop.itemId]);

  // Straight-line XZ lerp with a parabolic arc on Y. Recomputed each frame so
  // the mesh keeps tracking even if the player moves during the flight.
  const group = useRef<Group>(null);
  const startY = drop.y + 0.4;
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const tv = t.get();
    const tgt = selfPosRef.current;
    const endX = tgt.x;
    const endY = tgt.y + TARGET_Y_OFFSET;
    const endZ = tgt.z;
    const x = drop.x + (endX - drop.x) * tv;
    const z = drop.z + (endZ - drop.z) * tv;
    // Arc peaks ~0.5m above the straight line midpoint.
    const arc = 4 * tv * (1 - tv) * 0.8;
    const y = startY + (endY - startY) * tv + arc;
    g.position.set(x, y, z);
    const scale = 1 - tv;
    g.scale.set(scale, scale, scale);
  });

  // Spin the mesh as it flies for extra juice.
  const meshRef = useRef<Group>(null);
  useFrame((_, dt) => {
    if (meshRef.current) meshRef.current.rotation.y += dt * 8;
  });

  // Defensive: if the parent unmounts us (e.g. zone change) while the spring
  // is running, stop the spring so it can't fire onRest on a stale component.
  useEffect(
    () => () => {
      api.stop();
    },
    [api],
  );

  return (
    <animated.group ref={group}>
      <group ref={meshRef}>
        {isWeapon ? (
          <mesh castShadow>
            <boxGeometry args={[0.18, 0.6, 0.18]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.2}
              metalness={0.5}
              roughness={0.25}
              transparent
              opacity={0.95}
            />
          </mesh>
        ) : isArmor ? (
          <mesh castShadow>
            <boxGeometry args={[0.38, 0.3, 0.22]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.2}
              metalness={0.5}
              roughness={0.25}
              transparent
              opacity={0.95}
            />
          </mesh>
        ) : (
          <mesh castShadow>
            <icosahedronGeometry args={[0.25, 0]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.4}
              metalness={0.5}
              roughness={0.25}
              transparent
              opacity={0.95}
            />
          </mesh>
        )}
      </group>
      <pointLight color={color} intensity={0.8} distance={2.5} />
    </animated.group>
  );
}

/** Track drops that vanished from the server snapshot and schedule a fly
 * animation for each one — the drop disappears server-side on pickup, but we
 * want the visual to play *after* that. */
export function useFlyingDrops(
  drops: Map<string, DropSnapshot>,
  pickupIntentRef?: MutableRefObject<PickupIntentMap>,
): {
  flying: DropSnapshot[];
  complete: (id: string) => void;
} {
  // We retain a fading snapshot of every drop so when the server removes it,
  // we still have its last known position + itemId to animate from.
  const seen = useRef<Map<string, DropSnapshot>>(new Map());
  const [flying, setFlying] = useState<DropSnapshot[]>([]);

  useEffect(() => {
    const prev = seen.current;
    const next = new Map<string, DropSnapshot>();
    const now = Date.now();
    for (const [id, d] of drops) {
      next.set(id, d);
    }
    if (pickupIntentRef) {
      for (const [id, at] of pickupIntentRef.current) {
        if (now - at > PICKUP_INTENT_TTL_MS) pickupIntentRef.current.delete(id);
      }
    }
    // Drops in prev that are absent from next → just despawned; queue flight.
    const toFly: DropSnapshot[] = [];
    for (const [id, d] of prev) {
      if (!next.has(id) && pickupIntentRef?.current.has(id)) {
        toFly.push(d);
        pickupIntentRef.current.delete(id);
      }
    }
    seen.current = next;
    if (toFly.length > 0) {
      setFlying((list) => {
        const existingIds = new Set(list.map((f) => f.id));
        const additions = toFly.filter((d) => !existingIds.has(d.id));
        if (additions.length === 0) return list;
        return [...list, ...additions];
      });
    }
  }, [drops, pickupIntentRef]);

  const complete = useCallback((id: string) => {
    setFlying((list) => list.filter((f) => f.id !== id));
  }, []);

  return { flying, complete };
}

export const PICKUP_FLY_DURATION_MS = FLY_DURATION_MS;
