import type { AttackEvent, PlayerSnapshot } from "@/net/useRoom";
import { Billboard, Sparkles, Trail } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { Color, type Group, MathUtils, type Mesh, type MeshStandardMaterial } from "three";

type Vec3 = { x: number; y: number; z: number };

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 360) / 360;
}

function HPBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const WIDTH = 1.1;
  const HEIGHT = 0.12;
  const fillWidth = WIDTH * frac;
  const fillOffset = -(WIDTH - fillWidth) / 2;
  const fillColor = frac > 0.5 ? "#10b981" : frac > 0.25 ? "#eab308" : "#ef4444";
  return (
    <Billboard position={[0, 1.65, 0]}>
      <mesh>
        <planeGeometry args={[WIDTH + 0.04, HEIGHT + 0.04]} />
        <meshBasicMaterial color="#27272a" transparent opacity={0.85} />
      </mesh>
      <mesh position={[fillOffset, 0, 0.001]}>
        <planeGeometry args={[fillWidth, HEIGHT]} />
        <meshBasicMaterial color={fillColor} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function PlayerModel({
  player,
  isSelf,
  lastAttack,
  selfPosRef,
}: {
  player: PlayerSnapshot;
  isSelf: boolean;
  lastAttack: AttackEvent | undefined;
  selfPosRef?: MutableRefObject<Vec3>;
}) {
  const root = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const head = useRef<Mesh>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const trailAnchor = useRef<Mesh>(null);
  const swing = useRef<Group>(null);
  const swingMat = useRef<MeshStandardMaterial>(null);

  const target = useRef<Vec3>({ x: player.x, y: player.y, z: player.z });
  target.current.x = player.x;
  target.current.y = player.y;
  target.current.z = player.z;
  const prevPos = useRef({ x: player.x, z: player.z });
  const speed = useRef(0);
  const facing = useRef(0);

  // attack swing trigger (self only — visible swing on my character when I click)
  const lastAttackRef = useRef<AttackEvent | undefined>(undefined);
  const swingUntil = useRef(0);
  useEffect(() => {
    if (!isSelf) return;
    if (!lastAttack) return;
    if (lastAttack === lastAttackRef.current) return;
    lastAttackRef.current = lastAttack;
    if (lastAttack.attackerId === player.id) {
      swingUntil.current = performance.now() + 320;
    }
  }, [lastAttack, isSelf, player.id]);

  useFrame((state, dt) => {
    const g = root.current;
    if (!g) return;

    // Self = client-authoritative pos (60Hz), snap directly — removes
    // the 20Hz server-echo phase lag that made the camera/player feel jelly.
    // Others = lerp toward the latest snapshot at a brisk constant so they
    // catch up in ~120ms between 50ms snapshots.
    if (isSelf && selfPosRef) {
      const s = selfPosRef.current;
      g.position.x = s.x;
      g.position.y = 0.5;
      g.position.z = s.z;
    } else {
      const k = 1 - Math.exp(-dt * 22);
      g.position.x = MathUtils.lerp(g.position.x, target.current.x, k);
      g.position.y = MathUtils.lerp(g.position.y, target.current.y + 0.5, k);
      g.position.z = MathUtils.lerp(g.position.z, target.current.z, k);
    }

    // estimate speed from actual rendered position
    const dx = g.position.x - prevPos.current.x;
    const dz = g.position.z - prevPos.current.z;
    const inst = Math.hypot(dx, dz) / Math.max(dt, 0.0001);
    speed.current = MathUtils.lerp(speed.current, Math.min(inst, 6), 1 - Math.exp(-dt * 8));
    if (inst > 0.05) facing.current = Math.atan2(dx, dz);
    g.rotation.y = MathUtils.lerp(g.rotation.y, facing.current, 1 - Math.exp(-dt * 14));
    prevPos.current.x = g.position.x;
    prevPos.current.z = g.position.z;

    // body bob when moving, gentle idle — kept local to the body mesh so
    // the group root (which the camera targets) stays stable.
    const t = state.clock.getElapsedTime();
    const moving = Math.min(1, speed.current / 4);
    if (body.current) {
      const bob = moving * Math.sin(t * 14) * 0.07 + (1 - moving) * Math.sin(t * 2) * 0.02;
      body.current.position.y = 0.15 + bob;
    }
    if (head.current) {
      head.current.position.y = 0.88 + moving * Math.sin(t * 14) * 0.04;
      head.current.rotation.y = Math.sin(t * 1.4) * 0.25;
    }
    if (leftArm.current) {
      leftArm.current.rotation.x = moving * Math.sin(t * 12) * 0.9;
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = moving * Math.sin(t * 12 + Math.PI) * 0.9;
    }

    // swing arc visibility
    const now = performance.now();
    const swinging = now < swingUntil.current;
    if (swing.current) {
      swing.current.visible = swinging;
      if (swinging) {
        const remain = swingUntil.current - now;
        const progress = 1 - remain / 320;
        swing.current.rotation.y = MathUtils.lerp(-1.4, 1.4, progress);
        const s = 1 + Math.sin(progress * Math.PI) * 0.25;
        swing.current.scale.setScalar(s);
      }
    }
    if (swingMat.current) {
      const opacity = swinging ? Math.sin(((swingUntil.current - now) / 320) * Math.PI) : 0;
      swingMat.current.opacity = opacity;
    }
  });

  const { bodyColor, headColor, emissive } = useMemo(() => {
    const seed = player.customizationColor ? new Color(player.customizationColor) : undefined;
    const hsl = { h: 0, s: 0, l: 0 };
    let hue = hashHue(player.id);
    if (seed) {
      seed.getHSL(hsl);
      hue = hsl.h;
    }
    return {
      bodyColor: new Color().setHSL(hue, 0.72, isSelf ? 0.6 : 0.48),
      headColor: new Color().setHSL(hue, 0.85, isSelf ? 0.72 : 0.62),
      emissive: new Color().setHSL(hue, 0.9, isSelf ? 0.35 : 0.22),
    };
  }, [player.customizationColor, player.id, isSelf]);

  const dead = !player.alive;
  if (dead) {
    return (
      <group ref={root} position={[player.x, player.y + 0.05, player.z]}>
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.15, 0.8]} />
          <meshStandardMaterial
            color={bodyColor}
            emissive={emissive}
            emissiveIntensity={0.1}
            transparent
            opacity={0.25}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={root} position={[player.x, player.y + 0.5, player.z]}>
      <mesh ref={body} castShadow>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={emissive}
          emissiveIntensity={isSelf ? 0.5 : 0.25}
          metalness={0.3}
          roughness={0.35}
        />
      </mesh>
      <mesh ref={head} position={[0, 0.88, 0]} castShadow>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial
          color={headColor}
          emissive={emissive}
          emissiveIntensity={isSelf ? 0.6 : 0.35}
          metalness={0.4}
          roughness={0.25}
        />
      </mesh>
      <group ref={leftArm} position={[-0.48, 0.32, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <boxGeometry args={[0.18, 0.5, 0.18]} />
          <meshStandardMaterial color={bodyColor} roughness={0.45} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.48, 0.32, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <boxGeometry args={[0.18, 0.5, 0.18]} />
          <meshStandardMaterial color={bodyColor} roughness={0.45} />
        </mesh>
      </group>
      {isSelf ? <SelfHalo emissive={emissive} /> : null}
      {isSelf ? (
        <group ref={swing} position={[0, 0.3, 0]}>
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.9, 0.08, 12, 24, Math.PI]} />
            <meshStandardMaterial
              ref={swingMat}
              color="#fde68a"
              emissive="#fcd34d"
              emissiveIntensity={2}
              toneMapped={false}
              transparent
              opacity={0}
            />
          </mesh>
        </group>
      ) : null}
      <Trail width={0.6} length={2.2} color={headColor} attenuation={(t) => t * t}>
        <mesh ref={trailAnchor} position={[0, 0.1, 0]} visible={false}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={headColor} />
        </mesh>
      </Trail>
      <Sparkles
        count={isSelf ? 24 : 12}
        scale={[1.3, 1.6, 1.3]}
        size={1.6}
        speed={0.5}
        color={headColor}
      />
      <HPBar hp={player.hp} maxHp={player.maxHp} />
    </group>
  );
}

function SelfHalo({ emissive }: { emissive: Color }) {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 1.6;
  });
  return (
    <mesh ref={ref} position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.3, 0.42, 32]} />
      <meshBasicMaterial color={emissive} transparent opacity={0.95} toneMapped={false} />
    </mesh>
  );
}

export function Players({
  players,
  sessionId,
  lastAttack,
  selfPosRef,
}: {
  players: Map<string, PlayerSnapshot>;
  sessionId?: string;
  lastAttack?: AttackEvent;
  selfPosRef?: MutableRefObject<Vec3>;
}) {
  return (
    <>
      {[...players.values()].map((p) => (
        <PlayerModel
          key={p.id}
          player={p}
          isSelf={p.id === sessionId}
          lastAttack={lastAttack}
          selfPosRef={p.id === sessionId ? selfPosRef : undefined}
        />
      ))}
    </>
  );
}
