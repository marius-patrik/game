import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { useQuality } from "@/assets";
import { SparkBurst } from "@/fx";
import { scaleParticleCount } from "@/fx/particleBudget";

/**
 * Radial burst + rising sparkle column above the player when they level up.
 * Lives for ~1.4s then unmounts cleanly.
 */
export function LevelUpBurst({ at, onDone }: { at: { x: number; z: number }; onDone: () => void }) {
  const group = useRef<Group>(null);
  const { tier } = useQuality();
  const [t0] = useState(() => performance.now());
  const lifetime = 1.4;

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const elapsed = (performance.now() - t0) / 1000;
    const p = elapsed / lifetime;
    if (p >= 1) {
      onDone();
      return;
    }
    g.scale.setScalar(1 + p * 0.6);
  });

  useEffect(() => {
    const to = window.setTimeout(onDone, lifetime * 1000 + 50);
    return () => window.clearTimeout(to);
  }, [onDone]);

  return (
    <group ref={group} position={[at.x, 0.6, at.z]}>
      <SparkBurst baseCount={120} color="#fbbf24" lifetime={lifetime} speed={3} loop={false} />
      <Sparkles
        count={scaleParticleCount(50, tier)}
        scale={[2.2, 3.2, 2.2]}
        size={5}
        speed={0.6}
        color="#fde68a"
        opacity={0.9}
      />
    </group>
  );
}
