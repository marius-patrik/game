import { useSyncExternalStore } from "react";

type CameraState = {
  yaw: number;
};

const state: CameraState = {
  yaw: 0,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function snapshot(): CameraState {
  return state;
}

export function setCameraYaw(yaw: number): void {
  if (state.yaw === yaw) return;
  state.yaw = yaw;
  emit();
}

export function peekCameraYaw(): number {
  return state.yaw;
}

export function useCameraYaw(): number {
  return useSyncExternalStore(
    subscribe,
    () => snapshot().yaw,
    () => 0,
  );
}
