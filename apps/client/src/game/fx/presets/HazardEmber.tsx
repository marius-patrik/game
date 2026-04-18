import { Sparkles } from "@react-three/drei";
import { useQuality } from "@/assets";
import { scaleParticleCount } from "@/fx/particleBudget";
import { GAME_PALETTE } from "@/game/gamePalette";

/**
 * Ambient amber sparkles for hazard zones — a persistent emitter that
 * layers on top of the existing ring + fill geometry. The `HazardZones`
 * component mounts one of these per active hazard.
 */
export function HazardEmber({ radius }: { radius: number }) {
  const { tier } = useQuality();
  const count = scaleParticleCount(Math.round(14 + radius * 6), tier);
  return (
    <Sparkles
      count={count}
      scale={[radius * 2, 1.2, radius * 2]}
      size={2.6}
      speed={0.35}
      color={GAME_PALETTE.hazard.ember}
      opacity={0.8}
    />
  );
}
