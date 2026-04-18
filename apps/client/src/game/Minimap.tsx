import { ZONES, type ZoneId } from "@game/shared";
import { useEffect, useRef, useState } from "react";
import type { HazardSnapshot, MobSnapshot, NpcSnapshot, PlayerSnapshot } from "@/net/useRoom";
import { GAME_PALETTE } from "./gamePalette";

const MINIMAP = GAME_PALETTE.minimap;

/**
 * Top-down HUD minimap. Renders zone bounds, portals as gold rings, mobs as
 * red dots, other players as cyan dots, self as a larger white dot. The canvas
 * resizes to fill whichever container it's mounted in — the Map tab uses that
 * to fill the full pane height.
 */

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<number>(160);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const next = Math.max(96, Math.floor(Math.min(width, height)));
        setSize((s) => (Math.abs(s - next) > 1 ? next : s));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
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
      ctx.fillStyle = MINIMAP.bg;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = MINIMAP.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
      // zone bounds
      ctx.strokeStyle = MINIMAP.grid;
      ctx.strokeRect(toX(minX), toY(minZ), spanX * scale, spanZ * scale);

      // portals
      for (const p of zone.portals) {
        ctx.fillStyle = MINIMAP.portalFill;
        ctx.beginPath();
        ctx.arc(toX(p.pos.x), toY(p.pos.z), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = MINIMAP.portalRing;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(toX(p.pos.x), toY(p.pos.z), 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // hazards (orange exclamation glyph — drawn first so mobs/players stack on top)
      for (const h of hazards.values()) {
        const px = toX(h.x);
        const py = toY(h.z);
        ctx.strokeStyle = MINIMAP.hazardRing;
        ctx.lineWidth = 1;
        const rScale = Math.max(3, h.radius * scale * 0.45);
        ctx.beginPath();
        ctx.arc(px, py, rScale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = MINIMAP.hazardFill;
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
          ctx.strokeStyle = MINIMAP.mobHealer;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px - 4, py);
          ctx.lineTo(px + 4, py);
          ctx.moveTo(px, py - 4);
          ctx.lineTo(px, py + 4);
          ctx.stroke();
        } else {
          ctx.fillStyle = MINIMAP.mobAlive;
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
          ctx.fillStyle = MINIMAP.npcIcon;
          ctx.beginPath();
          ctx.moveTo(px, py - 5);
          ctx.lineTo(px + 5, py);
          ctx.lineTo(px, py + 5);
          ctx.lineTo(px - 5, py);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = MINIMAP.iconStroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (n.kind === "questgiver") {
          ctx.fillStyle = MINIMAP.npcReady;
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
          ctx.strokeStyle = MINIMAP.iconStroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = MINIMAP.mobDead;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // players (others = cyan; self = white dot)
      for (const p of players.values()) {
        if (p.id === sessionId) continue;
        ctx.fillStyle = MINIMAP.self;
        ctx.beginPath();
        ctx.arc(toX(p.x), toY(p.z), 3, 0, Math.PI * 2);
        ctx.fill();
      }

      const self = sessionId ? players.get(sessionId) : undefined;
      if (self) {
        ctx.fillStyle = MINIMAP.other;
        ctx.strokeStyle = MINIMAP.other;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(toX(self.x), toY(self.z), 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // zone label
      ctx.fillStyle = MINIMAP.text;
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
      ref={wrapperRef}
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg border border-border/50"
    >
      <canvas ref={ref} style={{ width: size, height: size, display: "block" }} />
    </div>
  );
}
