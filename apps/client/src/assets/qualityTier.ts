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
  /** Chromatic-aberration layer on the PostProcessing stack — expensive
   * fragment pass that mobile skips even if `postFX` is on. */
  chromaticAberration: boolean;
  /** Multiplier applied to every burst/trail/ember count declared on the
   * particle presets. Mobile halves; desktop-high passes through. */
  particleMultiplier: number;
  /** Bloom is always on at medium+, but intensity drops on mobile so the
   * scene doesn't blow out on high-DPR screens. */
  bloomIntensity: number;
  shadowMapSize: number;
};

export const TIER_BUDGETS: Record<QualityTier, TierBudget> = {
  low: {
    maxDrawCalls: 150,
    maxTextureMB: 64,
    maxDPR: 1.5,
    postFX: false,
    chromaticAberration: false,
    particleMultiplier: 0.35,
    bloomIntensity: 0,
    shadowMapSize: 512,
  },
  medium: {
    maxDrawCalls: 300,
    maxTextureMB: 128,
    maxDPR: 1.75,
    postFX: true,
    chromaticAberration: false,
    particleMultiplier: 0.6,
    bloomIntensity: 0.5,
    shadowMapSize: 1024,
  },
  high: {
    maxDrawCalls: 500,
    maxTextureMB: 256,
    maxDPR: 2,
    postFX: true,
    chromaticAberration: true,
    particleMultiplier: 1,
    bloomIntensity: 0.8,
    shadowMapSize: 2048,
  },
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
