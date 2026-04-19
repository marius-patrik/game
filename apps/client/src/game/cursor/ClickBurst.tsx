import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group } from "three";
import { peekGround } from "./cursorStore";

type Burst = {
  x: number;
  z: number;
  t: number; // seconds elapsed
  alive: boolean;
};

const MAX_BURSTS = 8;
const LIFETIME = 0.45; // seconds
const MAX_RADIUS = 1.25;

/**
 * Click-animation pool. Each left-button pointerdown on the canvas spawns
 * a ripple ring expanding to {@link MAX_RADIUS} over {@link LIFETIME}
 * seconds at the current ground cursor. Recycles a fixed pool
 * ({@link MAX_BURSTS}) so rapid clicks never allocate.
 *
 * Lives independently of the targeting system — any click, including
 * move-to-here and targeter confirm, produces a burst as long as the
 * ground cursor has a valid projection.
 */
export function ClickBurst() {
  const gl = useThree((s) => s.gl);
  const groupRefs = useRef<(Group | null)[]>([]);
  const burstsRef = useRef<Burst[]>(
    Array.from({ length: MAX_BURSTS }, () => ({ x: 0, z: 0, t: 0, alive: false })),
  );

  useEffect(() => {
    const dom = gl.domElement;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const ground = peekGround();
      if (!ground) return;
      const pool = burstsRef.current;
      const free = pool.find((b) => !b.alive);
      const slot = free ?? pool.reduce((a, b) => (a.t > b.t ? a : b));
      slot.x = ground.x;
      slot.z = ground.z;
      slot.t = 0;
      slot.alive = true;
    };
    dom.addEventListener("pointerdown", onPointerDown);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const pool = burstsRef.current;
    for (let i = 0; i < pool.length; i++) {
      const b = pool[i];
      if (!b?.alive) {
        const group = groupRefs.current[i];
        if (group) group.visible = false;
        continue;
      }
      b.t += dt;
      const group = groupRefs.current[i];
      if (!group) continue;
      if (b.t >= LIFETIME) {
        b.alive = false;
        group.visible = false;
        continue;
      }
      const p = b.t / LIFETIME;
      const radius = p * MAX_RADIUS;
      const scale = Math.max(radius / 0.5, 0.01);
      group.visible = true;
      group.position.set(b.x, 0.015, b.z);
      group.scale.set(scale, scale, scale);
      group.userData.opacity = 1 - p;
      // Walk children to update material opacity in-place.
      for (const child of group.children) {
        const obj = child as { material?: { opacity?: number; transparent?: boolean } };
        if (obj.material) {
          obj.material.opacity = (1 - p) * 0.9;
          obj.material.transparent = true;
        }
      }
    }
  });

  return (
    <>
      {Array.from({ length: MAX_BURSTS }, (_, i) => i).map((i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
          visible={false}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.42, 0.5, 48]} />
            <meshBasicMaterial color="#fde68a" transparent opacity={0.9} toneMapped={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <ringGeometry args={[0.2, 0.24, 32]} />
            <meshBasicMaterial color="#fcd34d" transparent opacity={0.6} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}
