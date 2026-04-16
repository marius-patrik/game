import { useQuality } from "@/assets";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  type Points,
  PointsMaterial,
} from "three";
import { scaleParticleCount } from "./particleBudget";

type SparkBurstProps = {
  baseCount?: number;
  color?: string;
  lifetime?: number;
  size?: number;
  speed?: number;
  gravity?: number;
  loop?: boolean;
};

function seedDirections(count: number): Float32Array {
  const s = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const base = i * 3;
    s[base] = Math.sin(phi) * Math.cos(theta);
    s[base + 1] = Math.sin(phi) * Math.sin(theta);
    s[base + 2] = Math.cos(phi);
  }
  return s;
}

export function SparkBurst({
  baseCount = 200,
  color = "#a78bfa",
  lifetime = 1.4,
  size = 0.08,
  speed = 3.5,
  gravity = 4,
  loop = true,
}: SparkBurstProps) {
  const { tier } = useQuality();
  const count = scaleParticleCount(baseCount, tier);

  const { geo, positionAttr, velocityAttr, ageAttr, seed } = useMemo(() => {
    const g = new BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const ages = new Float32Array(count);
    const directions = seedDirections(count);
    for (let i = 0; i < count; i++) {
      const base = i * 3;
      velocities[base] = directions[base]! * speed;
      velocities[base + 1] = directions[base + 1]! * speed;
      velocities[base + 2] = directions[base + 2]! * speed;
      ages[i] = Math.random() * lifetime;
    }
    const positionAttr = new BufferAttribute(positions, 3);
    const velocityAttr = new BufferAttribute(velocities, 3);
    const ageAttr = new BufferAttribute(ages, 1);
    g.setAttribute("position", positionAttr);
    g.setAttribute("velocity", velocityAttr);
    g.setAttribute("age", ageAttr);
    return { geo: g, positionAttr, velocityAttr, ageAttr, seed: directions };
  }, [count, speed, lifetime]);

  const mat = useMemo(
    () =>
      new PointsMaterial({
        color: new Color(color),
        size,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [color, size],
  );

  const pointsRef = useRef<Points>(null);

  useFrame((_, dt) => {
    const pArr = positionAttr.array as Float32Array;
    const vArr = velocityAttr.array as Float32Array;
    const aArr = ageAttr.array as Float32Array;
    let averageAge = 0;
    for (let i = 0; i < count; i++) {
      const base = i * 3;
      let age = aArr[i]! + dt;
      if (age > lifetime) {
        if (!loop) continue;
        pArr[base] = 0;
        pArr[base + 1] = 0;
        pArr[base + 2] = 0;
        vArr[base] = seed[base]! * speed;
        vArr[base + 1] = seed[base + 1]! * speed;
        vArr[base + 2] = seed[base + 2]! * speed;
        age = 0;
      } else {
        vArr[base + 1] = vArr[base + 1]! - gravity * dt;
        pArr[base] = pArr[base]! + vArr[base]! * dt;
        pArr[base + 1] = pArr[base + 1]! + vArr[base + 1]! * dt;
        pArr[base + 2] = pArr[base + 2]! + vArr[base + 2]! * dt;
      }
      aArr[i] = age;
      averageAge += age;
    }
    positionAttr.needsUpdate = true;
    ageAttr.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - averageAge / count / lifetime);
  });

  return <points ref={pointsRef} geometry={geo} material={mat} />;
}
