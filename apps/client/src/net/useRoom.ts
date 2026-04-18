import { notify } from "@/components/ui/unified-toast";
import { useCharacterStore } from "@/state/characterStore";
import {
  type AbilityId,
  CHAT_MAX_HISTORY,
  type ChatChannel,
  type ChatEntry,
  type ChatError,
  DEFAULT_ZONE,
  type DeathCause,
  type DiedMessage,
  type EquipSlot,
  type GameRoomState,
  type HazardZone,
  type InventorySlot,
  type Mob,
  type Npc,
  type Player,
  QUEST_CATALOG,
  type QuestProgress,
  type SkillSlot,
  type StatKey,
  type WeaponSlotKey,
  type WorldDrop,
  type ZoneId,
} from "@game/shared";
import { type Room, getStateCallbacks } from "colyseus.js";
import { useEffect, useRef, useState } from "react";
import { joinZone } from "./room";

export type SlotSnapshot = { itemId: string; qty: number };
export type QuestSnapshot = { id: string; status: string; progress: number; goal: number };

export type PlayerSnapshot = {
  id: string;
  name: string;
  customizationColor: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  alive: boolean;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  strength: number;
  dexterity: number;
  vitality: number;
  intellect: number;
  baseStrength: number;
  baseDexterity: number;
  baseVitality: number;
  baseIntellect: number;
  statPoints: number;
  skillPoints: number;
  equippedItemId: string;
  partyId: string;
  equipment: Record<string, string>;
  skillsEquipped: [string, string];
  ultimateSkill: string;
  inventory: SlotSnapshot[];
  quests: QuestSnapshot[];
  dailyQuests: QuestSnapshot[];
};

export type DropSnapshot = {
  id: string;
  itemId: string;
  qty: number;
  x: number;
  y: number;
  z: number;
};

export type MobSnapshot = {
  id: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  alive: boolean;
};

export type NpcSnapshot = {
  id: string;
  kind: string;
  name: string;
  x: number;
  y: number;
  z: number;
};

export type HazardSnapshot = {
  id: string;
  x: number;
  z: number;
  radius: number;
  dps: number;
};

export type AttackEvent = {
  attackerId: string;
  targetId: string;
  killed: boolean;
  dmg?: number;
  crit?: boolean;
};
export type RespawnEvent = { x: number; y: number; z: number; at: number };
export type DiedEvent = { cause: DeathCause; at: number };
export type PickupEvent = { itemId: string; qty: number; at: number };
export type UsedEvent = { itemId: string; hp: number; mana?: number; at: number };
export type MobKilledEvent = {
  mobId: string;
  pos: { x: number; y: number; z: number };
  at: number;
};
export type AbilityCastEvent = {
  casterId: string;
  abilityId: AbilityId;
  targetId?: string;
  pos: { x: number; y: number; z: number };
  hits: number;
  killed?: boolean;
  dmg?: number;
  crit?: boolean;
  at: number;
};
export type BossTelegraphEvent = {
  mobId: string;
  pos: { x: number; y: number; z: number };
  radius: number;
  durationMs: number;
  at: number;
};

export type CasterBoltSnapshot = {
  id: string;
  mobId: string;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  targetId: string;
  durationMs: number;
  spawnAt: number;
  state: "flying" | "hit" | "miss";
  damage: number;
};

export type RoomState = {
  status: "idle" | "connecting" | "connected" | "error";
  error?: string;
  sessionId?: string;
  zoneId: ZoneId;
  players: Map<string, PlayerSnapshot>;
  drops: Map<string, DropSnapshot>;
  mobs: Map<string, MobSnapshot>;
  npcs: Map<string, NpcSnapshot>;
  hazards: Map<string, HazardSnapshot>;
  chat: ChatEntry[];
  lastAttack?: AttackEvent;
  lastRespawn?: RespawnEvent;
  lastPickup?: PickupEvent;
  lastUsed?: UsedEvent;
  lastMobKilled?: MobKilledEvent;
  lastAbility?: AbilityCastEvent;
  lastTelegraph?: BossTelegraphEvent;
  lastDied?: DiedEvent;
  bolts: Map<string, CasterBoltSnapshot>;
  send: {
    (type: "move", payload: { x: number; y: number; z: number }): void;
    (type: "attack"): void;
    (type: "pickup", payload: { dropId: string }): void;
    (type: "use", payload: { itemId: string }): void;
    (type: "equip", payload: { itemId: string }): void;
    (type: "drop", payload: { itemId: string; qty: number }): void;
    (type: "chat", payload: { channel: ChatChannel; text: string }): void;
    (type: "allocateStat", payload: { stat: StatKey }): void;
    (
      type: "use-ability",
      payload: { slot: WeaponSlotKey | SkillSlot; target?: { x: number; z: number } },
    ): void;
    (type: "allocate-skill", payload: { skillId: string; slot: SkillSlot }): void;
    (type: "unbind-skill", payload: { slot: SkillSlot }): void;
    (type: "equipSlot", payload: { slot: EquipSlot; itemId: string }): void;
    (type: "unequipSlot", payload: { slot: EquipSlot }): void;
    (type: "buy", payload: { itemId: string; qty?: number }): void;
    (type: "sell", payload: { itemId: string; qty?: number }): void;
    (type: "turnInQuest", payload: { questId: string }): void;
  };
  travel: (zoneId: ZoneId) => void;
};

