import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { PlayerSnapshot } from "@/net/useRoom";
import { QUEST_CATALOG, getQuest } from "@game/shared";
import { Coins, ScrollText } from "lucide-react";
import { useState } from "react";

export function QuestPanel({
  player,
  onTurnIn,
  externalOpen,
  onExternalOpenChange,
}: {
  player: PlayerSnapshot | undefined;
  onTurnIn: (questId: string) => void;
  externalOpen?: boolean;
  onExternalOpenChange?: (o: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = onExternalOpenChange ?? setInternalOpen;
  if (!player) return null;
  const active = player.quests.filter((q) => q.status !== "turned_in");
  const activeCount = active.length;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto relative backdrop-blur-md bg-background/40"
          aria-label="Quests"
        >
          <ScrollText />
          <span className="hidden sm:inline">quests</span>
          {activeCount > 0 ? (
            <span className="-top-1 -right-1 absolute flex size-4 items-center justify-center rounded-full bg-amber-500 font-semibold text-[10px] text-amber-950">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quest Log</DialogTitle>
          <DialogDescription>
            Turn in completed quests with Elder Cubius (green cube in lobby).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-1">
          {Object.values(QUEST_CATALOG).map((def) => {
            const q = player.quests.find((x) => x.id === def.id);
            if (!q) return null;
            const frac = q.goal > 0 ? Math.min(100, (q.progress / q.goal) * 100) : 0;
            const turnedIn = q.status === "turned_in";
            const complete = q.status === "complete";
            return (
              <div
                key={def.id}
                className="flex flex-col gap-1.5 rounded-md border border-border/40 bg-muted/30 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{def.title}</div>
                  <div className="text-muted-foreground text-[11px] uppercase">
                    {turnedIn ? "done" : complete ? "ready" : "active"}
                  </div>
                </div>
                <div className="text-muted-foreground text-xs">{def.summary}</div>
                <Progress
                  value={frac}
                  indicatorClassName={
                    turnedIn ? "bg-muted-foreground" : complete ? "bg-emerald-500" : "bg-sky-500"
                  }
                  className="h-1.5"
                />
                <div className="flex items-center justify-between text-[11px]">
                  <span className="tabular-nums">
                    {q.progress}/{q.goal}
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span>+{def.xpReward} XP</span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <Coins className="size-3" />
                      {def.goldReward}
                    </span>
                  </span>
                </div>
                {complete && !turnedIn ? (
                  <Button size="sm" onClick={() => onTurnIn(def.id)}>
                    Turn in
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { QUEST_CATALOG, getQuest };
