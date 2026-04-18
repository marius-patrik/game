import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { triggerScreenShake } from "@/game/fx";
import type { PlayerSnapshot } from "@/net/useRoom";

/** Pulses a red vignette for ~220ms whenever the local player's HP drops.
 * Camera shake + DOM shake are triggered through the shared ScreenShake
 * store so the effect stacks cleanly with level-up / boss-telegraph. */
export function HitVignette({ self }: { self: PlayerSnapshot | undefined }) {
  const [hitAt, setHitAt] = useState<number | undefined>();
  const lastHp = useRef<number | undefined>(undefined);
  const lastAlive = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (!self) return;
    if (lastHp.current === undefined) {
      lastHp.current = self.hp;
      lastAlive.current = self.alive;
      return;
    }
    // Ignore HP increases (heals) and the respawn-full bump.
    if (self.alive && lastAlive.current && self.hp < lastHp.current) {
      setHitAt(Date.now());
      triggerScreenShake("hit");
    }
    lastHp.current = self.hp;
    lastAlive.current = self.alive;
  }, [self]);

  return (
    <AnimatePresence>
      {hitAt !== undefined && Date.now() - hitAt < 300 ? (
        <motion.div
          key={hitAt}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, var(--hit-vignette) 100%)`,
          }}
          onAnimationComplete={() => setHitAt(undefined)}
        />
      ) : null}
    </AnimatePresence>
  );
}
