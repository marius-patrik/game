import { TierAwareLOD, useQuality } from "@/assets";
import { useCameraIntro } from "@/cinematic";
import { SparkBurst } from "@/fx";
import type {
  AttackEvent,
  DropSnapshot,
  MobSnapshot,
  NpcSnapshot,
  PlayerSnapshot,
} from "@/net/useRoom";
import { useTheme } from "@/theme/theme-provider";
import { DEFAULT_ZONE, ZONES, type ZoneId } from "@game/shared";
import { Environment, Float } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { type Group, MathUtils, Vector3 } from "three";
import { DamageNumbers } from "./DamageNumbers";
import { Drops } from "./Drops";
import { Mobs } from "./Mobs";
import { Npcs } from "./Npcs";
import { Players } from "./Players";
import { Portals } from "./Portals";
import { resolveZonePalette } from "./zonePalette";

type Vec3 = { x: number; y: number; z: number };

// Fixed 3rd-person arm — feels like a camera on a boom attached to the player.
// Yaw is locked; no orbit controls at all, so portal travel + zone swap carry
// a predictable viewpoint into the new room.
const CAMERA_HEIGHT = 7;
const CAMERA_DISTANCE = 9.5;
const CAMERA_YAW = -Math.PI / 4;

export function Scene({
  players,
  drops,
  mobs,
  npcs,
  sessionId,
  zoneId = DEFAULT_ZONE,
  moveTarget,
  lastAttack,
  cinematicActive = false,
  onCinematicComplete,
  onGroundClick,
  onAttack,
  onPickup,
  onNpcClick,
}: {
  players: Map<string, PlayerSnapshot>;
  drops: Map<string, DropSnapshot>;
  mobs: Map<string, MobSnapshot>;
  npcs: Map<string, NpcSnapshot>;
  sessionId?: string;
  zoneId?: ZoneId;
  moveTarget: Vec3 | null;
  lastAttack?: AttackEvent;
  cinematicActive?: boolean;
  onCinematicComplete?: () => void;
  onGroundClick: (pos: Vec3) => void;
  onAttack: () => void;
  onPickup: (dropId: string) => void;
  onNpcClick: (npc: NpcSnapshot) => void;
}) {
  const cubeGroup = useRef<Group>(null);
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

      <Players players={players} sessionId={sessionId} lastAttack={lastAttack} />
      <Drops drops={drops} onPickup={onPickup} />
      <Mobs mobs={mobs} onAttack={onAttack} lastAttack={lastAttack} />
      <Npcs npcs={npcs} onInteract={onNpcClick} />
      <Portals portals={zone.portals} />
      <DamageNumbers lastAttack={lastAttack} players={players} mobs={mobs} />

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

      <ChaseArm self={self} cinematicActive={cinematicActive} />
    </>
  );
}

function ChaseArm({
  self,
  cinematicActive,
}: {
  self: PlayerSnapshot | undefined;
  cinematicActive: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const snapped = useRef(false);
  const lookAtTarget = useRef(new Vector3());
  const desiredPos = useRef(new Vector3());

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentional triggers only
  useEffect(() => {
    snapped.current = false;
  }, [self?.id]);

  useFrame((_, dt) => {
    if (cinematicActive || !self) return;
    desiredPos.current.set(
      self.x + Math.sin(CAMERA_YAW) * CAMERA_DISTANCE,
      self.y + CAMERA_HEIGHT,
      self.z + Math.cos(CAMERA_YAW) * CAMERA_DISTANCE,
    );
    lookAtTarget.current.set(self.x, self.y + 0.6, self.z);

    if (!snapped.current) {
      camera.position.copy(desiredPos.current);
      camera.lookAt(lookAtTarget.current);
      snapped.current = true;
    } else {
      const k = 1 - Math.exp(-dt * 10);
      camera.position.x = MathUtils.lerp(camera.position.x, desiredPos.current.x, k);
      camera.position.y = MathUtils.lerp(camera.position.y, desiredPos.current.y, k);
      camera.position.z = MathUtils.lerp(camera.position.z, desiredPos.current.z, k);
      camera.lookAt(lookAtTarget.current);
    }
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.001]}>
        <ringGeometry args={[0.12, 0.18, 24]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}
