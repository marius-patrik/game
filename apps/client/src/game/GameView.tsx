import { QualityProvider, useQuality } from "@/assets";
import { CinematicGate } from "@/cinematic";
import { useRoom } from "@/net/useRoom";
import { useTheme } from "@/theme/theme-provider";
import { type ChatChannel, ZONES } from "@game/shared";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { DeathOverlay } from "./DeathOverlay";
import { HUD } from "./HUD";
import { InventoryBar } from "./InventoryBar";
import { ProgressBar } from "./ProgressBar";
import { Scene } from "./Scene";
import { useClickControls } from "./useClickControls";

type Vec3 = { x: number; y: number; z: number };

const CINEMATIC_STORAGE_KEY = "cinematic.intro.played";
const CLIENT_RESPAWN_DELAY_MS = 2500;
const ATTACK_COOLDOWN_MS = 400;

export function GameView() {
  return (
    <QualityProvider>
      <GameViewInner />
    </QualityProvider>
  );
}

function GameViewInner() {
  const { resolved } = useTheme();
  const { budget } = useQuality();
  const room = useRoom();
  const bg = resolved === "dark" ? "#09090b" : "#fafafa";

  const [cinematicActive, setCinematicActive] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CINEMATIC_STORAGE_KEY) !== "1";
  });
  const finishCinematic = useCallback(() => {
    setCinematicActive(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CINEMATIC_STORAGE_KEY, "1");
    }
  }, []);

  const onMove = useCallback((pos: Vec3) => room.send("move", pos), [room.send]);
  const onPickup = useCallback((dropId: string) => room.send("pickup", { dropId }), [room.send]);
  const onUse = useCallback((itemId: string) => room.send("use", { itemId }), [room.send]);
  const onEquip = useCallback((itemId: string) => room.send("equip", { itemId }), [room.send]);
  const onChat = useCallback(
    (channel: ChatChannel, text: string) => room.send("chat", { channel, text }),
    [room.send],
  );

  const self = room.sessionId ? room.players.get(room.sessionId) : undefined;
  const alive = self?.alive ?? true;
  const canAct = Boolean(room.sessionId) && !cinematicActive && alive;
  const zone = ZONES[room.zoneId];

  const deathAtRef = useRef<number | undefined>(undefined);
  const lastAliveRef = useRef(true);
  useEffect(() => {
    if (lastAliveRef.current && !alive) deathAtRef.current = Date.now();
    if (!lastAliveRef.current && alive) deathAtRef.current = undefined;
    lastAliveRef.current = alive;
  }, [alive]);

  const [moveTarget, setMoveTarget] = useState<Vec3 | null>(null);
  // Reset click target on zone swap / respawn so we don't chase a stale point.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentional triggers only
  useEffect(() => {
    setMoveTarget(null);
  }, [room.zoneId, self?.alive]);
  const clearMoveTarget = useCallback(() => setMoveTarget(null), []);

  const onGroundClick = useCallback(
    (pos: Vec3) => {
      if (!canAct) return;
      setMoveTarget({ x: pos.x, y: 0, z: pos.z });
    },
    [canAct],
  );

  const lastAttackRef = useRef(0);
  const onAttack = useCallback(() => {
    if (!canAct) return;
    const now = performance.now();
    if (now - lastAttackRef.current < ATTACK_COOLDOWN_MS) return;
    lastAttackRef.current = now;
    room.send("attack");
  }, [canAct, room.send]);

  useClickControls({
    enabled: canAct,
    initial: { x: self?.x ?? zone.spawn.x, y: 0, z: self?.z ?? zone.spawn.z },
    zone,
    moveTarget,
    onArrive: clearMoveTarget,
    onSend: onMove,
  });

  return (
    <div className="relative h-full w-full" style={{ background: bg }}>
      <Canvas
        shadows
        dpr={[1, budget.maxDPR]}
        camera={{ position: [4, 4, 8], fov: 55 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <Scene
            players={room.players}
            drops={room.drops}
            mobs={room.mobs}
            sessionId={room.sessionId}
            zoneId={room.zoneId}
            moveTarget={moveTarget}
            cinematicActive={cinematicActive}
            onCinematicComplete={finishCinematic}
            onGroundClick={onGroundClick}
            onAttack={onAttack}
            onPickup={onPickup}
          />
          {budget.postFX ? (
            <EffectComposer multisampling={0}>
              <Bloom intensity={0.6} luminanceThreshold={0.85} mipmapBlur />
              <Vignette eskil={false} offset={0.15} darkness={0.6} />
            </EffectComposer>
          ) : null}
        </Suspense>
      </Canvas>
      <HUD
        status={room.status}
        playerCount={room.players.size}
        zoneId={room.zoneId}
        onTravel={room.travel}
      />
      <CinematicGate active={cinematicActive} onSkip={finishCinematic} />
      {!cinematicActive && room.sessionId ? (
        <>
          <ProgressBar player={self} />
          <InventoryBar player={self} onUse={onUse} onEquip={onEquip} />
          <ChatPanel entries={room.chat} onSend={onChat} enabled={Boolean(room.sessionId)} />
        </>
      ) : null}
      <DeathOverlay
        dead={!alive && !cinematicActive}
        respawnDelayMs={CLIENT_RESPAWN_DELAY_MS}
        deathAt={deathAtRef.current}
      />
    </div>
  );
}
