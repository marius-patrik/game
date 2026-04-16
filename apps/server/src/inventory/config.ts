import type { ItemId } from "@game/shared/items";

export type LootConfig = {
  killDropItemId: ItemId;
  killDropQty: number;
  pickupRange: number;
  potionSpawnIntervalMs: number;
  potionMaxInZone: number;
};

export const DEFAULT_LOOT: LootConfig = {
  killDropItemId: "soul",
  killDropQty: 1,
  pickupRange: 1.5,
  potionSpawnIntervalMs: 15_000,
  potionMaxInZone: 6,
};
