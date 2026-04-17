import type { RoomState } from "@/net/useRoom";
import { QUEST_CATALOG } from "@game/shared";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, ScrollText, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "./sfx";

type Active = { id: string; title: string; xp: number; gold: number; at: number };

/** Triggers a celebration pop when a quest transitions to "complete" (the
 * kill/collect requirement is met) and again when the player actually turns
 * it in. Quest-complete plays once per transition; turn-in receives the
 * server's "quest-complete" ack. */
export function QuestToast({ room }: { room: RoomState }) {
  const [active, setActive] = useState<Active[]>([]);
  const knownRef = useRef<Map<string, string>>(new Map());

  const self = room.sessionId ? room.players.get(room.sessionId) : undefined;

  useEffect(() => {
    if (!self) return;
    const known = knownRef.current;
    for (const q of self.quests) {
      const prev = known.get(q.id);
      if (prev !== q.status && q.status === "complete") {
        const def = QUEST_CATALOG[q.id];
        if (def) {
          setActive((list) => [
            ...list,
            {
              id: `${q.id}-complete-${Date.now()}`,
              title: `${def.title} — ready to turn in!`,
              xp: def.xpReward,
              gold: def.goldReward,
              at: Date.now(),
            },
          ]);
          playSfx("questFanfare");
        }
      }
      known.set(q.id, q.status);
    }
  }, [self]);

  useEffect(() => {
    if (active.length === 0) return;
    const t = setTimeout(() => {
      setActive((list) => list.filter((a) => Date.now() - a.at < 3200));
    }, 3200);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <AnimatePresence>
      {active.slice(0, 2).map((a, idx) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="pointer-events-none absolute top-[300px] right-2 z-30 flex w-[260px] items-center gap-2 rounded-lg border border-amber-400/60 bg-background/85 px-3 py-2 shadow-xl backdrop-blur-md sm:right-4"
          style={{ top: 300 + idx * 64 }}
        >
          <ScrollText className="size-4 text-amber-400" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-xs">{a.title}</div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Star className="size-3 text-amber-400" />+{a.xp}
              </span>
              <span className="flex items-center gap-0.5">
                <Coins className="size-3 text-amber-400" />+{a.gold}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
