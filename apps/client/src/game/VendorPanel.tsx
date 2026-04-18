import { getItem, VENDOR_STOCK } from "@game/shared";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PlayerSnapshot } from "@/net/useRoom";

function itemColor(item: ReturnType<typeof getItem>): string {
  if (!item) return "#71717a";
  if (item.rarity === "legendary") return "#fbbf24";
  if (item.rarity === "rare") return "#60a5fa";
  return "#a1a1aa";
}

function SellItemSlot({
  itemId,
  qty,
  onSell,
}: {
  itemId: string;
  qty: number;
  onSell: (qty: number) => void;
}) {
  const def = getItem(itemId);
  const color = itemColor(def);
  const sellPrice = Math.max(1, Math.floor((def?.price ?? 0) * 0.4));
  const tooltip = `${def?.name ?? itemId} (×${qty}) — Click to sell 1 · Shift-click for all · Value: ${sellPrice}g each`;

  return (
    <button
      type="button"
      title={tooltip}
      onClick={(e) => {
        if (e.shiftKey) {
          onSell(qty);
        } else {
          onSell(1);
        }
      }}
      className={cn(
        "group relative flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg border-2 bg-muted/20 px-0.5 py-1 transition-transform hover:scale-105 active:scale-95 sm:h-14 sm:w-14",
      )}
      style={{ borderColor: color }}
    >
      <div className="size-5 rounded sm:size-6" style={{ background: color }} />
      <div className="truncate w-full px-0.5 text-center font-medium text-[8px] leading-tight sm:text-[9px]">
        {def?.name ?? itemId}
      </div>

      <div className="absolute bottom-0.5 left-0.5 flex items-center gap-0.5 rounded bg-background/60 px-0.5 text-[7px] text-amber-400 tabular-nums sm:text-[8px]">
        <Coins className="size-2" />
        {sellPrice}
      </div>

      <span className="pointer-events-none absolute right-0.5 bottom-0.5 rounded bg-background/80 px-1 text-[9px] text-muted-foreground tabular-nums sm:text-[10px]">
        ×{qty}
      </span>
    </button>
  );
}

export function VendorPanel({
  open,
  onOpenChange,
  player,
  onBuy,
  onSell,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  player: PlayerSnapshot | undefined;
  onBuy: (itemId: string, qty: number) => void;
  onSell: (itemId: string, qty: number) => void;
}) {
  if (!player) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Mercer the Vendor
            <span className="ml-auto flex items-center gap-1 text-amber-400 text-sm">
              <Coins className="size-4" />
              <span className="tabular-nums">{player.gold}</span>
            </span>
          </DialogTitle>
          <DialogDescription>Stock changes with your level.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-4">
          <section className="flex flex-col gap-2">
            <h4 className="font-semibold text-xs uppercase text-muted-foreground">Buy</h4>
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
              {VENDOR_STOCK.map((id) => {
                const def = getItem(id);
                if (!def) return null;
                const price = def.price ?? 0;
                const canAfford = player.gold >= price;
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{def.name}</div>
                      <div className="text-muted-foreground text-[11px]">
                        {def.kind}
                        {def.slot ? ` · ${def.slot}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <Coins className="size-3" />
                      <span className="tabular-nums">{price}</span>
                    </div>
                    <Button size="sm" disabled={!canAfford} onClick={() => onBuy(id, 1)}>
                      Buy
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <h4 className="font-semibold text-xs uppercase text-muted-foreground">Sell</h4>
            <div className="grid grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-4 lg:grid-cols-5">
              {player.inventory.length === 0 ? (
                <div className="col-span-full py-6 text-center text-muted-foreground text-xs">
                  Bag is empty.
                </div>
              ) : (
                player.inventory.map((slot, idx) => (
                  <SellItemSlot
                    key={`${slot.itemId}-${idx}`}
                    itemId={slot.itemId}
                    qty={slot.qty}
                    onSell={(qty) => onSell(slot.itemId, qty)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
