import {
  type AbilityDef,
  type AbilityId,
  type EquipSlot,
  getAbility,
  getItem,
  isSkillId,
  resolveSkillAbility,
  resolveWeaponAbilityId,
  type SkillSlot,
  skillEffectiveCooldownMs,
  UNARMED_PRIMARY,
  UNARMED_SECONDARY,
  type WeaponSlotKey,
} from "@game/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { PlayerSnapshot } from "@/net/useRoom";
import { useCharacterStore } from "@/state/characterStore";
import { useHotbarStore, useItemQuickSlotBindings } from "@/state/hotbarStore";
import { formatKeybind, matchesKeybind } from "@/state/keybinds";
import { useKeybindsStore } from "@/state/keybindsStore";
import { HotbarSlot } from "./hotbar/HotbarSlot";
import { PotionSlot } from "./hotbar/PotionSlot";
import {
  abbreviateHotbarLabel,
  canBindItemToHotbar,
  countInventoryItem,
  HOTBAR_ITEM_MIME,
  type ItemQuickSlotKey,
} from "./hotbar/shared";
import { cancelTargeting, startTargeting, useActiveTargetingSource } from "./targeting";

type Vec3 = { x: number; y: number; z: number };

type AbilityCdKey = `ability:${AbilityId}` | `skill:${SkillSlot}`;
type AbilityCd = Partial<Record<AbilityCdKey, number>>;

type AbilitySlotSpec = {
  key: WeaponSlotKey | SkillSlot;
  label: string;
  hotkey: string;
  ability: AbilityDef | undefined;
  ultimate: boolean;
  cdKey: AbilityCdKey;
  cooldownMs: number;
};

const EMPTY_INVENTORY: readonly { itemId: string; qty: number }[] = [];
const EMPTY_SKILLS: readonly [string, string] = ["", ""];
const ITEM_QUICK_SLOTS: readonly ItemQuickSlotKey[] = ["I1", "I2"];

