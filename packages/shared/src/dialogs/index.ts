import type { DialogTree } from "../dialog";
import { elderCubiusDialog } from "./elder-cubius";
import { mercerDialog } from "./mercer";

/** NPC id → dialog tree. Keys match `Npc.id` in `GameRoomState.npcs`. */
export const DIALOG_TREES: Readonly<Record<string, DialogTree>> = {
  [elderCubiusDialog.npcId]: elderCubiusDialog,
  [mercerDialog.npcId]: mercerDialog,
};

export function getDialogTree(npcId: string): DialogTree | undefined {
  return DIALOG_TREES[npcId];
}

export { elderCubiusDialog, mercerDialog };
