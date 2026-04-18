export type QuestObjective =
  | { kind: "killMobs"; count: number }
  | { kind: "collectItem"; itemId: string; count: number }
  | { kind: "explore"; zoneId: string };

export type QuestDef = {
  id: string;
  title: string;
  summary: string;
  objective: QuestObjective;
  xpReward: number;
  goldReward: number;
  itemReward?: { itemId: string; qty: number };
  isDaily?: boolean;
  dailyPool?: "kills" | "explore" | "loot";
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
  "daily-slayer-lobby": {
    id: "daily-slayer-lobby",
    title: "Lobby Slayer",
    summary: "Clear out some pests in the lobby.",
    objective: { kind: "killMobs", count: 5 },
    xpReward: 50,
    goldReward: 30,
    isDaily: true,
    dailyPool: "kills",
  },
  "daily-slayer-arena": {
    id: "daily-slayer-arena",
    title: "Arena Combatant",
    summary: "Prove your worth in the arena.",
    objective: { kind: "killMobs", count: 10 },
    xpReward: 150,
    goldReward: 100,
    isDaily: true,
    dailyPool: "kills",
  },
  "daily-explorer-lobby": {
    id: "daily-explorer-lobby",
    title: "Lobby Scout",
    summary: "Visit the lobby to keep it safe.",
    objective: { kind: "explore", zoneId: "lobby" },
    xpReward: 30,
    goldReward: 20,
    isDaily: true,
    dailyPool: "explore",
  },
  "daily-explorer-arena": {
    id: "daily-explorer-arena",
    title: "Arena Scout",
    summary: "Venture into the arena.",
    objective: { kind: "explore", zoneId: "arena" },
    xpReward: 100,
    goldReward: 70,
    isDaily: true,
    dailyPool: "explore",
  },
  "daily-collector-potions": {
    id: "daily-collector-potions",
    title: "Potion Hoarder",
    summary: "Collect some heal potions.",
    objective: { kind: "collectItem", itemId: "heal_potion", count: 3 },
    xpReward: 60,
    goldReward: 40,
    isDaily: true,
    dailyPool: "loot",
  },
  "daily-collector-mana": {
    id: "daily-collector-mana",
    title: "Mana Collector",
    summary: "Gather mana potions for the mages.",
    objective: { kind: "collectItem", itemId: "mana_potion", count: 2 },
    xpReward: 80,
    goldReward: 50,
    isDaily: true,
    dailyPool: "loot",
  },
  "daily-slayer-elite": {
    id: "daily-slayer-elite",
    title: "Elite Hunter",
    summary: "Take down many foes across the realms.",
    objective: { kind: "killMobs", count: 20 },
    xpReward: 300,
    goldReward: 200,
    isDaily: true,
    dailyPool: "kills",
  },
  "daily-explorer-depths": {
    id: "daily-explorer-depths",
    title: "Deep Scout",
    summary: "Visit the deeper zones.",
    objective: { kind: "explore", zoneId: "depths" },
    xpReward: 200,
    goldReward: 150,
    isDaily: true,
    dailyPool: "explore",
  },
};

export type QuestId = keyof typeof QUEST_CATALOG;

export function getQuest(id: string): QuestDef | undefined {
  return QUEST_CATALOG[id];
}

export const FIRST_QUEST_ID: QuestId = "first-blood";
