import { useQuality } from "@/assets";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AdditiveBlending, type Mesh, type MeshBasicMaterial } from "three";

type Vec3 = { x: number; y: number; z: number };

const INNER_RADIUS = 14;
const OUTER_RADIUS = 16;
const BAND_RADIUS = 15.2;

/** Cosmetic marker around the lobby spawn showing the mob-free zone. Two
 * concentric glow bands with a slow breathing animation so the edge reads as
 * "barrier" but doesn't dominate the scene. */
export function SafeZoneRing({ center = { x: 0, y: 0, z: 0 } }: { center?: Vec3 } = {}) {
  const { tier } = useQuality();
  const ringRef = useRef<Mesh>(null);
  const bandRef = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const breath = 0.5 + 0.5 * Math.sin(t * 0.9);
    if (ringRef.current) {
      const mat = ringRef.current.material as MeshBasicMaterial;
      mat.opacity = 0.18 + 0.12 * breath;
    }
    if (bandRef.current) {
      const mat = bandRef.current.material as MeshBasicMaterial;
      mat.opacity = 0.25 + 0.15 * breath;
    }
  });

  // "low" tier skips the marker entirely to stay within the mobile draw-call
  // budget (ADR-0002) when hazards + mobs + portal particles all collide.
  if (tier === "low") return null;

  return (
    <group position={[center.x, center.y + 0.02, center.z]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <ringGeometry args={[INNER_RADIUS, OUTER_RADIUS, 96]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* Brighter thin band right on the boundary for definition. */}
      <mesh ref={bandRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} renderOrder={0}>
        <ringGeometry args={[BAND_RADIUS - 0.08, BAND_RADIUS + 0.08, 96]} />
        <meshBasicMaterial
          color="#93c5fd"
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
