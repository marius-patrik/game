import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense } from "react";
import { useTheme } from "@/theme/theme-provider";
import { HUD } from "./HUD";
import { Scene } from "./Scene";

export function GameView() {
  const { resolved } = useTheme();
  const bg = resolved === "dark" ? "#09090b" : "#fafafa";
  return (
    <div className="relative h-full w-full" style={{ background: bg }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [4, 4, 8], fov: 55 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <Scene />
          <EffectComposer multisampling={0}>
            <Bloom intensity={0.6} luminanceThreshold={0.85} mipmapBlur />
            <Vignette eskil={false} offset={0.15} darkness={0.6} />
          </EffectComposer>
        </Suspense>
      </Canvas>
      <HUD />
    </div>
  );
}
