import { create } from "zustand";
import { persist } from "zustand/middleware";
import { KEYBIND_DEFAULTS, type KeybindAction, type KeybindMap, normalizeKey } from "./keybinds";

type KeybindsState = {
  keybinds: KeybindMap;
  setKeybind: (action: KeybindAction, key: string) => void;
  resetKeybinds: () => void;
};

function loadPersistedKeybinds(persisted: unknown): KeybindMap {
  const raw =
    persisted && typeof persisted === "object" && "keybinds" in persisted
      ? (persisted as { keybinds?: Partial<Record<KeybindAction, string>> }).keybinds
      : undefined;

  const next: KeybindMap = { ...KEYBIND_DEFAULTS };
  for (const action of Object.keys(KEYBIND_DEFAULTS) as KeybindAction[]) {
    const key = raw?.[action];
    if (typeof key === "string" && key.length > 0) next[action] = normalizeKey(key);
  }
  return next;
}

export const useKeybindsStore = create<KeybindsState>()(
  persist(
    (set) => ({
      keybinds: { ...KEYBIND_DEFAULTS },
      setKeybind: (action, key) =>
        set((state) => ({
          keybinds: {
            ...state.keybinds,
            [action]: normalizeKey(key),
          },
        })),
      resetKeybinds: () => set({ keybinds: { ...KEYBIND_DEFAULTS } }),
    }),
    {
      name: "game.keybinds.v1",
      partialize: (state) => ({ keybinds: state.keybinds }),
      merge: (persisted, current) => ({
        ...current,
        keybinds: loadPersistedKeybinds(persisted),
      }),
    },
  ),
);

export function useKeybind(action: KeybindAction): string {
  return useKeybindsStore((state) => state.keybinds[action]);
}
