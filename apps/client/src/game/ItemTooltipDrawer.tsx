import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type ItemId, getItem } from "@game/shared";
import { Drawer } from "vaul";

type Action = { label: string; onSelect: () => void; variant?: "default" | "destructive" };

const rarityColor: Record<string, string> = {
  legendary: "#fbbf24",
  rare: "#60a5fa",
  common: "#a1a1aa",
};

/**
 * Bottom-sheet item tooltip for touch. Shows rarity-tinted header, bonus
 * list, and Drop/Equip/Use actions. Opens on long-press from
 * `ActionBar` inventory slots; the drawer closes itself after any
 * action fires.
 */
export function ItemTooltipDrawer({
  itemId,
  qty,
  equipped,
  open,
  onOpenChange,
  onUse,
  onEquip,
  onDrop,
}: {
  itemId: ItemId | undefined;
  qty: number;
  equipped: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUse: () => void;
  onEquip: () => void;
  onDrop: () => void;
}) {
  const def = itemId ? getItem(itemId) : undefined;
  const color = def ? (rarityColor[def.rarity] ?? rarityColor.common) : rarityColor.common;
  const bonuses: string[] = [];
  if (def?.damageBonus) bonuses.push(`+${def.damageBonus} damage`);
  if (def?.strBonus) bonuses.push(`+${def.strBonus} STR`);
  if (def?.dexBonus) bonuses.push(`+${def.dexBonus} DEX`);
  if (def?.vitBonus) bonuses.push(`+${def.vitBonus} VIT`);
  if (def?.intBonus) bonuses.push(`+${def.intBonus} INT`);
  if (def?.healAmount) bonuses.push(`+${def.healAmount} HP on use`);
  if (def?.manaAmount) bonuses.push(`+${def.manaAmount} mana on use`);
  if (def?.xpReward) bonuses.push(`+${def.xpReward} XP on turn-in`);

  const actions: Action[] = [];
  if (def?.kind === "consumable") {
    actions.push({ label: "Use", onSelect: () => close(onUse) });
  } else if (def?.slot) {
    actions.push({
      label: equipped ? "Equipped" : "Equip",
      onSelect: () => close(onEquip),
    });
  }
  actions.push({ label: "Drop 1", onSelect: () => close(onDrop), variant: "destructive" });

  function close(fn: () => void) {
    fn();
    onOpenChange(false);
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-2xl border border-border/50 border-b-0 bg-background pb-6 outline-none">
          <div className="mx-auto my-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30" />
          <div className="flex flex-col gap-3 px-5 pb-2">
            <Drawer.Title className="flex items-center gap-3">
              <span
                className="inline-block size-8 rounded shadow-inner"
                style={{ background: color }}
                aria-hidden
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold text-base" style={{ color }}>
                  {def?.name ?? itemId ?? "Item"}
                </span>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  {def ? `${def.rarity} · ${def.kind}` : "unknown"}
                  {qty > 1 ? ` · ×${qty}` : ""}
                  {equipped ? " · equipped" : ""}
                </span>
              </span>
            </Drawer.Title>
            <Drawer.Description className="sr-only">
              Details and actions for {def?.name ?? itemId ?? "item"}.
            </Drawer.Description>
            {bonuses.length > 0 ? (
              <ul className="flex flex-col gap-0.5 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                {bonuses.map((b) => (
                  <li key={b} className="tabular-nums">
                    {b}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">No stat bonuses.</p>
            )}
          </div>
          <div className="flex flex-col gap-2 px-5 pt-2">
            {actions.map((a) => (
              <Button
                key={a.label}
                type="button"
                variant={a.variant === "destructive" ? "destructive" : "default"}
                size="lg"
                className={cn("w-full", a.variant === "destructive" && "mt-1")}
                onClick={a.onSelect}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
