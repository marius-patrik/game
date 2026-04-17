import { create } from "zustand";
import { persist } from "zustand/middleware";

export const FOV_MIN = 60;
export const FOV_MAX = 100;
export const FOV_DEFAULT = 70;

function clampFov(value: number): number {
  if (!Number.isFinite(value)) return FOV_DEFAULT;
  return Math.max(FOV_MIN, Math.min(FOV_MAX, value));
}

type PreferencesState = {
  skipCinematics: boolean;
  setSkipCinematics: (value: boolean) => void;
  fov: number;
  setFov: (value: number) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      skipCinematics: false,
      setSkipCinematics: (value) => set({ skipCinematics: value }),
      fov: FOV_DEFAULT,
      setFov: (value) => set({ fov: clampFov(value) }),
    }),
    {
      name: "game.preferences.v1",
      partialize: (state) => ({
        skipCinematics: state.skipCinematics,
        fov: state.fov,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PreferencesState>;
        return {
          ...current,
          ...p,
          fov: clampFov(p.fov ?? current.fov),
        };
      },
    },
  ),
);
