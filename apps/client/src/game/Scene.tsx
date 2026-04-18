import { DEFAULT_ZONE, ZONES, type ZoneId } from "@game/shared";
import { Environment, Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useRef } from "react";
import type { Group } from "three";
import { TierAwareLOD, useQuality } from "@/assets";
import { useCameraIntro } from "@/cinematic";
import { SparkBurst } from "@/fx";
import type {
  AbilityCastEvent,
  AttackEvent,
  BossTelegraphEvent,
  CasterBoltSnapshot,
  DropSnapshot,
  HazardSnapshot,
  MobSnapshot,
  NpcSnapshot,
  PlayerSnapshot,
} from "@/net/useRoom";
import { BossTelegraph } from "./BossTelegraph";
import { CasterBolts } from "./CasterBolts";
import { ChaseCamera } from "./camera/ChaseCamera";
import { usePortalCameraPush } from "./cinematics";
import { ClickBurst } from "./cursor/ClickBurst";
import { Cursor3D } from "./cursor/Cursor3D";
import { peekGround, peekLocked } from "./cursor/cursorStore";
import { DamageNumbers } from "./DamageNumbers";
import { Drops } from "./Drops";
import { HazardZones } from "./HazardZones";
import { InteractionPrompt } from "./InteractionPrompt";
import { Mobs } from "./Mobs";
import { Npcs } from "./Npcs";
import { PlayerLabels } from "./PlayerLabel";
import { Players } from "./Players";
import { Portals } from "./Portals";
import { SafeZoneRing } from "./SafeZoneRing";
import { MoveCircle, Targeter, useActiveTargetingSource } from "./targeting";
import { ZoneDecor } from "./ZoneDecor";
import { resolveZonePalette } from "./zonePalette";

type Vec3 = { x: number; y: number; z: number };

// Keep the 3D scene on a stable palette so app chrome can theme independently.
const SCENE_THEME = "light" as const;

export function Scene({
  players,
  drops,
  mobs,
  npcs,
  hazards,
  bolts,
  sessionId,
  zoneId = DEFAULT_ZONE,
  moveTarget,
  lastAttack,
  lastAbility,
  lastTelegraph,
  selfPosRef,
  cinematicActive = false,
  portalCinematicActive = false,
  onCinematicComplete,
  onGroundClick,
  onPickup,
  onNpcInteract,
  interactionTargetId,
}: {
  players: Map<string, PlayerSnapshot>;
  drops: Map<string, DropSnapshot>;
  mobs: Map<string, MobSnapshot>;
  npcs: Map<string, NpcSnapshot>;
  hazards: Map<string, HazardSnapshot>;
  bolts: Map<string, CasterBoltSnapshot>;
  sessionId?: string;
  zoneId?: ZoneId;
  moveTarget: Vec3 | null;
  lastAttack?: AttackEvent;
  lastAbility?: AbilityCastEvent;
  lastTelegraph?: BossTelegraphEvent;
  selfPosRef?: MutableRefObject<Vec3>;
  cinematicActive?: boolean;
  portalCinematicActive?: boolean;
  onCinematicComplete?: () => void;
  onGroundClick: (pos: Vec3) => void;
  onPickup: (dropId: string) => void;
  onNpcInteract: (npc: NpcSnapshot) => void;
  interactionTargetId?: string;
}) {
  const cubeGroup = useRef<Group>(null);
  const { tier, budget } = useQuality();
  const targetingSource = useActiveTargetingSource();

  useCameraIntro({
    active: cinematicActive,
    onComplete: onCinematicComplete ?? (() => {}),
  });

  usePortalCameraPush({ active: portalCinematicActive });

  const zone = ZONES[zoneId];
  const palette = resolveZonePalette(zone, SCENE_THEME);
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

      {/* Decorative floating centerpiece — small, high up, out of the action. */}
      <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
        <group ref={cubeGroup} position={[0, 6, 0]}>
          <TierAwareLOD
            tier={tier}
            high={
              <mesh castShadow>
                <icosahedronGeometry args={[0.7, 3]} />
                {material}
              </mesh>
            }
            medium={
              <mesh castShadow>
                <icosahedronGeometry args={[0.7, 1]} />
                {material}
              </mesh>
            }
            low={
              <mesh castShadow>
                <boxGeometry args={[0.9, 0.9, 0.9]} />
                {material}
              </mesh>
            }
          />
        </group>
      </Float>

      <group position={[0, 6, 0]}>
        <SparkBurst baseCount={80} color="#f472b6" lifetime={1.2} speed={1.6} />
      </group>

      <ZoneDecor zoneId={zoneId} />

      <Players
        players={players}
        sessionId={sessionId}
        lastAttack={lastAttack}
        selfPosRef={selfPosRef}
      />
      <PlayerLabels players={players} sessionId={sessionId} />
      <Drops drops={drops} selfPosRef={selfPosRef} onPickup={onPickup} />
      <Mobs mobs={mobs} lastAttack={lastAttack} />
      <Npcs npcs={npcs} onInteract={onNpcInteract} />
      <HazardZones hazards={hazards} />
      <Portals
        portals={zone.portals}
        players={players}
        sessionId={sessionId}
        selfPosRef={selfPosRef}
      />
      {zoneId === "lobby" ? <SafeZoneRing center={zone.spawn} /> : null}
      <DamageNumbers
        lastAttack={lastAttack}
        lastAbility={lastAbility}
        players={players}
        mobs={mobs}
      />
      <BossTelegraph event={lastTelegraph} />
      <CasterBolts bolts={bolts} />

      <InteractionPrompt
        npcs={npcs}
        drops={drops}
        selfPosRef={selfPosRef}
        activeTargetId={interactionTargetId}
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={(e) => {
          // Swallow left-clicks on the ground while a targeter is active —
          // the targeter's global handler confirms the cast, and we do NOT
          // want a simultaneous move-to-here to queue behind it.
          if (e.button === 0 && targetingSource !== null) {
            e.stopPropagation();
            return;
          }
          if (e.button !== 0) return;
          e.stopPropagation();
          // In cursor-lock mode the native pointer is frozen at the lock
          // entry point, so `e.point` does NOT reflect where the player is
          // looking. Fall back to the shared ground-cursor ray (which is
          // camera-centred in that mode).
          if (peekLocked()) {
            const g = peekGround();
            if (g) onGroundClick({ x: g.x, y: 0, z: g.z });
            return;
          }
          onGroundClick({ x: e.point.x, y: 0, z: e.point.z });
        }}
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={palette.ground} roughness={0.9} />
      </mesh>

      {moveTarget ? <MoveTargetMarker pos={moveTarget} /> : null}

      <gridHelper args={[gridSize, gridSize, palette.gridMajor, palette.gridMinor]} />

      <Cursor3D />
      <ClickBurst />
      <MoveCircle />
      <Targeter selfPosRef={selfPosRef} />

      {selfPosRef ? (
        <ChaseCamera
          selfPosRef={selfPosRef}
          enabled={!cinematicActive}
          fovOverrideActive={cinematicActive || portalCinematicActive}
        />
      ) : null}
    </>
  );
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
