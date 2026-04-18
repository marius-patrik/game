import type { Portal } from "@game/shared";
import { Float, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useRef, useState } from "react";
import {
  AdditiveBlending,
  BackSide,
  type Group,
  MathUtils,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import { useQuality } from "@/assets";
import type { PlayerSnapshot } from "@/net/useRoom";

type Vec3 = { x: number; y: number; z: number };

const PORTAL_COLOR: Record<string, string> = {
  lobby: "#fbbf24",
  arena: "#f97316",
};

const PROXIMITY_RADIUS = 2;
const PROXIMITY_RADIUS_SQ = PROXIMITY_RADIUS * PROXIMITY_RADIUS;

function PortalMarker({
  portal,
  selfPosRef,
}: {
  portal: Portal;
  selfPosRef?: MutableRefObject<Vec3>;
}) {
  const group = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const groundRef = useRef<Mesh>(null);
  const { tier } = useQuality();
  const color = PORTAL_COLOR[portal.to] ?? "#a855f7";

  const segments = tier === "low" ? 32 : tier === "medium" ? 48 : 64;
  const baseSparkles = tier === "low" ? 8 : tier === "medium" ? 18 : 32;

  // Proximity pulse state — advanced each frame toward the target based on
  // whether the local player is within PROXIMITY_RADIUS.
  const pulse = useRef(0);
  const [isNear, setIsNear] = useState(false);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    // Torus starts flat in the XY plane. Stand it up around X, then spin the
    // ring around Y so the portal reads as a hovering vertical gate.
    if (ringRef.current) ringRef.current.rotation.y += dt * 0.6;
    if (innerRef.current) innerRef.current.rotation.y -= dt * 0.9;

    // Proximity detection — player distance in the horizontal plane.
    const self = selfPosRef?.current;
    let targetPulse = 0;
    let near = false;
    if (self) {
      const dx = self.x - portal.pos.x;
      const dz = self.z - portal.pos.z;
      near = dx * dx + dz * dz <= PROXIMITY_RADIUS_SQ;
      if (near) targetPulse = 1;
    }
    if (near !== isNear) setIsNear(near);
    // Exponential approach to target; ~400ms settle at k≈6.
    const k = 1 - Math.exp(-dt * 6);
    pulse.current = MathUtils.lerp(pulse.current, targetPulse, k);
    const scale = 1 + 0.15 * pulse.current;
    g.scale.set(scale, scale, scale);

    // Halo wobble — drifts the outer glow so it feels alive even idle.
    if (haloRef.current) {
      haloRef.current.rotation.y += dt * 0.25;
      const haloMat = haloRef.current.material as MeshBasicMaterial;
      haloMat.opacity = 0.18 + 0.22 * pulse.current;
    }
    if (groundRef.current) {
      const groundMat = groundRef.current.material as MeshBasicMaterial;
      groundMat.opacity = 0.35 + 0.25 * pulse.current;
    }
  });
  const sparkleCount = Math.max(4, baseSparkles * (isNear ? 2 : 1));

  return (
    <group ref={group} position={[portal.pos.x, portal.pos.y, portal.pos.z]}>
      {/* Ground glow — a flat disc with additive blending just above the floor. */}
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        renderOrder={-1}
      >
        <circleGeometry args={[1.6, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Main vertical ring — floats gently, always faces the world up axis. */}
      <Float speed={1.1} rotationIntensity={0} floatIntensity={0.3}>
        <group position={[0, 1.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          {/* Torus with a small open arc — the gap visibly rotates, giving
           * the ring a clear spin cue that a full torus alone would lack. */}
          <mesh ref={ringRef} castShadow>
            <torusGeometry args={[1.1, 0.12, 16, segments, Math.PI * 1.82]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.6}
              metalness={0.3}
              roughness={0.32}
            />
          </mesh>

          {/* Inner thinner counter-rotating arc for depth. */}
          <mesh ref={innerRef} castShadow>
            <torusGeometry args={[0.82, 0.05, 12, Math.max(24, segments - 16), Math.PI * 1.6]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={2.2}
              metalness={0.4}
              roughness={0.2}
            />
          </mesh>

          {/* Soft additive halo disc behind the ring — catches bloom nicely. */}
          <mesh ref={haloRef}>
            <ringGeometry args={[0.95, 1.35, 64]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.22}
              depthWrite={false}
              side={BackSide}
              blending={AdditiveBlending}
            />
          </mesh>

          <Sparkles
            count={sparkleCount}
            scale={[1.6, 1.6, 0.6]}
            size={3}
            speed={0.5}
            color={color}
          />
        </group>
      </Float>

      <pointLight color={color} intensity={1.4} distance={7} position={[0, 1.25, 0]} />
    </group>
  );
}

export function Portals({
  portals,
  players,
  sessionId,
  selfPosRef,
}: {
  portals: readonly Portal[];
  players?: Map<string, PlayerSnapshot>;
  sessionId?: string;
  selfPosRef?: MutableRefObject<Vec3>;
}) {
  // selfPosRef is the authoritative ref from the click-controls hook (smooth,
  // updated every frame). If it's missing, fall back to the server snapshot
  // which updates only on state deltas — fine for the visual pulse.
  const fallbackRef = useRef<Vec3>({ x: 0, y: 0, z: 0 });
  const self = sessionId ? players?.get(sessionId) : undefined;
  if (self) {
    fallbackRef.current.x = self.x;
    fallbackRef.current.y = self.y;
    fallbackRef.current.z = self.z;
  }
  const posRef = selfPosRef ?? fallbackRef;

  return (
    <>
      {portals.map((p) => (
        <PortalMarker key={`${p.to}-${p.pos.x}-${p.pos.z}`} portal={p} selfPosRef={posRef} />
      ))}
    </>
  );
}
