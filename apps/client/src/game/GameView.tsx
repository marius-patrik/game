import { QualityProvider, useQuality } from "@/assets";
import { CinematicGate } from "@/cinematic";
import { VirtualJoystick } from "@/input/VirtualJoystick";
import { isTouchDevice } from "@/input/isTouchDevice";
import { useRoom } from "@/net/useRoom";
import { useTheme } from "@/theme/theme-provider";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useCallback, useEffect, useState } from "react";
import { HUD } from "./HUD";
import { Scene } from "./Scene";
import { useMovement } from "./useMovement";

const CINEMATIC_STORAGE_KEY = "cinematic.intro.played";

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

  const self = room.sessionId ? room.players.get(room.sessionId) : undefined;
  useMovement({
    enabled: Boolean(room.sessionId) && !cinematicActive,
    initial: { x: self?.x ?? 0, y: 0, z: self?.z ?? 0 },
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
            sessionId={room.sessionId}
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
      {touch && room.sessionId && !cinematicActive ? <VirtualJoystick /> : null}
    </div>
  );
}
