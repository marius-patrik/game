import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useMemo, useRef } from "react";
import { type Group, MathUtils } from "three";
import type { DropSnapshot, NpcSnapshot } from "@/net/useRoom";

type Vec3 = { x: number; y: number; z: number };

const INTERACT_RADIUS = 2.2;

/**
 * Renders a floating "press E" (or "Talk") prompt above the nearest
 * interactable entity when the local player is within INTERACT_RADIUS.
 * For drops the prompt is implicit — pickup happens automatically as you
 * cross the range (see useAutoPickup). For NPCs the prompt gates on an
 * interact action from the player.
 */
export function InteractionPrompt({
  npcs,
  drops,
  selfPosRef,
  activeTargetId,
}: {
  npcs: Map<string, NpcSnapshot>;
  drops: Map<string, DropSnapshot>;
  selfPosRef?: MutableRefObject<Vec3>;
  activeTargetId?: string;
}) {
  const root = useRef<Group>(null);
  const lastDrawnText = useRef("");
  const lastDrawnColor = useRef("");
  const labelCanvas = useMemo(() => {
    const cvs = document.createElement("canvas");
    cvs.width = 256;
    cvs.height = 64;
    return cvs;
  }, []);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const self = selfPosRef?.current;
    if (!self) {
      g.visible = false;
      return;
    }
    const nearest = findNearest(npcs, drops, self, activeTargetId);
    if (!nearest) {
      g.visible = false;
      return;
    }
    g.visible = true;
    // target a bit above the entity head
    const liftY = nearest.kind === "npc" ? 1.9 : 0.9;
    g.position.x = MathUtils.lerp(g.position.x, nearest.x, 0.35);
    g.position.y = MathUtils.lerp(g.position.y, liftY, 0.35);
    g.position.z = MathUtils.lerp(g.position.z, nearest.z, 0.35);
    const label = nearest.kind === "npc" ? `Talk — ${nearest.name}` : "Pick up";
    const color = nearest.kind === "npc" ? "#fde68a" : "#a7f3d0";
    if (lastDrawnText.current !== label || lastDrawnColor.current !== color) {
      drawLabel(labelCanvas, label, color);
      lastDrawnText.current = label;
      lastDrawnColor.current = color;
    }
  });

  return (
    <group ref={root} visible={false}>
      <Billboard>
        <sprite scale={[1.8, 0.45, 1]}>
          <spriteMaterial attach="material" sizeAttenuation toneMapped={false} transparent>
            <canvasTexture attach="map" args={[labelCanvas]} />
          </spriteMaterial>
        </sprite>
      </Billboard>
    </group>
  );
}

type NearestHit = {
  kind: "npc" | "drop";
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  dist: number;
};

function findNearest(
  npcs: Map<string, NpcSnapshot>,
  drops: Map<string, DropSnapshot>,
  self: Vec3,
  activeTargetId?: string,
): NearestHit | null {
  let best: NearestHit | null = null;
  const r2 = INTERACT_RADIUS * INTERACT_RADIUS;
  // If the active NPC panel is open, we still show the prompt on that entity
  // so the player knows they can close it by walking away or pressing the key.
  for (const n of npcs.values()) {
    const dx = n.x - self.x;
    const dz = n.z - self.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > r2 && n.id !== activeTargetId) continue;
    if (!best || d2 < best.dist) {
      best = { kind: "npc", id: n.id, name: n.name, x: n.x, y: n.y, z: n.z, dist: d2 };
    }
  }
  for (const d of drops.values()) {
    const dx = d.x - self.x;
    const dz = d.z - self.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > r2) continue;
    if (!best || d2 < best.dist) {
      best = { kind: "drop", id: d.id, name: d.itemId, x: d.x, y: d.y, z: d.z, dist: d2 };
    }
  }
  return best;
}
function drawLabel(cvs: HTMLCanvasElement, text: string, color: string) {
  const ctx = cvs.getContext("2d");
  if (!ctx) return;
  const w = cvs.width;
  const h = cvs.height;
  ctx.clearRect(0, 0, w, h);
  ctx.font = "600 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);
}
