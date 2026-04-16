import { Detailed } from "@react-three/drei";
import type { ReactElement } from "react";
import type { QualityTier } from "./qualityTier";

type LODDistances = [near: number, mid: number, far: number];

const TIER_DISTANCES: Record<QualityTier, LODDistances> = {
  high: [0, 20, 40],
  medium: [0, 12, 25],
  low: [0, 6, 14],
};

export function tierDistances(tier: QualityTier): LODDistances {
  return TIER_DISTANCES[tier];
}

export function TierAwareLOD({
  tier,
  high,
  medium,
  low,
}: {
  tier: QualityTier;
  high: ReactElement;
  medium: ReactElement;
  low: ReactElement;
}) {
  const distances = TIER_DISTANCES[tier];
  return (
    <Detailed distances={distances}>
      {high}
      {medium}
      {low}
    </Detailed>
  );
}
