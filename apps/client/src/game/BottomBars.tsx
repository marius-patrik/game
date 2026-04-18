import { Heart, Sparkles, Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { PlayerSnapshot } from "@/net/useRoom";

/**
 * Bottom bars cluster — HP + MP half-width each, XP full-width below, all with
 * numbers + icons. Sits just above the ActionBar, centred, with a responsive
 * width cap so ultrawide monitors don't stretch the bars across the whole
 * screen. On death the cluster fades to keep the DeathOverlay readable.
 */
export function BottomBars({ player }: { player: PlayerSnapshot | undefined }) {
  const level = player?.level ?? 1;
  const hp = player?.hp ?? 0;
  const maxHp = Math.max(1, player?.maxHp ?? 1);
  const mana = Math.floor(player?.mana ?? 0);
  const maxMana = Math.max(1, player?.maxMana ?? 1);
  const xp = player?.xp ?? 0;
  const xpToNext = Math.max(1, player?.xpToNext ?? 1);
  const hpFrac = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const manaFrac = Math.max(0, Math.min(100, (mana / maxMana) * 100));
  const xpFrac = Math.max(0, Math.min(100, (xp / xpToNext) * 100));
  const hpTone = hpFrac > 50 ? "bg-emerald-500" : hpFrac > 25 ? "bg-amber-400" : "bg-destructive";
  const faded = !player?.alive;

  return (
    <div
      data-testid="bottom-bars"
      className={cn(
        "pointer-events-none absolute bottom-[84px] left-1/2 z-[5] flex w-[min(92vw,640px)] -translate-x-1/2 flex-col gap-1.5 sm:bottom-[96px] sm:w-[min(80vw,720px)]",
        faded ? "opacity-40" : "opacity-100",
      )}
    >
      <div className="flex items-center gap-2">
        <BarRow
          icon={<Heart className="size-3.5 text-destructive" />}
          label="HP"
          current={hp}
          max={maxHp}
          frac={hpFrac}
          tone={hpTone}
        />
        <BarRow
          icon={<Sparkles className="size-3.5 text-sky-400" />}
          label="MP"
          current={mana}
          max={maxMana}
          frac={manaFrac}
          tone="bg-sky-500"
        />
      </div>
      <div className="flex items-center gap-2 polish-glass rounded-[var(--radius-sm)] px-2 py-1">
        <Star className="size-3 shrink-0 text-amber-400" />
        <span className="shrink-0 font-semibold text-[11px] tabular-nums">Lv {level}</span>
        <div className="min-w-0 flex-1">
          <Progress value={xpFrac} indicatorClassName="bg-amber-400/90" className="h-1.5" />
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {xp}/{xpToNext}
        </span>
      </div>
    </div>
  );
}

function BarRow({
  icon,
  label,
  current,
  max,
  frac,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  current: number;
  max: number;
  frac: number;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 polish-glass rounded-[var(--radius-sm)] px-2 py-1">
      {icon}
      <span className="shrink-0 font-semibold text-[11px] text-muted-foreground tabular-nums">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <Progress value={frac} indicatorClassName={tone} className="h-2" />
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
        {current}/{max}
      </span>
    </div>
  );
}
