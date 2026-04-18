import { describe, expect, test } from "bun:test";
import {
  findKeybindConflict,
  formatKeybind,
  KEYBIND_ACTIONS,
  KEYBIND_CATEGORIES,
  KEYBIND_DEFAULTS,
  keybindActionLabel,
  matchesKeybind,
  normalizeKey,
  UNREBINDABLE_KEYS,
} from "./keybinds";

describe("keybind helpers", () => {
  test("ship the hotbar defaults for #94", () => {
    expect(KEYBIND_DEFAULTS.ability_W1).toBe("1");
    expect(KEYBIND_DEFAULTS.ability_W2).toBe("2");
    expect(KEYBIND_DEFAULTS.ability_S1).toBe("3");
    expect(KEYBIND_DEFAULTS.ability_S2).toBe("4");
    expect(KEYBIND_DEFAULTS.ability_U).toBe("q");
    expect(KEYBIND_DEFAULTS.item_I1).toBe("5");
    expect(KEYBIND_DEFAULTS.item_I2).toBe("6");
    expect(KEYBIND_DEFAULTS.potion_P1).toBe("7");
    expect(KEYBIND_DEFAULTS.potion_P2).toBe("8");
  });

  test("#95 widens coverage to every action", () => {
    expect(KEYBIND_DEFAULTS.interact).toBe("e");
    expect(KEYBIND_DEFAULTS.cursor_lock).toBe("control");
    expect(KEYBIND_DEFAULTS.cinematic_skip).toBe("space");
    expect(KEYBIND_DEFAULTS.toggle_settings).toBe("escape");
  });

  test("normalizes keyboard events into persisted bindings", () => {
    expect(normalizeKey("Q")).toBe("q");
    expect(normalizeKey("Escape")).toBe("escape");
    expect(normalizeKey(" ")).toBe("space");
    expect(normalizeKey("Control")).toBe("control");
  });

  test("matches bindings case-insensitively and formats for the HUD", () => {
    expect(matchesKeybind("Q", KEYBIND_DEFAULTS.ability_U)).toBe(true);
    expect(matchesKeybind("7", KEYBIND_DEFAULTS.potion_P1)).toBe(true);
    expect(formatKeybind(KEYBIND_DEFAULTS.ability_U)).toBe("Q");
    expect(formatKeybind(KEYBIND_DEFAULTS.toggle_settings)).toBe("Esc");
    expect(formatKeybind(KEYBIND_DEFAULTS.cursor_lock)).toBe("Ctrl");
    expect(formatKeybind(KEYBIND_DEFAULTS.cinematic_skip)).toBe("Space");
  });

  test("conflict detection flags rebinds that collide", () => {
    const map = { ...KEYBIND_DEFAULTS };
    expect(findKeybindConflict(map, "ability_S1", "q")).toBe("ability_U");
    expect(findKeybindConflict(map, "ability_S1", "z")).toBeUndefined();
    expect(findKeybindConflict(map, "ability_U", "q")).toBeUndefined();
  });

  test("every action appears exactly once in the category index", () => {
    const flattened = KEYBIND_CATEGORIES.flatMap((c) => c.actions.map((a) => a.action));
    const unique = new Set(flattened);
    expect(unique.size).toBe(flattened.length);
    for (const action of KEYBIND_ACTIONS) {
      expect(unique.has(action)).toBe(true);
    }
    expect(flattened.length).toBe(KEYBIND_ACTIONS.length);
  });

  test("labels all actions via the category index", () => {
    expect(keybindActionLabel("interact")).toBe("Interact");
    expect(keybindActionLabel("moveForward")).toBe("Move forward");
    expect(keybindActionLabel("cursor_lock")).toBe("Cursor lock");
  });

  test("unrebindable set protects core browser keys", () => {
    expect(UNREBINDABLE_KEYS.has("escape")).toBe(true);
    expect(UNREBINDABLE_KEYS.has("tab")).toBe(true);
  });
});
