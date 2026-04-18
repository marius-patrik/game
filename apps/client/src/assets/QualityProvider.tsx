import { createContext, type ReactNode, useContext, useMemo } from "react";
import { pickQualityTier, type QualityTier, TIER_BUDGETS, type TierBudget } from "./qualityTier";

type QualityContext = { tier: QualityTier; budget: TierBudget };

const Ctx = createContext<QualityContext | null>(null);

export function QualityProvider({
  children,
  tier: tierOverride,
}: {
  children: ReactNode;
  tier?: QualityTier;
}) {
  const value = useMemo<QualityContext>(() => {
    const tier = tierOverride ?? pickQualityTier();
    return { tier, budget: TIER_BUDGETS[tier] };
  }, [tierOverride]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQuality(): QualityContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useQuality must be used inside <QualityProvider>");
  return ctx;
}
