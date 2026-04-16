import type { PlayerSnapshot } from "@/net/useRoom";

export function ProgressBar({ player }: { player: PlayerSnapshot | undefined }) {
  const level = player?.level ?? 1;
  const xp = player?.xp ?? 0;
  const xpToNext = Math.max(1, player?.xpToNext ?? 1);
  const frac = Math.max(0, Math.min(1, xp / xpToNext));

  return (
    <div
      className="pointer-events-none absolute top-20 right-4 flex min-w-[180px] flex-col gap-1 rounded-md border border-border/50 bg-background/60 px-3 py-2 backdrop-blur-md sm:top-4 sm:right-[200px]"
      aria-label={`Level ${level}, ${xp} of ${xpToNext} XP`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">Lv {level}</span>
        <span className="text-muted-foreground">
          {xp}/{xpToNext}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-amber-400 transition-[width] duration-200 ease-out"
          style={{ width: `${frac * 100}%` }}
        />
      </div>
    </div>
  );
}
