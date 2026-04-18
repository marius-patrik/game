import type { ItemQuickSlotKey } from "@/game/hotbar/shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ItemQuickSlotBindings = Record<ItemQuickSlotKey, string>;

const EMPTY_ITEM_SLOTS: ItemQuickSlotBindings = {
  I1: "",
  I2: "",
};

type HotbarState = {
  itemSlotsByCharacter: Record<string, ItemQuickSlotBindings>;
  setItemQuickSlot: (characterId: string, slot: ItemQuickSlotKey, itemId: string) => void;
};

function sanitizePersistedSlots(persisted: unknown): Record<string, ItemQuickSlotBindings> {
  const raw =
    persisted && typeof persisted === "object" && "itemSlotsByCharacter" in persisted
      ? (persisted as { itemSlotsByCharacter?: Record<string, Partial<ItemQuickSlotBindings>> })
          .itemSlotsByCharacter
      : undefined;

  const next: Record<string, ItemQuickSlotBindings> = {};
  for (const [characterId, slots] of Object.entries(raw ?? {})) {
    next[characterId] = {
      I1: typeof slots.I1 === "string" ? slots.I1 : "",
      I2: typeof slots.I2 === "string" ? slots.I2 : "",
    };
  }
  return next;
}

export const useHotbarStore = create<HotbarState>()(
  persist(
    (set) => ({
      itemSlotsByCharacter: {},
      setItemQuickSlot: (characterId, slot, itemId) =>
        set((state) => ({
          itemSlotsByCharacter: {
            ...state.itemSlotsByCharacter,
            [characterId]: {
              ...(state.itemSlotsByCharacter[characterId] ?? EMPTY_ITEM_SLOTS),
              [slot]: itemId,
            },
          },
        })),
    }),
    {
      name: "game.hotbar.v1",
      partialize: (state) => ({ itemSlotsByCharacter: state.itemSlotsByCharacter }),
      merge: (persisted, current) => ({
        ...current,
        itemSlotsByCharacter: sanitizePersistedSlots(persisted),
      }),
    },
  ),
);

export function useItemQuickSlotBindings(characterId: string | null): ItemQuickSlotBindings {
  return useHotbarStore((state) =>
    characterId ? (state.itemSlotsByCharacter[characterId] ?? EMPTY_ITEM_SLOTS) : EMPTY_ITEM_SLOTS,
  );
}
