import { DEFAULT_ZONE, type GameRoomState, type Player, type ZoneId } from "@game/shared";
import { type Room, getStateCallbacks } from "colyseus.js";
import { useEffect, useRef, useState } from "react";
import { joinZone } from "./room";

export type PlayerSnapshot = { id: string; name: string; x: number; y: number; z: number };

export type RoomState = {
  status: "idle" | "connecting" | "connected" | "error";
  error?: string;
  sessionId?: string;
  zoneId: ZoneId;
  players: Map<string, PlayerSnapshot>;
  send: (type: "move", payload: { x: number; y: number; z: number }) => void;
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
        const send: RoomState["send"] = (type, payload) => room?.send(type, payload);

        const commit = () => {
          setState({
            status: "connected",
            sessionId: room?.sessionId,
            zoneId,
            players: new Map(players),
            send,
            travel,
          });
        };

        const $ = getStateCallbacks(room);
        $(room.state).players.onAdd((p: Player, key: string) => {
          players.set(key, { id: key, name: p.name, x: p.x, y: p.y, z: p.z });
          commit();
          $(p).onChange(() => {
            players.set(key, { id: key, name: p.name, x: p.x, y: p.y, z: p.z });
            commit();
          });
        });
        $(room.state).players.onRemove((_p: Player, key: string) => {
          players.delete(key);
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

  return state;
}
