import { Bloom, ChromaticAberration, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Fragment, type ReactElement, useEffect, useState } from "react";
import { Vector2 } from "three";
import { useQuality } from "@/assets";
import { useRoom } from "@/net/useRoom";

const ABERRATION_BASE = new Vector2(0.0008, 0.0008);
const ABERRATION_HIT = new Vector2(0.0042, 0.0042);

/**
 * Scene-root post-processing stack — bloom, chromatic aberration, vignette.
 * Everything is tier-gated so mobile (`low`) skips the composer entirely,
 * medium runs bloom + vignette without chromatic, high adds a subtle
 * chromatic that spikes for 180ms on every player-damage hit.
 *
 * The composer lives inside the `<Canvas />` tree — mount it at the root of
 * `Scene` so all drawn geometry flows through it.
 */
export function PostProcessing() {
  const { budget } = useQuality();
  const [aberration, setAberration] = useState<Vector2>(ABERRATION_BASE);
  const room = useRoom();

  // Kick the chromatic aberration for ~180ms whenever local HP drops.
  useEffect(() => {
    if (!budget.chromaticAberration) return;
    const self = room.sessionId ? room.players.get(room.sessionId) : undefined;
    if (!self) return;
    // Cheap snapshot of the current HP — actual change-detection lives in
    // `HitVignette`. Here we only care about the kick timer.
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

  const effects: ReactElement[] = [
    <Bloom
      key="bloom"
      intensity={budget.bloomIntensity}
      luminanceThreshold={0.82}
      luminanceSmoothing={0.2}
      mipmapBlur
    />,
  ];
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

  return (
    <EffectComposer multisampling={0}>
      <Fragment>{effects}</Fragment>
    </EffectComposer>
  );
}

const lastHpRef: { v: number | undefined } = { v: undefined };
