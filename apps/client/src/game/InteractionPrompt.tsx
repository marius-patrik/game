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
  return (
    <div
      data-testid="interaction-prompt"
      data-kind={kind}
      className="polish-glass pointer-events-none absolute bottom-[168px] left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs sm:bottom-[184px]"
      style={{ borderColor: `rgb(var(${kindBorderTokenVar(kind)}) / 0.6)` }}
    >
      Press{" "}
      <kbd className="rounded border border-border/60 bg-muted px-1">
        {formatKeybind(keyBinding)}
      </kbd>{" "}
      to {verb} <strong>{label}</strong>
    </div>
  );
}

function kindBorderTokenVar(kind: InteractionPromptKind): string {
  switch (kind) {
    case "vendor":
      return "--accent-violet";
    case "questgiver":
      return "--accent-emerald";
    case "drop":
      return "--accent-emerald-soft";
    case "portal":
      return "--accent-amber";
    default:
      return "--accent-gold";
  }
}
