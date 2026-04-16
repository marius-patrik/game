export type CombatConfig = {
  attackRange: number;
  attackDamage: number;
  maxHp: number;
  respawnDelayMs: number;
  invulnerableAfterRespawnMs: number;
};

export const DEFAULT_COMBAT: CombatConfig = {
  attackRange: 2.5,
  attackDamage: 15,
  maxHp: 100,
  respawnDelayMs: 2500,
  invulnerableAfterRespawnMs: 1500,
};
