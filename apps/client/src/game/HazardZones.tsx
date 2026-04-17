import type { HazardSnapshot } from "@/net/useRoom";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { type Group, MathUtils, type MeshBasicMaterial } from "three";

/** Orange floor-painted hazard ring with a pulsing inner fill. One mesh + one
 * shader per hazard — cheap enough for mobile within ADR-0002's 150-draw-call
 * budget. The inner circle's opacity oscillates so the hazard reads as an
 * active, dangerous zone instead of static decoration. */
function HazardRing({ hazard }: { hazard: HazardSnapshot }) {
  const group = useRef<Group>(null);
  const innerMat = useRef<MeshBasicMaterial>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (innerMat.current) {
      innerMat.current.opacity = MathUtils.lerp(0.12, 0.32, (Math.sin(t * 2.6) + 1) * 0.5);
    }
    if (group.current) {
      const s = 1 + Math.sin(t * 2.6) * 0.015;
      group.current.scale.set(s, 1, s);
    }
  });

  const ringInner = hazard.radius - 0.35;
  const ringOuter = hazard.radius;
  return (
    <group ref={group} position={[hazard.x, 0.02, hazard.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringInner, ringOuter, 48]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.001]}>
        <circleGeometry args={[ringInner, 48]} />
        <meshBasicMaterial
          ref={innerMat}
          color="#ea580c"
          transparent
          opacity={0.18}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function HazardZones({ hazards }: { hazards: Map<string, HazardSnapshot> }) {
  return (
    <>
      {[...hazards.values()].map((h) => (
        <HazardRing key={h.id} hazard={h} />
      ))}
    </>
  );
}
