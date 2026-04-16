const BASE_XP = 100;
const GROWTH = 1.5;

export function xpToNextLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) return BASE_XP;
  return Math.floor(BASE_XP * GROWTH ** (level - 1));
}

export type LevelUpResult = {
  level: number;
  xp: number;
  xpToNext: number;
  leveledUp: boolean;
  newLevels: number;
};

export function applyXp(level: number, xp: number, gained: number): LevelUpResult {
  let l = Math.max(1, level);
  let accumulated = Math.max(0, xp) + Math.max(0, gained);
  let newLevels = 0;
  while (accumulated >= xpToNextLevel(l)) {
    accumulated -= xpToNextLevel(l);
    l += 1;
    newLevels += 1;
  }
  return {
    level: l,
    xp: accumulated,
    xpToNext: xpToNextLevel(l),
    leveledUp: newLevels > 0,
    newLevels,
  };
}
