import { useLongPress } from "@/lib/useLongPress";
import { cn } from "@/lib/utils";
import type { PlayerSnapshot } from "@/net/useRoom";
import {
  type AbilityDef,
  type AbilityId,
  type EquipSlot,
  type ItemId,
  type SkillSlot,
  ULTIMATE_COOLDOWN_MULTIPLIER,
  UNARMED_PRIMARY,
  UNARMED_SECONDARY,
  type WeaponSlotKey,
  getAbility,
  getItem,
  getSkill,
  isItemId,
  isSkillId,
  resolveSkillAbility,
  resolveWeaponAbilityId,
  skillEffectiveCooldownMs,
} from "@game/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ItemTooltipDrawer } from "./ItemTooltipDrawer";
import { cancelTargeting, startTargeting, useActiveTargetingSource } from "./targeting";

type Vec3 = { x: number; y: number; z: number };

type AbilityCdKey = `ability:${AbilityId}` | `skill:${SkillSlot}`;
type AbilityCd = Partial<Record<AbilityCdKey, number>>;

type SlotSpec = {
  key: WeaponSlotKey | SkillSlot;
  label: string;
  hotkey: string;
  ability: AbilityDef | undefined;
  ultimate: boolean;
  cdKey: AbilityCdKey;
  cooldownMs: number;
};

const HOTBAR_SLOTS: readonly (WeaponSlotKey | SkillSlot)[] = ["W1", "W2", "S1", "S2", "U"];

