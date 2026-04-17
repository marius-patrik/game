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
import type { PlayerSnapshot } from "@/net/useRoom";
import type { StatKey } from "@game/shared";
import { Activity, Plus } from "lucide-react";
import { useState } from "react";

const STATS: { key: StatKey; label: string; desc: string }[] = [
  { key: "strength", label: "Strength", desc: "+1 damage per 2 STR" },
  { key: "dexterity", label: "Dexterity", desc: "-15ms attack cooldown per DEX" },
  { key: "vitality", label: "Vitality", desc: "+8 max HP per VIT" },
  { key: "intellect", label: "Intellect", desc: "+6 max mana, faster mana regen" },
];

export function StatPanel({
  player,
  onAllocate,
}: {
  player: PlayerSnapshot | undefined;
  onAllocate: (stat: StatKey) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!player) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto relative backdrop-blur-md bg-background/40"
          aria-label="Stats"
        >
          <Activity />
          <span className="hidden sm:inline">stats</span>
          {player.statPoints > 0 ? (
            <span className="-top-1 -right-1 absolute flex size-4 items-center justify-center rounded-full bg-primary font-semibold text-[10px] text-primary-foreground">
              {player.statPoints}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Character</DialogTitle>
          <DialogDescription>
            Level {player.level} · {player.statPoints} unspent point
            {player.statPoints === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-1">
          {STATS.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 p-2"
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm">
                  {row.label}{" "}
                  <span className="text-muted-foreground tabular-nums">{player[row.key]}</span>
                </div>
                <div className="text-muted-foreground text-xs">{row.desc}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={player.statPoints <= 0}
                onClick={() => onAllocate(row.key)}
                aria-label={`Spend point on ${row.label}`}
              >
                <Plus className="size-3" />
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
