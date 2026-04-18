import { Billboard } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type Group, MathUtils, type SpriteMaterial } from "three";
import type { PlayerSnapshot } from "@/net/useRoom";

/**
 * Hover-above-player name tag. Uses a canvas-textured sprite so we stay in a
 * single WebGL draw call per player (cheaper than drei `Html`, which
 * mount/unmounts DOM nodes and doesn't play well with cursor-lock). Opacity
 * fades above FADE_START_M and fully disappears past FADE_END_M to keep
 * the scene readable in crowded zones — spec calls out ">20m fade".
 */
const FADE_START_M = 14;
const FADE_END_M = 20;
const LIFT_Y = 2.35;

export function PlayerLabel({ player, isSelf }: { player: PlayerSnapshot; isSelf: boolean }) {
  const root = useRef<Group>(null);
  const materialRef = useRef<SpriteMaterial>(null);
  const { camera } = useThree();
  const labelCanvas = useMemo(() => {
    const cvs = document.createElement("canvas");
    cvs.width = 320;
    cvs.height = 72;
    return cvs;
  }, []);

  const drawnName = useRef<string | null>(null);
  const drawnSelf = useRef<boolean | null>(null);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const name = (player.name || "Adventurer").slice(0, 18);
    if (drawnName.current !== name || drawnSelf.current !== isSelf) {
      drawLabel(labelCanvas, name, isSelf);
      drawnName.current = name;
      drawnSelf.current = isSelf;
    }
    const dx = camera.position.x - player.x;
    const dy = camera.position.y - player.y;
    const dz = camera.position.z - player.z;
    const dist = Math.hypot(dx, dy, dz);
    const fade =
      dist <= FADE_START_M
        ? 1
        : dist >= FADE_END_M
          ? 0
          : 1 - (dist - FADE_START_M) / (FADE_END_M - FADE_START_M);
    g.visible = fade > 0.01 && player.alive;
    g.position.x = MathUtils.lerp(g.position.x, player.x, 0.35);
    g.position.y = LIFT_Y;
    g.position.z = MathUtils.lerp(g.position.z, player.z, 0.35);
    if (materialRef.current) materialRef.current.opacity = fade;
  });

  return (
    <group ref={root} position={[player.x, LIFT_Y, player.z]}>
      <Billboard>
        <sprite scale={[2.4, 0.54, 1]}>
          <spriteMaterial
            ref={materialRef}
            attach="material"
            sizeAttenuation
            toneMapped={false}
            transparent
            depthTest={false}
            depthWrite={false}
          >
            <canvasTexture attach="map" args={[labelCanvas]} />
          </spriteMaterial>
        </sprite>
      </Billboard>
    </group>
  );
}

export function PlayerLabels({
  players,
  sessionId,
}: {
  players: Map<string, PlayerSnapshot>;
  sessionId?: string;
}) {
  return (
    <>
      {[...players.values()].map((p) => (
        <PlayerLabel key={p.id} player={p} isSelf={p.id === sessionId} />
      ))}
    </>
  );
}

function drawLabel(cvs: HTMLCanvasElement, text: string, isSelf: boolean) {
  const ctx = cvs.getContext("2d");
  if (!ctx) return;
  const w = cvs.width;
  const h = cvs.height;
  ctx.clearRect(0, 0, w, h);
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = isSelf ? "#fde68a" : "#e4e4e7";
  ctx.fillText(text, w / 2, h / 2);
}
