import { QUEST_CATALOG } from "@game/shared";
import { Coins, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import type { QuestSnapshot } from "@/net/useRoom";

export function DailyQuestsHeader({ dailyQuests }: { dailyQuests: QuestSnapshot[] }) {
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (dailyQuests.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/40 p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm tracking-tight">Daily Quests</h3>
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
          <Timer className="size-3" />
          <span>{timeLeft}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {dailyQuests.map((q) => {
          const def = QUEST_CATALOG[q.id];
          if (!def) return null;
          const complete = q.status === "complete";
          const frac = q.goal > 0 ? Math.min(100, (q.progress / q.goal) * 100) : 0;

          return (
            <div key={q.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium leading-none">{def.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {q.progress} / {q.goal}
                </span>
              </div>
              <Progress
                value={frac}
                indicatorClassName={complete ? "bg-emerald-500" : "bg-sky-500"}
                className="h-1"
              />
              {complete && (
                <div className="flex items-center justify-end gap-2 text-[10px] text-emerald-500 font-medium">
                  <span>+{def.xpReward} XP</span>
                  <span className="flex items-center gap-0.5 text-amber-400">
                    <Coins className="size-2.5" />
                    {def.goldReward}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTimeUntilMidnight() {
  const now = new Date();
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);

  const diff = midnight.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
