import { formatKeybind } from "@/state/keybinds";

export type InteractionPromptKind = "npc" | "vendor" | "questgiver" | "drop" | "portal";

/** Single HUD prompt rendered above the action bar when an interactable is in
 * range. Every press-E target (NPCs, vendors, quest-givers, drops, portals)
 * flows through this component — identical visuals, label copy derived from
 * the caller. */
export function InteractionPrompt({
  visible,
  label,
  keyBinding,
  verb,
  kind,
}: {
  visible: boolean;
  /** Display name of the interactable — NPC name, item name, zone name, etc. */
  label: string;
  /** Current value of the interact keybinding (e.g. "e"). */
  keyBinding: string;
  /** Verb shown to the player. "Talk to", "Trade with", "Turn in to", "Pick up", "Enter". */
  verb: string;
  /** Semantic category for the optional tinted border / data-hook. */
  kind: InteractionPromptKind;
}) {
  if (!visible) return null;
  const color = kindBorderColor(kind);
  return (
    <div
      data-testid="interaction-prompt"
      data-kind={kind}
      className="pointer-events-none absolute bottom-[168px] left-1/2 -translate-x-1/2 rounded-full border bg-background/80 px-4 py-1 text-xs shadow backdrop-blur-md sm:bottom-[184px]"
      style={{ borderColor: color }}
    >
      Press{" "}
      <kbd className="rounded border border-border/60 bg-muted px-1">
        {formatKeybind(keyBinding)}
      </kbd>{" "}
      to {verb} <strong>{label}</strong>
    </div>
  );
}

function kindBorderColor(kind: InteractionPromptKind): string {
  switch (kind) {
    case "vendor":
      return "rgba(139,92,246,0.6)";
    case "questgiver":
      return "rgba(34,197,94,0.6)";
    case "drop":
      return "rgba(167,243,208,0.6)";
    case "portal":
      return "rgba(251,146,60,0.6)";
    default:
      return "rgba(251,191,36,0.6)";
  }
}
