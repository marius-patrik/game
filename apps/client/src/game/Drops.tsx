import type { DropSnapshot } from "@/net/useRoom";
import { getItem } from "@game/shared/items";
import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useMemo, useRef } from "react";
import { Color, type Mesh } from "three";
import { PickupFly, useFlyingDrops } from "./PickupFly";

type Vec3 = { x: number; y: number; z: number };

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

function DropMarker({
  drop,
  onPickup,
}: {
  drop: DropSnapshot;
  onPickup: (dropId: string) => void;
}) {
  const meshRef = useRef<Mesh>(null);
  const color = useMemo(() => new Color(ITEM_COLOR[drop.itemId] ?? "#f59e0b"), [drop.itemId]);
  const def = getItem(drop.itemId);
  const isWeapon = def?.kind === "weapon";
  const isArmor = def?.kind === "armor";

  useFrame((_, dt) => {
    if (meshRef.current) meshRef.current.rotation.y += dt * 1.8;
  });

  return (
    <Float speed={2} floatIntensity={0.4} rotationIntensity={0}>
      <group position={[drop.x, drop.y + 0.4, drop.z]}>
        <mesh
          ref={meshRef}
          castShadow
          onPointerDown={(e) => {
            e.stopPropagation();
            onPickup(drop.id);
          }}
        >
          {isWeapon ? (
            <boxGeometry args={[0.18, 0.6, 0.18]} />
          ) : isArmor ? (
            <boxGeometry args={[0.38, 0.3, 0.22]} />
          ) : (
            <icosahedronGeometry args={[0.25, 0]} />
          )}
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            metalness={0.5}
            roughness={0.25}
          />
        </mesh>
        <pointLight color={color} intensity={0.6} distance={2.5} />
      </group>
    </Float>
  );
}

export function Drops({
  drops,
  selfPosRef,
  onPickup,
}: {
  drops: Map<string, DropSnapshot>;
  selfPosRef?: MutableRefObject<Vec3>;
  onPickup: (dropId: string) => void;
}) {
  // Ghost entries for drops that despawned server-side — kept alive locally
  // for the fly-to-player animation duration so the item never just "pops".
  const { flying, complete } = useFlyingDrops(drops);

  return (
    <>
      {[...drops.values()].map((d) => (
        <DropMarker key={d.id} drop={d} onPickup={onPickup} />
      ))}
      {selfPosRef
        ? flying.map((d) => (
            <PickupFly key={`fly-${d.id}`} drop={d} selfPosRef={selfPosRef} onComplete={complete} />
          ))
        : null}
    </>
  );
}
