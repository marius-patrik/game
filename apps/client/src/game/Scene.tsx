import { Environment, Float, OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import { useTheme } from "@/theme/theme-provider";

export function Scene() {
  const cube = useRef<Mesh>(null);
  const { resolved } = useTheme();
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
    if (!cube.current) return;
    cube.current.rotation.x += dt * 0.4;
    cube.current.rotation.y += dt * 0.6;
  });

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.bg, 12, 40]} />
      <ambientLight intensity={palette.ambient} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <Environment preset={palette.preset} />

      <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
        <mesh ref={cube} castShadow position={[0, 1.2, 0]}>
          <boxGeometry args={[1.4, 1.4, 1.4]} />
          <meshStandardMaterial
            color="#a78bfa"
            emissive="#6d28d9"
            emissiveIntensity={0.35}
            metalness={0.5}
            roughness={0.18}
          />
        </mesh>
      </Float>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={palette.ground} roughness={0.9} />
      </mesh>

      <gridHelper args={[40, 40, palette.gridMajor, palette.gridMinor]} />

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </>
  );
}
