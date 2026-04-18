export const KEYBIND_DEFAULTS = {
  interact: "e",
  moveForward: "w",
  moveBack: "s",
  moveLeft: "a",
  moveRight: "d",
  ability_W1: "1",
  ability_W2: "2",
  ability_S1: "3",
  ability_S2: "4",
  ability_U: "q",
  item_I1: "5",
  item_I2: "6",
  potion_P1: "7",
  potion_P2: "8",
  toggle_chat: "t",
  toggle_inventory: "i",
  toggle_map: "m",
  toggle_settings: "escape",
  cinematic_skip: "space",
} as const;

export type KeybindAction = keyof typeof KEYBIND_DEFAULTS;
export type KeybindMap = Record<KeybindAction, string>;

export function normalizeKey(key: string): string {
  if (key === " ") return "space";
  return key.trim().toLowerCase();
}

export function matchesKeybind(eventKey: string, binding: string): boolean {
  return normalizeKey(eventKey) === binding;
}

export function formatKeybind(binding: string): string {
  if (binding === "space") return "Space";
  if (binding === "escape") return "Esc";
  if (binding.length === 1) return binding.toUpperCase();
  return `${binding[0]?.toUpperCase() ?? ""}${binding.slice(1)}`;
}
