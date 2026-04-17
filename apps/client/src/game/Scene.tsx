import { TierAwareLOD, useQuality } from "@/assets";
import { useCameraIntro } from "@/cinematic";
import { SparkBurst } from "@/fx";
import type {
  AttackEvent,
  BossTelegraphEvent,
  CasterBoltSnapshot,
  DropSnapshot,
  MobSnapshot,
  NpcSnapshot,
  PlayerSnapshot,
} from "@/net/useRoom";
import { useTheme } from "@/theme/theme-provider";
import { DEFAULT_ZONE, ZONES, type ZoneId } from "@game/shared";
import { Environment, Float, OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useRef } from "react";
import { type Group, MathUtils, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { BossTelegraph } from "./BossTelegraph";
import { CasterBolts } from "./CasterBolts";
import { DamageNumbers } from "./DamageNumbers";
import { Drops } from "./Drops";
import { InteractionPrompt } from "./InteractionPrompt";
import { Mobs } from "./Mobs";
import { Npcs } from "./Npcs";
import { Players } from "./Players";
import { Portals } from "./Portals";
import { ZoneDecor } from "./ZoneDecor";
import { usePortalCameraPush } from "./cinematics";
import { resolveZonePalette } from "./zonePalette";

type Vec3 = { x: number; y: number; z: number };

/** Cam arm defaults. User can still rotate/zoom via OrbitControls. */
const CAMERA_MIN_DIST = 6;
const CAMERA_MAX_DIST = 18;
const CAMERA_INITIAL_DIST = 10;
const CAMERA_INITIAL_POLAR = Math.PI * 0.32;
const CAMERA_INITIAL_YAW = Math.PI * 0.75;

export function Scene({
  players,
  drops,
  mobs,
  npcs,
  bolts,
  sessionId,
  zoneId = DEFAULT_ZONE,
  moveTarget,
  lastAttack,
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
  bolts: Map<string, CasterBoltSnapshot>;
  sessionId?: string;
  zoneId?: ZoneId;
  moveTarget: Vec3 | null;
  lastAttack?: AttackEvent;
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
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { resolved } = useTheme();
  const { tier, budget } = useQuality();

  useCameraIntro({
    active: cinematicActive,
    onComplete: onCinematicComplete ?? (() => {}),
  });

  usePortalCameraPush({ active: portalCinematicActive });

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
      <Drops drops={drops} onPickup={onPickup} />
      <Mobs mobs={mobs} lastAttack={lastAttack} />
      <Npcs npcs={npcs} onInteract={onNpcInteract} />
      <Portals portals={zone.portals} />
      <DamageNumbers lastAttack={lastAttack} players={players} mobs={mobs} />
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
        dampingFactor={0.12}
        enablePan={false}
        minDistance={CAMERA_MIN_DIST}
        maxDistance={CAMERA_MAX_DIST}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.46}
        rotateSpeed={0.8}
        zoomSpeed={0.7}
        enabled={!cinematicActive && !portalCinematicActive}
      />
      <ChaseTarget
        self={self}
        selfPosRef={selfPosRef}
        controlsRef={controlsRef}
        cinematicActive={cinematicActive}
      />
    </>
  );
}

/** Drives the OrbitControls target to follow the player. The user keeps
 * free rotation + zoom around the character — the camera orbits *with* the
 * player, not around a fixed world point. */
function ChaseTarget({
  self,
  selfPosRef,
  controlsRef,
  cinematicActive,
}: {
  self: PlayerSnapshot | undefined;
  selfPosRef?: MutableRefObject<Vec3>;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  cinematicActive: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const initialized = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentional triggers only
  useEffect(() => {
    initialized.current = false;
  }, [self?.id]);

  useFrame((_, dt) => {
    if (cinematicActive || !self) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const src = selfPosRef?.current ?? self;
    const targetX = src.x;
    const targetY = 0.5 + 0.6;
    const targetZ = src.z;

    if (!initialized.current) {
      // Place camera on a predictable arm angle on first frame so the
      // initial view is consistent across zone swaps / respawns.
      const offX =
        Math.sin(CAMERA_INITIAL_YAW) * CAMERA_INITIAL_DIST * Math.sin(CAMERA_INITIAL_POLAR);
      const offY = CAMERA_INITIAL_DIST * Math.cos(CAMERA_INITIAL_POLAR);
      const offZ =
        Math.cos(CAMERA_INITIAL_YAW) * CAMERA_INITIAL_DIST * Math.sin(CAMERA_INITIAL_POLAR);
      controls.target.set(targetX, targetY, targetZ);
      camera.position.set(targetX + offX, targetY + offY, targetZ + offZ);
      initialized.current = true;
    } else {
      // Preserve the camera offset from the current target. Moving the
      // target without touching camera.position makes the camera follow
      // the character smoothly while the user retains their rotation/zoom.
      const prevX = controls.target.x;
      const prevY = controls.target.y;
      const prevZ = controls.target.z;
      const k = 1 - Math.exp(-dt * 18);
      const nx = MathUtils.lerp(prevX, targetX, k);
      const ny = MathUtils.lerp(prevY, targetY, k);
      const nz = MathUtils.lerp(prevZ, targetZ, k);
      const dx = nx - prevX;
      const dy = ny - prevY;
      const dz = nz - prevZ;
      controls.target.set(nx, ny, nz);
      camera.position.add(new Vector3(dx, dy, dz));
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.001]}>
        <ringGeometry args={[0.12, 0.18, 24]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}
