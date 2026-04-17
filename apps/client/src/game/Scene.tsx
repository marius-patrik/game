import { TierAwareLOD, useQuality } from "@/assets";
import { useCameraIntro } from "@/cinematic";
import { SparkBurst } from "@/fx";
import type { DropSnapshot, MobSnapshot, PlayerSnapshot } from "@/net/useRoom";
import { useTheme } from "@/theme/theme-provider";
import { DEFAULT_ZONE, ZONES, type ZoneId } from "@game/shared";
import { Environment, Float, OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { type Group, MathUtils, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Drops } from "./Drops";
import { Mobs } from "./Mobs";
import { Players } from "./Players";
import { Portals } from "./Portals";
import { resolveZonePalette } from "./zonePalette";

type Vec3 = { x: number; y: number; z: number };

export function Scene({
  players,
  drops,
  mobs,
  sessionId,
  zoneId = DEFAULT_ZONE,
  moveTarget,
  cinematicActive = false,
  onCinematicComplete,
  onGroundClick,
  onAttack,
  onPickup,
}: {
  players: Map<string, PlayerSnapshot>;
  drops: Map<string, DropSnapshot>;
  mobs: Map<string, MobSnapshot>;
  sessionId?: string;
  zoneId?: ZoneId;
  moveTarget: Vec3 | null;
  cinematicActive?: boolean;
  onCinematicComplete?: () => void;
  onGroundClick: (pos: Vec3) => void;
  onAttack: () => void;
  onPickup: (dropId: string) => void;
}) {
  const cubeGroup = useRef<Group>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { resolved } = useTheme();
  const { tier, budget } = useQuality();

  useCameraIntro({
    active: cinematicActive,
    onComplete: onCinematicComplete ?? (() => {}),
  });

  const zone = ZONES[zoneId];
  const palette = resolveZonePalette(zone, resolved);
  const self = sessionId ? players.get(sessionId) : undefined;
  const width = zone.bounds.max.x - zone.bounds.min.x;
  const depth = zone.bounds.max.z - zone.bounds.min.z;
  const gridSize = Math.max(width, depth);

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
      <fog attach="fog" args={[palette.bg, palette.fogNear, palette.fogFar]} />
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
      <Drops drops={drops} onPickup={onPickup} />
      <Mobs mobs={mobs} onAttack={onAttack} />
      <Portals portals={zone.portals} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={(e) => {
          e.stopPropagation();
          onGroundClick({ x: e.point.x, y: 0, z: e.point.z });
        }}
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={palette.ground} roughness={0.9} />
      </mesh>

      {moveTarget ? <MoveTargetMarker pos={moveTarget} /> : null}

      <gridHelper args={[gridSize, gridSize, palette.gridMajor, palette.gridMinor]} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={4}
        maxDistance={22}
        maxPolarAngle={Math.PI * 0.48}
        enabled={!cinematicActive}
      />
      <ChaseCamera self={self} controlsRef={controlsRef} cinematicActive={cinematicActive} />
    </>
  );
}

function ChaseCamera({
  self,
  controlsRef,
  cinematicActive,
}: {
  self: PlayerSnapshot | undefined;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  cinematicActive: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const snapped = useRef(false);

  // Snap on mount / zone change / player id change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentional triggers only
  useEffect(() => {
    snapped.current = false;
  }, [self?.id]);

  useFrame((_, dt) => {
    if (cinematicActive || !self) return;
    const controls = controlsRef.current;
    if (!controls) return;
    const k = 1 - Math.exp(-dt * 8);
    if (!snapped.current) {
      const offset = new Vector3(
        camera.position.x - controls.target.x,
        camera.position.y - controls.target.y,
        camera.position.z - controls.target.z,
      );
      controls.target.set(self.x, self.y, self.z);
      camera.position.set(self.x + offset.x, self.y + offset.y, self.z + offset.z);
      snapped.current = true;
    } else {
      controls.target.x = MathUtils.lerp(controls.target.x, self.x, k);
      controls.target.y = MathUtils.lerp(controls.target.y, self.y, k);
      controls.target.z = MathUtils.lerp(controls.target.z, self.z, k);
    }
    controls.update();
  });
  return null;
}

function MoveTargetMarker({ pos }: { pos: Vec3 }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.getElapsedTime();
    const s = 1 + Math.sin(t * 6) * 0.08;
    g.scale.set(s, 1, s);
  });
  return (
    <group ref={ref} position={[pos.x, 0.01, pos.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.42, 32]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}
