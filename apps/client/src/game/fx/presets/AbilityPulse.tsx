import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Mesh } from "three";
import { DoubleSide } from "three";

/**
 * Expanding flat ring + fading disc at the caster's feet on ability use.
 * ~360ms lifetime. Avoids SparkBurst allocations so it's cheap enough to
 * fire on every ability press.
 */
export function AbilityPulse({
  at,
  color,
  onDone,
}: {
  at: { x: number; z: number };
  color: string;
  onDone: () => void;
}) {
  const meshRef = useRef<Mesh>(null);
  const fillRef = useRef<Mesh>(null);
  const [t0] = useState(() => performance.now());
  const lifetime = 0.36;
  const maxRadius = 1.8;

  useFrame(() => {
    const m = meshRef.current;
    const f = fillRef.current;
    if (!m || !f) return;
    const elapsed = (performance.now() - t0) / 1000;
    if (elapsed >= lifetime) {
      onDone();
      return;
    }
    const p = elapsed / lifetime;
    const scale = 0.2 + p * maxRadius;
    m.scale.set(scale, scale, scale);
    f.scale.set(scale * 0.85, scale * 0.85, scale * 0.85);
    const mat = m.material;
    const fmat = f.material;
    if ("opacity" in mat) mat.opacity = (1 - p) * 0.9;
    if ("opacity" in fmat) fmat.opacity = (1 - p) * 0.35;
  });

  useEffect(() => {
    const to = window.setTimeout(onDone, lifetime * 1000 + 50);
    return () => window.clearTimeout(to);
  }, [onDone]);

  return (
    <group position={[at.x, 0.05, at.z]}>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.95, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={fillRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
