import type { PlayerSnapshot } from "@/net/useRoom";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type Group, MathUtils } from "three";

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 360) / 360;
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

  return (
    <group ref={ref} position={[player.x, player.y + 0.5, player.z]}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={isSelf ? 0.55 : 0.25}
          metalness={0.3}
          roughness={0.3}
        />
      </mesh>
      {isSelf ? (
        <mesh position={[0, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.45, 24]} />
          <meshBasicMaterial color="#fde68a" />
        </mesh>
      ) : null}
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
