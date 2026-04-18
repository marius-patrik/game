import {
  checkAllRequirements,
  type DialogAction,
  type DialogNode,
  type DialogPlayerSnapshot,
  type DialogTree,
} from "@game/shared/dialog";
import { getDialogTree } from "@game/shared/dialogs";

export type DialogActionRequest =
  | { kind: "startQuest"; questId: string }
  | { kind: "turnInQuest"; questId: string }
  | { kind: "openVendor" };

export type DialogStartResult =
  | { ok: true; tree: DialogTree; node: DialogNode }
  | { ok: false; reason: "unknown_npc" };

export type DialogChooseResult =
  | {
      ok: true;
      /** The node the client should render next (terminal if `close` is true). */
      node?: DialogNode;
      /** Server-side effects the caller is expected to apply. */
      actions: readonly DialogActionRequest[];
      /** When true, the client modal should close. */
      close: boolean;
    }
  | {
      ok: false;
      reason: "unknown_npc" | "unknown_node" | "invalid_choice" | "requirement_failed";
      detail?: string;
    };

/**
 * Resolve the initial node for a `dialog-start` message. Pure — no player
 * state is consulted (the root is reachable for everyone; gating happens on
 * choices).
 */
export function startDialog(npcId: string): DialogStartResult {
  const tree = getDialogTree(npcId);
  if (!tree) return { ok: false, reason: "unknown_npc" };
  const node = tree.nodes[tree.rootNodeId];
  if (!node) return { ok: false, reason: "unknown_npc" };
  return { ok: true, tree, node };
}

/**
 * Resolve a `dialog-choose` message. The server re-validates the node id and
 * choice index against the tree (client-supplied) and re-checks every
 * requirement against the player snapshot. Nothing on the server persists
 * between calls — dialog state is client-only.
 */
export function chooseDialog(
  npcId: string,
  nodeId: string,
  choiceIndex: number,
  player: DialogPlayerSnapshot,
): DialogChooseResult {
  const tree = getDialogTree(npcId);
  if (!tree) return { ok: false, reason: "unknown_npc" };
  const node = tree.nodes[nodeId];
  if (!node) return { ok: false, reason: "unknown_node", detail: nodeId };
  if (choiceIndex < 0 || choiceIndex >= node.choices.length) {
    return { ok: false, reason: "invalid_choice", detail: `index ${choiceIndex}` };
  }
  const choice = node.choices[choiceIndex];
  if (!choice) return { ok: false, reason: "invalid_choice", detail: `index ${choiceIndex}` };

  const req = checkAllRequirements(choice.requires, player);
  if (!req.ok) return { ok: false, reason: "requirement_failed", detail: req.reason };

  const actions = mapActions(choice.actions);
  if (choice.goto === "end") {
    return { ok: true, actions, close: true };
  }
  const nextNode = tree.nodes[choice.goto];
  if (!nextNode) {
    return { ok: false, reason: "unknown_node", detail: choice.goto };
  }
  return { ok: true, node: nextNode, actions, close: false };
}

function mapActions(actions: readonly DialogAction[] | undefined): readonly DialogActionRequest[] {
  if (!actions || actions.length === 0) return [];
  return actions.map((a) => a);
}
