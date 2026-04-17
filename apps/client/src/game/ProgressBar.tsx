import { Progress } from "@/components/ui/progress";
import type { PlayerSnapshot } from "@/net/useRoom";
import { Coins, Heart, Sparkles, Star } from "lucide-react";

export function ProgressBar({ player }: { player: PlayerSnapshot | undefined }) {
  const level = player?.level ?? 1;
  const xp = player?.xp ?? 0;
  const xpToNext = Math.max(1, player?.xpToNext ?? 1);
  const hp = player?.hp ?? 0;
  const maxHp = Math.max(1, player?.maxHp ?? 1);
  const mana = Math.floor(player?.mana ?? 0);
  const maxMana = Math.max(1, player?.maxMana ?? 1);
  const gold = player?.gold ?? 0;
  const hpFrac = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const manaFrac = Math.max(0, Math.min(100, (mana / maxMana) * 100));
  const xpFrac = Math.max(0, Math.min(100, (xp / xpToNext) * 100));
  const hpTone = hpFrac > 50 ? "bg-emerald-500" : hpFrac > 25 ? "bg-amber-400" : "bg-destructive";

  return (
    <div
      className="pointer-events-none absolute top-20 right-2 left-2 flex flex-col gap-2 rounded-lg border border-border/50 bg-background/70 px-3 py-2 backdrop-blur-md sm:top-4 sm:right-4 sm:left-auto sm:min-w-[260px]"
      aria-label={`Level ${level}, ${hp} of ${maxHp} HP, ${mana} of ${maxMana} mana, ${gold} gold`}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-amber-400">
          <Coins className="size-3.5" />
          <span className="font-semibold tabular-nums">{gold}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Star className="size-3.5 text-amber-400" />
          <span className="tabular-nums">Lv {level}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <Heart className="size-3.5 text-destructive" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Progress value={hpFrac} indicatorClassName={hpTone} className="h-2" />
          <span className="w-[4.8rem] shrink-0 text-right text-muted-foreground tabular-nums">
            {hp}/{maxHp}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <Sparkles className="size-3.5 text-sky-400" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Progress value={manaFrac} indicatorClassName="bg-sky-500" className="h-1.5" />
          <span className="w-[4.8rem] shrink-0 text-right text-muted-foreground tabular-nums">
            {mana}/{maxMana}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] opacity-90">
        <Progress value={xpFrac} indicatorClassName="bg-amber-400/80" className="h-1" />
        <span className="w-[4.8rem] shrink-0 text-right text-muted-foreground tabular-nums">
          {xp}/{xpToNext}
        </span>
      </div>
    </div>
  );
}
