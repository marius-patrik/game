import type { PlayerSnapshot } from "@/net/useRoom";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "./sfx";

/**
 * Full-width "LEVEL UP!" banner + starburst when the local player's level
 * increments. Auto-dismisses after 1.6s.
 */
export function LevelUpBanner({ self }: { self: PlayerSnapshot | undefined }) {
  const [visibleFor, setVisibleFor] = useState<number | undefined>();
  const lastLevel = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!self) return;
    if (lastLevel.current === undefined) {
      lastLevel.current = self.level;
      return;
    }
    if (self.level > lastLevel.current) {
      setVisibleFor(self.level);
      playSfx("levelup");
      const t = setTimeout(() => setVisibleFor(undefined), 1600);
      lastLevel.current = self.level;
      return () => clearTimeout(t);
    }
    lastLevel.current = self.level;
  }, [self]);

  return (
    <AnimatePresence>
      {visibleFor !== undefined ? (
        <motion.div
          key={visibleFor}
          initial={{ opacity: 0, scale: 0.6, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.15, y: -10 }}
          transition={{ duration: 0.45, ease: [0.22, 1.6, 0.36, 1] }}
          className="pointer-events-none absolute top-[28%] left-1/2 z-40 -translate-x-1/2"
        >
          <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-400 bg-background/80 px-6 py-3 shadow-2xl backdrop-blur-md">
            <Sparkles className="size-6 text-amber-400" />
            <div className="text-center">
              <div className="font-bold text-amber-400 text-xs uppercase tracking-widest">
                Level up!
              </div>
              <div className="flex items-center gap-1.5 font-bold text-2xl">
                <Star className="size-5 text-amber-400" />
                <span>Lv {visibleFor}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                +3 stat points · HP + mana restored
              </div>
            </div>
            <Sparkles className="size-6 text-amber-400" />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
