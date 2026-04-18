import { Billboard, Sparkles, Trail } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { Color, type Group, MathUtils, type Mesh, type MeshStandardMaterial } from "three";
import type { AttackEvent, PlayerSnapshot } from "@/net/useRoom";
import { GAME_PALETTE } from "./gamePalette";

type Vec3 = { x: number; y: number; z: number };

/** Sphere radius for the player mesh (meters). */
const SPHERE_RADIUS = 0.42;
/** Rest hover height for the sphere mesh above the floor (meters). */
const HOVER_HEIGHT = 1.0;
/** Peak amplitude of the idle bob animation. */
const BOB_AMPLITUDE = 0.05;
/** Full bob cycle duration (seconds). 2s per spec. */
const BOB_PERIOD_SEC = 2.0;

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
  const fillColor =
    frac > 0.5
      ? GAME_PALETTE.player.hpHigh
      : frac > 0.25
        ? GAME_PALETTE.player.hpMid
        : GAME_PALETTE.player.hpLow;
  return (
    <Billboard position={[0, 1.7, 0]}>
      <mesh>
        <planeGeometry args={[WIDTH + 0.04, HEIGHT + 0.04]} />
        <meshBasicMaterial color={GAME_PALETTE.player.barBg} transparent opacity={0.85} />
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
  const bobGroup = useRef<Group>(null);
  const sphere = useRef<Mesh>(null);
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
    //
    // IMPORTANT: the root group sits at a **fixed** Y for the chase camera
    // to track. The bob animation lives on a child group (bobGroup) so the
    // camera never inherits its oscillation.
    if (isSelf && selfPosRef) {
      const s = selfPosRef.current;
      g.position.x = s.x;
      g.position.z = s.z;
    } else {
      const k = 1 - Math.exp(-dt * 22);
      g.position.x = MathUtils.lerp(g.position.x, target.current.x, k);
      g.position.z = MathUtils.lerp(g.position.z, target.current.z, k);
    }
    g.position.y = 0;

    // estimate speed from actual rendered position
    const dx = g.position.x - prevPos.current.x;
    const dz = g.position.z - prevPos.current.z;
    const inst = Math.hypot(dx, dz) / Math.max(dt, 0.0001);
    speed.current = MathUtils.lerp(speed.current, Math.min(inst, 6), 1 - Math.exp(-dt * 8));
    if (inst > 0.05) facing.current = Math.atan2(dx, dz);
    g.rotation.y = MathUtils.lerp(g.rotation.y, facing.current, 1 - Math.exp(-dt * 14));
    prevPos.current.x = g.position.x;
    prevPos.current.z = g.position.z;

    // Idle bob ±0.05m over 2s. Runs continuously (floating orb aesthetic)
    // and is applied to `bobGroup`, NOT `root`, so the chase camera —
    // which follows the authoritative ref, not any mesh — doesn't oscillate.
    const t = state.clock.getElapsedTime();
    const phase = (t / BOB_PERIOD_SEC) * Math.PI * 2;
    const bob = Math.sin(phase) * BOB_AMPLITUDE;
    if (bobGroup.current) {
      bobGroup.current.position.y = HOVER_HEIGHT + bob;
      // Subtle forward-lean into motion; resets on idle.
      const moving = Math.min(1, speed.current / 4);
      bobGroup.current.rotation.x = moving * 0.08;
    }
    if (sphere.current) {
      // Slow spin makes the orb feel alive without needing face detail.
      sphere.current.rotation.y += dt * 0.4;
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

  const { bodyColor, emissive, accent } = useMemo(() => {
    const seed = player.customizationColor ? new Color(player.customizationColor) : undefined;
    const hsl = { h: 0, s: 0, l: 0 };
    let hue = hashHue(player.id);
    if (seed) {
      seed.getHSL(hsl);
      hue = hsl.h;
    }
    return {
      bodyColor: new Color().setHSL(hue, 0.72, isSelf ? 0.6 : 0.48),
      accent: new Color().setHSL(hue, 0.85, isSelf ? 0.72 : 0.62),
      emissive: new Color().setHSL(hue, 0.9, isSelf ? 0.4 : 0.25),
    };
  }, [player.customizationColor, player.id, isSelf]);

  const dead = !player.alive;
  if (dead) {
    return (
      <group ref={root} position={[player.x, 0, player.z]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <sphereGeometry args={[SPHERE_RADIUS, 20, 16]} />
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
    <group ref={root} position={[player.x, 0, player.z]}>
      <group ref={bobGroup} position={[0, HOVER_HEIGHT, 0]}>
        <mesh ref={sphere} castShadow>
          <sphereGeometry args={[SPHERE_RADIUS, 32, 24]} />
          <meshStandardMaterial
            color={bodyColor}
            emissive={emissive}
            emissiveIntensity={isSelf ? 0.55 : 0.3}
            metalness={0.35}
            roughness={0.3}
          />
        </mesh>
        {/* Thin equatorial band for visual interest + facing hint. */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[SPHERE_RADIUS * 1.02, SPHERE_RADIUS * 0.07, 8, 32]} />
          <meshStandardMaterial
            color={accent}
            emissive={emissive}
            emissiveIntensity={isSelf ? 0.8 : 0.5}
            metalness={0.5}
            roughness={0.25}
            toneMapped={false}
          />
        </mesh>
        {isSelf ? <SelfHalo emissive={emissive} /> : null}
        {isSelf ? (
          <group ref={swing} position={[0, 0, 0]}>
            <mesh rotation={[0, 0, 0]}>
              <torusGeometry args={[0.9, 0.08, 12, 24, Math.PI]} />
              <meshStandardMaterial
                ref={swingMat}
                color={GAME_PALETTE.player.crown}
                emissive={GAME_PALETTE.player.crownEmissive}
                emissiveIntensity={2}
                toneMapped={false}
                transparent
                opacity={0}
              />
            </mesh>
          </group>
        ) : null}
        <Trail width={0.6} length={2.2} color={accent} attenuation={(tt) => tt * tt}>
          <mesh ref={trailAnchor} position={[0, 0, 0]} visible={false}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color={accent} />
          </mesh>
        </Trail>
        <Sparkles
          count={isSelf ? 24 : 12}
          scale={[1.3, 1.6, 1.3]}
          size={1.6}
          speed={0.5}
          color={accent}
        />
      </group>
      {/* Soft shadow disc on the floor, keeps the orb grounded visually. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <circleGeometry args={[SPHERE_RADIUS * 1.1, 24]} />
        <meshBasicMaterial color={GAME_PALETTE.player.shadow} transparent opacity={0.28} />
      </mesh>
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
    <mesh ref={ref} position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
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
