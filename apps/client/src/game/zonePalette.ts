import type { Zone, ZonePreset } from "@game/shared";

export type ResolvedTheme = "light" | "dark";

export type ZonePalette = {
  bg: string;
  ground: string;
  gridMajor: string;
  gridMinor: string;
  ambient: number;
  preset: ZonePreset;
  fogNear: number;
  fogFar: number;
};

const LIGHT_BG = "#fafafa";
const DARK_BG = "#09090b";

export function resolveZonePalette(zone: Zone, resolvedTheme: ResolvedTheme): ZonePalette {
  const { theme } = zone;
  if (resolvedTheme === "dark") {
    return {
      bg: DARK_BG,
      ground: theme.ground,
      gridMajor: theme.gridMajor,
      gridMinor: theme.gridMinor,
      ambient: 0.25,
      preset: theme.preset,
      fogNear: theme.fog.near,
      fogFar: theme.fog.far,
    };
  }
  return {
    bg: LIGHT_BG,
    ground: "#e4e4e7",
    gridMajor: "#d4d4d8",
    gridMinor: "#e4e4e7",
    ambient: 0.6,
    preset: theme.preset,
    fogNear: theme.fog.near,
    fogFar: theme.fog.far,
  };
}
