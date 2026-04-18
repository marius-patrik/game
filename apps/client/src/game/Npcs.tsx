import type { ZoneLightingProfile } from "@game/shared";
import { Billboard, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { type Group, MathUtils, type Mesh } from "three";
import type { NpcSnapshot } from "@/net/useRoom";
import { CellMaterial } from "./fx/CellMaterial";
import { GAME_PALETTE } from "./gamePalette";

type CellPalette = ZoneLightingProfile["cellPalette"];

function NameTag({ name, color }: { name: string; color: string }) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = "600 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = GAME_PALETTE.dmg.stroke;
    ctx.strokeText(name, 128, 32);
    ctx.fillStyle = color;
    ctx.fillText(name, 128, 32);
  }
  return (
    <Billboard position={[0, 1.5, 0]}>
      <sprite scale={[2.1, 0.55, 1]}>
        <spriteMaterial attach="material" sizeAttenuation toneMapped={false}>
          <canvasTexture attach="map" args={[canvas]} />
        </spriteMaterial>
      </sprite>
    </Billboard>
  );
}

function NpcModel({
  npc,
  onInteract,
  cellPalette,
}: {
  npc: NpcSnapshot;
  onInteract: (npc: NpcSnapshot) => void;
  cellPalette: CellPalette;
}) {
  const root = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const isVendor = npc.kind === "vendor";
  const color = isVendor ? GAME_PALETTE.npc.vendor : GAME_PALETTE.npc.questgiver;
  const emissive = isVendor ? GAME_PALETTE.npc.vendorEmissive : GAME_PALETTE.npc.questgiverEmissive;

  useFrame((state, dt) => {
    const b = body.current;
    if (!b) return;
    const t = state.clock.getElapsedTime();
    b.position.y = 0.3 + Math.sin(t * 2) * 0.06;
    b.rotation.y = MathUtils.lerp(b.rotation.y, Math.sin(t * 0.5) * 0.3, 1 - Math.exp(-dt * 4));
  });

  return (
    <group
      ref={root}
      position={[npc.x, npc.y, npc.z]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onInteract(npc);
      }}
    >
      <mesh ref={body} castShadow>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <CellMaterial
          bands={cellPalette}
          color={color}
          emissive={emissive}
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* head gem */}
      <mesh position={[0, 1.05, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial
          color={GAME_PALETTE.npc.readyRing}
          emissive={GAME_PALETTE.npc.readyEmissive}
          emissiveIntensity={0.7}
          toneMapped={false}
        />
      </mesh>
      {/* base glow */}
      <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.6, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <Sparkles count={18} scale={[1.2, 1.6, 1.2]} size={2.2} speed={0.3} color={color} />
      <NameTag name={npc.name} color={color} />
    </group>
  );
}

export function Npcs({
  npcs,
  onInteract,
  cellPalette,
}: {
  npcs: Map<string, NpcSnapshot>;
  onInteract: (npc: NpcSnapshot) => void;
  cellPalette: CellPalette;
}) {
  return (
    <>
      {[...npcs.values()].map((n) => (
        <NpcModel key={n.id} npc={n} onInteract={onInteract} cellPalette={cellPalette} />
      ))}
    </>
  );
}
