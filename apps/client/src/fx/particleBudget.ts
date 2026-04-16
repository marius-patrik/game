import type { QualityTier } from "@/assets";

const TIER_MULTIPLIER: Record<QualityTier, number> = {
  low: 0.25,
  medium: 0.5,
  high: 1,
};

export function scaleParticleCount(baseCount: number, tier: QualityTier): number {
  if (!Number.isFinite(baseCount) || baseCount <= 0) return 0;
  const scaled = Math.floor(baseCount * TIER_MULTIPLIER[tier]);
  return Math.max(1, scaled);
}

export function particleMultiplier(tier: QualityTier): number {
  return TIER_MULTIPLIER[tier];
}
