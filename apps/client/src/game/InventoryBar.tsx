import type { PlayerSnapshot } from "@/net/useRoom";
import { getItem } from "@game/shared/items";

const KIND_CLASS: Record<string, string> = {
  weapon: "ring-sky-400/70 bg-sky-500/10",
  consumable: "ring-rose-400/70 bg-rose-500/10",
  trophy: "ring-violet-400/70 bg-violet-500/10",
};

const ITEM_LETTER: Record<string, string> = {
  heal_potion: "H",
  sword: "S",
  soul: "◆",
};

function iconLetter(itemId: string): string {
  return ITEM_LETTER[itemId] ?? itemId.slice(0, 1).toUpperCase();
}

export function InventoryBar({
  player,
  onUse,
  onEquip,
}: {
  player: PlayerSnapshot | undefined;
  onUse: (itemId: string) => void;
  onEquip: (itemId: string) => void;
}) {
  const slots = player?.inventory ?? [];
  const equipped = player?.equippedItemId ?? "";

  return (
    <div
      className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border/50 bg-background/60 px-2 py-2 backdrop-blur-md"
      role="toolbar"
      aria-label="Inventory"
    >
      {slots.length === 0 ? (
        <div className="px-4 py-1 text-muted-foreground text-xs">Empty</div>
      ) : null}
      {slots.map((slot, i) => {
        const def = getItem(slot.itemId);
        const kindClass = def ? (KIND_CLASS[def.kind] ?? "") : "";
        const isEquipped = def?.kind === "weapon" && equipped === slot.itemId;
        return (
          <button
            key={`${slot.itemId}-${i}`}
            type="button"
            onClick={() => {
              if (def?.kind === "consumable") onUse(slot.itemId);
              else if (def?.kind === "weapon") onEquip(isEquipped ? "" : slot.itemId);
            }}
            className={`relative flex h-12 w-12 items-center justify-center rounded-md font-bold text-foreground text-lg ring-1 ${kindClass} ${
              isEquipped ? "ring-2 ring-amber-400" : ""
            }`}
            title={`${def?.name ?? slot.itemId} ×${slot.qty}${isEquipped ? " (equipped)" : ""}`}
          >
            <span>{iconLetter(slot.itemId)}</span>
            {slot.qty > 1 ? (
              <span className="absolute right-0.5 bottom-0 text-[10px] leading-none">
                ×{slot.qty}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
