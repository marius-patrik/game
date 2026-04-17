import { useFrame } from "@react-three/fiber";
/**
 * Shape renderers for the targeter. Each consumes a common contract so
 * the abstract `Targeter` can swap shapes without branching per-shape in
 * its render path.
 *
 * Only `circle` is used in this PR; `cone` and `rect` are stubs so #98
 * (skills) can slot meteor / cleave-aoe / line-skill in without touching
 * the hook or `useTargetingInputHandlers`.
 */
import { useMemo, useRef } from "react";
import { type Group, MathUtils, Vector3 } from "three";

type Vec3 = { x: number; y: number; z: number };

export type ShapeProps = {
  origin: Vec3;
  ground: Vec3;
  rangeMax: number;
  paramA: number;
  paramB: number;
  color: string;
  outOfRangeColor: string;
};

function distFlat(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.hypot(dx, dz);
}

/**
 * Circle targeter — the dash / blink / AOE shape.
 * Renders:
 *  - A large translucent range disc at `origin`, radius = rangeMax.
 *  - A reticule ring at the (clamped) cursor pos. Ring tints red when
 *    the raw cursor is out of range, even though the confirmed position
 *    snaps to the range edge.
 */
export function CircleTargeter({ origin, ground, rangeMax, color, outOfRangeColor }: ShapeProps) {
  const rangeRef = useRef<Group>(null);
  const reticleRef = useRef<Group>(null);
  const reticleInnerRef = useRef<{
    material?: { color?: { set?: (c: string) => void } };
  }>(null);

  useFrame((_, dt) => {
    const r = rangeRef.current;
    if (r) {
      r.position.set(origin.x, 0.015, origin.z);
      r.scale.setScalar(rangeMax);
      r.rotation.y += dt * 0.1;
    }
    const dist = distFlat(origin, ground);
    const clampedT = dist > 0 ? Math.min(1, rangeMax / dist) : 1;
    const cx = MathUtils.lerp(origin.x, ground.x, clampedT);
    const cz = MathUtils.lerp(origin.z, ground.z, clampedT);
    const g = reticleRef.current;
    if (g) {
      g.position.set(cx, 0.02, cz);
      g.rotation.y += dt * 1.6;
      const p = (Math.sin(performance.now() * 0.006) + 1) * 0.5;
      const s = 0.9 + p * 0.2;
      g.scale.setScalar(s);
    }
    const outOfRange = dist > rangeMax + 0.05;
    const inner = reticleInnerRef.current as unknown as {
      material: { color: { set: (c: string) => void } };
    } | null;
    if (inner?.material?.color?.set) {
      inner.material.color.set(outOfRange ? outOfRangeColor : color);
    }
  });

  return (
    <>
      {/* Range disc */}
      <group ref={rangeRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.96, 1.0, 96]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
          <circleGeometry args={[1.0, 96]} />
          <meshBasicMaterial color={color} transparent opacity={0.07} toneMapped={false} />
        </mesh>
      </group>

      {/* Reticule at clamped cursor */}
      <group ref={reticleRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.7, 48]} />
          <meshBasicMaterial
            ref={reticleInnerRef as never}
            color={color}
            transparent
            opacity={0.75}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <circleGeometry args={[0.55, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.12} toneMapped={false} />
        </mesh>
        {/* Cross hairs for orientation */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.08, 1.1]} />
          <meshBasicMaterial color={color} transparent opacity={0.45} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[0.08, 1.1]} />
          <meshBasicMaterial color={color} transparent opacity={0.45} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

/** Cone targeter — wedge from origin pointing at the cursor. */
export function ConeTargeter({ origin, ground, rangeMax, paramA, color }: ShapeProps) {
  const groupRef = useRef<Group>(null);

  const angleDeg = paramA > 0 ? paramA : 60;
  const halfAngle = (angleDeg * Math.PI) / 360;

  const geom = useMemo(() => {
    // Build a flat sector on the XZ plane: start from origin, sweep
    // `angleDeg` around the +Z axis, radius = 1 (scaled by rangeMax).
    const segments = 24;
    const positions: number[] = [0, 0, 0];
    const indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const theta = -halfAngle + t * (halfAngle * 2);
      positions.push(Math.sin(theta), 0, Math.cos(theta));
      if (i > 0) indices.push(0, i, i + 1);
    }
    return { positions: new Float32Array(positions), indices };
  }, [halfAngle]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const dx = ground.x - origin.x;
    const dz = ground.z - origin.z;
    const yaw = Math.atan2(dx, dz);
    g.position.set(origin.x, 0.02, origin.z);
    g.rotation.y = yaw;
    g.scale.setScalar(rangeMax);
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[0, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geom.positions, 3]} />
          <bufferAttribute attach="index" args={[new Uint16Array(geom.indices), 1]} />
        </bufferGeometry>
        <meshBasicMaterial color={color} transparent opacity={0.25} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Rect targeter — axis-aligned rectangle centered on cursor. */
export function RectTargeter({ ground, paramA, paramB, color }: ShapeProps) {
  const width = paramA > 0 ? paramA : 4;
  const depth = paramB > 0 ? paramB : 2;
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    g.position.set(ground.x, 0.02, ground.z);
  });
  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** For consumers that want to project the origin→ground direction */
export function directionXZ(origin: Vec3, ground: Vec3): Vector3 {
  const dx = ground.x - origin.x;
  const dz = ground.z - origin.z;
  const len = Math.hypot(dx, dz);
  if (len === 0) return new Vector3(0, 0, 1);
  return new Vector3(dx / len, 0, dz / len);
}