function snapPlayer(p: Player, key: string): PlayerSnapshot {
  const inv: SlotSnapshot[] = [];
  for (const s of p.inventory as Iterable<InventorySlot>) {
    inv.push({ itemId: s.itemId, qty: s.qty });
  }
  const equipment: Record<string, string> = {};
  p.equipment.forEach((itemId, slot) => {
    equipment[slot] = itemId;
  });
  const quests: QuestSnapshot[] = [];
  p.quests.forEach((q: QuestProgress, id: string) => {
    quests.push({ id, status: q.status, progress: q.progress, goal: q.goal });
  });
  const dailyQuests: QuestSnapshot[] = [];
  p.dailyQuests.forEach((q: QuestProgress, id: string) => {
    dailyQuests.push({ id, status: q.status, progress: q.progress, goal: q.goal });
  });
  const skillsArray = p.skillsEquipped as Iterable<string>;
  const skillsEquipped: [string, string] = ["", ""];
  let i = 0;
  for (const s of skillsArray) {
    if (i < 2) skillsEquipped[i] = typeof s === "string" ? s : "";
    i += 1;
  }
  return {
    id: key,
    name: p.name,
    customizationColor: p.customizationColor,
    x: p.x,
    y: p.y,
    z: p.z,
    hp: p.hp,
    maxHp: p.maxHp,
    mana: p.mana,
    maxMana: p.maxMana,
    alive: p.alive,
    level: p.level,
    xp: p.xp,
    xpToNext: p.xpToNext,
    gold: p.gold,
    strength: p.strength,
    dexterity: p.dexterity,
    vitality: p.vitality,
    intellect: p.intellect,
    baseStrength: p.baseStrength,
    baseDexterity: p.baseDexterity,
    baseVitality: p.baseVitality,
    baseIntellect: p.baseIntellect,
    statPoints: p.statPoints,
    skillPoints: p.skillPoints,
    equippedItemId: p.equippedItemId,
    partyId: p.partyId,
    equipment,
    skillsEquipped,
    ultimateSkill: p.ultimateSkill,
    inventory: inv,
    quests,
    dailyQuests,
  };
}

function snapDrop(d: WorldDrop, key: string): DropSnapshot {
  return { id: key, itemId: d.itemId, qty: d.qty, x: d.x, y: d.y, z: d.z };
}

function snapMob(m: Mob, key: string): MobSnapshot {
  return {
    id: key,
    kind: m.kind,
    x: m.x,
    y: m.y,
    z: m.z,
    hp: m.hp,
    maxHp: m.maxHp,
    alive: m.alive,
  };
}

function snapNpc(n: Npc, key: string): NpcSnapshot {
  return { id: key, kind: n.kind, name: n.name, x: n.x, y: n.y, z: n.z };
}

function snapHazard(h: HazardZone, key: string): HazardSnapshot {
  return { id: key, x: h.x, z: h.z, radius: h.radius, dps: h.dps };
}

function chatErrorMessage(reason: ChatError["reason"]): string {
  switch (reason) {
    case "rate_limit":
      return "Chat: slow down";
    case "too_long":
      return "Chat: message too long";
    case "empty":
      return "Chat: message empty";
    case "invalid_channel":
      return "Chat: invalid channel";
    case "muted":
      return "Chat: you are muted";
    case "blocked":
      return "Chat: blocked";
    case "not_found":
      return "Chat: player not found";
    case "party_full":
      return "Party: full (max 4)";
    case "party_other_party":
      return "Party: that player is already in another party";
  }
}

