import { TierAwareLOD, useQuality } from "@/assets";
import { useCameraIntro } from "@/cinematic";
import { SparkBurst } from "@/fx";
import type { PlayerSnapshot } from "@/net/useRoom";
import { useTheme } from "@/theme/theme-provider";
import { Environment, Float, OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { Players } from "./Players";

export function Scene({
  players,
  sessionId,
  cinematicActive = false,
  onCinematicComplete,
}: {
  players: Map<string, PlayerSnapshot>;
  sessionId?: string;
  cinematicActive?: boolean;
  onCinematicComplete?: () => void;
}) {
  const cubeGroup = useRef<Group>(null);
  const { resolved } = useTheme();
  const { tier, budget } = useQuality();

  useCameraIntro({
    active: cinematicActive,
    onComplete: onCinematicComplete ?? (() => {}),
  });
  const palette =
    resolved === "dark"
      ? {
          bg: "#09090b",
          ground: "#18181b",
          gridMajor: "#27272a",
          gridMinor: "#1c1c1f",
          ambient: 0.25,
          preset: "city" as const,
        }
      : {
          bg: "#fafafa",
          ground: "#e4e4e7",
          gridMajor: "#d4d4d8",
          gridMinor: "#e4e4e7",
          ambient: 0.6,
          preset: "apartment" as const,
        };

  useFrame((_, dt) => {
    if (!cubeGroup.current) return;
    cubeGroup.current.rotation.x += dt * 0.4;
    cubeGroup.current.rotation.y += dt * 0.6;
  });

  const material = (
    <meshStandardMaterial
      color="#a78bfa"
      emissive="#6d28d9"
      emissiveIntensity={0.35}
      metalness={0.5}
      roughness={0.18}
    />
  );

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.bg, 12, 40]} />
      <ambientLight intensity={palette.ambient} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[budget.shadowMapSize, budget.shadowMapSize]}
      />
      <Environment preset={palette.preset} />

      <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
        <group ref={cubeGroup} position={[0, 3, 0]}>
          <TierAwareLOD
            tier={tier}
            high={
              <mesh castShadow>
                <icosahedronGeometry args={[1, 3]} />
                {material}
              </mesh>
            }
            medium={
              <mesh castShadow>
                <icosahedronGeometry args={[1, 1]} />
                {material}
              </mesh>
            }
            low={
              <mesh castShadow>
                <boxGeometry args={[1.4, 1.4, 1.4]} />
                {material}
              </mesh>
            }
          />
        </group>
      </Float>

      <group position={[0, 3, 0]}>
        <SparkBurst baseCount={160} color="#f472b6" lifetime={1.2} speed={2.4} />
      </group>

      <Players players={players} sessionId={sessionId} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={palette.ground} roughness={0.9} />
      </mesh>

      <gridHelper args={[40, 40, palette.gridMajor, palette.gridMinor]} />

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} enabled={!cinematicActive} />
    </>
  );
}
