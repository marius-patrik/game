import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { peekGround } from "../cursor/cursorStore";
import { useActiveTargetingSource } from "./targetingStore";

/**
 * Subtle always-on ring at the ground-projected cursor. Gives the cursor
 * a tactile world-anchor even when no ability is being targeted. Hidden
 * while a targeter is active (the targeter draws its own reticule and
 * two overlapping rings look busy).
 */
export function MoveCircle() {
  const groupRef = useRef<Group>(null);
  const activeSource = useActiveTargetingSource();
  const hidden = activeSource !== null;

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    if (hidden) {
      g.visible = false;
      return;
    }
    const ground = peekGround();
    if (!ground) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(ground.x, 0.005, ground.z);
    g.rotation.y += dt * 0.4;
    const t = state.clock.getElapsedTime();
    const s = 1 + Math.sin(t * 3) * 0.04;
    g.scale.set(s, 1, s);
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.75, 0.82, 64]} />
        <meshBasicMaterial color="#dbeafe" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[0.3, 0.33, 32]} />
        <meshBasicMaterial color="#f8fafc" transparent opacity={0.28} toneMapped={false} />
      </mesh>
    </group>
  );
}
