import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlayerSnapshot } from "@/net/useRoom";
import { VENDOR_STOCK, getItem } from "@game/shared";
import { Coins } from "lucide-react";

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
        <div className="grid grid-cols-2 gap-3">
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
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
              {player.inventory.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-xs">Bag is empty.</div>
              ) : (
                player.inventory.map((slot, idx) => {
                  const def = getItem(slot.itemId);
                  if (!def) return null;
                  const sellFor = Math.max(1, Math.floor((def.price ?? 0) * 0.4));
                  return (
                    <div
                      key={`${slot.itemId}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{def.name}</div>
                        <div className="text-muted-foreground text-[11px] tabular-nums">
                          ×{slot.qty}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-amber-400">
                        <Coins className="size-3" />
                        <span className="tabular-nums">{sellFor}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => onSell(slot.itemId, 1)}>
                        Sell
                      </Button>
                    </div>
                  );
                })
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
