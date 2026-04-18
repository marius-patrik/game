import { EQUIP_SLOTS, type EquipSlot, getAbility, getItem, type StatKey } from "@game/shared";
import { Minus, Plus, Shield } from "lucide-react";
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
import { GAME_PALETTE } from "./gamePalette";

const STATS: { key: StatKey; label: string; desc: string }[] = [
  { key: "strength", label: "Strength", desc: "+1 damage per 2 STR" },
  { key: "dexterity", label: "Dexterity", desc: "-15ms attack cooldown per DEX" },
  { key: "vitality", label: "Vitality", desc: "+8 max HP per VIT" },
  { key: "intellect", label: "Intellect", desc: "+6 max mana, faster mana regen" },
];

const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: "Weapon",
  head: "Head",
  chest: "Chest",
  ring: "Ring",
};

function baseKeyFor(
  stat: StatKey,
): "baseStrength" | "baseDexterity" | "baseVitality" | "baseIntellect" {
  if (stat === "strength") return "baseStrength";
  if (stat === "dexterity") return "baseDexterity";
  if (stat === "vitality") return "baseVitality";
  return "baseIntellect";
}

export function StatPanel({
  player,
  open,
  onOpenChange,
  onAllocate,
  onUnequipSlot,
}: {
  player: PlayerSnapshot | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAllocate: (stat: StatKey) => void;
  onUnequipSlot: (slot: EquipSlot) => void;
}) {
  if (!player) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Character</DialogTitle>
          <DialogDescription>
            Level {player.level} · {player.statPoints} unspent point
            {player.statPoints === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-1">
          {STATS.map((row) => {
            const base = player[baseKeyFor(row.key)];
            const effective = player[row.key];
            const bonus = effective - base;
            return (
              <div
                key={row.key}
                className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 p-2"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm">
                    {row.label}{" "}
                    <span className="text-muted-foreground tabular-nums">{effective}</span>
                    {bonus !== 0 ? (
                      <span
                        className={cn(
                          "ml-1 text-[11px] tabular-nums",
                          bonus > 0 ? "text-emerald-400" : "text-rose-400",
                        )}
                      >
                        ({base}
                        {bonus >= 0 ? " +" : " "}
                        {bonus})
                      </span>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground text-xs">{row.desc}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={player.statPoints <= 0}
                  onClick={() => onAllocate(row.key)}
                  aria-label={`Spend point on ${row.label}`}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
            <Shield className="size-3.5" />
            Equipment
          </div>
          <div className="grid grid-cols-2 gap-2">
            {EQUIP_SLOTS.map((slot) => (
              <EquipSlotRow
                key={slot}
                slot={slot}
                itemId={player.equipment?.[slot] ?? ""}
                onUnequip={() => onUnequipSlot(slot)}
              />
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EquipSlotRow({
  slot,
  itemId,
  onUnequip,
}: {
  slot: EquipSlot;
  itemId: string;
  onUnequip: () => void;
}) {
  const def = itemId ? getItem(itemId) : undefined;
  const primary = def?.primaryAbilityId ? getAbility(def.primaryAbilityId) : undefined;
  const secondary = def?.secondaryAbilityId ? getAbility(def.secondaryAbilityId) : undefined;
  const color =
    def?.rarity === "legendary"
      ? GAME_PALETTE.rarity.legendary
      : def?.rarity === "rare"
        ? GAME_PALETTE.rarity.rare
        : def
          ? GAME_PALETTE.rarity.common
          : GAME_PALETTE.locked;
  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-border/40 bg-muted/30 p-2"
      data-slot={slot}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {SLOT_LABEL[slot]}
        </span>
        {def ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onUnequip}
            aria-label={`Unequip ${SLOT_LABEL[slot]}`}
            title={`Unequip ${def.name}`}
          >
            <Minus className="size-3" />
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <div className="size-5 shrink-0 rounded" style={{ background: color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-xs" style={{ color }}>
            {def?.name ?? "Empty"}
          </div>
          {def ? (
            <div className="text-[10px] text-muted-foreground">
              {[
                def.damageBonus ? `+${def.damageBonus} dmg` : null,
                def.strBonus ? `+${def.strBonus} STR` : null,
                def.dexBonus ? `+${def.dexBonus} DEX` : null,
                def.vitBonus ? `+${def.vitBonus} VIT` : null,
                def.intBonus ? `+${def.intBonus} INT` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "no bonuses"}
            </div>
          ) : null}
        </div>
      </div>
      {slot === "weapon" && (primary || secondary) ? (
        <div className="flex items-center gap-1 border-border/40 border-t pt-1 text-[10px] text-muted-foreground">
          {primary ? (
            <span title={primary.description}>
              <span className="text-foreground/80">W1</span>{" "}
              <span style={{ color: primary.color }}>{primary.name}</span>
            </span>
          ) : null}
          {secondary ? (
            <span className="ml-2" title={secondary.description}>
              <span className="text-foreground/80">W2</span>{" "}
              <span style={{ color: secondary.color }}>{secondary.name}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
