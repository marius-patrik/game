import { describe, expect, test } from "bun:test";
import { KEYBIND_DEFAULTS, formatKeybind, matchesKeybind, normalizeKey } from "./keybinds";

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

  test("normalizes keyboard events into persisted bindings", () => {
    expect(normalizeKey("Q")).toBe("q");
    expect(normalizeKey("Escape")).toBe("escape");
    expect(normalizeKey(" ")).toBe("space");
  });

  test("matches bindings case-insensitively and formats for the HUD", () => {
    expect(matchesKeybind("Q", KEYBIND_DEFAULTS.ability_U)).toBe(true);
    expect(matchesKeybind("7", KEYBIND_DEFAULTS.potion_P1)).toBe(true);
    expect(formatKeybind(KEYBIND_DEFAULTS.ability_U)).toBe("Q");
    expect(formatKeybind(KEYBIND_DEFAULTS.toggle_settings)).toBe("Esc");
  });
});
