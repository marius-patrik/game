import type { DropSnapshot, PlayerSnapshot } from "@/net/useRoom";
import { getItem } from "@game/shared/items";
import { useEffect, useMemo } from "react";

const PICKUP_RANGE = 1.5;

function nearestDrop(
  drops: Map<string, DropSnapshot>,
  pos: { x: number; z: number },
): DropSnapshot | undefined {
  let best: DropSnapshot | undefined;
  let bestSq = PICKUP_RANGE * PICKUP_RANGE;
  for (const d of drops.values()) {
    const dx = d.x - pos.x;
    const dz = d.z - pos.z;
    const sq = dx * dx + dz * dz;
    if (sq <= bestSq) {
      bestSq = sq;
      best = d;
    }
  }
  return best;
}

export function PickupPrompt({
  player,
  drops,
  onPickup,
}: {
  player: PlayerSnapshot | undefined;
  drops: Map<string, DropSnapshot>;
  onPickup: (dropId: string) => void;
}) {
  const near = useMemo(() => {
    if (!player || !player.alive) return undefined;
    return nearestDrop(drops, { x: player.x, z: player.z });
  }, [player, drops]);

  useEffect(() => {
    if (!near) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key !== "e" && e.key !== "E") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      onPickup(near.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [near, onPickup]);

  if (!near) return null;
  const def = getItem(near.itemId);
  const label = def?.name ?? near.itemId;

  return (
    <div className="pointer-events-auto absolute top-1/2 left-1/2 flex -translate-x-1/2 translate-y-12 items-center gap-3 rounded-md border border-amber-400/60 bg-background/80 px-3 py-2 shadow-lg backdrop-blur-md">
      <span className="text-sm">
        Pick up <strong>{label}</strong>
        {near.qty > 1 ? ` ×${near.qty}` : ""}
      </span>
      <button
        type="button"
        onClick={() => onPickup(near.id)}
        className="rounded border border-amber-400/60 bg-amber-400/20 px-2 py-1 font-bold text-xs hover:bg-amber-400/40"
      >
        E
      </button>
    </div>
  );
}
