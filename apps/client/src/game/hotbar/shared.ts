import { getItem } from "@game/shared";

export type ItemQuickSlotKey = "I1" | "I2";
export type PotionSlotKey = "P1" | "P2";

export const HOTBAR_ITEM_MIME = "application/x-game-hotbar-item";

export function abbreviateHotbarLabel(label: string): string {
  const words = label
    .split(/[\s-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

export function countInventoryItem(
  inventory: readonly { itemId: string; qty: number }[],
  itemId: string,
): number {
  return inventory.reduce((sum, entry) => sum + (entry.itemId === itemId ? entry.qty : 0), 0);
}

export function canBindItemToHotbar(itemId: string): boolean {
  const item = getItem(itemId);
  return item?.kind === "consumable" || Boolean(item?.slot);
}