export function useRoom(): RoomState {
  const selectedCharacterId = useCharacterStore((s) => s.selectedCharacterId);
  const [zoneId, setZoneId] = useState<ZoneId>(DEFAULT_ZONE);
  const [state, setState] = useState<RoomState>(() => ({
    status: "idle",
    players: new Map(),
    drops: new Map(),
    mobs: new Map(),
    npcs: new Map(),
    hazards: new Map(),
    chat: [],
    bolts: new Map(),
    zoneId: DEFAULT_ZONE,
    send: (() => {}) as RoomState["send"],
    travel: () => {},
  }));
  const roomRef = useRef<Room<GameRoomState> | undefined>(undefined);
  const zoneSwitchingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let room: Room<GameRoomState> | undefined;

    setState((s) => ({ ...s, status: "connecting", zoneId }));

    const travel = (next: ZoneId) => {
      if (next === zoneId) return;
      zoneSwitchingRef.current = true;
      console.info("[game] zone travel requested", { from: zoneId, to: next });
      setZoneId(next);
    };

    (async () => {
      try {
        console.info("[game] joining zone", { zoneId, characterId: selectedCharacterId });
        room = await joinZone(zoneId, selectedCharacterId ?? undefined);
        roomRef.current = room;
        if (cancelled) {
          room.leave();
          return;
        }

        const players = new Map<string, PlayerSnapshot>();
        const drops = new Map<string, DropSnapshot>();
        const mobs = new Map<string, MobSnapshot>();
        const npcs = new Map<string, NpcSnapshot>();
        const hazards = new Map<string, HazardSnapshot>();
        const chat: ChatEntry[] = [];
        const bolts = new Map<string, CasterBoltSnapshot>();
        let lastAttack: AttackEvent | undefined;
        let lastRespawn: RespawnEvent | undefined;
        let lastPickup: PickupEvent | undefined;
        let lastUsed: UsedEvent | undefined;
        let lastMobKilled: MobKilledEvent | undefined;
        let lastAbility: AbilityCastEvent | undefined;
        let lastTelegraph: BossTelegraphEvent | undefined;
        let lastDied: DiedEvent | undefined;

        const send = ((type: string, payload?: unknown) => {
          if (!room) return;
          if (payload === undefined) room.send(type);
          else room.send(type, payload);
        }) as RoomState["send"];

        const commit = () => {
          setState({
            status: "connected",
            sessionId: room?.sessionId,
            zoneId,
            players: new Map(players),
            drops: new Map(drops),
            mobs: new Map(mobs),
            npcs: new Map(npcs),
            hazards: new Map(hazards),
            chat: [...chat],
            bolts: new Map(bolts),
            lastAttack,
            lastRespawn,
            lastPickup,
            lastUsed,
            lastMobKilled,
            lastAbility,
            lastTelegraph,
            lastDied,
            send,
            travel,
          });
        };

        const $ = getStateCallbacks(room);
        $(room.state).players.onAdd((p: Player, key: string) => {
          players.set(key, snapPlayer(p, key));
          commit();
          $(p).onChange(() => {
            players.set(key, snapPlayer(p, key));
            commit();
          });
        });
        $(room.state).players.onRemove((_p: Player, key: string) => {
          players.delete(key);
          commit();
        });
        $(room.state).drops.onAdd((d: WorldDrop, key: string) => {
          drops.set(key, snapDrop(d, key));
          commit();
          $(d).onChange(() => {
            drops.set(key, snapDrop(d, key));
            commit();
          });
        });
        $(room.state).drops.onRemove((_d: WorldDrop, key: string) => {
          drops.delete(key);
          commit();
        });
        $(room.state).mobs.onAdd((m: Mob, key: string) => {
          mobs.set(key, snapMob(m, key));
          commit();
          $(m).onChange(() => {
            mobs.set(key, snapMob(m, key));
            commit();
          });
        });
        $(room.state).mobs.onRemove((_m: Mob, key: string) => {
          mobs.delete(key);
          commit();
        });
        $(room.state).npcs.onAdd((n: Npc, key: string) => {
          npcs.set(key, snapNpc(n, key));
          commit();
          $(n).onChange(() => {
            npcs.set(key, snapNpc(n, key));
            commit();
          });
        });
        $(room.state).npcs.onRemove((_n: Npc, key: string) => {
          npcs.delete(key);
          commit();
        });
        $(room.state).hazards.onAdd((h: HazardZone, key: string) => {
          hazards.set(key, snapHazard(h, key));
          commit();
          $(h).onChange(() => {
            hazards.set(key, snapHazard(h, key));
            commit();
          });
        });
        $(room.state).hazards.onRemove((_h: HazardZone, key: string) => {
          hazards.delete(key);
          commit();
        });

        room.onMessage("attack", (msg: AttackEvent) => {
          lastAttack = { ...msg, attackerId: msg.attackerId };
          commit();
        });
        room.onMessage(
          "mob-killed",
          (msg: { mobId: string; pos: { x: number; y: number; z: number } }) => {
            lastMobKilled = { mobId: msg.mobId, pos: msg.pos, at: Date.now() };
            commit();
          },
        );
        room.onMessage("respawned", (pos: { x: number; y: number; z: number }) => {
          lastRespawn = { x: pos.x, y: pos.y, z: pos.z, at: Date.now() };
          lastDied = undefined; // clear once we respawn so DeathOverlay cause resets
          commit();
        });
        room.onMessage("died", (msg: DiedMessage) => {
          lastDied = { cause: msg.cause, at: msg.at };
          commit();
        });
        room.onMessage("pickup", (msg: { itemId: string; qty: number }) => {
          lastPickup = { itemId: msg.itemId, qty: msg.qty, at: Date.now() };
          commit();
        });
        let lastPickupErrorAt = 0;
        room.onMessage(
          "pickup-error",
          (msg: {
            reason: "inventory_full" | "unknown_item" | "invalid_qty";
            itemId?: string;
          }) => {
            // Auto-pickup fires on every drop in range, so throttle toasts so
            // a full bag doesn't flood the notification stack.
            const now = Date.now();
            if (now - lastPickupErrorAt < 2000) return;
            lastPickupErrorAt = now;
            if (msg.reason === "inventory_full") notify.error("Inventory full");
            else notify.error(`Pickup failed: ${msg.reason}`);
          },
        );
        room.onMessage("used", (msg: { itemId: string; hp: number; mana?: number }) => {
          lastUsed = { itemId: msg.itemId, hp: msg.hp, mana: msg.mana, at: Date.now() };
          commit();
        });
        room.onMessage("chat", (entry: ChatEntry) => {
          chat.push(entry);
          while (chat.length > CHAT_MAX_HISTORY) chat.shift();
          commit();
        });
        room.onMessage("chat-history", (rows: ChatEntry[]) => {
          // Preload recent persisted messages ahead of live entries.
          chat.unshift(...rows);
          while (chat.length > CHAT_MAX_HISTORY) chat.shift();
          commit();
        });
        room.onMessage("portal-locked", (msg: { to: ZoneId; minLevel: number }) => {
          notify.error(`Portal locked: reach level ${msg.minLevel} to enter ${String(msg.to)}.`);
        });
        room.onMessage(
          "boss-telegraph",
          (msg: {
            mobId: string;
            pos: { x: number; y: number; z: number };
            radius: number;
            durationMs: number;
          }) => {
            lastTelegraph = {
              mobId: msg.mobId,
              pos: msg.pos,
              radius: msg.radius,
              durationMs: msg.durationMs,
              at: Date.now(),
            };
            commit();
          },
        );
        room.onMessage(
          "caster-bolt",
          (msg: {
            id: string;
            mobId: string;
            from: { x: number; y: number; z: number };
            to: { x: number; y: number; z: number };
            targetId: string;
            durationMs: number;
            damage: number;
          }) => {
            bolts.set(msg.id, {
              id: msg.id,
              mobId: msg.mobId,
              from: msg.from,
              to: msg.to,
              targetId: msg.targetId,
              durationMs: msg.durationMs,
              spawnAt: Date.now(),
              state: "flying",
              damage: msg.damage,
            });
            commit();
          },
        );
        const resolveBolt = (id: string, state: "hit" | "miss") => {
          const existing = bolts.get(id);
          if (existing) bolts.set(id, { ...existing, state });
          // Give the animation a beat to finish before dropping the entry.
          setTimeout(() => {
            bolts.delete(id);
            commit();
          }, 200);
          commit();
        };
        room.onMessage("caster-bolt-hit", (msg: { id: string }) => resolveBolt(msg.id, "hit"));
        room.onMessage("caster-bolt-miss", (msg: { id: string }) => resolveBolt(msg.id, "miss"));
        room.onMessage("chat-error", (msg: ChatError) => {
          notify.error(chatErrorMessage(msg.reason));
        });
        room.onMessage("zone-exit", (msg: { to: ZoneId }) => {
          travel(msg.to);
        });
        room.onMessage(
          "skill-error",
          (msg: {
            reason:
              | "unknown_skill"
              | "invalid_slot"
              | "level_gate"
              | "insufficient_points"
              | "already_allocated"
              | "slot_kind_mismatch"
              | "empty_slot";
          }) => {
            notify.error(`Skill: ${msg.reason.replace(/_/g, " ")}`);
          },
        );
        room.onMessage(
          "ability-cast",
          (msg: {
            casterId: string;
            abilityId: AbilityId;
            targetId?: string;
            pos: { x: number; y: number; z: number };
            hits: number;
            killed?: boolean;
            dmg?: number;
            crit?: boolean;
          }) => {
            lastAbility = {
              casterId: msg.casterId,
              abilityId: msg.abilityId,
              targetId: msg.targetId,
              pos: msg.pos,
              hits: msg.hits,
              killed: msg.killed,
              dmg: msg.dmg,
              crit: msg.crit,
              at: Date.now(),
            };
            commit();
          },
        );
        room.onMessage(
          "ability-error",
          (msg: {
            slot?: string;
            abilityId?: AbilityId;
            reason: "cooldown" | "mana" | "dead" | "invalid_slot" | "unknown_ability";
          }) => {
            if (msg.reason === "cooldown") return; // silent — cooldown visualized on button
            notify.error(`Ability failed: ${msg.reason}`);
          },
        );
        room.onMessage(
          "equip-error",
          (msg: {
            slot: string;
            itemId?: string;
            reason: "invalid_slot" | "slot_mismatch" | "unknown_item" | "not_in_inventory";
          }) => {
            notify.error(`Equip failed: ${msg.reason.replace(/_/g, " ")}`);
          },
        );
        room.onMessage("equip-ok", (_msg: { slot: string; itemId: string }) => {
          // Schema update drives the UI; no toast needed on success.
        });
        room.onMessage("vendor-ok", (_msg: unknown) => {
          notify.success("Deal done");
        });
        room.onMessage("vendor-error", (msg: { reason: string }) => {
          notify.error(`Vendor: ${msg.reason}`);
        });
        room.onMessage("quest-complete", (_msg: unknown) => {
          notify.success("Quest turned in!");
        });

        room.onLeave(() => {
          if (cancelled) return;
          console.info("[game] room left", { zoneId, sessionId: room?.sessionId });
          setState((s) => ({
            ...s,
            status: "idle",
            players: new Map(),
            drops: new Map(),
            mobs: new Map(),
            npcs: new Map(),
            hazards: new Map(),
            chat: [],
            bolts: new Map(),
          }));
        });
        room.onError((_code, message) => {
          if (cancelled) return;
          console.warn("[game] room error", { zoneId, message });
          setState((s) => ({
            ...s,
            status: "error",
            error: message,
            players: new Map(),
            drops: new Map(),
            mobs: new Map(),
            npcs: new Map(),
            hazards: new Map(),
            chat: [],
            bolts: new Map(),
          }));
        });

        commit();
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          status: "error",
          error: (err as Error).message,
          players: new Map(),
          drops: new Map(),
          mobs: new Map(),
          npcs: new Map(),
          hazards: new Map(),
        }));
      }
    })();

    return () => {
      cancelled = true;
      room?.leave();
      roomRef.current = undefined;
    };
  }, [zoneId, selectedCharacterId]);

  const prevStatus = useRef<RoomState["status"]>("idle");
  useEffect(() => {
    const prev = prevStatus.current;
    if (prev === state.status) return;
    prevStatus.current = state.status;
    const transitioning = zoneSwitchingRef.current;
    if (prev === "connected" && (state.status === "idle" || state.status === "error")) {
      if (!transitioning) {
        notify.error("Disconnected", {
          description: state.error ?? "Lost connection to the zone.",
        });
      }
    } else if (prev === "error" && state.status === "connected") {
      notify.success("Reconnected");
    } else if (prev === "idle" && state.status === "connected") {
      if (!transitioning) notify.success(`Joined ${state.zoneId}`);
      zoneSwitchingRef.current = false;
    }
  }, [state.status, state.error, state.zoneId]);

  const lastLevelRef = useRef<number | undefined>(undefined);
  const knownQuestStatusRef = useRef<Map<string, string>>(new Map());
  const self = state.sessionId ? state.players.get(state.sessionId) : undefined;
  useEffect(() => {
    if (!self) return;
    if (lastLevelRef.current === undefined) {
      lastLevelRef.current = self.level;
    } else if (self.level > lastLevelRef.current) {
      notify.levelUp({ level: self.level });
      lastLevelRef.current = self.level;
    } else {
      lastLevelRef.current = self.level;
    }
    const known = knownQuestStatusRef.current;
    for (const q of self.quests) {
      const prev = known.get(q.id);
      if (prev !== q.status && q.status === "complete") {
        const def = QUEST_CATALOG[q.id];
        if (def) {
          notify.questReady({ title: def.title, xp: def.xpReward, gold: def.goldReward });
        }
      }
      known.set(q.id, q.status);
    }
  }, [self]);

  return state;
}
