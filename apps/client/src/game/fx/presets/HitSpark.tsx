import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { SparkBurst } from "@/fx";

/**
 * Snappy radial burst at the impact point when an ability connects. Short
 * lifetime (~280ms) with no gravity so particles radiate out evenly and
 * the burst doesn't muddy the frame that follows.
 */
export function HitSpark({
  at,
  color,
  onDone,
}: {
  at: { x: number; z: number };
  color: string;
  onDone: () => void;
}) {
  const group = useRef<Group>(null);
  const [t0] = useState(() => performance.now());
  const lifetime = 0.28;

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const elapsed = (performance.now() - t0) / 1000;
    if (elapsed >= lifetime) {
      onDone();
      return;
    }
  });

  useEffect(() => {
    const to = window.setTimeout(onDone, lifetime * 1000 + 50);
    return () => window.clearTimeout(to);
  }, [onDone]);

  return (
    <group ref={group} position={[at.x, 0.8, at.z]}>
      <SparkBurst
        baseCount={70}
        color={color}
        lifetime={lifetime}
        speed={5.8}
        size={0.1}
        gravity={0}
        loop={false}
      />
    </group>
  );
}
