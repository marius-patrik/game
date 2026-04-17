import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PlayerSnapshot } from "@/net/useRoom";
import { EQUIP_SLOTS, type EquipSlot, type ItemId, getItem, isItemId } from "@game/shared";
import { Backpack, X } from "lucide-react";
import { useState } from "react";

const SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: "Weapon",
  head: "Head",
  chest: "Chest",
  ring: "Ring",
};

function itemColor(item: ReturnType<typeof getItem>): string {
  if (!item) return "#71717a";
  if (item.rarity === "legendary") return "#fbbf24";
  if (item.rarity === "rare") return "#60a5fa";
  return "#a1a1aa";
}

export function InventoryPanel({
  player,
  onEquipSlot,
  onUnequipSlot,
  onUse,
  onDrop,
}: {
  player: PlayerSnapshot | undefined;
  onEquipSlot: (slot: EquipSlot, itemId: string) => void;
  onUnequipSlot: (slot: EquipSlot) => void;
  onUse: (itemId: string) => void;
  onDrop: (itemId: string, qty: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!player) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto backdrop-blur-md bg-background/40"
          aria-label="Inventory"
        >
          <Backpack />
          <span className="hidden sm:inline">bag</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Inventory</DialogTitle>
          <DialogDescription>Equip gear and use consumables.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_1.2fr] gap-4">
          <section className="flex flex-col gap-2">
            <h4 className="font-semibold text-xs uppercase text-muted-foreground">Equipment</h4>
            {EQUIP_SLOTS.map((slot) => {
              const id = player.equipment[slot];
              const def = id ? getItem(id) : undefined;
              return (
                <div
                  key={slot}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-sm"
                  style={{ borderColor: def ? itemColor(def) : undefined }}
                >
                  <div className="min-w-0">
                    <div className="text-muted-foreground text-[11px] uppercase">
                      {SLOT_LABELS[slot]}
                    </div>
                    <div
                      className="truncate font-medium"
                      style={{ color: def ? itemColor(def) : undefined }}
                    >
                      {def?.name ?? "—"}
                    </div>
                  </div>
                  {def ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUnequipSlot(slot)}
                    >
                      <X className="size-3" />
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </section>
          <section className="flex flex-col gap-2">
            <h4 className="font-semibold text-xs uppercase text-muted-foreground">Bag</h4>
            <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto pr-1">
              {player.inventory.length === 0 ? (
                <div className="col-span-4 py-6 text-center text-muted-foreground text-xs">
                  Empty.
                </div>
              ) : (
                player.inventory.map((slot, idx) => {
                  const def = getItem(slot.itemId);
                  const qty = slot.qty;
                  return (
                    <ItemCell
                      key={`${slot.itemId}-${idx}`}
                      itemId={slot.itemId}
                      qty={qty}
                      color={itemColor(def)}
                      label={def?.name ?? slot.itemId}
                      canEquip={def?.slot !== undefined}
                      canUse={def?.kind === "consumable"}
                      onEquip={() => {
                        if (def?.slot && isItemId(slot.itemId))
                          onEquipSlot(def.slot, slot.itemId as ItemId);
                      }}
                      onUse={() => onUse(slot.itemId)}
                      onDrop={() => onDrop(slot.itemId, 1)}
                    />
                  );
                })
              )}
            </div>
          </section>
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemCell({
  itemId,
  qty,
  color,
  label,
  canEquip,
  canUse,
  onEquip,
  onUse,
  onDrop,
}: {
  itemId: string;
  qty: number;
  color: string;
  label: string;
  canEquip: boolean;
  canUse: boolean;
  onEquip: () => void;
  onUse: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      className="group relative flex flex-col items-center gap-1 rounded-md border-2 bg-muted/20 px-1 py-1.5 text-center text-[11px]"
      style={{ borderColor: color }}
      title={label}
    >
      <div className="size-8 rounded" style={{ background: color }} />
      <div className="truncate text-[10px] font-medium" style={{ maxWidth: 56 }}>
        {label}
      </div>
      <div className="text-muted-foreground text-[10px] tabular-nums">×{qty}</div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-md bg-background/80 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        {canEquip ? (
          <button
            type="button"
            onClick={onEquip}
            className={cn("rounded bg-primary px-1 py-0.5 text-[10px] text-primary-foreground")}
          >
            Equip
          </button>
        ) : null}
        {canUse ? (
          <button
            type="button"
            onClick={onUse}
            className="rounded bg-emerald-500 px-1 py-0.5 text-[10px] text-emerald-950"
          >
            Use
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDrop}
          className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
          aria-label={`Drop ${itemId}`}
        >
          Drop
        </button>
      </div>
    </div>
  );
}
