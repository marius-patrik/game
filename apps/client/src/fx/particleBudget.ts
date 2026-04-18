import { type QualityTier, TIER_BUDGETS } from "@/assets";

export function scaleParticleCount(baseCount: number, tier: QualityTier): number {
  if (!Number.isFinite(baseCount) || baseCount <= 0) return 0;
  const scaled = Math.floor(baseCount * TIER_BUDGETS[tier].particleMultiplier);
  return Math.max(1, scaled);
}

export function particleMultiplier(tier: QualityTier): number {
  return TIER_BUDGETS[tier].particleMultiplier;
}
