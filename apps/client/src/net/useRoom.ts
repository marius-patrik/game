import {
  CHAT_MAX_HISTORY,
  type ChatChannel,
  type ChatEntry,
  type ChatError,
  DEFAULT_ZONE,
  type DeathCause,
  type DiedMessage,
  type EquipSlot,
  type GameRoomState,
  type InventorySlot,
  type Mob,
  type Npc,
  type Player,
  type QuestProgress,
  type SkillId,
  type StatKey,
  type WorldDrop,
  type ZoneId,
} from "@game/shared";
import { type Room, getStateCallbacks } from "colyseus.js";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { joinZone } from "./room";

export type SlotSnapshot = { itemId: string; qty: number };
export type QuestSnapshot = { id: string; status: string; progress: number; goal: number };

export type PlayerSnapshot = {
  id: string;
  name: string;
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
  statPoints: number;
  equippedItemId: string;
  equipment: Record<string, string>;
  inventory: SlotSnapshot[];
  quests: QuestSnapshot[];
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
export type SkillCastEvent = {
  casterId: string;
  skillId: SkillId;
  pos: { x: number; y: number; z: number };
  hits: number;
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
  chat: ChatEntry[];
  lastAttack?: AttackEvent;
  lastRespawn?: RespawnEvent;
  lastPickup?: PickupEvent;
  lastUsed?: UsedEvent;
  lastMobKilled?: MobKilledEvent;
  lastSkill?: SkillCastEvent;
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
    (type: "cast", payload: { skillId: SkillId }): void;
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
  return {
    id: key,
    name: p.name,
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
    statPoints: p.statPoints,
    equippedItemId: p.equippedItemId,
    equipment,
    inventory: inv,
    quests,
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
  }
}

export function useRoom(): RoomState {
  const [zoneId, setZoneId] = useState<ZoneId>(DEFAULT_ZONE);
  const [state, setState] = useState<RoomState>(() => ({
    status: "idle",
    players: new Map(),
    drops: new Map(),
    mobs: new Map(),
    npcs: new Map(),
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
      setZoneId(next);
    };

    (async () => {
      try {
        room = await joinZone(zoneId);
        roomRef.current = room;
        if (cancelled) {
          room.leave();
          return;
        }

        const players = new Map<string, PlayerSnapshot>();
        const drops = new Map<string, DropSnapshot>();
        const mobs = new Map<string, MobSnapshot>();
        const npcs = new Map<string, NpcSnapshot>();
        const chat: ChatEntry[] = [];
        const bolts = new Map<string, CasterBoltSnapshot>();
        let lastAttack: AttackEvent | undefined;
        let lastRespawn: RespawnEvent | undefined;
        let lastPickup: PickupEvent | undefined;
        let lastUsed: UsedEvent | undefined;
        let lastMobKilled: MobKilledEvent | undefined;
        let lastSkill: SkillCastEvent | undefined;
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
            chat: [...chat],
            bolts: new Map(bolts),
            lastAttack,
            lastRespawn,
            lastPickup,
            lastUsed,
            lastMobKilled,
            lastSkill,
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
            if (msg.reason === "inventory_full") toast.error("Inventory full");
            else toast.error(`Pickup failed: ${msg.reason}`);
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
          toast.error(`Portal locked: reach level ${msg.minLevel} to enter ${String(msg.to)}.`);
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
          toast.error(chatErrorMessage(msg.reason));
        });
        room.onMessage("zone-exit", (msg: { to: ZoneId }) => {
          travel(msg.to);
        });
        room.onMessage(
          "skill-cast",
          (msg: {
            casterId: string;
            skillId: SkillId;
            pos: { x: number; y: number; z: number };
            hits: number;
          }) => {
            lastSkill = {
              casterId: msg.casterId,
              skillId: msg.skillId,
              pos: msg.pos,
              hits: msg.hits,
              at: Date.now(),
            };
            commit();
          },
        );
        room.onMessage("cast-error", (msg: { skillId: SkillId; reason: "cooldown" | "mana" }) => {
          toast.error(`Cast failed: ${msg.reason}`);
        });
        room.onMessage("vendor-ok", (_msg: unknown) => {
          toast.success("Deal done");
        });
        room.onMessage("vendor-error", (msg: { reason: string }) => {
          toast.error(`Vendor: ${msg.reason}`);
        });
        room.onMessage("quest-complete", (_msg: unknown) => {
          toast.success("Quest turned in!");
        });

        room.onLeave(() => {
          if (cancelled) return;
          setState((s) => ({
            ...s,
            status: "idle",
            players: new Map(),
            drops: new Map(),
            mobs: new Map(),
            npcs: new Map(),
            chat: [],
            bolts: new Map(),
          }));
        });
        room.onError((_code, message) => {
          if (cancelled) return;
          setState((s) => ({
            ...s,
            status: "error",
            error: message,
            players: new Map(),
            drops: new Map(),
            mobs: new Map(),
            npcs: new Map(),
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
        }));
      }
    })();

    return () => {
      cancelled = true;
      room?.leave();
      roomRef.current = undefined;
    };
  }, [zoneId]);

  const prevStatus = useRef<RoomState["status"]>("idle");
  useEffect(() => {
    const prev = prevStatus.current;
    if (prev === state.status) return;
    prevStatus.current = state.status;
    const transitioning = zoneSwitchingRef.current;
    if (prev === "connected" && (state.status === "idle" || state.status === "error")) {
      if (!transitioning) {
        toast.error("Disconnected", {
          description: state.error ?? "Lost connection to the zone.",
        });
      }
    } else if (prev === "error" && state.status === "connected") {
      toast.success("Reconnected");
    } else if (prev === "idle" && state.status === "connected") {
      if (!transitioning) toast.success(`Joined ${state.zoneId}`);
      zoneSwitchingRef.current = false;
    }
  }, [state.status, state.error, state.zoneId]);

  return state;
}
