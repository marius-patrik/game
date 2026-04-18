import { SparkBurst } from "@/fx";
import { GAME_PALETTE } from "@/game/gamePalette";

/**
 * Thin wrapper around `SparkBurst` so mob-death visuals live in the preset
 * registry alongside the other burst events. Mob.tsx previously inlined two
 * SparkBurst calls with the same semantics — centralizing here keeps the
 * color / count constants from drifting.
 */
export function MobDeathDust({ variant = "grunt" }: { variant?: "grunt" | "healer" }) {
  const pal = GAME_PALETTE.mob[variant];
  return (
    <>
      <SparkBurst baseCount={120} color={pal.trail} lifetime={0.9} speed={3.8} loop={false} />
      <SparkBurst
        baseCount={40}
        color={
          variant === "healer"
            ? GAME_PALETTE.mob.healerSparkles
            : GAME_PALETTE.mob.grunt.deathSparkB
        }
        lifetime={0.6}
        speed={2.4}
        loop={false}
      />
    </>
  );
}
