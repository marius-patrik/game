export { type CombatConfig, DEFAULT_COMBAT } from "./config";
export { type AttackResult, type Combatant, resolveAttack } from "./resolveAttack";
export {
  type AbilityCheckResult,
  type EquipmentView,
  checkAbilityReady,
  resolveWeaponAbility,
} from "./abilityDispatch";
export {
  type AllocationInput,
  type AllocationResult,
  type UnbindInput,
  type UnbindResult,
  SKILLS_EQUIPPED_SIZE,
  validateAllocation,
  validateUnbind,
} from "./skillAllocation";
