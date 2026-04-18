/**
 * Per-tab active-dialog state. Stores the current node as delivered by the
 * server (`dialog-node` message). The DialogUI subscribes via `useSyncExternal
 * Store`; room message handlers call `openDialog` / `updateNode` / `closeDialog`
 * to drive it.
 *
 * Dialog progress is NOT persisted — refreshes close any in-flight dialog.
 */
import { useSyncExternalStore } from "react";

export type DialogServerChoice = {
  text: string;
  /** Greyed-out when false (requirement not met, per server re-check). */
  available: boolean;
  reason?: string;
};

export type DialogServerNode = {
  npcId: string;
  id: string;
  text: string;
  choices: DialogServerChoice[];
};

export type DialogHeader = {
  speakerName: string;
  portraitId: string;
};

type DialogState = {
  open: boolean;
  header: DialogHeader | null;
  node: DialogServerNode | null;
};

const initialState: DialogState = { open: false, header: null, node: null };

let state: DialogState = initialState;
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

function snapshot(): DialogState {
  return state;
}

export function openDialog(header: DialogHeader, node: DialogServerNode): void {
  state = { open: true, header, node };
  emit();
}

export function updateDialogNode(node: DialogServerNode): void {
  if (!state.open) return;
  state = { ...state, node };
  emit();
}

export function closeDialog(): void {
  if (!state.open && !state.node && !state.header) return;
  state = { open: false, header: null, node: null };
  emit();
}

export function useDialogState(): DialogState {
  return useSyncExternalStore(subscribe, snapshot, () => initialState);
}

export function peekDialog(): DialogState {
  return state;
}

if (typeof window !== "undefined") {
  // Dev hook — lets preview-harness smoke-test the UI without a real server
  // round-trip. Mirrors `window.setCameraProfile` in cameraProfiles.ts.
  (
    window as unknown as {
      __dialogStore?: {
        open: typeof openDialog;
        update: typeof updateDialogNode;
        close: typeof closeDialog;
        peek: typeof peekDialog;
      };
    }
  ).__dialogStore = {
    open: openDialog,
    update: updateDialogNode,
    close: closeDialog,
    peek: peekDialog,
  };
}
