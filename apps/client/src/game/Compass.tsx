import { type MobSnapshot, useRoom } from "@/net/useRoom";
import { peekCameraYaw } from "@/state/cameraStore";
import { usePreferencesStore } from "@/state/preferencesStore";
import { QUEST_CATALOG, ZONES } from "@game/shared";
import { ChevronUp, Circle, MapPin, Target, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type POI,
  type Vec3,
  angleToScreenX,
  bearingFromTo,
  distanceXZ,
  normalizeAngle,
} from "./compass/computeBearings";

const MAX_POI_DISTANCE = 40;
const COMPASS_FOV_DEG = 90;

export function Compass({ cinematicActive }: { cinematicActive?: boolean }) {
  const room = useRoom();
  const fov = usePreferencesStore((s) => s.fov);
  const [tick, setTick] = useState(0);

  // Throttled update at ~30Hz
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 33);
    return () => clearInterval(id);
  }, []);

  if (cinematicActive) return null;

  const self = room.sessionId ? room.players.get(room.sessionId) : undefined;
  if (!self) return null;

  const facing = -peekCameraYaw(); // bearing = -yaw
  const selfPos: Vec3 = { x: self.x, y: self.y, z: self.z };
  const fovRad = (fov * Math.PI) / 180;

  const pois: POI[] = [];

  // 1. Mobs
  for (const mob of room.mobs.values()) {
    if (!mob.alive) continue;
    const dist = distanceXZ(selfPos, { x: mob.x, y: mob.y, z: mob.z });
    if (dist > MAX_POI_DISTANCE) continue;
    pois.push({
      id: `mob-${mob.id}`,
      kind: mob.kind === "boss" ? "boss" : "mob",
      pos: { x: mob.x, y: mob.y, z: mob.z },
    });
  }

  // 2. NPCs
  for (const npc of room.npcs.values()) {
    const dist = distanceXZ(selfPos, { x: npc.x, y: npc.y, z: npc.z });
    if (dist > MAX_POI_DISTANCE) continue;
    pois.push({
      id: `npc-${npc.id}`,
      kind: "npc",
      pos: { x: npc.x, y: npc.y, z: npc.z },
      label: npc.name,
    });
  }

  // 3. Portals
  const zone = ZONES[room.zoneId];
  if (zone) {
    for (const portal of zone.portals) {
      pois.push({
        id: `portal-${portal.to}`,
        kind: "portal",
        pos: portal.pos,
        label: portal.to,
      });
    }
  }

  // 4. Quest Objectives
  for (const q of self.quests) {
    if (q.status !== "active") continue;
    const def = QUEST_CATALOG[q.id];
    if (!def) continue;

    const obj = def.objective;
    if (obj.kind === "explore" && obj.zoneId !== room.zoneId) {
      // Find portal leading to that zone
      const portal = zone?.portals.find((p) => p.to === obj.zoneId);
      if (portal) {
        pois.push({
          id: `quest-${q.id}`,
          kind: "quest",
          pos: portal.pos,
          label: def.title,
        });
      }
    } else if (obj.kind === "killMobs") {
      // Highlight the nearest mob
      let nearestMob: MobSnapshot | null = null;
      let minDist = Number.POSITIVE_INFINITY;
      for (const mob of room.mobs.values()) {
        if (!mob.alive) continue;
        const dist = distanceXZ(selfPos, { x: mob.x, y: mob.y, z: mob.z });
        if (dist < minDist) {
          minDist = dist;
          nearestMob = mob;
        }
      }
      if (nearestMob) {
        pois.push({
          id: `quest-${q.id}`,
          kind: "quest",
          pos: { x: nearestMob.x, y: nearestMob.y, z: nearestMob.z },
          label: def.title,
        });
      }
    }
  }

  const cardinalTicks = [
    { label: "N", angle: 0 },
    { label: "E", angle: Math.PI / 2 },
    { label: "S", angle: Math.PI },
    { label: "W", angle: (3 * Math.PI) / 2 },
  ];

  return (
    <div className="pointer-events-none absolute top-4 left-1/2 flex h-8 w-64 -translate-x-1/2 items-center justify-center overflow-hidden rounded-md border border-border/40 bg-background/60 backdrop-blur-sm sm:top-6 sm:w-96">
      {/* Compass strip container */}
      <div className="relative h-full w-full">
        {/* Cardinal Ticks */}
        {cardinalTicks.map((t) => {
          const x = angleToScreenX(t.angle, facing, fovRad);
          if (x === null) return null;
          return (
            <div
              key={t.label}
              className="absolute top-0 bottom-0 flex flex-col items-center justify-start pt-1"
              style={{ left: `${x * 100}%`, transform: "translateX(-50%)" }}
            >
              <span className="text-[10px] font-bold leading-none text-muted-foreground/80">
                {t.label}
              </span>
              <div className="h-1 w-[1px] bg-muted-foreground/40" />
            </div>
          );
        })}

        {/* POIs */}
        {pois.map((poi) => {
          const bearing = bearingFromTo(selfPos, poi.pos);
          const x = angleToScreenX(bearing, facing, fovRad);
          if (x === null) return null;

          return (
            <div
              key={poi.id}
              className="absolute top-1/2 flex -translate-y-1/2 items-center justify-center transition-all duration-200"
              style={{ left: `${x * 100}%`, transform: "translate(-50%, -50%)" }}
            >
              <POIStaticIcon kind={poi.kind} />
            </div>
          );
        })}

        {/* Center indicator */}
        <div className="absolute top-0 left-1/2 h-full w-[2px] -translate-x-1/2 bg-primary/20" />
      </div>
    </div>
  );
}

function POIStaticIcon({ kind }: { kind: POI["kind"] }) {
  switch (kind) {
    case "mob":
      return (
        <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]" />
      );
    case "boss":
      return <Target className="h-3 w-3 text-red-500" />;
    case "npc":
      return (
        <div className="h-1.5 w-1.5 rounded-sm bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
      );
    case "portal":
      return <Circle className="h-3 w-3 text-blue-400" />;
    case "quest":
      return <ChevronUp className="h-4 w-4 animate-pulse text-yellow-400" />;
    default:
      return null;
  }
}
