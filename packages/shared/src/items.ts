export type ItemKind = "weapon" | "consumable" | "trophy";
export type ItemRarity = "common" | "rare" | "legendary";

export type ItemDef = {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: ItemRarity;
  stackable: boolean;
  maxStack: number;
  damageBonus?: number;
  healAmount?: number;
  xpReward?: number;
};

export const ITEM_CATALOG = {
  heal_potion: {
    id: "heal_potion",
    name: "Heal Potion",
    kind: "consumable",
    rarity: "common",
    stackable: true,
    maxStack: 5,
    healAmount: 40,
  },
  sword: {
    id: "sword",
    name: "Sword",
    kind: "weapon",
    rarity: "rare",
    stackable: false,
    maxStack: 1,
    damageBonus: 10,
  },
  soul: {
    id: "soul",
    name: "Soul",
    kind: "trophy",
    rarity: "legendary",
    stackable: true,
    maxStack: 99,
    xpReward: 25,
  },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEM_CATALOG;

export function getItem(id: string): ItemDef | undefined {
  return (ITEM_CATALOG as Record<string, ItemDef>)[id];
}

export function isItemId(id: string): id is ItemId {
  return id in ITEM_CATALOG;
}

export const ALL_ITEM_IDS = Object.keys(ITEM_CATALOG) as ItemId[];
