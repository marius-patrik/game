import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { type Group, MathUtils } from "three";
import type { AbilityCastEvent, AttackEvent, MobSnapshot, PlayerSnapshot } from "@/net/useRoom";
import { GAME_PALETTE } from "./gamePalette";

const LIFETIME_MS = 850;
const RISE = 1.4;
const BASE_DAMAGE = 15;

type Ticket = {
  id: number;
  x: number;
  y: number;
  z: number;
  amount: number;
  killed: boolean;
  crit: boolean;
  until: number;
};

let ticketCounter = 0;

function resolveTargetPos(
  targetId: string,
  players: Map<string, PlayerSnapshot>,
  mobs: Map<string, MobSnapshot>,
): { x: number; y: number; z: number } | null {
  if (targetId.startsWith("mob:")) {
    const m = mobs.get(targetId.slice(4));
    return m ? { x: m.x, y: m.y, z: m.z } : null;
  }
  const p = players.get(targetId);
  return p ? { x: p.x, y: p.y, z: p.z } : null;
}

export function DamageNumbers({
  lastAttack,
  lastAbility,
  players,
  mobs,
}: {
  lastAttack: AttackEvent | undefined;
  lastAbility?: AbilityCastEvent;
  players: Map<string, PlayerSnapshot>;
  mobs: Map<string, MobSnapshot>;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const seenAttack = useRef<AttackEvent | undefined>(undefined);
  const seenAbility = useRef<AbilityCastEvent | undefined>(undefined);

  useEffect(() => {
    if (!lastAttack) return;
    if (seenAttack.current === lastAttack) return;
    seenAttack.current = lastAttack;
    const pos = resolveTargetPos(lastAttack.targetId, players, mobs);
    if (!pos) return;
    const now = Date.now();
    ticketCounter += 1;
    const amount = lastAttack.dmg ?? BASE_DAMAGE;
    const ticket: Ticket = {
      id: ticketCounter,
      x: pos.x,
      y: pos.y + 1.4,
      z: pos.z,
      amount,
      killed: lastAttack.killed,
      crit: lastAttack.crit ?? false,
      until: now + LIFETIME_MS,
    };
    setTickets((prev) => [...prev, ticket]);
  }, [lastAttack, players, mobs]);

  useEffect(() => {
    if (!lastAbility) return;
    if (seenAbility.current === lastAbility) return;
    seenAbility.current = lastAbility;
    if (lastAbility.hits <= 0) return;
    const dmg = lastAbility.dmg ?? 0;
    if (dmg <= 0) return;
    const targetId = lastAbility.targetId;
    const pos = targetId
      ? resolveTargetPos(targetId, players, mobs)
      : { x: lastAbility.pos.x, y: lastAbility.pos.y, z: lastAbility.pos.z };
    if (!pos) return;
    const now = Date.now();
    ticketCounter += 1;
    const ticket: Ticket = {
      id: ticketCounter,
      x: pos.x,
      y: pos.y + 1.4,
      z: pos.z,
      amount: dmg,
      killed: lastAbility.killed ?? false,
      crit: lastAbility.crit ?? false,
      until: now + LIFETIME_MS,
    };
    setTickets((prev) => [...prev, ticket]);
  }, [lastAbility, players, mobs]);

  useEffect(() => {
    if (tickets.length === 0) return;
    const soonest = tickets.reduce((m, t) => Math.min(m, t.until), Number.POSITIVE_INFINITY);
    const wait = Math.max(0, soonest - Date.now());
    const handle = setTimeout(() => {
      setTickets((prev) => prev.filter((t) => t.until > Date.now()));
    }, wait + 16);
    return () => clearTimeout(handle);
  }, [tickets]);

  return (
    <>
      {tickets.map((t) => (
        <DamageNumber key={t.id} ticket={t} />
      ))}
    </>
  );
}

function DamageNumber({ ticket }: { ticket: Ticket }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const elapsed = (Date.now() - (ticket.until - LIFETIME_MS)) / LIFETIME_MS;
    const e = MathUtils.clamp(elapsed, 0, 1);
    g.position.y = ticket.y + RISE * e;
    const baseScale = ticket.killed ? 1.4 - 0.2 * e : 1 + 0.25 * (1 - e);
    const critBump = ticket.crit ? 1.45 : 1;
    g.scale.setScalar(baseScale * critBump);
  });
  const text = ticket.killed ? "KILL!" : ticket.crit ? `-${ticket.amount}!` : `-${ticket.amount}`;
  const color = ticket.killed
    ? GAME_PALETTE.dmg.kill
    : ticket.crit
      ? GAME_PALETTE.dmg.crit
      : GAME_PALETTE.dmg.hit;
  return (
    <group ref={ref} position={[ticket.x, ticket.y, ticket.z]}>
      <Billboard>
        <DmgSprite text={text} color={color} />
      </Billboard>
    </group>
  );
}

// Rendering text in three.js without loading a font is non-trivial — we use
// a canvas texture sprite so we don't have to ship a font file.
function DmgSprite({ text, color }: { text: string; color: string }) {
  const canvas = makeTextCanvas(text, color);
  return (
    <sprite scale={[text.length * 0.28 + 0.6, 0.7, 1]}>
      <spriteMaterial attach="material" sizeAttenuation toneMapped={false}>
        <canvasTexture attach="map" args={[canvas]} />
      </spriteMaterial>
    </sprite>
  );
}

function makeTextCanvas(text: string, color: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const w = 256;
  const h = 96;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.font = "700 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = GAME_PALETTE.dmg.stroke;
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);
  return canvas;
}
