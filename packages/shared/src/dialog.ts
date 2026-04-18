/**
 * Skyrim-style NPC dialog trees.
 *
 * Each NPC's conversation is an immutable graph of `DialogNode`s. The server
 * validates every advance from scratch using the player's current state, so
 * no dialog progress lives in the Colyseus schema — resolving a choice is a
 * pure function of (tree, nodeId, choiceIndex, player snapshot).
 *
 * A `goto` of `"end"` closes the modal.
 */

export type DialogEndNodeId = "end";

export type DialogRequirement =
  | { kind: "minLevel"; level: number }
  | { kind: "questStatus"; questId: string; status: "none" | "active" | "complete" | "turned_in" }
  | { kind: "hasItem"; itemId: string; qty?: number };

export type DialogAction =
  | { kind: "startQuest"; questId: string }
  | { kind: "openVendor" }
  | { kind: "turnInQuest"; questId: string };

export type DialogChoice = {
  /** Text shown on the choice button (e.g. "I'll take the job."). */
  text: string;
  /** Next node id to transition to, or `"end"` to close the dialog. */
  goto: string | DialogEndNodeId;
  /**
   * Requirements that must all pass for this choice to be selectable.
   * When any requirement fails the choice is rendered greyed-out with a
   * tooltip explaining the gate.
   */
  requires?: readonly DialogRequirement[];
  /** Server-side effects applied before transitioning to `goto`. */
  actions?: readonly DialogAction[];
};

export type DialogNode = {
  id: string;
  /** Speaker line rendered through the typewriter. */
  text: string;
  choices: readonly DialogChoice[];
};

export type DialogTree = {
  /** Matches `Npc.id` on the server. */
  npcId: string;
  /** Shown in the modal header — fall back to `Npc.name` if unset. */
  speakerName?: string;
  /**
   * Optional static portrait key. Clients map this to a colour/glyph for the
   * placeholder portrait stub; future work swaps in artwork.
   */
  portraitId?: string;
  /** First node entered on `dialog-start`. */
  rootNodeId: string;
  nodes: Readonly<Record<string, DialogNode>>;
};

export type DialogValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * Static structural validator for a dialog tree. Catches typos that would
 * otherwise only blow up at runtime: missing root, dangling gotos, empty
 * choice lists on non-terminal nodes.
 */
export function validateDialogTree(tree: DialogTree): DialogValidationResult {
  if (!tree.rootNodeId) return { ok: false, reason: "missing rootNodeId" };
  if (!tree.nodes[tree.rootNodeId]) {
    return { ok: false, reason: `rootNodeId "${tree.rootNodeId}" not in nodes` };
  }
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.id !== id) {
      return { ok: false, reason: `node key "${id}" does not match node.id "${node.id}"` };
    }
    if (node.choices.length === 0) {
      return { ok: false, reason: `node "${id}" has no choices (use goto: "end" to close)` };
    }
    for (const [i, c] of node.choices.entries()) {
      if (c.goto === "end") continue;
      if (!tree.nodes[c.goto]) {
        return { ok: false, reason: `node "${id}" choice ${i} → unknown goto "${c.goto}"` };
      }
    }
  }
  return { ok: true };
}

export type DialogPlayerSnapshot = {
  level: number;
  quests: ReadonlyMap<string, { status: string }>;
  inventory: ReadonlyArray<{ itemId: string; qty: number }>;
};

export function checkRequirement(
  req: DialogRequirement,
  player: DialogPlayerSnapshot,
): { ok: boolean; reason?: string } {
  switch (req.kind) {
    case "minLevel":
      if (player.level < req.level) {
        return { ok: false, reason: `Requires level ${req.level}` };
      }
      return { ok: true };
    case "questStatus": {
      const q = player.quests.get(req.questId);
      const status = q?.status ?? "none";
      if (status !== req.status) {
        return { ok: false, reason: `Quest "${req.questId}" must be ${req.status}` };
      }
      return { ok: true };
    }
    case "hasItem": {
      const need = req.qty ?? 1;
      let have = 0;
      for (const slot of player.inventory) {
        if (slot.itemId === req.itemId) have += slot.qty;
        if (have >= need) break;
      }
      if (have < need) {
        return { ok: false, reason: `Need ${need}× ${req.itemId}` };
      }
      return { ok: true };
    }
  }
}

/** Aggregate-check — all requirements must pass. Returns the first failure. */
export function checkAllRequirements(
  requirements: readonly DialogRequirement[] | undefined,
  player: DialogPlayerSnapshot,
): { ok: boolean; reason?: string } {
  if (!requirements || requirements.length === 0) return { ok: true };
  for (const r of requirements) {
    const result = checkRequirement(r, player);
    if (!result.ok) return result;
  }
  return { ok: true };
}