/** Combat + utility hotbar — final 2W + 2S + U + 2I + 2P layout. */
export function ActionBar({
  player,
  enabled,
  onUseAbility,
  onUseAbilityAt,
  onUse,
  onEquipSlot,
}: {
  player: PlayerSnapshot | undefined;
  enabled: boolean;
  onUseAbility: (slot: WeaponSlotKey | SkillSlot) => void;
  onUseAbilityAt?: (slot: WeaponSlotKey | SkillSlot, target: Vec3) => void;
  onUse: (itemId: string) => void;
  onEquipSlot: (slot: EquipSlot, itemId: string) => void;
}) {
  const [, force] = useState(0);
  const abilityCdRef = useRef<AbilityCd>({});
  const manaRef = useRef(player?.mana ?? 0);
  manaRef.current = Math.floor(player?.mana ?? 0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const activeTargetingSource = useActiveTargetingSource();
  const selectedCharacterId = useCharacterStore((state) => state.selectedCharacterId);
  const keybinds = useKeybindsStore((state) => state.keybinds);
  const itemQuickSlots = useItemQuickSlotBindings(selectedCharacterId);
  const setItemQuickSlot = useHotbarStore((state) => state.setItemQuickSlot);
  const [dragOverSlot, setDragOverSlot] = useState<ItemQuickSlotKey | null>(null);

  const weaponId = player?.equipment?.weapon ?? "";
  const skillsEquipped = player?.skillsEquipped ?? EMPTY_SKILLS;
  const ultimateSkill = player?.ultimateSkill ?? "";
  const inventory = player?.inventory ?? EMPTY_INVENTORY;

  const slots = useMemo<AbilitySlotSpec[]>(() => {
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
        hotkey: formatKeybind(keybinds.ability_W1),
        ability: w1,
        ultimate: false,
        cdKey: `ability:${w1?.id ?? UNARMED_PRIMARY}` as AbilityCdKey,
        cooldownMs: w1?.cooldownMs ?? 0,
      },
      {
        key: "W2",
        label: w2?.name ?? "W2",
        hotkey: formatKeybind(keybinds.ability_W2),
        ability: w2,
        ultimate: false,
        cdKey: `ability:${w2?.id ?? UNARMED_SECONDARY}` as AbilityCdKey,
        cooldownMs: w2?.cooldownMs ?? 0,
      },
      {
        key: "S1",
        label: s1Ability?.name ?? "S1",
        hotkey: formatKeybind(keybinds.ability_S1),
        ability: s1Ability,
        ultimate: false,
        cdKey: "skill:S1",
        cooldownMs: s1Ability?.cooldownMs ?? 0,
      },
      {
        key: "S2",
        label: s2Ability?.name ?? "S2",
        hotkey: formatKeybind(keybinds.ability_S2),
        ability: s2Ability,
        ultimate: false,
        cdKey: "skill:S2",
        cooldownMs: s2Ability?.cooldownMs ?? 0,
      },
      {
        key: "U",
        label: uAbility?.name ?? "Ultimate",
        hotkey: formatKeybind(keybinds.ability_U),
        ability: uAbility,
        ultimate: true,
        cdKey: "skill:U",
        cooldownMs: uCooldown,
      },
    ];
  }, [keybinds, weaponId, skillsEquipped, ultimateSkill]);

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

  const itemSlotData = useMemo(
    () =>
      ITEM_QUICK_SLOTS.map((slot) => {
        const boundItemId = itemQuickSlots[slot];
        const boundItem = boundItemId ? getItem(boundItemId) : undefined;
        const count = boundItemId ? countInventoryItem(inventory, boundItemId) : 0;
        const present = Boolean(boundItem && count > 0);
        return {
          slot,
          hotkey: formatKeybind(slot === "I1" ? keybinds.item_I1 : keybinds.item_I2),
          boundItemId,
          item: present ? boundItem : undefined,
          count,
          equipped: boundItemId.length > 0 && equippedItemIds.has(boundItemId),
        };
      }),
    [equippedItemIds, inventory, itemQuickSlots, keybinds],
  );

  const activateItemQuickSlot = useCallback(
    (slot: ItemQuickSlotKey) => {
      if (!enabledRef.current) return;
      const boundItemId = itemQuickSlots[slot];
      if (!boundItemId || countInventoryItem(inventory, boundItemId) <= 0) return;
      const def = getItem(boundItemId);
      if (!def) return;
      if (def.kind === "consumable") {
        onUse(boundItemId);
        return;
      }
      if (def.slot) onEquipSlot(def.slot, boundItemId);
    },
    [inventory, itemQuickSlots, onEquipSlot, onUse],
  );

  const handleQuickSlotDragOver = useCallback(
    (slot: ItemQuickSlotKey, event: React.DragEvent<HTMLButtonElement>) => {
      const itemId = event.dataTransfer.getData(HOTBAR_ITEM_MIME);
      if (!itemId || !canBindItemToHotbar(itemId)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dragOverSlot !== slot) setDragOverSlot(slot);
    },
    [dragOverSlot],
  );

  const handleQuickSlotDrop = useCallback(
    (slot: ItemQuickSlotKey, event: React.DragEvent<HTMLButtonElement>) => {
      const itemId = event.dataTransfer.getData(HOTBAR_ITEM_MIME);
      setDragOverSlot(null);
      if (!selectedCharacterId || !itemId || !canBindItemToHotbar(itemId)) return;
      event.preventDefault();
      setItemQuickSlot(selectedCharacterId, slot, itemId);
    },
    [selectedCharacterId, setItemQuickSlot],
  );

  const mana = Math.floor(player?.mana ?? 0);
  const healPotionCount = countInventoryItem(inventory, "heal_potion");
  const manaPotionCount = countInventoryItem(inventory, "mana_potion");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (matchesKeybind(e.key, keybinds.ability_W1)) {
        e.preventDefault();
        useAbility("W1");
      } else if (matchesKeybind(e.key, keybinds.ability_W2)) {
        e.preventDefault();
        useAbility("W2");
      } else if (matchesKeybind(e.key, keybinds.ability_S1)) {
        e.preventDefault();
        useAbility("S1");
      } else if (matchesKeybind(e.key, keybinds.ability_S2)) {
        e.preventDefault();
        useAbility("S2");
      } else if (matchesKeybind(e.key, keybinds.ability_U)) {
        e.preventDefault();
        useAbility("U");
      } else if (matchesKeybind(e.key, keybinds.item_I1)) {
        e.preventDefault();
        activateItemQuickSlot("I1");
      } else if (matchesKeybind(e.key, keybinds.item_I2)) {
        e.preventDefault();
        activateItemQuickSlot("I2");
      } else if (matchesKeybind(e.key, keybinds.potion_P1) && healPotionCount > 0) {
        e.preventDefault();
        onUse("heal_potion");
      } else if (matchesKeybind(e.key, keybinds.potion_P2) && manaPotionCount > 0) {
        e.preventDefault();
        onUse("mana_potion");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activateItemQuickSlot, healPotionCount, keybinds, manaPotionCount, onUse, useAbility]);

  useEffect(() => {
    const id = setInterval(() => force((v) => v + 1), 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-auto absolute bottom-2 left-1/2 z-10 max-w-[calc(100vw-0.5rem)] -translate-x-1/2 px-1 sm:bottom-4 sm:max-w-[calc(100vw-1rem)] sm:px-2">
      <div
        data-testid="action-bar"
        className="flex items-end gap-0.5 rounded-2xl border border-border/40 bg-background/75 px-1.5 py-1.5 shadow-md backdrop-blur-md sm:gap-1.5 sm:px-3 sm:py-2"
      >
        {slots.slice(0, 2).map((spec) => {
          const def = spec.ability;
          const ready = abilityCdRef.current[spec.cdKey] ?? 0;
          const cd = Math.max(0, ready - Date.now());
          const canAfford = !def || def.manaCost === 0 || mana >= def.manaCost;
          const aimingThis = activeTargetingSource === `ability:${spec.key}`;
          const disabled = !def || (!aimingThis && (!enabled || cd > 0 || !canAfford));

          return (
            <HotbarSlot
              key={spec.key}
              slot={spec.key}
              hotkey={spec.hotkey}
              glyph={abbreviateHotbarLabel(def?.name ?? spec.label)}
              color={def?.color ?? "#71717a"}
              empty={!def}
              disabled={disabled}
              active={aimingThis}
              cooldownRemainingMs={cd}
              cooldownTotalMs={spec.cooldownMs}
              title={`${def?.name ?? spec.label} — ${def?.description ?? "Weapon ability."}`}
              ariaLabel={`${def?.name ?? spec.label} on ${spec.key}, key ${spec.hotkey}`}
              onClick={() => useAbility(spec.key)}
            />
          );
        })}

        <Separator orientation="vertical" className="mx-0 h-7 self-center sm:mx-0.5 sm:h-10" />

        {slots.slice(2, 4).map((spec) => {
          const def = spec.ability;
          const ready = abilityCdRef.current[spec.cdKey] ?? 0;
          const cd = Math.max(0, ready - Date.now());
          const canAfford = !def || def.manaCost === 0 || mana >= def.manaCost;
          const aimingThis = activeTargetingSource === `ability:${spec.key}`;
          const disabled = !def || (!aimingThis && (!enabled || cd > 0 || !canAfford));

          return (
            <HotbarSlot
              key={spec.key}
              slot={spec.key}
              hotkey={spec.hotkey}
              glyph={def ? abbreviateHotbarLabel(def.name) : "SK"}
              color={def?.color ?? "#71717a"}
              empty={!def}
              disabled={disabled}
              active={aimingThis}
              cooldownRemainingMs={cd}
              cooldownTotalMs={spec.cooldownMs}
              title={
                def
                  ? `${def.name} — ${def.description}`
                  : `${getSlotLabel(spec.key, false)} — empty. Bind in the Skills tab.`
              }
              ariaLabel={
                def
                  ? `${def.name} on ${spec.key}, key ${spec.hotkey}`
                  : `${getSlotLabel(spec.key, false)} is empty`
              }
              onClick={() => useAbility(spec.key)}
            />
          );
        })}

        <Separator orientation="vertical" className="mx-0 h-7 self-center sm:mx-0.5 sm:h-10" />

        {slots.slice(4, 5).map((spec) => {
          const def = spec.ability;
          const ready = abilityCdRef.current[spec.cdKey] ?? 0;
          const cd = Math.max(0, ready - Date.now());
          const canAfford = !def || def.manaCost === 0 || mana >= def.manaCost;
          const aimingThis = activeTargetingSource === `ability:${spec.key}`;
          const disabled = !def || (!aimingThis && (!enabled || cd > 0 || !canAfford));

          return (
            <HotbarSlot
              key={spec.key}
              slot={spec.key}
              hotkey={spec.hotkey}
              glyph={def ? abbreviateHotbarLabel(def.name) : "U"}
              color={def?.color ?? "#fbbf24"}
              empty={!def}
              disabled={disabled}
              active={aimingThis}
              distinct
              cooldownRemainingMs={cd}
              cooldownTotalMs={spec.cooldownMs}
              cooldownStyle="ring"
              title={
                def
                  ? `${def.name} — ${def.description}. Ultimate slot.`
                  : "Ultimate slot — empty. Bind an ultimate in the Skills tab."
              }
              ariaLabel={
                def ? `${def.name} ultimate, key ${spec.hotkey}` : "Ultimate slot is empty"
              }
              onClick={() => useAbility(spec.key)}
            />
          );
        })}

        <Separator orientation="vertical" className="mx-0 h-7 self-center sm:mx-0.5 sm:h-10" />

        {itemSlotData.map((slot) => (
          <HotbarSlot
            key={slot.slot}
            slot={slot.slot}
            hotkey={slot.hotkey}
            glyph={slot.item ? abbreviateHotbarLabel(slot.item.name) : "IT"}
            color={
              slot.item?.rarity === "legendary"
                ? "#fbbf24"
                : slot.item?.rarity === "rare"
                  ? "#60a5fa"
                  : "#a1a1aa"
            }
            empty={!slot.item}
            disabled={!enabled || !slot.item}
            className={cn(
              slot.equipped && "ring-1 ring-amber-400/70",
              dragOverSlot === slot.slot &&
                "ring-2 ring-sky-400/70 ring-offset-1 ring-offset-background",
            )}
            count={slot.item ? slot.count : undefined}
            title={
              slot.item
                ? `${slot.item.name} — ${slot.item.kind === "consumable" ? "click to use" : "click to equip"}. Drag a new inventory item here to replace it.`
                : slot.boundItemId
                  ? `${getItem(slot.boundItemId)?.name ?? "Bound item"} is not in your inventory.`
                  : `${slot.slot} — drag a usable inventory item here.`
            }
            ariaLabel={
              slot.item
                ? `${slot.item.name} on ${slot.slot}, key ${slot.hotkey}`
                : `${slot.slot} quick slot`
            }
            onClick={() => activateItemQuickSlot(slot.slot)}
            onDragOver={(event) => handleQuickSlotDragOver(slot.slot, event)}
            onDragLeave={() => {
              if (dragOverSlot === slot.slot) setDragOverSlot(null);
            }}
            onDrop={(event) => handleQuickSlotDrop(slot.slot, event)}
          />
        ))}

        <Separator orientation="vertical" className="mx-0 h-7 self-center sm:mx-0.5 sm:h-10" />

        <PotionSlot
          slot="P1"
          hotkey={formatKeybind(keybinds.potion_P1)}
          qty={healPotionCount}
          enabled={enabled}
          onUse={() => onUse("heal_potion")}
        />
        <PotionSlot
          slot="P2"
          hotkey={formatKeybind(keybinds.potion_P2)}
          qty={manaPotionCount}
          enabled={enabled}
          onUse={() => onUse("mana_potion")}
        />
      </div>
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
