import type { ZoneLightingProfile } from "@game/shared";
import {
  Color,
  type ColorRepresentation,
  DataTexture,
  NearestFilter,
  RGBAFormat,
  type Texture,
} from "three";

/**
 * Borderlands-style cell shader. Wraps three.js' built-in `MeshToonMaterial`
 * — which samples a tiny gradient texture to snap diffuse lighting into
 * discrete bands — with a per-zone 3-step palette (dark / mid / bright)
 * lifted from `ZoneLightingProfile.cellPalette`.
 *
 * Why `MeshToonMaterial` instead of `@lamina/material`: lamina needs a
 * bespoke toon layer to replicate this (its Color + Gradient primitives
 * operate on UVs, not the lambert term), and three.js already ships a
 * working toon shader. This keeps the bundle delta near-zero while giving
 * us the 3-step banding the plan calls for.
 *
 * The underlying diffuse color is modulated by the zone's mid tint so each
 * zone reads as a coherent palette without re-authoring every material.
 */

const GRADIENT_CACHE = new Map<string, Texture>();

type CellBands = Pick<ZoneLightingProfile["cellPalette"], "dark" | "mid" | "bright">;

function buildGradientTexture(bands: CellBands): Texture {
  const key = `${bands.dark}|${bands.mid}|${bands.bright}`;
  const existing = GRADIENT_CACHE.get(key);
  if (existing) return existing;

  // 3-stop banded gradient — three pixels wide. `NearestFilter` is critical:
  // linear sampling would smooth the bands back into a continuous gradient.
  const stops = [new Color(bands.dark), new Color(bands.mid), new Color(bands.bright)];
  const data = new Uint8Array(3 * 4);
  for (let i = 0; i < 3; i++) {
    const c = stops[i];
    if (!c) continue;
    data[i * 4 + 0] = Math.round(c.r * 255);
    data[i * 4 + 1] = Math.round(c.g * 255);
    data[i * 4 + 2] = Math.round(c.b * 255);
    data[i * 4 + 3] = 255;
  }

  const tex = new DataTexture(data, 3, 1, RGBAFormat);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  GRADIENT_CACHE.set(key, tex);
  return tex;
}

export function useCellGradient(bands: CellBands): Texture {
  return buildGradientTexture(bands);
}

/**
 * Drop-in replacement for `<meshStandardMaterial>`. Accepts the same `color`
 * + optional `emissive` hints; internally renders a `<meshToonMaterial>`
 * with the per-zone gradient.
 *
 * The `accent` prop lets callers preserve a hot emissive flourish (fountain
 * crystal, firepit flame, mob eyes) that would otherwise wash out in the
 * flat-shaded output.
 */
export function CellMaterial({
  bands,
  color = "#ffffff",
  emissive,
  emissiveIntensity = 0,
  transparent,
  opacity,
  toneMapped = true,
}: {
  bands: CellBands;
  color?: ColorRepresentation;
  emissive?: ColorRepresentation;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  toneMapped?: boolean;
}) {
  const gradientMap = useCellGradient(bands);
  return (
    <meshToonMaterial
      color={color}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={emissiveIntensity}
      gradientMap={gradientMap}
      transparent={transparent}
      opacity={opacity}
      toneMapped={toneMapped}
    />
  );
}
