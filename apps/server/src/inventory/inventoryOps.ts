import { type ItemDef, getItem } from "@game/shared/items";

export type Slot = { itemId: string; qty: number };

export type AddResult =
  | { ok: true; slots: Slot[]; added: number }
  | { ok: false; reason: "unknown_item" | "inventory_full" | "invalid_qty"; slots: Slot[] };

export type RemoveResult =
  | { ok: true; slots: Slot[]; removed: number }
  | { ok: false; reason: "not_enough" | "invalid_qty"; slots: Slot[] };

const INVENTORY_CAP = 16;

function cloneSlots(slots: readonly Slot[]): Slot[] {
  return slots.map((s) => ({ itemId: s.itemId, qty: s.qty }));
}

export function addItem(
  slots: readonly Slot[],
  itemId: string,
  qty: number,
  cap: number = INVENTORY_CAP,
): AddResult {
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, reason: "invalid_qty", slots: cloneSlots(slots) };
  }
  const def: ItemDef | undefined = getItem(itemId);
  if (!def) return { ok: false, reason: "unknown_item", slots: cloneSlots(slots) };

  const next = cloneSlots(slots);
  let remaining = Math.floor(qty);
  let added = 0;

  if (def.stackable) {
    for (const slot of next) {
      if (remaining <= 0) break;
      if (slot.itemId !== itemId) continue;
      const room = def.maxStack - slot.qty;
      if (room <= 0) continue;
      const take = Math.min(room, remaining);
      slot.qty += take;
      remaining -= take;
      added += take;
    }
  }

  while (remaining > 0 && next.length < cap) {
    const take = def.stackable ? Math.min(def.maxStack, remaining) : 1;
    next.push({ itemId, qty: take });
    remaining -= take;
    added += take;
  }

  if (added === 0) return { ok: false, reason: "inventory_full", slots: next };
  return { ok: true, slots: next, added };
}

export function removeItem(slots: readonly Slot[], itemId: string, qty: number): RemoveResult {
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, reason: "invalid_qty", slots: cloneSlots(slots) };
  }
  const total = slots.reduce((acc, s) => acc + (s.itemId === itemId ? s.qty : 0), 0);
  if (total < qty) return { ok: false, reason: "not_enough", slots: cloneSlots(slots) };

  const next = cloneSlots(slots);
  let remaining = Math.floor(qty);
  for (let i = next.length - 1; i >= 0 && remaining > 0; i--) {
    const slot = next[i]!;
    if (slot.itemId !== itemId) continue;
    const take = Math.min(slot.qty, remaining);
    slot.qty -= take;
    remaining -= take;
    if (slot.qty === 0) next.splice(i, 1);
  }
  return { ok: true, slots: next, removed: qty };
}

export function countItem(slots: readonly Slot[], itemId: string): number {
  return slots.reduce((acc, s) => acc + (s.itemId === itemId ? s.qty : 0), 0);
}

export function findSlotIndex(slots: readonly Slot[], itemId: string): number {
  return slots.findIndex((s) => s.itemId === itemId && s.qty > 0);
}

export const INVENTORY_SLOT_CAP = INVENTORY_CAP;
