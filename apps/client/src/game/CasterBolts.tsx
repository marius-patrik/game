import { Trail } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type Mesh, Vector3 } from "three";
import type { CasterBoltSnapshot } from "@/net/useRoom";

/**
 * Visual bolts from caster mobs. Each bolt interpolates from its origin to
 * its landing position over the server-scheduled flight time. Damage is
 * resolved authoritatively on the server — the client just animates; hit
 * vs. miss is signalled by a state transition on the snapshot.
 */
export function CasterBolts({ bolts }: { bolts: Map<string, CasterBoltSnapshot> }) {
  const list = Array.from(bolts.values());
  if (list.length === 0) return null;
  return (
    <>
      {list.map((b) => (
        <Bolt key={b.id} bolt={b} />
      ))}
    </>
  );
}

function Bolt({ bolt }: { bolt: CasterBoltSnapshot }) {
  const ref = useRef<Mesh>(null);
  // Reuse Vector3 instances to avoid per-frame allocations.
  const tmp = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const elapsed = Date.now() - bolt.spawnAt;
    const t = Math.max(0, Math.min(1, elapsed / bolt.durationMs));
    // Slight parabolic arc so bolts read as thrown rather than hitscan.
    const arc = Math.sin(t * Math.PI) * 0.6;
    tmp.set(
      bolt.from.x + (bolt.to.x - bolt.from.x) * t,
      bolt.from.y + (bolt.to.y - bolt.from.y) * t + arc,
      bolt.from.z + (bolt.to.z - bolt.from.z) * t,
    );
    m.position.copy(tmp);
    // fade + pulse on impact/miss
    const life = bolt.state === "flying" ? 1 : Math.max(0, 1 - (elapsed - bolt.durationMs) / 200);
    m.scale.setScalar(0.85 + Math.sin(elapsed * 0.02) * 0.1 * life);
  });

  const color = bolt.state === "miss" ? "#94a3b8" : "#a78bfa";
  return (
    <Trail width={0.5} length={2.4} color={color} attenuation={(t) => t * t}>
      <mesh ref={ref} position={[bolt.from.x, bolt.from.y, bolt.from.z]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
    </Trail>
  );
}
