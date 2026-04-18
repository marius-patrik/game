import type { ZoneId } from "@game/shared";
import { Float } from "@react-three/drei";
import { useMemo } from "react";

/**
 * Static in-world decor per zone so the playing field doesn't feel like a
 * grid test harness. Lobby gets market stalls + pillars arranged around the
 * spawn; arena gets crumbled stone obelisks + a central firepit.
 * Everything is compositional primitives to keep with the art direction.
 */
export function ZoneDecor({ zoneId }: { zoneId: ZoneId }) {
  if (zoneId === "lobby") return <LobbyDecor />;
  if (zoneId === "arena") return <ArenaDecor />;
  return null;
}

function LobbyDecor() {
  // Ring of tall pillars + two market stalls flanking the NPCs.
  const pillarPositions = useMemo<[number, number, number][]>(
    () => [
      [-10, 0, -10],
      [10, 0, -10],
      [-10, 0, 10],
      [10, 0, 10],
      [0, 0, -14],
      [0, 0, 14],
    ],
    [],
  );
  return (
    <group>
      {pillarPositions.map((p) => (
        <StonePillar key={`p-${p[0]}-${p[2]}`} pos={p} height={3.2} color="#71717a" />
      ))}
      {/* Vendor stall */}
      <MarketStall pos={[-6, 0, 4]} canopy="#7c3aed" />
      {/* Quest giver lectern */}
      <MarketStall pos={[6, 0, 4]} canopy="#059669" />
      {/* Central fountain */}
      <Fountain pos={[0, 0, 0]} />
      {/* Perimeter hedge — four long low boxes outside bounds */}
      <PerimeterHedge bounds={17} />
    </group>
  );
}

function ArenaDecor() {
  // Crumbled obelisks scattered through the larger bounds.
  const obeliskPositions = useMemo<[number, number, number, number][]>(
    () => [
      [-20, 0, -15, 0.6],
      [18, 0, 16, 0.8],
      [-12, 0, 22, 0.5],
      [24, 0, -6, 0.7],
      [-25, 0, 8, 0.55],
      [8, 0, -24, 0.9],
    ],
    [],
  );
  return (
    <group>
      {obeliskPositions.map(([x, y, z, tilt]) => (
        <Obelisk key={`o-${x}-${z}`} pos={[x, y, z]} tiltRad={tilt} />
      ))}
      <Firepit pos={[0, 0, 0]} />
      <PerimeterHedge bounds={38} color="#6b0f1a" />
    </group>
  );
}

function StonePillar({
  pos,
  height,
  color,
}: {
  pos: [number, number, number];
  height: number;
  color: string;
}) {
  return (
    <group position={pos}>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.5, 0.6, height, 12]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh position={[0, height + 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.55, 0.3, 12]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0, height + 0.5, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          color="#fde68a"
          emissive="#fbbf24"
          emissiveIntensity={0.9}
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0, height + 0.6, 0]} color="#fbbf24" intensity={0.4} distance={4} />
    </group>
  );
}

function MarketStall({ pos, canopy }: { pos: [number, number, number]; canopy: string }) {
  return (
    <group position={pos}>
      {/* Counter */}
      <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[1.8, 0.9, 0.6]} />
        <meshStandardMaterial color="#78350f" roughness={0.85} />
      </mesh>
      {/* Canopy posts */}
      {(
        [
          [-0.8, 0.85, -0.25],
          [0.8, 0.85, -0.25],
          [-0.8, 0.85, 0.25],
          [0.8, 0.85, 0.25],
        ] as [number, number, number][]
      ).map(([x, y, z]) => (
        <mesh key={`post-${x}-${z}`} position={[x, y, z]} castShadow>
          <boxGeometry args={[0.08, 1.7, 0.08]} />
          <meshStandardMaterial color="#57534e" roughness={0.8} />
        </mesh>
      ))}
      {/* Canopy roof */}
      <mesh position={[0, 1.9, 0]} castShadow>
        <boxGeometry args={[2, 0.1, 0.9]} />
        <meshStandardMaterial
          color={canopy}
          roughness={0.5}
          emissive={canopy}
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Decorative hanging lantern */}
      <Float speed={1.5} rotationIntensity={0} floatIntensity={0.3}>
        <mesh position={[0.6, 1.55, 0]}>
          <octahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial
            color="#fde68a"
            emissive="#fbbf24"
            emissiveIntensity={1}
            toneMapped={false}
          />
        </mesh>
      </Float>
    </group>
  );
}

function Fountain({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh receiveShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[2.4, 2.6, 0.4, 32]} />
        <meshStandardMaterial color="#52525b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1.9, 2.0, 0.2, 32]} />
        <meshStandardMaterial
          color="#1e40af"
          emissive="#3b82f6"
          emissiveIntensity={0.2}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.25, 0.35, 1.2, 12]} />
        <meshStandardMaterial color="#71717a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial
          color="#60a5fa"
          emissive="#3b82f6"
          emissiveIntensity={1.1}
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0, 1.8, 0]} color="#3b82f6" intensity={0.9} distance={6} />
    </group>
  );
}

function Obelisk({ pos, tiltRad }: { pos: [number, number, number]; tiltRad: number }) {
  return (
    <group position={pos} rotation={[0, tiltRad * 1.2, tiltRad * 0.25]}>
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <boxGeometry args={[0.6, 4, 0.6]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.9} />
      </mesh>
      <mesh position={[0, 4.1, 0]} castShadow>
        <coneGeometry args={[0.42, 0.6, 4]} />
        <meshStandardMaterial color="#52525b" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2, 0.31]}>
        <planeGeometry args={[0.2, 0.35]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#f59e0b"
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Firepit({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.2, 1.3, 0.3, 16]} />
        <meshStandardMaterial color="#27272a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.7, 0.9, 0.5, 12]} />
        <meshStandardMaterial
          color="#f97316"
          emissive="#ea580c"
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <Float speed={4} floatIntensity={0.5}>
        <mesh position={[0, 1.2, 0]}>
          <coneGeometry args={[0.5, 1.2, 8]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fb923c"
            emissiveIntensity={2}
            toneMapped={false}
            transparent
            opacity={0.9}
          />
        </mesh>
      </Float>
      <pointLight position={[0, 1.2, 0]} color="#fb923c" intensity={1.6} distance={10} />
    </group>
  );
}

function PerimeterHedge({ bounds, color = "#1f2937" }: { bounds: number; color?: string }) {
  const bars: [number, number, number, [number, number, number]][] = [
    [0, 0.4, -bounds, [bounds * 2, 0.8, 0.6]],
    [0, 0.4, bounds, [bounds * 2, 0.8, 0.6]],
    [-bounds, 0.4, 0, [0.6, 0.8, bounds * 2]],
    [bounds, 0.4, 0, [0.6, 0.8, bounds * 2]],
  ];
  return (
    <>
      {bars.map(([x, y, z, size]) => (
        <mesh key={`hedge-${x}-${z}`} position={[x, y, z]}>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
      ))}
    </>
  );
}
