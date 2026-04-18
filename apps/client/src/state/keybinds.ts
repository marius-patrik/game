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
  cursor_lock: "control",
} as const;

export type KeybindAction = keyof typeof KEYBIND_DEFAULTS;
export type KeybindMap = Record<KeybindAction, string>;

export const KEYBIND_ACTIONS = Object.keys(KEYBIND_DEFAULTS) as readonly KeybindAction[];

export type KeybindCategory = {
  id: string;
  label: string;
  actions: readonly { action: KeybindAction; label: string; description?: string }[];
};

export const KEYBIND_CATEGORIES: readonly KeybindCategory[] = [
  {
    id: "movement",
    label: "Movement",
    actions: [
      { action: "moveForward", label: "Move forward" },
      { action: "moveBack", label: "Move back" },
      { action: "moveLeft", label: "Strafe left" },
      { action: "moveRight", label: "Strafe right" },
    ],
  },
  {
    id: "combat",
    label: "Combat",
    actions: [
      { action: "ability_W1", label: "Primary weapon" },
      { action: "ability_W2", label: "Secondary weapon" },
      { action: "ability_S1", label: "Skill 1" },
      { action: "ability_S2", label: "Skill 2" },
      { action: "ability_U", label: "Ultimate" },
    ],
  },
  {
    id: "items",
    label: "Items",
    actions: [
      { action: "item_I1", label: "Item slot 1" },
      { action: "item_I2", label: "Item slot 2" },
      { action: "potion_P1", label: "Heal potion" },
      { action: "potion_P2", label: "Mana potion" },
    ],
  },
  {
    id: "world",
    label: "World",
    actions: [
      { action: "interact", label: "Interact" },
      { action: "cursor_lock", label: "Cursor lock" },
      { action: "cinematic_skip", label: "Skip cinematic" },
    ],
  },
  {
    id: "ui",
    label: "Interface",
    actions: [
      { action: "toggle_map", label: "Toggle map" },
      { action: "toggle_chat", label: "Toggle chat" },
      { action: "toggle_inventory", label: "Toggle inventory" },
      { action: "toggle_settings", label: "Toggle settings" },
    ],
  },
];

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
  if (binding === "control") return "Ctrl";
  if (binding === "shift") return "Shift";
  if (binding === "alt") return "Alt";
  if (binding === "meta") return "Meta";
  if (binding === "tab") return "Tab";
  if (binding === "enter") return "Enter";
  if (binding === "arrowup") return "↑";
  if (binding === "arrowdown") return "↓";
  if (binding === "arrowleft") return "←";
  if (binding === "arrowright") return "→";
  if (binding.length === 1) return binding.toUpperCase();
  return `${binding[0]?.toUpperCase() ?? ""}${binding.slice(1)}`;
}

export const UNREBINDABLE_KEYS: ReadonlySet<string> = new Set(["escape", "tab", "enter"]);

export function findKeybindConflict(
  keybinds: KeybindMap,
  action: KeybindAction,
  key: string,
): KeybindAction | undefined {
  const normalized = normalizeKey(key);
  for (const other of KEYBIND_ACTIONS) {
    if (other === action) continue;
    if (keybinds[other] === normalized) return other;
  }
  return undefined;
}

export function keybindActionLabel(action: KeybindAction): string {
  for (const category of KEYBIND_CATEGORIES) {
    const match = category.actions.find((a) => a.action === action);
    if (match) return match.label;
  }
  return action;
}
