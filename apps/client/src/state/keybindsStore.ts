import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  findKeybindConflict,
  KEYBIND_ACTIONS,
  KEYBIND_DEFAULTS,
  type KeybindAction,
  type KeybindMap,
  normalizeKey,
  UNREBINDABLE_KEYS,
} from "./keybinds";

type KeybindsByCharacter = Record<string, KeybindMap>;

export type SetKeybindResult =
  | { ok: true }
  | { ok: false; reason: "unrebindable" }
  | { ok: false; reason: "conflict"; conflictsWith: KeybindAction };

type KeybindsState = {
  keybindsByCharacter: KeybindsByCharacter;
  /** Session/global fallback used before a character is selected (login screen,
   * guard). Always present so hooks can read a map synchronously. */
  globalKeybinds: KeybindMap;
  setKeybind: (characterId: string | null, action: KeybindAction, key: string) => SetKeybindResult;
  resetKeybinds: (characterId: string | null) => void;
};

function sanitizeMap(raw: Partial<Record<KeybindAction, string>> | undefined): KeybindMap {
  const next: KeybindMap = { ...KEYBIND_DEFAULTS };
  if (!raw) return next;
  for (const action of KEYBIND_ACTIONS) {
    const key = raw[action];
    if (typeof key === "string" && key.length > 0) next[action] = normalizeKey(key);
  }
  return next;
}

function sanitizePersisted(persisted: unknown): {
  keybindsByCharacter: KeybindsByCharacter;
  globalKeybinds: KeybindMap;
} {
  if (!persisted || typeof persisted !== "object") {
    return { keybindsByCharacter: {}, globalKeybinds: { ...KEYBIND_DEFAULTS } };
  }
  const obj = persisted as {
    keybindsByCharacter?: Record<string, Partial<Record<KeybindAction, string>>>;
    globalKeybinds?: Partial<Record<KeybindAction, string>>;
  };
  const byChar: KeybindsByCharacter = {};
  for (const [characterId, raw] of Object.entries(obj.keybindsByCharacter ?? {})) {
    byChar[characterId] = sanitizeMap(raw);
  }
  return {
    keybindsByCharacter: byChar,
    globalKeybinds: sanitizeMap(obj.globalKeybinds),
  };
}

export const useKeybindsStore = create<KeybindsState>()(
  persist(
    (set, get) => ({
      keybindsByCharacter: {},
      globalKeybinds: { ...KEYBIND_DEFAULTS },
      setKeybind: (characterId, action, key) => {
        const normalized = normalizeKey(key);
        if (UNREBINDABLE_KEYS.has(normalized) && KEYBIND_DEFAULTS[action] !== normalized) {
          return { ok: false, reason: "unrebindable" };
        }
        const current = characterId
          ? (get().keybindsByCharacter[characterId] ?? { ...KEYBIND_DEFAULTS })
          : get().globalKeybinds;
        const conflict = findKeybindConflict(current, action, normalized);
        if (conflict) return { ok: false, reason: "conflict", conflictsWith: conflict };
        if (characterId) {
          set((state) => ({
            keybindsByCharacter: {
              ...state.keybindsByCharacter,
              [characterId]: {
                ...(state.keybindsByCharacter[characterId] ?? { ...KEYBIND_DEFAULTS }),
                [action]: normalized,
              },
            },
          }));
        } else {
          set((state) => ({
            globalKeybinds: { ...state.globalKeybinds, [action]: normalized },
          }));
        }
        return { ok: true };
      },
      resetKeybinds: (characterId) => {
        if (characterId) {
          set((state) => ({
            keybindsByCharacter: {
              ...state.keybindsByCharacter,
              [characterId]: { ...KEYBIND_DEFAULTS },
            },
          }));
        } else {
          set({ globalKeybinds: { ...KEYBIND_DEFAULTS } });
        }
      },
    }),
    {
      name: "game.keybinds.v2",
      partialize: (state) => ({
        keybindsByCharacter: state.keybindsByCharacter,
        globalKeybinds: state.globalKeybinds,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizePersisted(persisted),
      }),
    },
  ),
);

/** Subscribe to the keybinds map for a given character, falling back to the
 * session-global defaults when no character is selected yet. */
export function useCharacterKeybinds(characterId: string | null): KeybindMap {
  return useKeybindsStore((state) =>
    characterId
      ? (state.keybindsByCharacter[characterId] ?? state.globalKeybinds)
      : state.globalKeybinds,
  );
}

export function useKeybind(characterId: string | null, action: KeybindAction): string {
  return useKeybindsStore((state) => {
    const map = characterId
      ? (state.keybindsByCharacter[characterId] ?? state.globalKeybinds)
      : state.globalKeybinds;
    return map[action];
  });
}
