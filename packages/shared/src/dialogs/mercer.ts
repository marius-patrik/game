import type { DialogTree } from "../dialog";

/**
 * Mercer the lobby vendor. The dialog's "Show me your wares." choice fires
 * an `openVendor` action — the server closes the dialog and the client opens
 * the existing VendorPanel. Stocking is handled by VENDOR_STOCK; the dialog
 * is pure flavor + entry point.
 */
export const mercerDialog: DialogTree = {
  npcId: "npc:vendor",
  speakerName: "Mercer the Vendor",
  portraitId: "mercer",
  rootNodeId: "greeting",
  nodes: {
    greeting: {
      id: "greeting",
      text: "Coin for steel, steel for coin. I keep the scales honest — which is more than most can say.",
      choices: [
        {
          text: "Show me your wares.",
          goto: "end",
          actions: [{ kind: "openVendor" }],
        },
        {
          text: "Who stocks your shelves?",
          goto: "about-supply",
        },
        {
          text: "Not today.",
          goto: "end",
        },
      ],
    },
    "about-supply": {
      id: "about-supply",
      text: "Caravans come in from the eastern passes when the roads allow. If the stock looks thin, blame the weather — or the bandits.",
      choices: [
        {
          text: "Let's trade, then.",
          goto: "end",
          actions: [{ kind: "openVendor" }],
        },
        {
          text: "Another time.",
          goto: "end",
        },
      ],
    },
  },
};
