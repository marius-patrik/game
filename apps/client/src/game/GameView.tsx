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

export function GameView() {
  const { resolved } = useTheme();
  const room = useRoom();
  const bg = resolved === "dark" ? "#09090b" : "#fafafa";
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(isTouchDevice()), []);

  const onMove = useCallback(
    (pos: { x: number; y: number; z: number }) => room.send("move", pos),
    [room.send],
  );

  const self = room.sessionId ? room.players.get(room.sessionId) : undefined;
  useMovement({
    enabled: Boolean(room.sessionId),
    initial: { x: self?.x ?? 0, y: 0, z: self?.z ?? 0 },
    onSend: onMove,
  });

  return (
    <div className="relative h-full w-full" style={{ background: bg }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [4, 4, 8], fov: 55 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <Scene players={room.players} sessionId={room.sessionId} />
          <EffectComposer multisampling={0}>
            <Bloom intensity={0.6} luminanceThreshold={0.85} mipmapBlur />
            <Vignette eskil={false} offset={0.15} darkness={0.6} />
          </EffectComposer>
        </Suspense>
      </Canvas>
      <HUD
        status={room.status}
        playerCount={room.players.size}
        zoneId={room.zoneId}
        onTravel={room.travel}
      />
      {touch && room.sessionId ? <VirtualJoystick /> : null}
    </div>
  );
}
