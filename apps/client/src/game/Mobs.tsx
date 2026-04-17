import { SparkBurst } from "@/fx";
import type { AttackEvent, MobSnapshot } from "@/net/useRoom";
import { Billboard, Float, Sparkles, Trail } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { type Group, MathUtils, type Mesh, type MeshStandardMaterial } from "three";

const DEATH_FX_MS = 900;

function HPBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const WIDTH = 0.9;
  const HEIGHT = 0.1;
  const fillWidth = WIDTH * frac;
  const fillOffset = -(WIDTH - fillWidth) / 2;
  return (
    <Billboard position={[0, 1.3, 0]}>
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

function MobModel({
  mob,
  onAttack,
  lastAttack,
}: {
  mob: MobSnapshot;
  onAttack: () => void;
  lastAttack: AttackEvent | undefined;
}) {
  const root = useRef<Group>(null);
  const spikes = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const eye1 = useRef<Mesh>(null);
  const eye2 = useRef<Mesh>(null);
  const bodyMat = useRef<MeshStandardMaterial>(null);
  const trailAnchor = useRef<Mesh>(null);

  const target = useRef({ x: mob.x, y: mob.y, z: mob.z });
  target.current.x = mob.x;
  target.current.y = mob.y;
  target.current.z = mob.z;
  const prevPos = useRef({ x: mob.x, z: mob.z });
  const speed = useRef(0);
  const facing = useRef(0);

  // hit flash ramp
  const lastAttackRef = useRef<AttackEvent | undefined>(undefined);
  const flashUntil = useRef(0);
  useEffect(() => {
    if (!lastAttack) return;
    if (lastAttack === lastAttackRef.current) return;
    lastAttackRef.current = lastAttack;
    if (lastAttack.targetId === `mob:${mob.id}`) {
      flashUntil.current = performance.now() + 200;
    }
  }, [lastAttack, mob.id]);

  useFrame((state, dt) => {
    const g = root.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 12);
    g.position.x = MathUtils.lerp(g.position.x, target.current.x, k);
    g.position.y = MathUtils.lerp(g.position.y, target.current.y + 0.55, k);
    g.position.z = MathUtils.lerp(g.position.z, target.current.z, k);

    const dx = g.position.x - prevPos.current.x;
    const dz = g.position.z - prevPos.current.z;
    const inst = Math.hypot(dx, dz) / Math.max(dt, 0.0001);
    speed.current = MathUtils.lerp(speed.current, Math.min(inst, 4), 1 - Math.exp(-dt * 8));
    if (inst > 0.05) facing.current = Math.atan2(dx, dz);
    g.rotation.y = MathUtils.lerp(g.rotation.y, facing.current, 1 - Math.exp(-dt * 12));
    prevPos.current.x = g.position.x;
    prevPos.current.z = g.position.z;

    // idle eye pulse + spike spin
    const t = state.clock.getElapsedTime();
    if (spikes.current) spikes.current.rotation.y += dt * 2.4;
    const pulse = 0.6 + Math.abs(Math.sin(t * 3.2)) * 0.5;
    if (
      eye1.current &&
      (eye1.current.material as MeshStandardMaterial).emissiveIntensity !== undefined
    ) {
      (eye1.current.material as MeshStandardMaterial).emissiveIntensity = pulse;
    }
    if (
      eye2.current &&
      (eye2.current.material as MeshStandardMaterial).emissiveIntensity !== undefined
    ) {
      (eye2.current.material as MeshStandardMaterial).emissiveIntensity = pulse;
    }
    // body bob when chasing
    if (body.current) body.current.position.y = Math.sin(t * 9) * 0.06 * (speed.current / 4);

    // hit flash
    const now = performance.now();
    const flashing = now < flashUntil.current;
    if (bodyMat.current) {
      const f = flashing ? (flashUntil.current - now) / 200 : 0;
      bodyMat.current.emissiveIntensity = MathUtils.lerp(0.45, 2.4, f);
    }
    if (flashing && g) {
      // small back-recoil in facing dir
      const f = (flashUntil.current - now) / 200;
      g.position.x -= Math.sin(facing.current) * 0.15 * f;
      g.position.z -= Math.cos(facing.current) * 0.15 * f;
    }
  });

  return (
    <group
      ref={root}
      position={[mob.x, mob.y + 0.55, mob.z]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onAttack();
      }}
    >
      <Float speed={2.4} floatIntensity={0.18} rotationIntensity={0}>
        {/* body cone */}
        <mesh ref={body} castShadow>
          <coneGeometry args={[0.4, 0.95, 10]} />
          <meshStandardMaterial
            ref={bodyMat}
            color="#dc2626"
            emissive="#7f1d1d"
            emissiveIntensity={0.45}
            metalness={0.2}
            roughness={0.55}
          />
        </mesh>
        {/* eyes */}
        <mesh ref={eye1} position={[-0.13, 0.18, 0.32]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial
            color="#fde68a"
            emissive="#fbbf24"
            emissiveIntensity={1}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={eye2} position={[0.13, 0.18, 0.32]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial
            color="#fde68a"
            emissive="#fbbf24"
            emissiveIntensity={1}
            toneMapped={false}
          />
        </mesh>
        {/* orbiting spikes */}
        <group ref={spikes} position={[0, 0.1, 0]}>
          {[0, 1, 2].map((i) => {
            const angle = (i / 3) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.sin(angle) * 0.6, 0, Math.cos(angle) * 0.6]}
                rotation={[0, angle, 0]}
                castShadow
              >
                <coneGeometry args={[0.08, 0.3, 6]} />
                <meshStandardMaterial color="#b91c1c" emissive="#450a0a" emissiveIntensity={0.5} />
              </mesh>
            );
          })}
        </group>
        {/* base glow ring */}
        <mesh position={[0, -0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.55, 24]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.35} toneMapped={false} />
        </mesh>
      </Float>
      {/* movement trail */}
      <Trail width={0.5} length={1.8} color="#ef4444" attenuation={(t) => t * t}>
        <mesh ref={trailAnchor} visible={false}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </Trail>
      {/* ambient sparkle */}
      <Sparkles count={8} scale={[1, 1.2, 1]} size={1.2} speed={0.4} color="#fca5a5" />
      <HPBar hp={mob.hp} maxHp={mob.maxHp} />
    </group>
  );
}

type DeathFx = { id: string; pos: { x: number; y: number; z: number }; until: number };

export function Mobs({
  mobs,
  onAttack,
  lastAttack,
}: {
  mobs: Map<string, MobSnapshot>;
  onAttack: () => void;
  lastAttack?: AttackEvent;
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
        <MobModel key={m.id} mob={m} onAttack={onAttack} lastAttack={lastAttack} />
      ))}
      {deaths.map((d) => (
        <group key={d.id} position={[d.pos.x, d.pos.y + 0.6, d.pos.z]}>
          <SparkBurst baseCount={120} color="#ef4444" lifetime={0.9} speed={3.8} loop={false} />
          <SparkBurst baseCount={40} color="#fbbf24" lifetime={0.6} speed={2.4} loop={false} />
        </group>
      ))}
    </>
  );
}
