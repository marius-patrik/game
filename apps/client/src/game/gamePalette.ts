/**
 * Central palette for 3D material colors (mesh fill + emissive + particle
 * accent). HUD / DOM surfaces use CSS tokens in `src/styles/tokens.css`; this
 * module exists so gameplay-semantic colors (mob red, item-rarity amber,
 * telegraph crimson) live in one place instead of being scattered across
 * `.tsx` scene components.
 *
 * Keep values as plain hex strings — three.js `Color` accepts them directly
 * and this file is imported into tight render loops where we don't want
 * CSS-parsing overhead.
 */

export const GAME_PALETTE = {
  /** Cosmetic sphere + trail accents for the decorative centerpiece. */
  centerpiece: {
    body: "#a78bfa",
    emissive: "#6d28d9",
    spark: "#f472b6",
  },

  /** Mob visuals — body/emissive/spike/trail split for the grunt / healer
   * variants, plus shared telegraph + sparkles accents. */
  mob: {
    grunt: {
      body: "#dc2626",
      emissive: "#7f1d1d",
      spike: "#b91c1c",
      spikeEmissive: "#450a0a",
      trail: "#ef4444",
      deathSparkA: "#ef4444",
      deathSparkB: "#fbbf24",
    },
    healer: {
      body: "#22c55e",
      emissive: "#14532d",
      spike: "#15803d",
      spikeEmissive: "#052e16",
      trail: "#86efac",
      groundRing: "#22c55e",
      healBeam: "#4ade80",
    },
    enragedSparkles: "#f97316",
    gruntSparkles: "#fca5a5",
    healerSparkles: "#86efac",
    corpseBase: "#27272a",
    corpseEmissive: "#ef4444",
  },

  /** NPC accents — vendors (violet) vs quest-givers (emerald), plus the
   * "ready to turn in" ring accent. */
  npc: {
    vendor: "#8b5cf6",
    vendorEmissive: "#4c1d95",
    questgiver: "#22c55e",
    questgiverEmissive: "#14532d",
    readyRing: "#fde68a",
    readyEmissive: "#fbbf24",
  },

  /** Item-rarity / drop visuals. `unknown` is the catch-all so never-seen
   * itemIds don't flash pink. */
  item: {
    heal_potion: "#ef4444",
    mana_potion: "#38bdf8",
    sword: "#94a3b8",
    greataxe: "#a1a1aa",
    helm: "#f59e0b",
    cuirass: "#fb923c",
    ring_spark: "#a78bfa",
    soul: "#a78bfa",
    unknown: "#f59e0b",
  } as Record<string, string>,

  /** Caster bolt colors (hit vs miss). */
  caster: {
    hit: "#a78bfa",
    miss: "#94a3b8",
  },

  /** Ability-pulse ring default (violet). Per-ability tint can override. */
  abilityPulse: "#a78bfa",

  /** Hazard zones (arena embers + cracked ground). */
  hazard: {
    ring: "#f97316",
    fill: "#ea580c",
    ember: "#fdba74",
  },

  /** Boss attack telegraph — hot red with a dim inner body. */
  telegraph: {
    rim: "#ef4444",
    body: "#7f1d1d",
  },

  /** Move-target indicator. */
  moveMarker: "#fde68a",

  /** Damage-number color tiers. */
  dmg: {
    kill: "#facc15",
    crit: "#fde047",
    hit: "#fca5a5",
    stroke: "rgba(0,0,0,0.85)",
  },

  /** Out-of-range cooldown indicator on ActionBar. */
  outOfRange: "#ef4444",

  /** Ability/skill slot rarity tints on the hotbar. */
  rarity: {
    legendary: "#fbbf24",
    rare: "#60a5fa",
    common: "#a1a1aa",
  },

  /** Empty / disabled slot fill. */
  emptySlot: "#71717a",
  /** Unknown-rarity / locked slot fill. */
  locked: "#4b5563",

  /** Player-mesh visual — HP gradient + self-label accents. */
  player: {
    hpHigh: "#10b981",
    hpMid: "#eab308",
    hpLow: "#ef4444",
    barBg: "#27272a",
    selfLabel: "#fde68a",
    otherLabel: "#e4e4e7",
    crown: "#fde68a",
    crownEmissive: "#fcd34d",
    shadow: "#000000",
  },

  /** Portals: per-destination ring color. */
  portal: {
    lobby: "#fbbf24",
    arena: "#f97316",
    fallback: "#a855f7",
  },

  /** Safe-zone beacon ring. */
  safeZone: {
    outer: "#60a5fa",
    inner: "#93c5fd",
  },

  /** Zone decor — stone pillars, market stalls, lobby centerpieces. */
  decor: {
    stone: "#71717a",
    stalePurple: "#7c3aed",
    stallGreen: "#059669",
    hedge: "#6b0f1a",
    hedgeDefault: "#1f2937",
    wood: "#78350f",
    dirt: "#57534e",
    lanternGlass: "#fde68a",
    lanternEmissive: "#fbbf24",
    pedestal: "#52525b",
    crystalBody: "#1e40af",
    crystalEmissive: "#3b82f6",
    crystalGlow: "#60a5fa",
    slab: "#71717a",
    obeliskBody: "#3f3f46",
    obeliskCap: "#52525b",
    obeliskGlyph: "#fbbf24",
    obeliskGlyphEmissive: "#f59e0b",
    firepitRim: "#27272a",
    firepitCore: "#f97316",
    firepitCoreEmissive: "#ea580c",
    firepitFlame: "#fbbf24",
    firepitFlameEmissive: "#fb923c",
    firepitLight: "#fb923c",
  },

  /** Minimap canvas palette. Canvas context needs raw strings. */
  minimap: {
    bg: "rgba(9, 9, 11, 0.7)",
    border: "rgba(161, 161, 170, 0.4)",
    grid: "rgba(161, 161, 170, 0.35)",
    portalFill: "rgba(251, 191, 36, 0.9)",
    portalRing: "rgba(251, 191, 36, 0.35)",
    hazardRing: "rgba(249, 115, 22, 0.35)",
    hazardFill: "#f97316",
    mobAlive: "#ef4444",
    mobDead: "#a3a3a3",
    mobHealer: "#22c55e",
    npcVendor: "#a78bfa",
    npcQuestgiver: "#22c55e",
    npcReady: "#facc15",
    npcIcon: "#f59e0b",
    iconStroke: "rgba(0,0,0,0.55)",
    self: "#22d3ee",
    other: "#ffffff",
    text: "rgba(250, 250, 250, 0.85)",
  },
} as const;