/** Combined abilities + inventory bar — the "main UI section" at the bottom. */
export function ActionBar({
  player,
  enabled,
  onUseAbility,
  onUseAbilityAt,
  onUse,
  onEquip,
  onEquipSlot,
  onDrop,
}: {
  player: PlayerSnapshot | undefined;
  enabled: boolean;
  onUseAbility: (slot: WeaponSlotKey | SkillSlot) => void;
  onUseAbilityAt?: (slot: WeaponSlotKey | SkillSlot, target: Vec3) => void;
  onUse: (itemId: string) => void;
  onEquip: (itemId: string) => void;
  onEquipSlot: (slot: EquipSlot, itemId: string) => void;
  onDrop: (itemId: string, qty: number) => void;
}) {
  const [, force] = useState(0);
  const abilityCdRef = useRef<AbilityCd>({});
  const manaRef = useRef(player?.mana ?? 0);
  manaRef.current = Math.floor(player?.mana ?? 0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const activeTargetingSource = useActiveTargetingSource();

  const weaponId = player?.equipment?.weapon ?? "";
  const skillsEquipped = player?.skillsEquipped ?? ["", ""];
  const ultimateSkill = player?.ultimateSkill ?? "";

  const slots = useMemo<SlotSpec[]>(() => {
    const lookup = (id: string) => {
      const def = getItem(id);
      if (!def || def.kind !== "weapon") return undefined;
      return {
        primaryAbilityId: def.primaryAbilityId,
        secondaryAbilityId: def.secondaryAbilityId,
      };
    };
    const w1Id = resolveWeaponAbilityId(weaponId || undefined, "W1", lookup);
    const w2Id = resolveWeaponAbilityId(weaponId || undefined, "W2", lookup);
    const w1 = getAbility(w1Id) ?? getAbility(UNARMED_PRIMARY);
    const w2 = getAbility(w2Id) ?? getAbility(UNARMED_SECONDARY);
    const s1Id = skillsEquipped[0] ?? "";
    const s2Id = skillsEquipped[1] ?? "";
    const s1Ability = isSkillId(s1Id) ? resolveSkillAbility(s1Id) : undefined;
    const s2Ability = isSkillId(s2Id) ? resolveSkillAbility(s2Id) : undefined;
    const uAbility = isSkillId(ultimateSkill) ? resolveSkillAbility(ultimateSkill) : undefined;
    const uCooldown = uAbility ? skillEffectiveCooldownMs(ultimateSkill, uAbility.cooldownMs) : 0;
    return [
      {
        key: "W1",
        label: w1?.name ?? "W1",
        hotkey: "1",
        ability: w1,
        ultimate: false,
        cdKey: `ability:${w1?.id ?? UNARMED_PRIMARY}` as AbilityCdKey,
        cooldownMs: w1?.cooldownMs ?? 0,
      },
      {
        key: "W2",
        label: w2?.name ?? "W2",
        hotkey: "2",
        ability: w2,
        ultimate: false,
        cdKey: `ability:${w2?.id ?? UNARMED_SECONDARY}` as AbilityCdKey,
        cooldownMs: w2?.cooldownMs ?? 0,
      },
      {
        key: "S1",
        label: s1Ability?.name ?? "S1",
        hotkey: "3",
        ability: s1Ability,
        ultimate: false,
        cdKey: "skill:S1",
        cooldownMs: s1Ability?.cooldownMs ?? 0,
      },
      {
        key: "S2",
        label: s2Ability?.name ?? "S2",
        hotkey: "4",
        ability: s2Ability,
        ultimate: false,
        cdKey: "skill:S2",
        cooldownMs: s2Ability?.cooldownMs ?? 0,
      },
      {
        key: "U",
        label: uAbility?.name ?? "Ultimate",
        hotkey: "R",
        ability: uAbility,
        ultimate: true,
        cdKey: "skill:U",
        cooldownMs: uCooldown,
      },
    ];
  }, [weaponId, skillsEquipped, ultimateSkill]);

  const useAbility = useCallback(
    (slotKey: WeaponSlotKey | SkillSlot) => {
      if (!enabledRef.current) return;
      const spec = slots.find((s) => s.key === slotKey);
      if (!spec) return;
      const def = spec.ability;
      if (!def) return;
      const now = Date.now();
      const ready = abilityCdRef.current[spec.cdKey] ?? 0;
      if (now < ready) return;
      if (manaRef.current < def.manaCost) return;
      // Ranged / aoe / movement abilities go through the targeter for precision;
      // melee single-target abilities just fire on the nearest hostile.
      if (def.kind === "aoe" || def.kind === "movement" || def.kind === "ranged") {
        if (activeTargetingSource === `ability:${slotKey}`) {
          cancelTargeting();
          return;
        }
        startTargeting({
          source: `ability:${slotKey}`,
          shape: "circle",
          rangeMax: def.range,
          color: def.color,
          outOfRangeColor: "#ef4444",
          onConfirm: (pos) => {
            abilityCdRef.current = {
              ...abilityCdRef.current,
              [spec.cdKey]: Date.now() + spec.cooldownMs,
            };
            force((v) => v + 1);
            if (onUseAbilityAt) onUseAbilityAt(slotKey, pos);
            else onUseAbility(slotKey);
          },
          onCancel: () => {
            force((v) => v + 1);
          },
        });
        force((v) => v + 1);
        return;
      }
      abilityCdRef.current = { ...abilityCdRef.current, [spec.cdKey]: now + spec.cooldownMs };
      force((v) => v + 1);
      onUseAbility(slotKey);
    },
    [activeTargetingSource, onUseAbility, onUseAbilityAt, slots],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const key = e.key;
      // Hotbar layout: 1=W1, 2=W2, 3=S1, 4=S2, R=U
      if (key === "1") {
        e.preventDefault();
        useAbility("W1");
      } else if (key === "2") {
        e.preventDefault();
        useAbility("W2");
      } else if (key === "3") {
        e.preventDefault();
        useAbility("S1");
      } else if (key === "4") {
        e.preventDefault();
        useAbility("S2");
      } else if (key === "r" || key === "R") {
        e.preventDefault();
        useAbility("U");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [useAbility]);

  useEffect(() => {
    const id = setInterval(() => force((v) => v + 1), 100);
    return () => clearInterval(id);
  }, []);

  const mana = Math.floor(player?.mana ?? 0);

  const [drawerSlot, setDrawerSlot] = useState<number | null>(null);
  const drawerEntry =
    drawerSlot !== null && player?.inventory[drawerSlot] ? player.inventory[drawerSlot] : undefined;
  const drawerItemId =
    drawerEntry && isItemId(drawerEntry.itemId) ? (drawerEntry.itemId as ItemId) : undefined;

  const openDrawer = useCallback((slotIdx: number) => setDrawerSlot(slotIdx), []);
  const closeDrawer = useCallback(() => setDrawerSlot(null), []);

  const equippedItemIds = useMemo(() => {
    const out = new Set<string>();
    if (player?.equippedItemId) out.add(player.equippedItemId);
    if (player?.equipment) {
      for (const id of Object.values(player.equipment)) {
        if (id) out.add(id);
      }
    }
    return out;
  }, [player?.equippedItemId, player?.equipment]);

  return (
    <div className="pointer-events-auto absolute bottom-2 left-1/2 z-10 flex max-w-[96vw] -translate-x-1/2 flex-wrap items-end justify-center gap-2 sm:bottom-4 sm:flex-nowrap sm:gap-3">
      <div className="flex gap-1.5 rounded-xl border border-border/40 bg-background/70 px-2 py-2 shadow-md backdrop-blur-md">
        {HOTBAR_SLOTS.map((slotKey) => {
          const spec = slots.find((s) => s.key === slotKey);
          if (!spec) return null;
          const def = spec.ability;
          const bound = Boolean(def);
          const ready = abilityCdRef.current[spec.cdKey] ?? 0;
          const now = Date.now();
          const cd = Math.max(0, ready - now);
          const cdFrac = cd > 0 && spec.cooldownMs > 0 ? cd / spec.cooldownMs : 0;
          const canAfford = !def || def.manaCost === 0 || mana >= def.manaCost;
          const aimingThis = activeTargetingSource === `ability:${slotKey}`;
          const disabled = !enabled || !bound || cd > 0 || !canAfford;
          const color = def?.color ?? "#4b5563";
          const slotLabel = getSlotLabel(slotKey, spec.ultimate);
          return (
            <button
              key={slotKey}
              type="button"
              onClick={() => useAbility(slotKey)}
              disabled={disabled && !aimingThis}
              aria-label={
                bound
                  ? `${def?.name} (key ${spec.hotkey}) — ${slotLabel}`
                  : `${slotLabel} — empty. Bind in Skills tab.`
              }
              title={
                bound
                  ? `${def?.name} — ${def?.description}${
                      def?.manaCost && def.manaCost > 0 ? ` (${def.manaCost} mana)` : ""
                    }${spec.ultimate ? ` — ultimate (×${ULTIMATE_COOLDOWN_MULTIPLIER} cooldown)` : ""}${aimingThis ? " — click again to cancel" : ""}`
                  : `${slotLabel} — bind a skill to this slot in the Skills tab.`
              }
              className={cn(
                "group relative h-12 w-12 overflow-hidden rounded-lg border-2 bg-background/80 shadow-md backdrop-blur-md transition-transform sm:h-14 sm:w-14",
                spec.ultimate && "h-14 w-14 sm:h-16 sm:w-16",
                disabled && !aimingThis ? "opacity-70" : "hover:scale-105",
                aimingThis && "ring-2 ring-offset-1 ring-offset-background",
                !bound && "border-dashed",
              )}
              style={{
                borderColor: color,
                ...(aimingThis ? { boxShadow: `0 0 0 2px ${color}` } : {}),
              }}
              data-slot={slotKey}
              data-ability={def?.id ?? ""}
            >
              <span
                className="-translate-x-1/2 absolute top-1 left-1/2 font-bold text-[10px] tabular-nums sm:text-[11px]"
                style={{ color }}
              >
                {bound ? def?.name : slotLabel}
              </span>
              <span className="absolute right-1 bottom-1 rounded bg-background/60 px-1 font-mono text-[10px] text-muted-foreground">
                {spec.hotkey}
              </span>
              {bound && def && def.manaCost > 0 ? (
                <span className="-translate-x-1/2 absolute bottom-1 left-1/2 text-[10px] text-sky-400 tabular-nums">
                  {def.manaCost}
                </span>
              ) : null}
              {cd > 0 && spec.ultimate ? (
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `conic-gradient(${color} ${360 * (1 - cdFrac)}deg, rgba(0,0,0,0.65) 0)`,
                    mask: "radial-gradient(circle, transparent 40%, black 42%)",
                    WebkitMask: "radial-gradient(circle, transparent 40%, black 42%)",
                  }}
                />
              ) : cd > 0 ? (
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
                className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border/30 bg-muted/10 sm:h-14 sm:w-14"
                aria-label="Empty slot"
              />
            );
          }
          const isEquipped = equippedItemIds.has(slot.itemId);
          return (
            <ItemSlot
              key={`slot-${i}-${slot.itemId}`}
              slotIdx={i}
              itemId={slot.itemId as ItemId}
              qty={slot.qty}
              equipped={isEquipped}
              onUse={() => onUse(slot.itemId)}
              onEquip={() => {
                const def = getItem(slot.itemId);
                if (def?.slot) onEquipSlot(def.slot, slot.itemId);
                else onEquip(slot.itemId);
              }}
              onDrop={() => onDrop(slot.itemId, 1)}
              onLongPress={() => openDrawer(i)}
            />
          );
        })}
      </div>
      <ItemTooltipDrawer
        itemId={drawerItemId}
        qty={drawerEntry?.qty ?? 0}
        equipped={drawerEntry ? equippedItemIds.has(drawerEntry.itemId) : false}
        open={drawerSlot !== null && drawerItemId !== undefined}
        onOpenChange={(o) => {
          if (!o) closeDrawer();
        }}
        onUse={() => drawerEntry && onUse(drawerEntry.itemId)}
        onEquip={() => {
          if (!drawerEntry) return;
          const def = getItem(drawerEntry.itemId);
          if (def?.slot) onEquipSlot(def.slot, drawerEntry.itemId);
          else onEquip(drawerEntry.itemId);
        }}
        onDrop={() => drawerEntry && onDrop(drawerEntry.itemId, 1)}
      />
    </div>
  );
}

function getSlotLabel(slot: WeaponSlotKey | SkillSlot, ultimate: boolean): string {
  if (slot === "U" || ultimate) return "Ultimate";
  if (slot === "S1") return "Skill 1";
  if (slot === "S2") return "Skill 2";
  if (slot === "W1") return "Primary";
  return "Secondary";
}

function itemColor(item: ReturnType<typeof getItem>): string {
  if (!item) return "#71717a";
  if (item.rarity === "legendary") return "#fbbf24";
  if (item.rarity === "rare") return "#60a5fa";
  return "#a1a1aa";
}

const DOUBLE_TAP_WINDOW_MS = 300;

function ItemSlot({
  slotIdx,
  itemId,
  qty,
  equipped,
  onUse,
  onEquip,
  onDrop,
  onLongPress,
}: {
  slotIdx: number;
  itemId: ItemId;
  qty: number;
  equipped: boolean;
  onUse: () => void;
  onEquip: () => void;
  onDrop: () => void;
  onLongPress: () => void;
}) {
  const def = getItem(itemId);
  const canUse = def?.kind === "consumable";
  const canEquip = Boolean(def?.slot);
  const primary = canUse ? onUse : canEquip ? onEquip : undefined;
  const color = itemColor(def);
  const bonuses: string[] = [];
  if (def?.damageBonus) bonuses.push(`+${def.damageBonus} dmg`);
  if (def?.strBonus) bonuses.push(`+${def.strBonus} STR`);
  if (def?.dexBonus) bonuses.push(`+${def.dexBonus} DEX`);
  if (def?.vitBonus) bonuses.push(`+${def.vitBonus} VIT`);
  if (def?.intBonus) bonuses.push(`+${def.intBonus} INT`);
  if (def?.healAmount) bonuses.push(`+${def.healAmount} HP`);
  if (def?.manaAmount) bonuses.push(`+${def.manaAmount} mana`);
  const actionLabel = canUse
    ? "Double-tap to use · long-press for details"
    : canEquip
      ? "Double-tap to equip · long-press for details"
      : "Long-press for details";
  const tooltip = `${def?.name ?? itemId}${bonuses.length ? ` · ${bonuses.join(", ")}` : ""} — ${actionLabel}`;

  const lastTapRef = useRef(0);
  const longPressFiredRef = useRef(false);

  const long = useLongPress({
    onLongPress: () => {
      longPressFiredRef.current = true;
      onLongPress();
    },
    durationMs: 500,
  });

  const handleTap = useCallback(() => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (!primary) return;
    const now = Date.now();
    if (now - lastTapRef.current <= DOUBLE_TAP_WINDOW_MS) {
      lastTapRef.current = 0;
      primary();
    } else {
      lastTapRef.current = now;
    }
  }, [primary]);

  return (
    <div className="group relative h-12 w-12 sm:h-14 sm:w-14" title={tooltip} data-slot={slotIdx}>
      <button
        type="button"
        onClick={handleTap}
        onPointerDown={long.onPointerDown}
        onPointerMove={long.onPointerMove}
        onPointerUp={long.onPointerUp}
        onPointerLeave={long.onPointerLeave}
        onPointerCancel={long.onPointerCancel}
        onContextMenu={(e) => {
          e.preventDefault();
          long.cancel();
          onLongPress();
        }}
        aria-label={`${def?.name ?? itemId}: ${actionLabel}`}
        className={cn(
          "flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg border-2 bg-muted/20 px-0.5 py-1 transition-transform sm:h-14 sm:w-14",
          equipped && "ring-2 ring-amber-400",
          primary ? "hover:scale-105" : "cursor-default",
        )}
        style={{ borderColor: color }}
      >
        <div className="size-5 rounded sm:size-6" style={{ background: color }} />
        <div className="font-medium text-[9px] leading-tight" style={{ maxWidth: 48 }}>
          {def?.name?.slice(0, 8) ?? itemId.slice(0, 8)}
        </div>
      </button>
      <span className="pointer-events-none absolute right-0.5 bottom-0.5 rounded bg-background/80 px-1 text-[10px] text-muted-foreground tabular-nums">
        ×{qty}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDrop();
        }}
        aria-label="Drop item"
        className="absolute top-0.5 right-0.5 size-3.5 rounded-full bg-background/70 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
