import { useQuality } from "@/assets";
import type { Portal } from "@game/shared";
import { Float, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

const PORTAL_COLOR: Record<string, string> = {
  lobby: "#60a5fa",
  arena: "#f97316",
};

function PortalMarker({ portal }: { portal: Portal }) {
  const ringRef = useRef<Mesh>(null);
  const { tier } = useQuality();
  const color = PORTAL_COLOR[portal.to] ?? "#a855f7";

  useFrame((_, dt) => {
    if (ringRef.current) ringRef.current.rotation.z += dt * 0.8;
  });

  const segments = tier === "low" ? 24 : tier === "medium" ? 48 : 64;
  const sparkleCount = tier === "low" ? 10 : tier === "medium" ? 24 : 40;

  return (
    <group position={[portal.pos.x, portal.pos.y + 1.1, portal.pos.z]}>
      <Float speed={1.2} rotationIntensity={0} floatIntensity={0.4}>
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[1.2, 0.2, 16, segments]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.2}
            metalness={0.3}
            roughness={0.35}
          />
        </mesh>
        <Sparkles count={sparkleCount} scale={[1.8, 1.8, 1.8]} size={3} speed={0.6} color={color} />
      </Float>
      <pointLight color={color} intensity={1.2} distance={6} />
    </group>
  );
}

export function Portals({ portals }: { portals: readonly Portal[] }) {
  return (
    <>
      {portals.map((p) => (
        <PortalMarker key={`${p.to}-${p.pos.x}-${p.pos.z}`} portal={p} />
      ))}
    </>
  );
}
