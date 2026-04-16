import { useEffect, useState } from "react";

export function DeathOverlay({
  dead,
  respawnDelayMs,
  deathAt,
}: {
  dead: boolean;
  respawnDelayMs: number;
  deathAt?: number;
}) {
  const [remaining, setRemaining] = useState(respawnDelayMs);

  useEffect(() => {
    if (!dead || !deathAt) return;
    const tick = () => {
      const elapsed = Date.now() - deathAt;
      setRemaining(Math.max(0, respawnDelayMs - elapsed));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [dead, deathAt, respawnDelayMs]);

  if (!dead) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-2 rounded-xl border border-rose-500/40 bg-background/80 px-8 py-6 shadow-xl">
        <div className="font-bold text-2xl text-rose-400">You died</div>
        <div className="text-muted-foreground text-sm">
          Respawning in {(remaining / 1000).toFixed(1)}s
        </div>
      </div>
    </div>
  );
}
