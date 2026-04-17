import { Progress } from "@/components/ui/progress";
import type { PlayerSnapshot } from "@/net/useRoom";
import { QUEST_CATALOG } from "@game/shared";
import { ScrollText } from "lucide-react";

const MAX_TRACKED = 2;

export function QuestTracker({ player }: { player: PlayerSnapshot | undefined }) {
  if (!player) return null;
  const active = player.quests
    .filter((q) => q.status === "active" || q.status === "complete")
    .slice(0, MAX_TRACKED);
  if (active.length === 0) return null;
  return (
    <div className="pointer-events-none absolute top-[140px] right-2 flex max-w-[220px] flex-col gap-1.5 rounded-lg border border-border/40 bg-background/70 px-3 py-2 backdrop-blur-md sm:top-[160px] sm:right-4 sm:max-w-[260px]">
      <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">
        <ScrollText className="size-3" />
        <span>Quests</span>
      </div>
      {active.map((q) => {
        const def = QUEST_CATALOG[q.id];
        if (!def) return null;
        const frac = q.goal > 0 ? (q.progress / q.goal) * 100 : 0;
        const done = q.status === "complete";
        return (
          <div key={q.id} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className={done ? "font-semibold text-emerald-400" : "font-semibold"}>
                {def.title}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {q.progress}/{q.goal}
              </span>
            </div>
            <Progress
              value={frac}
              indicatorClassName={done ? "bg-emerald-500" : "bg-sky-500"}
              className="h-1"
            />
          </div>
        );
      })}
    </div>
  );
}
