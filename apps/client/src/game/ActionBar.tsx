import { cn } from "@/lib/utils";
import type { PlayerSnapshot } from "@/net/useRoom";
import {
  type EquipSlot,
  type ItemId,
  SKILL_BAR,
  SKILL_CATALOG,
  type SkillId,
  getItem,
  isItemId,
} from "@game/shared";
import { useCallback, useEffect, useRef, useState } from "react";

type Cd = Partial<Record<SkillId, number>>;

/** Combined abilities + inventory bar — the "main UI section" at the bottom. */
export function ActionBar({
  player,
  enabled,
  onCast,
  onUse,
  onEquip,
  onEquipSlot,
  onDrop,
}: {
  player: PlayerSnapshot | undefined;
  enabled: boolean;
  onCast: (id: SkillId) => void;
  onUse: (itemId: string) => void;
  onEquip: (itemId: string) => void;
  onEquipSlot: (slot: EquipSlot, itemId: string) => void;
  onDrop: (itemId: string, qty: number) => void;
}) {
  const [, force] = useState(0);
  const cdRef = useRef<Cd>({});
  const manaRef = useRef(player?.mana ?? 0);
  manaRef.current = Math.floor(player?.mana ?? 0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const cast = useCallback(
    (id: SkillId) => {
      if (!enabledRef.current) return;
      const skill = SKILL_CATALOG[id];
      const now = Date.now();
      const ready = cdRef.current[id] ?? 0;
      if (now < ready) return;
      if (manaRef.current < skill.manaCost) return;
      cdRef.current = { ...cdRef.current, [id]: now + skill.cooldownMs };
      force((v) => v + 1);
      onCast(id);
    },
    [onCast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const idx = Number.parseInt(e.key, 10);
      if (!Number.isFinite(idx)) return;
      const id = SKILL_BAR[idx - 1];
      if (!id) return;
      e.preventDefault();
      cast(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cast]);

  useEffect(() => {
    const id = setInterval(() => force((v) => v + 1), 100);
    return () => clearInterval(id);
  }, []);

  const mana = Math.floor(player?.mana ?? 0);

  return (
    <div className="pointer-events-auto absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-end gap-2 sm:bottom-4 sm:gap-3">
      <div className="flex gap-1.5 rounded-xl border border-border/40 bg-background/70 px-2 py-2 shadow-md backdrop-blur-md">
        {SKILL_BAR.map((id, idx) => {
          const skill = SKILL_CATALOG[id];
          const ready = cdRef.current[id] ?? 0;
          const now = Date.now();
          const cd = Math.max(0, ready - now);
          const cdFrac = cd > 0 ? cd / skill.cooldownMs : 0;
          const canAfford = skill.manaCost === 0 || mana >= skill.manaCost;
          const disabled = !enabled || cd > 0 || !canAfford;
          return (
            <button
              key={id}
              type="button"
              onClick={() => cast(id)}
              disabled={disabled}
              aria-label={`${skill.name} (key ${idx + 1})`}
              title={`${skill.name} — ${skill.description}${
                skill.manaCost > 0 ? ` (${skill.manaCost} mana)` : ""
              }`}
              className={cn(
                "group relative h-14 w-14 overflow-hidden rounded-lg border-2 bg-background/80 shadow-md backdrop-blur-md transition-transform",
                disabled ? "opacity-70" : "hover:scale-105",
              )}
              style={{ borderColor: skill.color }}
            >
              <span
                className="-translate-x-1/2 absolute top-1 left-1/2 font-bold text-[11px] tabular-nums"
                style={{ color: skill.color }}
              >
                {skill.name}
              </span>
              <span className="absolute right-1 bottom-1 rounded bg-background/60 px-1 font-mono text-[10px] text-muted-foreground">
                {idx + 1}
              </span>
              {skill.manaCost > 0 ? (
                <span className="-translate-x-1/2 absolute bottom-1 left-1/2 text-[10px] text-sky-400 tabular-nums">
                  {skill.manaCost}
                </span>
              ) : null}
              {cd > 0 ? (
                <span
                  className="absolute inset-x-0 bottom-0 bg-background/70"
                  style={{ height: `${cdFrac * 100}%` }}
                />
              ) : null}
              {cd > 0 ? (
                <span className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 font-mono font-semibold text-white text-xs">
                  {(cd / 1000).toFixed(1)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="hidden items-center self-stretch text-muted-foreground text-xs sm:flex">
        <span className="opacity-60">|</span>
      </div>
      <div className="flex gap-1.5 rounded-xl border border-border/40 bg-background/70 px-2 py-2 shadow-md backdrop-blur-md">
        {Array.from({ length: 6 }, (_, i) => i).map((i) => {
          const slot = player?.inventory[i];
          if (!slot || !isItemId(slot.itemId)) {
            return (
              <div
                key={`slot-empty-${i}`}
                className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-border/30 bg-muted/10"
                aria-label="Empty slot"
              />
            );
          }
          return (
            <ItemSlot
              key={`slot-${i}-${slot.itemId}`}
              itemId={slot.itemId as ItemId}
              qty={slot.qty}
              equipped={player?.equippedItemId === slot.itemId}
              onUse={() => onUse(slot.itemId)}
              onEquip={() => {
                onEquip(slot.itemId);
                const def = getItem(slot.itemId);
                if (def?.slot) onEquipSlot(def.slot, slot.itemId);
              }}
              onDrop={() => onDrop(slot.itemId, 1)}
            />
          );
        })}
      </div>
    </div>
  );
}

function itemColor(item: ReturnType<typeof getItem>): string {
  if (!item) return "#71717a";
  if (item.rarity === "legendary") return "#fbbf24";
  if (item.rarity === "rare") return "#60a5fa";
  return "#a1a1aa";
}

function ItemSlot({
  itemId,
  qty,
  equipped,
  onUse,
  onEquip,
  onDrop,
}: {
  itemId: ItemId;
  qty: number;
  equipped: boolean;
  onUse: () => void;
  onEquip: () => void;
  onDrop: () => void;
}) {
  const def = getItem(itemId);
  const canUse = def?.kind === "consumable";
  const canEquip = Boolean(def?.slot);
  const color = itemColor(def);
  const bonuses: string[] = [];
  if (def?.damageBonus) bonuses.push(`+${def.damageBonus} dmg`);
  if (def?.strBonus) bonuses.push(`+${def.strBonus} STR`);
  if (def?.dexBonus) bonuses.push(`+${def.dexBonus} DEX`);
  if (def?.vitBonus) bonuses.push(`+${def.vitBonus} VIT`);
  if (def?.intBonus) bonuses.push(`+${def.intBonus} INT`);
  if (def?.healAmount) bonuses.push(`+${def.healAmount} HP`);
  if (def?.manaAmount) bonuses.push(`+${def.manaAmount} mana`);
  const tooltip = `${def?.name ?? itemId}${bonuses.length ? ` · ${bonuses.join(", ")}` : ""}`;
  const onClick = canUse ? onUse : canEquip ? onEquip : undefined;
  return (
    <div className="group relative h-14 w-14" title={tooltip}>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-lg border-2 bg-muted/20 px-0.5 py-1 transition-transform",
          equipped && "ring-2 ring-amber-400",
          !onClick && "cursor-default",
          onClick && "hover:scale-105",
        )}
        style={{ borderColor: color }}
      >
        <div className="size-6 rounded" style={{ background: color }} />
        <div className="text-[9px] font-medium leading-tight" style={{ maxWidth: 48 }}>
          {def?.name?.slice(0, 8) ?? itemId.slice(0, 8)}
        </div>
      </button>
      <span className="pointer-events-none absolute right-0.5 bottom-0.5 rounded bg-background/80 px-1 text-[10px] text-muted-foreground tabular-nums">
        ×{qty}
      </span>
      <button
        type="button"
        onClick={onDrop}
        aria-label="Drop item"
        className="absolute top-0.5 right-0.5 size-3.5 rounded-full bg-background/70 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
