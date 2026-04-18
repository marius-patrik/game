import type { ZoneId, ZoneLightingProfile } from "@game/shared";
import { Float } from "@react-three/drei";
import { useMemo } from "react";
import { CellMaterial } from "./fx/CellMaterial";
import { GAME_PALETTE } from "./gamePalette";

const DECOR = GAME_PALETTE.decor;

type CellPalette = ZoneLightingProfile["cellPalette"];

/**
 * Static in-world decor per zone so the playing field doesn't feel like a
 * grid test harness. Lobby gets market stalls + pillars arranged around the
 * spawn; arena gets crumbled stone obelisks + a central firepit.
 * Everything is compositional primitives to keep with the art direction.
 *
 * All non-emissive surfaces route through `<CellMaterial>` so the banded
 * diffuse picks up the zone's `cellPalette`. Glowy bits (lanterns, glyphs,
 * crystal, firepit flame) keep their `meshStandardMaterial` so the bloom
 * pass has real HDR emissive to latch onto.
 */
export function ZoneDecor({ zoneId, cellPalette }: { zoneId: ZoneId; cellPalette: CellPalette }) {
  if (zoneId === "lobby") return <LobbyDecor cellPalette={cellPalette} />;
  if (zoneId === "arena") return <ArenaDecor cellPalette={cellPalette} />;
  return null;
}

function LobbyDecor({ cellPalette }: { cellPalette: CellPalette }) {
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
        <StonePillar
          key={`p-${p[0]}-${p[2]}`}
          pos={p}
          height={3.2}
          color={DECOR.stone}
          cellPalette={cellPalette}
        />
      ))}
      <MarketStall pos={[-6, 0, 4]} canopy={DECOR.stalePurple} cellPalette={cellPalette} />
      <MarketStall pos={[6, 0, 4]} canopy={DECOR.stallGreen} cellPalette={cellPalette} />
      <Fountain pos={[0, 0, 0]} cellPalette={cellPalette} />
      <PerimeterHedge bounds={17} cellPalette={cellPalette} />
    </group>
  );
}

function ArenaDecor({ cellPalette }: { cellPalette: CellPalette }) {
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
        <Obelisk key={`o-${x}-${z}`} pos={[x, y, z]} tiltRad={tilt} cellPalette={cellPalette} />
      ))}
      <Firepit pos={[0, 0, 0]} cellPalette={cellPalette} />
      <PerimeterHedge bounds={38} color={DECOR.hedge} cellPalette={cellPalette} />
    </group>
  );
}

function StonePillar({
  pos,
  height,
  color,
  cellPalette,
}: {
  pos: [number, number, number];
  height: number;
  color: string;
  cellPalette: CellPalette;
}) {
  return (
    <group position={pos}>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.5, 0.6, height, 12]} />
        <CellMaterial bands={cellPalette} color={color} />
      </mesh>
      <mesh position={[0, height + 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.55, 0.3, 12]} />
        <CellMaterial bands={cellPalette} color={color} />
      </mesh>
      <mesh position={[0, height + 0.5, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          color={DECOR.lanternGlass}
          emissive={DECOR.lanternEmissive}
          emissiveIntensity={0.9}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        position={[0, height + 0.6, 0]}
        color={DECOR.lanternEmissive}
        intensity={0.4}
        distance={4}
      />
    </group>
  );
}

function MarketStall({
  pos,
  canopy,
  cellPalette,
}: {
  pos: [number, number, number];
  canopy: string;
  cellPalette: CellPalette;
}) {
  return (
    <group position={pos}>
      <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[1.8, 0.9, 0.6]} />
        <CellMaterial bands={cellPalette} color={DECOR.wood} />
      </mesh>
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
          <CellMaterial bands={cellPalette} color={DECOR.dirt} />
        </mesh>
      ))}
      <mesh position={[0, 1.9, 0]} castShadow>
        <boxGeometry args={[2, 0.1, 0.9]} />
        <CellMaterial
          bands={cellPalette}
          color={canopy}
          emissive={canopy}
          emissiveIntensity={0.15}
        />
      </mesh>
      <Float speed={1.5} rotationIntensity={0} floatIntensity={0.3}>
        <mesh position={[0.6, 1.55, 0]}>
          <octahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial
            color={DECOR.lanternGlass}
            emissive={DECOR.lanternEmissive}
            emissiveIntensity={1}
            toneMapped={false}
          />
        </mesh>
      </Float>
    </group>
  );
}

function Fountain({
  pos,
  cellPalette,
}: {
  pos: [number, number, number];
  cellPalette: CellPalette;
}) {
  return (
    <group position={pos}>
      <mesh receiveShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[2.4, 2.6, 0.4, 32]} />
        <CellMaterial bands={cellPalette} color={DECOR.pedestal} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1.9, 2.0, 0.2, 32]} />
        <CellMaterial
          bands={cellPalette}
          color={DECOR.crystalBody}
          emissive={DECOR.crystalEmissive}
          emissiveIntensity={0.2}
        />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.25, 0.35, 1.2, 12]} />
        <CellMaterial bands={cellPalette} color={DECOR.slab} />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial
          color={DECOR.crystalGlow}
          emissive={DECOR.crystalEmissive}
          emissiveIntensity={1.1}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        position={[0, 1.8, 0]}
        color={DECOR.crystalEmissive}
        intensity={0.9}
        distance={6}
      />
    </group>
  );
}

function Obelisk({
  pos,
  tiltRad,
  cellPalette,
}: {
  pos: [number, number, number];
  tiltRad: number;
  cellPalette: CellPalette;
}) {
  return (
    <group position={pos} rotation={[0, tiltRad * 1.2, tiltRad * 0.25]}>
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <boxGeometry args={[0.6, 4, 0.6]} />
        <CellMaterial bands={cellPalette} color={DECOR.obeliskBody} />
      </mesh>
      <mesh position={[0, 4.1, 0]} castShadow>
        <coneGeometry args={[0.42, 0.6, 4]} />
        <CellMaterial bands={cellPalette} color={DECOR.obeliskCap} />
      </mesh>
      <mesh position={[0, 2, 0.31]}>
        <planeGeometry args={[0.2, 0.35]} />
        <meshStandardMaterial
          color={DECOR.obeliskGlyph}
          emissive={DECOR.obeliskGlyphEmissive}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Firepit({
  pos,
  cellPalette,
}: {
  pos: [number, number, number];
  cellPalette: CellPalette;
}) {
  return (
    <group position={pos}>
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.2, 1.3, 0.3, 16]} />
        <CellMaterial bands={cellPalette} color={DECOR.firepitRim} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.7, 0.9, 0.5, 12]} />
        <meshStandardMaterial
          color={DECOR.firepitCore}
          emissive={DECOR.firepitCoreEmissive}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <Float speed={4} floatIntensity={0.5}>
        <mesh position={[0, 1.2, 0]}>
          <coneGeometry args={[0.5, 1.2, 8]} />
          <meshStandardMaterial
            color={DECOR.firepitFlame}
            emissive={DECOR.firepitFlameEmissive}
            emissiveIntensity={2}
            toneMapped={false}
            transparent
            opacity={0.9}
          />
        </mesh>
      </Float>
      <pointLight position={[0, 1.2, 0]} color={DECOR.firepitLight} intensity={1.6} distance={10} />
    </group>
  );
}

function PerimeterHedge({
  bounds,
  color = DECOR.hedgeDefault,
  cellPalette,
}: {
  bounds: number;
  color?: string;
  cellPalette: CellPalette;
}) {
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
          <CellMaterial bands={cellPalette} color={color} />
        </mesh>
      ))}
    </>
  );
}
