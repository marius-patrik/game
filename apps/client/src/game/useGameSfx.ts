import type { RoomState } from "@/net/useRoom";
import { useEffect, useRef } from "react";
import { playSfx } from "./sfx";

/**
 * Fires procedural SFX for gameplay events by watching refs on the RoomState.
 * All sounds go through the shared context in sfx.ts, which honours the
 * master volume set from SettingsPanel.
 */
export function useGameSfx(room: RoomState): void {
  const attackRef = useRef(room.lastAttack);
  const abilityRef = useRef(room.lastAbility);
  const pickupRef = useRef(room.lastPickup);
  const zoneRef = useRef(room.zoneId);
  const levelRef = useRef<number | undefined>(undefined);
  const mobsSeenRef = useRef(new Set<string>());

  // self level -> init
  const self = room.sessionId ? room.players.get(room.sessionId) : undefined;
  if (levelRef.current === undefined && self) levelRef.current = self.level;

  useEffect(() => {
    if (room.lastAttack && room.lastAttack !== attackRef.current) {
      attackRef.current = room.lastAttack;
      // Hit resolved on server. Attacker-local will also have heard their own
      // "attack" swing when they clicked — this is the "thud" that lands.
      playSfx("hit");
      if (room.lastAttack.crit) playSfx("crit");
      if (room.lastAttack.killed && room.lastAttack.targetId.startsWith("mob:")) {
        playSfx("death");
      }
    }
  }, [room.lastAttack]);

  useEffect(() => {
    if (room.lastAbility && room.lastAbility !== abilityRef.current) {
      abilityRef.current = room.lastAbility;
      if (room.lastAbility.hits > 0) {
        playSfx("hit");
        if (room.lastAbility.crit) playSfx("crit");
        if (room.lastAbility.killed && room.lastAbility.targetId?.startsWith("mob:")) {
          playSfx("death");
        }
      }
    }
  }, [room.lastAbility]);

  useEffect(() => {
    if (room.lastPickup && room.lastPickup !== pickupRef.current) {
      pickupRef.current = room.lastPickup;
      playSfx("pickup");
    }
  }, [room.lastPickup]);

  useEffect(() => {
    if (room.zoneId !== zoneRef.current) {
      zoneRef.current = room.zoneId;
      playSfx("portal");
    }
  }, [room.zoneId]);

  useEffect(() => {
    if (!self) return;
    const prev = levelRef.current;
    levelRef.current = self.level;
    if (prev !== undefined && self.level > prev) {
      playSfx("levelup");
    }
  }, [self]);

  // spot killed mobs (map shrink since last tick); we only play the death SFX
  // if we were already observing that mob, so we don't fire on leave.
  useEffect(() => {
    const seen = mobsSeenRef.current;
    for (const id of seen) {
      if (!room.mobs.has(id)) seen.delete(id);
    }
    for (const id of room.mobs.keys()) {
      seen.add(id);
    }
  }, [room.mobs]);
}
