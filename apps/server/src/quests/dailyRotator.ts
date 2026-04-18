import { QUEST_CATALOG, type QuestDef } from "@game/shared/quests";

export function getActiveDailyQuests(dateISO: string): readonly QuestDef[] {
  const dailyQuests = Object.values(QUEST_CATALOG).filter((q) => q.isDaily);
  if (dailyQuests.length < 3) return dailyQuests;

  const dateStr = dateISO.split("T")[0] || getTodayUTC();

  function getForSeed(seed: string): QuestDef[] {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }

    const selected: QuestDef[] = [];
    const pool = [...dailyQuests];
    const pools: ("kills" | "explore" | "loot")[] = ["kills", "explore", "loot"];

    for (let i = 0; i < 3; i++) {
      const targetPool = pools[i % pools.length];
      const eligibleFromPool = pool.filter((q) => q.dailyPool === targetPool);

      let quest: QuestDef;
      if (eligibleFromPool.length > 0) {
        const index = Math.abs(hash + i) % eligibleFromPool.length;
        quest = eligibleFromPool[index]!;
      } else {
        const index = Math.abs(hash + i) % pool.length;
        quest = pool[index]!;
      }

      selected.push(quest);
      const poolIndex = pool.findIndex((p) => p.id === quest.id);
      if (poolIndex !== -1) {
        pool.splice(poolIndex, 1);
      }
    }
    return selected;
  }

  const today = getForSeed(dateStr);

  // Anti-repeat: if exactly same as yesterday, shift seed
  const yesterdayDate = new Date(dateStr);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0]!;
  const yesterday = getForSeed(yesterdayStr);

  const todayIds = today
    .map((q) => q.id)
    .sort()
    .join(",");
  const yesterdayIds = yesterday
    .map((q) => q.id)
    .sort()
    .join(",");

  if (todayIds === yesterdayIds) {
    return getForSeed(`${dateStr}_shift`);
  }

  return today;
}

export function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0]!;
}
