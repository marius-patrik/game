export type Vec3 = { x: number; y: number; z: number };

export type ZoneId = "lobby" | "arena";

export type ZonePreset = "city" | "sunset" | "warehouse" | "forest" | "apartment" | "dawn" | "park";

export type ZoneTheme = {
  preset: ZonePreset;
  ground: string;
  gridMajor: string;
  gridMinor: string;
  fog: { near: number; far: number };
};

/**
 * Three-point lighting: warm key (main directional), cool fill (secondary),
 * and a rim light from behind. Zones override the defaults for mood — the
 * lobby stays bright and neutral; the arena drops the fill and pushes the
 * rim crimson for a combat feel.
 */
export type ZoneLightingProfile = {
  ambient: { color: string; intensity: number };
  key: { color: string; intensity: number; position: [number, number, number] };
  fill: { color: string; intensity: number; position: [number, number, number] };
  rim: { color: string; intensity: number; position: [number, number, number] };
};

export type Portal = {
  to: ZoneId;
  pos: Vec3;
  radius: number;
  /** Minimum level required to travel. Portals below this threshold show
   * as locked in the minimap and the server rejects the zone-exit. */
  minLevel?: number;
};

export type Zone = {
  id: string;
  name: string;
  spawn: Vec3;
  bounds: { min: Vec3; max: Vec3 };
  maxClients: number;
  portals: Portal[];
  theme: ZoneTheme;
  lighting: ZoneLightingProfile;
};

const LOBBY_LIGHTING: ZoneLightingProfile = {
  ambient: { color: "#b8c8d8", intensity: 0.45 },
  key: { color: "#fff6dc", intensity: 1.35, position: [6, 10, 4] },
  fill: { color: "#9ec5ff", intensity: 0.45, position: [-6, 4, -2] },
  rim: { color: "#c4b5fd", intensity: 0.6, position: [0, 5, -8] },
};

const ARENA_LIGHTING: ZoneLightingProfile = {
  ambient: { color: "#3a1a1a", intensity: 0.3 },
  key: { color: "#ffc592", intensity: 1.2, position: [4, 9, 6] },
  fill: { color: "#4f3b60", intensity: 0.35, position: [-8, 3, -4] },
  rim: { color: "#ef4444", intensity: 0.75, position: [0, 4, -10] },
};

export const ZONES = {
  lobby: {
    id: "lobby",
    name: "Lobby",
    spawn: { x: 0, y: 0.5, z: 0 },
    bounds: { min: { x: -18, y: 0, z: -18 }, max: { x: 18, y: 8, z: 18 } },
    maxClients: 64,
    portals: [{ to: "arena", pos: { x: 15, y: 0.5, z: 0 }, radius: 1.5, minLevel: 2 }],
    theme: {
      preset: "city",
      ground: "#18181b",
      gridMajor: "#27272a",
      gridMinor: "#1c1c1f",
      fog: { near: 12, far: 40 },
    },
    lighting: LOBBY_LIGHTING,
  },
  arena: {
    id: "arena",
    name: "Arena",
    spawn: { x: 0, y: 0.5, z: 0 },
    bounds: { min: { x: -40, y: 0, z: -40 }, max: { x: 40, y: 12, z: 40 } },
    maxClients: 32,
    portals: [{ to: "lobby", pos: { x: -35, y: 0.5, z: 0 }, radius: 1.5 }],
    theme: {
      preset: "sunset",
      ground: "#3f1d2a",
      gridMajor: "#7c2d12",
      gridMinor: "#451a03",
      fog: { near: 18, far: 55 },
    },
    lighting: ARENA_LIGHTING,
  },
} as const satisfies Record<ZoneId, Zone>;

export const DEFAULT_ZONE: ZoneId = "lobby";

export function getZone(id: string): Zone | undefined {
  return (ZONES as Record<string, Zone>)[id];
}

export function clampToBounds(p: Vec3, zone: Zone): Vec3 {
  const { min, max } = zone.bounds;
  return {
    x: Math.min(max.x, Math.max(min.x, p.x)),
    y: Math.min(max.y, Math.max(min.y, p.y)),
    z: Math.min(max.z, Math.max(min.z, p.z)),
  };
}
