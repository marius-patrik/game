import type { PlayerSnapshot } from "@/net/useRoom";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Pulses a red vignette for ~220ms whenever the local player's HP drops.
 * Combined with a small CSS viewport nudge so heavy hits feel heavier. */
export function HitVignette({ self }: { self: PlayerSnapshot | undefined }) {
  const [hitAt, setHitAt] = useState<number | undefined>();
  const [shakeKey, setShakeKey] = useState(0);
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
      setShakeKey((k) => k + 1);
    }
    lastHp.current = self.hp;
    lastAlive.current = self.alive;
  }, [self]);

  return (
    <>
      <AnimatePresence>
        {hitAt !== undefined && Date.now() - hitAt < 300 ? (
          <motion.div
            key={hitAt}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 z-30"
            data-testid="hit-vignette"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(220,38,38,0.45) 100%)",
            }}
            onAnimationComplete={() => setHitAt(undefined)}
          />
        ) : null}
      </AnimatePresence>
      {/* Viewport nudge — a 60ms offset applied to the container. */}
      <ShakeStyle key={shakeKey} />
    </>
  );
}

function ShakeStyle({ key: _ }: { key?: number }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 180);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <style>{`
      @keyframes hit-shake {
        0% { transform: translate(0, 0); }
        20% { transform: translate(-3px, 2px); }
        40% { transform: translate(3px, -2px); }
        60% { transform: translate(-2px, -1px); }
        80% { transform: translate(2px, 1px); }
        100% { transform: translate(0, 0); }
      }
      .relative.h-full.w-full { animation: hit-shake 180ms ease-out; }
    `}</style>
  );
}
