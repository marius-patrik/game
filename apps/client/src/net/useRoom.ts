import {
  CHAT_MAX_HISTORY,
  type ChatChannel,
  type ChatEntry,
  type ChatError,
  DEFAULT_ZONE,
  type GameRoomState,
  type InventorySlot,
  type Mob,
  type Player,
  type WorldDrop,
  type ZoneId,
} from "@game/shared";
import { type Room, getStateCallbacks } from "colyseus.js";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { joinZone } from "./room";

export type SlotSnapshot = { itemId: string; qty: number };

export type PlayerSnapshot = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  level: number;
  xp: number;
  xpToNext: number;
  equippedItemId: string;
  inventory: SlotSnapshot[];
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

export type AttackEvent = { attackerId: string; targetId: string; killed: boolean };
export type RespawnEvent = { x: number; y: number; z: number; at: number };
export type PickupEvent = { itemId: string; qty: number; at: number };
export type UsedEvent = { itemId: string; hp: number; at: number };
export type MobKilledEvent = {
  mobId: string;
  pos: { x: number; y: number; z: number };
  at: number;
};

export type RoomState = {
  status: "idle" | "connecting" | "connected" | "error";
  error?: string;
  sessionId?: string;
  zoneId: ZoneId;
  players: Map<string, PlayerSnapshot>;
  drops: Map<string, DropSnapshot>;
  mobs: Map<string, MobSnapshot>;
  chat: ChatEntry[];
  lastAttack?: AttackEvent;
  lastRespawn?: RespawnEvent;
  lastPickup?: PickupEvent;
  lastUsed?: UsedEvent;
  lastMobKilled?: MobKilledEvent;
  send: {
    (type: "move", payload: { x: number; y: number; z: number }): void;
    (type: "attack"): void;
    (type: "pickup", payload: { dropId: string }): void;
    (type: "use", payload: { itemId: string }): void;
    (type: "equip", payload: { itemId: string }): void;
    (type: "drop", payload: { itemId: string; qty: number }): void;
    (type: "chat", payload: { channel: ChatChannel; text: string }): void;
  };
  travel: (zoneId: ZoneId) => void;
};

function snapPlayer(p: Player, key: string): PlayerSnapshot {
  const inv: SlotSnapshot[] = [];
  for (const s of p.inventory as Iterable<InventorySlot>) {
    inv.push({ itemId: s.itemId, qty: s.qty });
  }
  return {
    id: key,
    name: p.name,
    x: p.x,
    y: p.y,
    z: p.z,
    hp: p.hp,
    maxHp: p.maxHp,
    alive: p.alive,
    level: p.level,
    xp: p.xp,
    xpToNext: p.xpToNext,
    equippedItemId: p.equippedItemId,
    inventory: inv,
  };
}

function snapDrop(d: WorldDrop, key: string): DropSnapshot {
  return { id: key, itemId: d.itemId, qty: d.qty, x: d.x, y: d.y, z: d.z };
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
  }
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

export function useRoom(): RoomState {
  const [zoneId, setZoneId] = useState<ZoneId>(DEFAULT_ZONE);
  const [state, setState] = useState<RoomState>(() => ({
    status: "idle",
    players: new Map(),
    drops: new Map(),
    mobs: new Map(),
    chat: [],
    zoneId: DEFAULT_ZONE,
    send: (() => {}) as RoomState["send"],
    travel: () => {},
  }));
  const roomRef = useRef<Room<GameRoomState> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let room: Room<GameRoomState> | undefined;

    setState((s) => ({ ...s, status: "connecting", zoneId }));

    const travel = (next: ZoneId) => {
      if (next === zoneId) return;
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
        const chat: ChatEntry[] = [];
        let lastAttack: AttackEvent | undefined;
        let lastRespawn: RespawnEvent | undefined;
        let lastPickup: PickupEvent | undefined;
        let lastUsed: UsedEvent | undefined;
        let lastMobKilled: MobKilledEvent | undefined;

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
            chat: [...chat],
            lastAttack,
            lastRespawn,
            lastPickup,
            lastUsed,
            lastMobKilled,
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

        room.onMessage("attack", (msg: AttackEvent) => {
          lastAttack = msg;
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
          commit();
        });
        room.onMessage("pickup", (msg: { itemId: string; qty: number }) => {
          lastPickup = { itemId: msg.itemId, qty: msg.qty, at: Date.now() };
          commit();
        });
        room.onMessage("used", (msg: { itemId: string; hp: number }) => {
          lastUsed = { itemId: msg.itemId, hp: msg.hp, at: Date.now() };
          commit();
        });
        room.onMessage("chat", (entry: ChatEntry) => {
          chat.push(entry);
          while (chat.length > CHAT_MAX_HISTORY) chat.shift();
          commit();
        });
        room.onMessage("chat-error", (msg: ChatError) => {
          toast.error(chatErrorMessage(msg.reason));
        });
        room.onMessage("zone-exit", (msg: { to: ZoneId }) => {
          travel(msg.to);
        });

        room.onLeave(() => {
          if (cancelled) return;
          setState((s) => ({
            ...s,
            status: "idle",
            players: new Map(),
            drops: new Map(),
            mobs: new Map(),
            chat: [],
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
            chat: [],
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
    if (prev === "connected" && (state.status === "idle" || state.status === "error")) {
      toast.error("Disconnected", {
        description: state.error ?? "Lost connection to the zone.",
      });
    } else if (prev === "error" && state.status === "connected") {
      toast.success("Reconnected");
    } else if (prev === "idle" && state.status === "connected") {
      toast.success(`Joined ${state.zoneId}`);
    }
  }, [state.status, state.error, state.zoneId]);

  return state;
}
