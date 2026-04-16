import { DEFAULT_ZONE, type GameRoomState, type Player, type ZoneId } from "@game/shared";
import { type Room, getStateCallbacks } from "colyseus.js";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { joinZone } from "./room";

export type PlayerSnapshot = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  alive: boolean;
};

export type AttackEvent = { attackerId: string; targetId: string; killed: boolean };
export type RespawnEvent = { x: number; y: number; z: number; at: number };

export type RoomState = {
  status: "idle" | "connecting" | "connected" | "error";
  error?: string;
  sessionId?: string;
  zoneId: ZoneId;
  players: Map<string, PlayerSnapshot>;
  lastAttack?: AttackEvent;
  lastRespawn?: RespawnEvent;
  send: {
    (type: "move", payload: { x: number; y: number; z: number }): void;
    (type: "attack"): void;
  };
  travel: (zoneId: ZoneId) => void;
};

export function useRoom(): RoomState {
  const [zoneId, setZoneId] = useState<ZoneId>(DEFAULT_ZONE);
  const [state, setState] = useState<RoomState>(() => ({
    status: "idle",
    players: new Map(),
    zoneId: DEFAULT_ZONE,
    send: () => {},
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
        let lastAttack: AttackEvent | undefined;
        let lastRespawn: RespawnEvent | undefined;
        const send = ((type: "move" | "attack", payload?: unknown) => {
          if (type === "attack") {
            room?.send("attack");
            return;
          }
          room?.send(type, payload);
        }) as RoomState["send"];

        const snap = (p: Player, key: string): PlayerSnapshot => ({
          id: key,
          name: p.name,
          x: p.x,
          y: p.y,
          z: p.z,
          hp: p.hp,
          maxHp: p.maxHp,
          alive: p.alive,
        });

        const commit = () => {
          setState({
            status: "connected",
            sessionId: room?.sessionId,
            zoneId,
            players: new Map(players),
            lastAttack,
            lastRespawn,
            send,
            travel,
          });
        };

        const $ = getStateCallbacks(room);
        $(room.state).players.onAdd((p: Player, key: string) => {
          players.set(key, snap(p, key));
          commit();
          $(p).onChange(() => {
            players.set(key, snap(p, key));
            commit();
          });
        });
        $(room.state).players.onRemove((_p: Player, key: string) => {
          players.delete(key);
          commit();
        });

        room.onMessage("attack", (msg: AttackEvent) => {
          lastAttack = msg;
          commit();
        });
        room.onMessage("respawned", (pos: { x: number; y: number; z: number }) => {
          lastRespawn = { x: pos.x, y: pos.y, z: pos.z, at: Date.now() };
          commit();
        });

        room.onLeave(() => {
          if (cancelled) return;
          setState((s) => ({ ...s, status: "idle", players: new Map() }));
        });
        room.onError((_code, message) => {
          if (cancelled) return;
          setState((s) => ({ ...s, status: "error", error: message, players: new Map() }));
        });

        commit();
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          status: "error",
          error: (err as Error).message,
          players: new Map(),
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
