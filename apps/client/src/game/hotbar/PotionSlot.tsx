import { getItem } from "@game/shared";
import { HotbarSlot } from "./HotbarSlot";
import type { PotionSlotKey } from "./shared";

const POTION_META: Record<
  PotionSlotKey,
  {
    itemId: "heal_potion" | "mana_potion";
    color: string;
    glyph: string;
  }
> = {
  P1: {
    itemId: "heal_potion",
    color: "#ef4444",
    glyph: "HP",
  },
  P2: {
    itemId: "mana_potion",
    color: "#38bdf8",
    glyph: "MP",
  },
};

export function PotionSlot({
  slot,
  hotkey,
  qty,
  enabled,
  onUse,
}: {
  slot: PotionSlotKey;
  hotkey: string;
  qty: number;
  enabled: boolean;
  onUse: () => void;
}) {
  const meta = POTION_META[slot];
  const item = getItem(meta.itemId)!;
  const empty = qty <= 0;

  return (
    <HotbarSlot
      slot={slot}
      hotkey={hotkey}
      glyph={meta.glyph}
      color={meta.color}
      empty={empty}
      disabled={!enabled || empty}
      count={qty > 0 ? qty : undefined}
      title={
        empty
          ? `${item.name} slot — empty. Potions auto-bind from inventory.`
          : `${item.name} — click to use. ${qty} remaining.`
      }
      ariaLabel={
        empty ? `${item.name} slot is empty` : `${item.name} slot, ${qty} remaining, key ${hotkey}`
      }
      onClick={empty ? undefined : onUse}
    />
  );
}
