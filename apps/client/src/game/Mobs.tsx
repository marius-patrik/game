import { SparkBurst } from "@/fx";
import type { MobSnapshot } from "@/net/useRoom";
import { Billboard, Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { type Group, MathUtils } from "three";

const DEATH_FX_MS = 800;

function HPBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const WIDTH = 0.9;
  const HEIGHT = 0.1;
  const fillWidth = WIDTH * frac;
  const fillOffset = -(WIDTH - fillWidth) / 2;
  // Match the shadcn tokens used by the HUD Progress:
  // track = secondary/muted, fill = destructive (red) for enemies.
  return (
    <Billboard position={[0, 1.1, 0]}>
      <mesh>
        <planeGeometry args={[WIDTH + 0.03, HEIGHT + 0.03]} />
        <meshBasicMaterial color="#27272a" transparent opacity={0.85} />
      </mesh>
      <mesh position={[fillOffset, 0, 0.001]}>
        <planeGeometry args={[fillWidth, HEIGHT]} />
        <meshBasicMaterial color="#ef4444" toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function MobEntity({ mob, onAttack }: { mob: MobSnapshot; onAttack: () => void }) {
  const ref = useRef<Group>(null);
  const target = useRef({ x: mob.x, y: mob.y, z: mob.z });
  target.current.x = mob.x;
  target.current.y = mob.y;
  target.current.z = mob.z;

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 12);
    g.position.x = MathUtils.lerp(g.position.x, target.current.x, k);
    g.position.y = MathUtils.lerp(g.position.y, target.current.y + 0.5, k);
    g.position.z = MathUtils.lerp(g.position.z, target.current.z, k);
  });

  return (
    <group ref={ref} position={[mob.x, mob.y + 0.5, mob.z]}>
      <Float speed={2.4} floatIntensity={0.25} rotationIntensity={0.1}>
        <mesh
          castShadow
          onPointerDown={(e) => {
            e.stopPropagation();
            onAttack();
          }}
        >
          <coneGeometry args={[0.35, 0.9, 8]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#7f1d1d"
            emissiveIntensity={0.5}
            metalness={0.2}
            roughness={0.55}
          />
        </mesh>
      </Float>
      <HPBar hp={mob.hp} maxHp={mob.maxHp} />
    </group>
  );
}

type DeathFx = { id: string; pos: { x: number; y: number; z: number }; until: number };

export function Mobs({
  mobs,
  onAttack,
}: {
  mobs: Map<string, MobSnapshot>;
  onAttack: () => void;
}) {
  const lastRef = useRef(new Map<string, MobSnapshot>());
  const [deaths, setDeaths] = useState<DeathFx[]>([]);

  useEffect(() => {
    const prev = lastRef.current;
    const removed: DeathFx[] = [];
    prev.forEach((p, id) => {
      if (!mobs.has(id)) {
        removed.push({
          id: `${id}-${Date.now()}`,
          pos: { x: p.x, y: p.y, z: p.z },
          until: Date.now() + DEATH_FX_MS,
        });
      }
    });
    if (removed.length > 0) setDeaths((prev) => [...prev, ...removed]);
    lastRef.current = new Map(mobs);
  }, [mobs]);

  useEffect(() => {
    if (deaths.length === 0) return;
    const soonest = deaths.reduce((m, d) => Math.min(m, d.until), Number.POSITIVE_INFINITY);
    const now = Date.now();
    const wait = Math.max(0, soonest - now);
    const t = setTimeout(() => {
      setDeaths((prev) => prev.filter((d) => d.until > Date.now()));
    }, wait + 16);
    return () => clearTimeout(t);
  }, [deaths]);

  return (
    <>
      {[...mobs.values()].map((m) => (
        <MobEntity key={m.id} mob={m} onAttack={onAttack} />
      ))}
      {deaths.map((d) => (
        <group key={d.id} position={[d.pos.x, d.pos.y + 0.6, d.pos.z]}>
          <SparkBurst baseCount={80} color="#ef4444" lifetime={0.8} speed={3} loop={false} />
        </group>
      ))}
    </>
  );
}
