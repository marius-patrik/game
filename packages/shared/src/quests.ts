export type QuestObjective =
  | { kind: "killMobs"; count: number }
  | { kind: "collectItem"; itemId: string; count: number };

export type QuestDef = {
  id: string;
  title: string;
  summary: string;
  objective: QuestObjective;
  xpReward: number;
  goldReward: number;
  itemReward?: { itemId: string; qty: number };
};

export const QUEST_CATALOG: Record<string, QuestDef> = {
  "first-blood": {
    id: "first-blood",
    title: "First Blood",
    summary: "Kill 3 mobs to prove you can handle the lobby. Elder Cubius needs hands.",
    objective: { kind: "killMobs", count: 3 },
    xpReward: 40,
    goldReward: 20,
    itemReward: { itemId: "heal_potion", qty: 2 },
  },
  "arena-initiate": {
    id: "arena-initiate",
    title: "Arena Initiate",
    summary: "Drop 6 hostiles in the arena. The sunset favors the persistent.",
    objective: { kind: "killMobs", count: 6 },
    xpReward: 120,
    goldReward: 50,
    itemReward: { itemId: "mana_potion", qty: 3 },
  },
};

export type QuestId = keyof typeof QUEST_CATALOG;

export function getQuest(id: string): QuestDef | undefined {
  return QUEST_CATALOG[id];
}

export const FIRST_QUEST_ID: QuestId = "first-blood";
