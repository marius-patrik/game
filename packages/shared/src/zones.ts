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

export type Portal = {
  to: ZoneId;
  pos: Vec3;
  radius: number;
};

export type Zone = {
  id: string;
  name: string;
  spawn: Vec3;
  bounds: { min: Vec3; max: Vec3 };
  maxClients: number;
  portals: Portal[];
  theme: ZoneTheme;
};

export const ZONES = {
  lobby: {
    id: "lobby",
    name: "Lobby",
    spawn: { x: 0, y: 0.5, z: 0 },
    bounds: { min: { x: -18, y: 0, z: -18 }, max: { x: 18, y: 8, z: 18 } },
    maxClients: 64,
    portals: [{ to: "arena", pos: { x: 15, y: 0.5, z: 0 }, radius: 1.5 }],
    theme: {
      preset: "city",
      ground: "#18181b",
      gridMajor: "#27272a",
      gridMinor: "#1c1c1f",
      fog: { near: 12, far: 40 },
    },
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
