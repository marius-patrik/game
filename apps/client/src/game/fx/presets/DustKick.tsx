import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { SparkBurst } from "@/fx";

/**
 * Karlson-style dust puff at the player's feet on landing/spawn. Biases
 * ~flat (low Y) so it reads as ground kick, not an explosion. ~500ms
 * lifetime; self-unmounts.
 */
export function DustKick({ at, onDone }: { at: { x: number; z: number }; onDone: () => void }) {
  const group = useRef<Group>(null);
  const [t0] = useState(() => performance.now());
  const lifetime = 0.5;

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

  // Squashed burst — SparkBurst is spherical, but gravity pulls particles
  // down and the size stays small so it reads as a floor-level puff.
  return (
    <group ref={group} position={[at.x, 0.08, at.z]} scale={[1, 0.4, 1]}>
      <SparkBurst
        baseCount={60}
        color="#d1b48a"
        lifetime={lifetime}
        speed={2.2}
        size={0.14}
        gravity={1.8}
        loop={false}
      />
    </group>
  );
}
