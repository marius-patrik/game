import { QUEST_CATALOG, ZONES, type ZoneId } from "@game/shared";
import { Coins, MapPin, ScrollText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { PlayerSnapshot } from "@/net/useRoom";

/**
 * Top-right context strip — coins, currently tracked quest (only when one is
 * active or complete), and current zone. The quest card is conditional: it
 * disappears entirely when the player has none active.
 */
export function TopRightSidebar({
  player,
  zoneId,
}: {
  player: PlayerSnapshot | undefined;
  zoneId: ZoneId;
}) {
  const zone = ZONES[zoneId];
  const gold = player?.gold ?? 0;
  const activeQuest = player?.quests.find((q) => q.status === "active" || q.status === "complete");
  const questDef = activeQuest ? QUEST_CATALOG[activeQuest.id] : undefined;
  const frac =
    activeQuest && activeQuest.goal > 0
      ? Math.min(100, (activeQuest.progress / activeQuest.goal) * 100)
      : 0;
  const ready = activeQuest?.status === "complete";

  return (
    <div
      className="pointer-events-auto absolute top-2 right-2 flex max-w-[min(260px,60vw)] flex-col gap-2 sm:top-4 sm:right-4 sm:max-w-[260px]"
      data-testid="top-right-sidebar"
    >
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/70 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-1.5 text-amber-400">
          <Coins className="size-4" />
          <span className="font-semibold tabular-nums">{gold.toLocaleString()}</span>
        </div>
        <span className="text-muted-foreground text-[11px]">coins</span>
      </div>

      {activeQuest && questDef ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-background/70 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
            <ScrollText className="size-3" />
            Active quest
          </div>
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span
              className={cn(
                "min-w-0 truncate font-semibold",
                ready ? "text-emerald-400" : "text-foreground",
              )}
            >
              {questDef.title}
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {activeQuest.progress}/{activeQuest.goal}
            </span>
          </div>
          <Progress
            value={frac}
            indicatorClassName={ready ? "bg-emerald-500" : "bg-sky-500"}
            className="h-1.5"
          />
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/70 px-3 py-1.5 text-[11px] backdrop-blur-md">
        <MapPin className="size-3.5 text-muted-foreground" />
        <span className="truncate">{zone?.name ?? zoneId}</span>
      </div>
    </div>
  );
}
