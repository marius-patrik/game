import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { useQuality } from "@/assets";
import { scaleParticleCount } from "@/fx/particleBudget";

/**
 * Brief gold-dust sparkle that plays on pickup at the drop's world position.
 * Auto-unmounts after ~600ms.
 */
export function PickupTrail({
  at,
  color,
  onDone,
}: {
  at: { x: number; z: number };
  color: string;
  onDone: () => void;
}) {
  const group = useRef<Group>(null);
  const { tier } = useQuality();
  const [t0] = useState(() => performance.now());
  const lifetime = 0.6;

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const elapsed = (performance.now() - t0) / 1000;
    if (elapsed >= lifetime) {
      onDone();
      return;
    }
    const rise = (elapsed / lifetime) * 0.6;
    g.position.y = 0.6 + rise;
  });

  useEffect(() => {
    const to = window.setTimeout(onDone, lifetime * 1000 + 50);
    return () => window.clearTimeout(to);
  }, [onDone]);

  return (
    <group ref={group} position={[at.x, 0.6, at.z]}>
      <Sparkles
        count={scaleParticleCount(24, tier)}
        scale={[0.9, 1.2, 0.9]}
        size={3}
        speed={0.4}
        color={color}
        opacity={0.95}
      />
    </group>
  );
}
