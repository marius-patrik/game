import { create } from "zustand";
import { persist } from "zustand/middleware";

type PreferencesState = {
  skipCinematics: boolean;
  setSkipCinematics: (value: boolean) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      skipCinematics: false,
      setSkipCinematics: (value) => set({ skipCinematics: value }),
    }),
    {
      name: "game.preferences.v1",
      partialize: (state) => ({ skipCinematics: state.skipCinematics }),
    },
  ),
);
