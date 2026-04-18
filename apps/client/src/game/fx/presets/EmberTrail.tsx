import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { SparkBurst } from "@/fx";

/**
 * Ember streak at the dash impact — short, hot, gravity-kissed so the
 * particles drift down into the ground. Meant to layer on top of the
 * existing Trail component for a pop of "action landed here".
 */
export function EmberTrail({
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
  const lifetime = 0.75;

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
    <group ref={group} position={[at.x, 0.4, at.z]}>
      <SparkBurst
        baseCount={90}
        color={color}
        lifetime={lifetime}
        speed={3.2}
        size={0.09}
        gravity={2.8}
        loop={false}
      />
    </group>
  );
}
