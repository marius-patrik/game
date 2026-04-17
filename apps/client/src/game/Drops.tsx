import type { DropSnapshot } from "@/net/useRoom";
import { getItem } from "@game/shared/items";
import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type Mesh } from "three";

const ITEM_COLOR: Record<string, string> = {
  heal_potion: "#ef4444",
  sword: "#94a3b8",
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
  onPickup,
}: {
  drops: Map<string, DropSnapshot>;
  onPickup: (dropId: string) => void;
}) {
  return (
    <>
      {[...drops.values()].map((d) => (
        <DropMarker key={d.id} drop={d} onPickup={onPickup} />
      ))}
    </>
  );
}
