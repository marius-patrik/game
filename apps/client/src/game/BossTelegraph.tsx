import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { type Group, MathUtils } from "three";
import type { BossTelegraphEvent } from "@/net/useRoom";

type Active = {
  id: string;
  x: number;
  z: number;
  radius: number;
  until: number;
  from: number;
};

/** Listens for boss-telegraph events and renders a pulsing red floor ring at
 * each wind-up position. The ring shrinks from full radius to the impact
 * point during the telegraph duration, so the player can dodge by walking
 * out before it hits. */
export function BossTelegraph({ event }: { event: BossTelegraphEvent | undefined }) {
  const [active, setActive] = useState<Active[]>([]);
  const seenRef = useRef<BossTelegraphEvent | undefined>(undefined);

  useEffect(() => {
    if (!event || event === seenRef.current) return;
    seenRef.current = event;
    const now = Date.now();
    const ticket: Active = {
      id: `${event.mobId}-${event.at}`,
      x: event.pos.x,
      z: event.pos.z,
      radius: event.radius,
      from: now,
      until: now + event.durationMs,
    };
    setActive((prev) => [...prev, ticket]);
  }, [event]);

  useEffect(() => {
    if (active.length === 0) return;
    const soonest = active.reduce((m, a) => Math.min(m, a.until), Number.POSITIVE_INFINITY);
    const wait = Math.max(0, soonest - Date.now());
    const t = setTimeout(() => {
      setActive((prev) => prev.filter((a) => a.until > Date.now()));
    }, wait + 16);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <>
      {active.map((a) => (
        <TelegraphRing key={a.id} ticket={a} />
      ))}
    </>
  );
}

function TelegraphRing({ ticket }: { ticket: Active }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const now = Date.now();
    const total = ticket.until - ticket.from;
    const remaining = Math.max(0, ticket.until - now);
    const progress = 1 - remaining / total; // 0 -> 1
    const scale = MathUtils.lerp(ticket.radius, 0.25, progress);
    g.scale.set(scale, 1, scale);
  });
  return (
    <group ref={ref} position={[ticket.x, 0.02, ticket.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 1, 48]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.75} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.005]}>
        <circleGeometry args={[0.78, 32]} />
        <meshBasicMaterial color="#7f1d1d" transparent opacity={0.28} toneMapped={false} />
      </mesh>
    </group>
  );
}
