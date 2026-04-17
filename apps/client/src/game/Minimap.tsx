import type { HazardSnapshot, MobSnapshot, NpcSnapshot, PlayerSnapshot } from "@/net/useRoom";
import { ZONES, type ZoneId } from "@game/shared";
import { useEffect, useRef, useState } from "react";

/**
 * Top-down HUD minimap. Renders zone bounds, portals as gold rings,
 * mobs as red dots, other players as hue-coded dots, and self as a larger
 * white dot with a facing indicator. Scales down on narrow viewports so
 * it doesn't collide with the HP/mana/XP panel.
 */
function pickSize(): number {
  if (typeof window === "undefined") return 160;
  return window.innerWidth < 640 ? 120 : 160;
}

export function Minimap({
  zoneId,
  players,
  mobs,
  npcs,
  hazards,
  sessionId,
}: {
  zoneId: ZoneId;
  players: Map<string, PlayerSnapshot>;
  mobs: Map<string, MobSnapshot>;
  npcs: Map<string, NpcSnapshot>;
  hazards: Map<string, HazardSnapshot>;
  sessionId?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<number>(() => pickSize());

  useEffect(() => {
    const onResize = () => setSize(pickSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    let raf = 0;
    const draw = () => {
      const zone = ZONES[zoneId];
      if (!zone) return;
      const minX = zone.bounds.min.x;
      const maxX = zone.bounds.max.x;
      const minZ = zone.bounds.min.z;
      const maxZ = zone.bounds.max.z;
      const spanX = maxX - minX;
      const spanZ = maxZ - minZ;
      const scale = (size - 16) / Math.max(spanX, spanZ);
      const offX = 8 + (size - 16 - spanX * scale) / 2;
      const offZ = 8 + (size - 16 - spanZ * scale) / 2;
      const toX = (wx: number) => offX + (wx - minX) * scale;
      const toY = (wz: number) => offZ + (wz - minZ) * scale;

      ctx.clearRect(0, 0, size, size);
      // panel background
      ctx.fillStyle = "rgba(9, 9, 11, 0.7)";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(161, 161, 170, 0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
      // zone bounds
      ctx.strokeStyle = "rgba(161, 161, 170, 0.35)";
      ctx.strokeRect(toX(minX), toY(minZ), spanX * scale, spanZ * scale);

      // portals
      for (const p of zone.portals) {
        ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
        ctx.beginPath();
        ctx.arc(toX(p.pos.x), toY(p.pos.z), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(toX(p.pos.x), toY(p.pos.z), 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // hazards (orange exclamation glyph — drawn first so mobs/players stack on top)
      for (const h of hazards.values()) {
        const px = toX(h.x);
        const py = toY(h.z);
        ctx.strokeStyle = "rgba(249, 115, 22, 0.35)";
        ctx.lineWidth = 1;
        const rScale = Math.max(3, h.radius * scale * 0.45);
        ctx.beginPath();
        ctx.arc(px, py, rScale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#f97316";
        ctx.font = "bold 10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", px, py + 0.5);
      }

      // mobs (healer = green "+", others = red dot)
      for (const m of mobs.values()) {
        const px = toX(m.x);
        const py = toY(m.z);
        if (m.kind === "healer") {
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px - 4, py);
          ctx.lineTo(px + 4, py);
          ctx.moveTo(px, py - 4);
          ctx.lineTo(px, py + 4);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // NPCs — distinct glyphs per kind so "vendor in lobby" and
      // "quest-giver in lobby" are recognisable at a glance.
      for (const n of npcs.values()) {
        const px = toX(n.x);
        const py = toY(n.z);
        if (n.kind === "vendor") {
          ctx.fillStyle = "#f59e0b"; // amber
          ctx.beginPath();
          ctx.moveTo(px, py - 5);
          ctx.lineTo(px + 5, py);
          ctx.lineTo(px, py + 5);
          ctx.lineTo(px - 5, py);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.55)";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (n.kind === "questgiver") {
          ctx.fillStyle = "#facc15"; // brighter yellow so it reads differently from portals
          const r = 5;
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const x = px + Math.cos(a) * r;
            const y = py + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.55)";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = "#a3a3a3";
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // players (others = cyan; self = white dot)
      for (const p of players.values()) {
        if (p.id === sessionId) continue;
        ctx.fillStyle = "#22d3ee";
        ctx.beginPath();
        ctx.arc(toX(p.x), toY(p.z), 3, 0, Math.PI * 2);
        ctx.fill();
      }

      const self = sessionId ? players.get(sessionId) : undefined;
      if (self) {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(toX(self.x), toY(self.z), 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // zone label
      ctx.fillStyle = "rgba(250, 250, 250, 0.85)";
      ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(zone.name, 6, 6);
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [zoneId, players, mobs, npcs, hazards, sessionId, size]);

  return (
    <div
      className="pointer-events-none absolute top-20 left-2 overflow-hidden rounded-lg border border-border/50 shadow-md backdrop-blur-md sm:top-4 sm:left-4"
      style={{ width: size, height: size }}
    >
      <canvas ref={ref} style={{ width: size, height: size, display: "block" }} />
    </div>
  );
}
