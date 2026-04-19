import type { ZoneLightingProfile } from "@game/shared";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Outline,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Color, Vector2 } from "three";
import { useQuality } from "@/assets";
import { useRoom } from "@/net/useRoom";

const ABERRATION_BASE = new Vector2(0.0008, 0.0008);
const ABERRATION_HIT = new Vector2(0.0042, 0.0042);

/**
 * Scene-root post-processing stack — outline pass + bloom + chromatic
 * aberration + vignette. Tier-gated:
 *
 * - `low` (mobile): composer entirely skipped. Outlines fall back to a
 *   thin scene-material contour; the overall look stays cohesive because
 *   the cell shader already flattens the diffuse.
 * - `medium`: bloom + vignette + a slimmer outline (edgeStrength 3).
 * - `high`: full stack including chromatic aberration that spikes for
 *   180ms on every player-damage hit, and a thick Borderlands-style
 *   outline (edgeStrength 6).
 *
 * The composer lives inside the `<Canvas />` tree — mount it at the root of
 * `Scene` so all drawn geometry flows through it.
 */
export function PostProcessing({
  cellPalette,
}: {
  cellPalette?: ZoneLightingProfile["cellPalette"];
}) {
  const { tier, budget } = useQuality();
  const [aberration, setAberration] = useState<Vector2>(ABERRATION_BASE);
  const room = useRoom();

  const outlineColor = useMemo(() => {
    if (!cellPalette) return 0x05030a;
    return new Color(cellPalette.outline).getHex();
  }, [cellPalette]);

  useEffect(() => {
    if (!budget.chromaticAberration) return;
    const self = room.sessionId ? room.players.get(room.sessionId) : undefined;
    if (!self) return;
    const onHit = () => {
      setAberration(ABERRATION_HIT);
      const to = window.setTimeout(() => setAberration(ABERRATION_BASE), 180);
      return () => window.clearTimeout(to);
    };
    const id = window.setInterval(() => {
      const cur = room.sessionId ? room.players.get(room.sessionId) : undefined;
      if (!cur) return;
      const prev = lastHpRef.v;
      if (prev !== undefined && cur.alive && cur.hp < prev) {
        onHit();
      }
      lastHpRef.v = cur.hp;
    }, 120);
    return () => window.clearInterval(id);
  }, [budget.chromaticAberration, room.sessionId, room.players]);

  if (!budget.postFX) return null;

  const effects: ReactElement[] = [];

  // Borderlands-style thick outline. Desktop reads bolder (edgeStrength 6
  // ≈ 2-3px on a 1440p viewport); medium trims to ~1-2px so mobile Chrome
  // holds the 30 FPS floor without a GPU spike on every frame.
  const outlineEdgeStrength = tier === "high" ? 6 : 3;
  effects.push(
    <Outline
      key="outline"
      blendFunction={BlendFunction.NORMAL}
      edgeStrength={outlineEdgeStrength}
      visibleEdgeColor={outlineColor}
      hiddenEdgeColor={outlineColor}
      blur={false}
      pulseSpeed={0}
      xRay={false}
      kernelSize={KernelSize.SMALL}
    />,
  );

  effects.push(
    <Bloom
      key="bloom"
      intensity={budget.bloomIntensity}
      luminanceThreshold={0.82}
      luminanceSmoothing={0.2}
      mipmapBlur
    />,
  );
  if (budget.chromaticAberration) {
    effects.push(
      <ChromaticAberration
        key="chromatic"
        offset={aberration}
        radialModulation={false}
        modulationOffset={0}
      />,
    );
  }
  effects.push(<Vignette key="vignette" eskil={false} offset={0.2} darkness={0.55} />);

  return <EffectComposer multisampling={0}>{effects}</EffectComposer>;
}

const lastHpRef: { v: number | undefined } = { v: undefined };
