export type QualityTier = "low" | "medium" | "high";

export type QualityEnv = {
  pointerCoarse: boolean;
  devicePixelRatio: number;
  hardwareConcurrency: number;
  deviceMemory?: number;
};

export type TierBudget = {
  maxDrawCalls: number;
  maxTextureMB: number;
  maxDPR: number;
  postFX: boolean;
  shadowMapSize: number;
};

export const TIER_BUDGETS: Record<QualityTier, TierBudget> = {
  low: { maxDrawCalls: 150, maxTextureMB: 64, maxDPR: 1.5, postFX: false, shadowMapSize: 512 },
  medium: {
    maxDrawCalls: 300,
    maxTextureMB: 128,
    maxDPR: 1.75,
    postFX: true,
    shadowMapSize: 1024,
  },
  high: { maxDrawCalls: 500, maxTextureMB: 256, maxDPR: 2, postFX: true, shadowMapSize: 2048 },
};

export function detectQualityEnv(): QualityEnv {
  const hasWindow = typeof window !== "undefined";
  const hasNav = typeof navigator !== "undefined";
  return {
    pointerCoarse:
      hasWindow && typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)").matches
        : false,
    devicePixelRatio: hasWindow ? window.devicePixelRatio : 1,
    hardwareConcurrency: hasNav ? (navigator.hardwareConcurrency ?? 4) : 4,
    deviceMemory: hasNav
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      : undefined,
  };
}

export function pickQualityTier(env: QualityEnv = detectQualityEnv()): QualityTier {
  if (env.pointerCoarse) {
    if ((env.deviceMemory ?? 4) < 4 || env.hardwareConcurrency <= 4) return "low";
    return "medium";
  }
  if (env.hardwareConcurrency >= 8 && (env.deviceMemory ?? 8) >= 8) return "high";
  return "medium";
}
