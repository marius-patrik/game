import { QUEST_CATALOG, type QuestDef } from "@game/shared/quests";
import { type Player, QuestProgress } from "@game/shared/schema";
import { loadDailyProgress, saveDailyProgress } from "../db/character";
import { getActiveDailyQuests, getTodayUTC } from "./dailyRotator";

export class DailyQuestTracker {
  private activeDailies: readonly QuestDef[];
  private today: string;

  constructor() {
    this.today = getTodayUTC();
    this.activeDailies = getActiveDailyQuests(this.today);
  }

  updateToday() {
    const now = getTodayUTC();
    if (now !== this.today) {
      this.today = now;
      this.activeDailies = getActiveDailyQuests(this.today);
    }
  }

  async loadPlayerDailies(p: Player, characterId: string) {
    this.updateToday();
    const rows = await loadDailyProgress(characterId, this.today);

    // Initialize or sync with active dailies
    p.dailyQuests.clear();
    for (const def of this.activeDailies) {
      const q = new QuestProgress();
      q.id = def.id;
      q.status = "active";
      q.progress = 0;
      q.goal = def.objective.kind === "explore" ? 1 : def.objective.count;

      const saved = rows.find((r) => r.questId === def.id);
      if (saved) {
        q.progress = saved.progress;
        if (saved.completedAt) {
          q.status = "complete";
        }
      }
      p.dailyQuests.set(def.id, q);
    }
  }

  onMobKilled(p: Player, mobKind: string) {
    this.updateToday();
    const rewards: { xp: number; gold: number; questId: string }[] = [];
    for (const def of this.activeDailies) {
      if (def.dailyPool !== "kills") continue;
      const q = p.dailyQuests.get(def.id);
      if (!q || q.status !== "active") continue;

      q.progress = Math.min(q.progress + 1, q.goal);
      if (q.progress >= q.goal) {
        q.status = "complete";
        const r = this.grantReward(p, def);
        rewards.push({ ...r, questId: def.id });
      }
    }
    return rewards;
  }

  onZoneEntered(p: Player, zoneId: string) {
    this.updateToday();
    const rewards: { xp: number; gold: number; questId: string }[] = [];
    for (const def of this.activeDailies) {
      if (def.dailyPool !== "explore") continue;
      if (def.objective.kind !== "explore" || def.objective.zoneId !== zoneId) continue;

      const q = p.dailyQuests.get(def.id);
      if (!q || q.status !== "active") continue;

      q.progress = 1;
      q.status = "complete";
      const r = this.grantReward(p, def);
      rewards.push({ ...r, questId: def.id });
    }
    return rewards;
  }

  onItemPickedUp(p: Player, itemId: string, qty: number) {
    this.updateToday();
    const rewards: { xp: number; gold: number; questId: string }[] = [];
    for (const def of this.activeDailies) {
      if (def.dailyPool !== "loot") continue;
      if (def.objective.kind !== "collectItem" || def.objective.itemId !== itemId) continue;

      const q = p.dailyQuests.get(def.id);
      if (!q || q.status !== "active") continue;

      q.progress = Math.min(q.progress + qty, q.goal);
      if (q.progress >= q.goal) {
        q.status = "complete";
        const r = this.grantReward(p, def);
        rewards.push({ ...r, questId: def.id });
      }
    }
    return rewards;
  }

  private grantReward(p: Player, def: QuestDef) {
    p.gold += def.goldReward;
    // XP is awarded via awardXp in GameRoom, but we don't have easy access to it here.
    // We'll return the reward info so GameRoom can apply it.
    return { xp: def.xpReward, gold: def.goldReward };
  }

  async persistPlayerDailies(characterId: string, p: Player) {
    const tasks: Promise<void>[] = [];
    for (const [, q] of p.dailyQuests) {
      tasks.push(
        saveDailyProgress({
          characterId,
          date: this.today,
          questId: q.id,
          progress: q.progress,
          completedAt: q.status === "complete" ? new Date() : null,
        }),
      );
    }
    await Promise.all(tasks);
  }
}

export const dailyTracker = new DailyQuestTracker();
