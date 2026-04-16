import type { PlayerSnapshot } from "@/net/useRoom";
import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type Group, MathUtils } from "three";

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 360) / 360;
}

function HPBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const WIDTH = 1.1;
  const HEIGHT = 0.12;
  const fillWidth = WIDTH * frac;
  const fillOffset = -(WIDTH - fillWidth) / 2;
  return (
    <Billboard position={[0, 1.15, 0]}>
      <mesh>
        <planeGeometry args={[WIDTH + 0.04, HEIGHT + 0.04]} />
        <meshBasicMaterial color="#111827" transparent opacity={0.75} />
      </mesh>
      <mesh position={[fillOffset, 0, 0.001]}>
        <planeGeometry args={[fillWidth, HEIGHT]} />
        <meshBasicMaterial
          color={frac > 0.5 ? "#22c55e" : frac > 0.25 ? "#eab308" : "#ef4444"}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}

function PlayerCube({ player, isSelf }: { player: PlayerSnapshot; isSelf: boolean }) {
  const ref = useRef<Group>(null);
  const target = useRef({ x: player.x, y: player.y, z: player.z });
  target.current.x = player.x;
  target.current.y = player.y;
  target.current.z = player.z;

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 14);
    g.position.x = MathUtils.lerp(g.position.x, target.current.x, k);
    g.position.y = MathUtils.lerp(g.position.y, target.current.y + 0.5, k);
    g.position.z = MathUtils.lerp(g.position.z, target.current.z, k);
  });

  const { color, emissive } = useMemo(() => {
    const hue = hashHue(player.id);
    return {
      color: new Color().setHSL(hue, 0.65, isSelf ? 0.62 : 0.5),
      emissive: new Color().setHSL(hue, 0.7, 0.3),
    };
  }, [player.id, isSelf]);

  const dead = !player.alive;

  return (
    <group ref={ref} position={[player.x, player.y + 0.5, player.z]}>
      <mesh castShadow visible={!dead}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={isSelf ? 0.55 : 0.25}
          metalness={0.3}
          roughness={0.3}
          transparent={dead}
          opacity={dead ? 0.25 : 1}
        />
      </mesh>
      {isSelf && !dead ? (
        <mesh position={[0, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.45, 24]} />
          <meshBasicMaterial color="#fde68a" />
        </mesh>
      ) : null}
      {!dead ? <HPBar hp={player.hp} maxHp={player.maxHp} /> : null}
    </group>
  );
}

export function Players({
  players,
  sessionId,
}: {
  players: Map<string, PlayerSnapshot>;
  sessionId?: string;
}) {
  return (
    <>
      {[...players.values()].map((p) => (
        <PlayerCube key={p.id} player={p} isSelf={p.id === sessionId} />
      ))}
    </>
  );
}
