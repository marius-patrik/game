/** Network payload types that aren't synced via Colyseus schema but are
 * sent as messages between client and server. Keeping them here so both
 * sides import a single source of truth. */

/** Broadcast shape for an attack landing on a target (existing shape +
 * optional crit flag added in the crit-hits feature). */
export type AttackBroadcast = {
  attackerId: string;
  targetId: string;
  killed: boolean;
  dmg?: number;
  crit?: boolean;
};

/** The mob archetypes the server spawns. Kept in shared so the
 * `DeathCause` payload (and any future mob-flavoured UI) can refer to
 * them without importing from the server package. */
export type MobArchetypeId = "grunt" | "caster" | "boss" | "healer";

/** Cause of death surfaced to the dying player in the `died` message. */
export type DeathCause =
  | { kind: "mob"; mobKind: MobArchetypeId; name?: string }
  | { kind: "player"; name: string }
  | { kind: "world" };

export type DiedMessage = {
  cause: DeathCause;
  at: number;
};

export function describeDeathCause(cause: DeathCause): string {
  switch (cause.kind) {
    case "mob":
      return cause.name ? `Slain by ${cause.name}` : `Slain by a ${cause.mobKind}`;
    case "player":
      return `Slain by ${cause.name}`;
    case "world":
      return "You died";
  }
}
