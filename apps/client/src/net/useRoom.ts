import type { GameRoomState, Player } from "@game/shared";
import type { Room } from "colyseus.js";
import { getStateCallbacks } from "colyseus.js";
import { useEffect, useState } from "react";
import { joinGame } from "./room";

export type PlayerSnapshot = { id: string; x: number; y: number; z: number };

export type RoomState = {
  status: "idle" | "connecting" | "connected" | "error";
  error?: string;
  sessionId?: string;
  players: Map<string, PlayerSnapshot>;
  send: (type: "move", payload: { x: number; y: number; z: number }) => void;
};

const empty: RoomState = {
  status: "idle",
  players: new Map(),
  send: () => {},
};

export function useRoom(): RoomState {
  const [state, setState] = useState<RoomState>(empty);

  useEffect(() => {
    let cancelled = false;
    let room: Room<GameRoomState> | undefined;

    setState((s) => ({ ...s, status: "connecting" }));

    (async () => {
      try {
        room = await joinGame();
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
            players: new Map(players),
            send,
          });
        };

        const $ = getStateCallbacks(room);
        $(room.state).players.onAdd((p: Player, key: string) => {
          players.set(key, { id: key, x: p.x, y: p.y, z: p.z });
          commit();
          $(p).onChange(() => {
            players.set(key, { id: key, x: p.x, y: p.y, z: p.z });
            commit();
          });
        });
        $(room.state).players.onRemove((_p: Player, key: string) => {
          players.delete(key);
          commit();
        });

        room.onLeave(() => {
          if (cancelled) return;
          setState({ ...empty, status: "idle" });
        });
        room.onError((_code, message) => {
          if (cancelled) return;
          setState({ ...empty, status: "error", error: message });
        });

        commit();
      } catch (err) {
        if (cancelled) return;
        setState({ ...empty, status: "error", error: (err as Error).message });
      }
    })();

    return () => {
      cancelled = true;
      room?.leave();
    };
  }, []);

  return state;
}
