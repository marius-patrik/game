import { QualityProvider, useQuality } from "@/assets";
import { CinematicGate } from "@/cinematic";
import { VirtualJoystick } from "@/input/VirtualJoystick";
import { isTouchDevice } from "@/input/isTouchDevice";
import { useRoom } from "@/net/useRoom";
import { useTheme } from "@/theme/theme-provider";
import type { ChatChannel } from "@game/shared";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AttackButton } from "./AttackButton";
import { ChatPanel } from "./ChatPanel";
import { DeathOverlay } from "./DeathOverlay";
import { HUD } from "./HUD";
import { InventoryBar } from "./InventoryBar";
import { PickupPrompt } from "./PickupPrompt";
import { ProgressBar } from "./ProgressBar";
import { Scene } from "./Scene";
import { useAttack } from "./useAttack";
import { useMovement } from "./useMovement";

const CINEMATIC_STORAGE_KEY = "cinematic.intro.played";
const CLIENT_RESPAWN_DELAY_MS = 2500;

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
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(isTouchDevice()), []);

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

  const onMove = useCallback(
    (pos: { x: number; y: number; z: number }) => room.send("move", pos),
    [room.send],
  );
  const onAttack = useCallback(() => room.send("attack"), [room.send]);
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

  const deathAtRef = useRef<number | undefined>(undefined);
  const lastAliveRef = useRef(true);
  useEffect(() => {
    if (lastAliveRef.current && !alive) deathAtRef.current = Date.now();
    if (!lastAliveRef.current && alive) deathAtRef.current = undefined;
    lastAliveRef.current = alive;
  }, [alive]);

  useMovement({
    enabled: canAct,
    initial: { x: self?.x ?? 0, y: 0, z: self?.z ?? 0 },
    onSend: onMove,
  });
  useAttack({ enabled: canAct, onAttack });

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
            cinematicActive={cinematicActive}
            onCinematicComplete={finishCinematic}
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
      {touch && room.sessionId && !cinematicActive ? (
        <>
          <VirtualJoystick />
          <AttackButton disabled={!alive} />
        </>
      ) : null}
      {!cinematicActive && room.sessionId ? (
        <>
          <ProgressBar player={self} />
          <InventoryBar player={self} onUse={onUse} onEquip={onEquip} />
          <PickupPrompt player={self} drops={room.drops} onPickup={onPickup} />
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
