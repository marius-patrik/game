import type { QualityTier } from "@/assets";

const TIER_DURATION_MULTIPLIER: Record<QualityTier, number> = {
  low: 0.5,
  medium: 0.75,
  high: 1,
};

export function scaleCinematicDuration(baseMs: number, tier: QualityTier): number {
  if (!Number.isFinite(baseMs) || baseMs <= 0) return 0;
  return Math.max(250, Math.floor(baseMs * TIER_DURATION_MULTIPLIER[tier]));
}
