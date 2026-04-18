import type { DialogTree } from "../dialog";

/**
 * Elder Cubius in the lobby — the game's first quest giver. The first quest
 * is auto-accepted on login today, so the dialog's primary job is
 * introducing the NPC, handing back to "accept" as an explicit choice, and
 * teasing the higher-level content that's gated behind leveling up.
 */
export const elderCubiusDialog: DialogTree = {
  npcId: "npc:quest",
  speakerName: "Elder Cubius",
  portraitId: "elder-cubius",
  rootNodeId: "greeting",
  nodes: {
    greeting: {
      id: "greeting",
      text: "Traveler. The lobby grows restless and my bones ache for rest. Will you lend a hand?",
      choices: [
        {
          text: "Tell me about the work.",
          goto: "about-work",
        },
        {
          text: "I'll take the job.",
          goto: "first-blood-accepted",
          requires: [{ kind: "questStatus", questId: "first-blood", status: "none" }],
          actions: [{ kind: "startQuest", questId: "first-blood" }],
        },
        {
          text: "Any trials for the seasoned?",
          goto: "trial-offered",
          requires: [{ kind: "minLevel", level: 3 }],
        },
        {
          text: "Farewell, elder.",
          goto: "end",
        },
      ],
    },
    "about-work": {
      id: "about-work",
      text: "Vermin from beyond the veil prowl the fringes. Three kills will prove your mettle — no more, no less. The arena waits beyond that.",
      choices: [
        {
          text: "Understood. I'll begin.",
          goto: "first-blood-accepted",
          requires: [{ kind: "questStatus", questId: "first-blood", status: "none" }],
          actions: [{ kind: "startQuest", questId: "first-blood" }],
        },
        {
          text: "Back to the start.",
          goto: "greeting",
        },
        {
          text: "I have heard enough.",
          goto: "end",
        },
      ],
    },
    "first-blood-accepted": {
      id: "first-blood-accepted",
      text: "Good. Return when the deed is done and we will speak of arenas.",
      choices: [
        {
          text: "Farewell.",
          goto: "end",
        },
      ],
    },
    "trial-offered": {
      id: "trial-offered",
      text: "The arena outside these walls. Survive long enough and you will find your name — or your end — there.",
      choices: [
        {
          text: "I'll find my way.",
          goto: "end",
        },
        {
          text: "Back to the start.",
          goto: "greeting",
        },
      ],
    },
  },
};
