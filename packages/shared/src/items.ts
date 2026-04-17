export type ItemKind = "weapon" | "consumable" | "trophy" | "armor" | "ring" | "currency";
export type ItemRarity = "common" | "rare" | "legendary";
export type EquipSlot = "weapon" | "head" | "chest" | "ring";

export type ItemDef = {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: ItemRarity;
  stackable: boolean;
  maxStack: number;
  slot?: EquipSlot;
  damageBonus?: number;
  healAmount?: number;
  manaAmount?: number;
  xpReward?: number;
  strBonus?: number;
  dexBonus?: number;
  vitBonus?: number;
  intBonus?: number;
  price?: number; // gold cost in vendor
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
    price: 8,
  },
  mana_potion: {
    id: "mana_potion",
    name: "Mana Potion",
    kind: "consumable",
    rarity: "common",
    stackable: true,
    maxStack: 5,
    manaAmount: 35,
    price: 12,
  },
  sword: {
    id: "sword",
    name: "Iron Sword",
    kind: "weapon",
    rarity: "rare",
    stackable: false,
    maxStack: 1,
    slot: "weapon",
    damageBonus: 10,
    strBonus: 2,
    price: 60,
  },
  greataxe: {
    id: "greataxe",
    name: "Greataxe",
    kind: "weapon",
    rarity: "rare",
    stackable: false,
    maxStack: 1,
    slot: "weapon",
    damageBonus: 18,
    strBonus: 4,
    price: 140,
  },
  helm: {
    id: "helm",
    name: "Bronze Helm",
    kind: "armor",
    rarity: "common",
    stackable: false,
    maxStack: 1,
    slot: "head",
    vitBonus: 2,
    price: 24,
  },
  cuirass: {
    id: "cuirass",
    name: "Cuirass",
    kind: "armor",
    rarity: "common",
    stackable: false,
    maxStack: 1,
    slot: "chest",
    vitBonus: 4,
    strBonus: 1,
    price: 48,
  },
  ring_spark: {
    id: "ring_spark",
    name: "Spark Ring",
    kind: "ring",
    rarity: "rare",
    stackable: false,
    maxStack: 1,
    slot: "ring",
    intBonus: 3,
    dexBonus: 2,
    price: 90,
  },
  soul: {
    id: "soul",
    name: "Soul",
    kind: "trophy",
    rarity: "legendary",
    stackable: true,
    maxStack: 99,
    xpReward: 25,
    price: 30,
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

export const VENDOR_STOCK: readonly ItemId[] = [
  "heal_potion",
  "mana_potion",
  "sword",
  "helm",
  "cuirass",
  "ring_spark",
  "greataxe",
];
