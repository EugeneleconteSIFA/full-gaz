/**
 * Special abilities, one per character (D057). Each one serves conquest: hold a zone, reach it
 * first, clear it from afar, or push the enemy out of it. Immutable configuration; the cooldown
 * and effect timers live in PlayerState.
 */

/** Takes less damage for a while: holds a contested base. */
export interface GuardAbility {
  readonly kind: "guard";
  readonly label: string;
  readonly description: string;
  readonly cooldownSeconds: number;
  readonly durationSeconds: number;
  /** Fraction of incoming damage still taken while guarding, 0..1. */
  readonly damageTakenFactor: number;
}

/** Instant leap: first on a base, or out of a fight. */
export interface DashAbility {
  readonly kind: "dash";
  readonly label: string;
  readonly description: string;
  readonly cooldownSeconds: number;
  /** World units travelled, stopped early by walls. */
  readonly distance: number;
}

/** Several projectiles at once in a fan: clears a zone from afar. */
export interface VolleyAbility {
  readonly kind: "volley";
  readonly label: string;
  readonly description: string;
  readonly cooldownSeconds: number;
  readonly projectiles: number;
  /** Full width of the fan, degrees. */
  readonly spreadDegrees: number;
}

/** Hits all around and throws enemies back: empties a capture zone. */
export interface SpinAbility {
  readonly kind: "spin";
  readonly label: string;
  readonly description: string;
  readonly cooldownSeconds: number;
  /** Reach, as a multiple of the character's (upgraded) attack range. */
  readonly rangeFactor: number;
  /** Damage, as a multiple of the character's (upgraded) attack damage. */
  readonly damageFactor: number;
  /** Distance enemies hit are pushed away, world units, stopped by walls. */
  readonly knockback: number;
}

/** One big lobbed shell (lobbers only): a wider, harder splash that clears a zone over walls. */
export interface BombardAbility {
  readonly kind: "bombard";
  readonly label: string;
  readonly description: string;
  readonly cooldownSeconds: number;
  /** Damage, as a multiple of the character's (upgraded) attack damage. */
  readonly damageFactor: number;
  /** Splash radius, as a multiple of the character's splash radius. */
  readonly splashFactor: number;
}

export type AbilityDefinition =
  GuardAbility | DashAbility | VolleyAbility | SpinAbility | BombardAbility;
export type AbilityKind = AbilityDefinition["kind"];

export const ABILITY_TUNING = {
  /** Displacements (dash, knockback) advance in steps this long, so they never skip a wall. */
  displacementStep: 0.25,
} as const;
