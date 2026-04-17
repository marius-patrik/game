import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CharacterState {
  selectedCharacterId: string | null;
  setSelectedCharacterId: (id: string | null) => void;
}

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set) => ({
      selectedCharacterId: null,
      setSelectedCharacterId: (id) => set({ selectedCharacterId: id }),
    }),
    { name: "game.character.store" },
  ),
);
