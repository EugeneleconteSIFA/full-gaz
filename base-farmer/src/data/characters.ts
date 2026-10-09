import type { CharacterId } from "../core/types";
import type { AbilityDefinition } from "./abilities";

/** Immutable configuration. Runtime values live in PlayerState. */
/**
 * Melee hits everything in an arc in front, at once. Ranged fires a projectile. Lob throws a
 * shell over walls and bodies onto the aimed spot, where it hurts everyone around (D065).
 */
export type AttackKind = "melee" | "ranged" | "lob";

/** Lob only: how the shell flies and lands. */
export interface LobStats {
  /** Seconds from the throw to the landing, whatever the distance. */
  readonly flightSeconds: number;
  /** Enemies whose body is within this distance of the landing spot are hit, world units. */
  readonly splashRadius: number;
  /** The shell never lands closer than this, world units (no throwing at one's own feet). */
  readonly minRange: number;
}

export interface CharacterDefinition {
  readonly id: CharacterId;
  /** The character's name, shown to players. */
  readonly label: string;
  /** Gameplay role, for docs and tooling (not shown: players see the name). */
  readonly role: string;
  /** One-line pitch shown on the selection screen. */
  readonly tagline: string;
  /** Stats divided by BASELINE, for the selection screen ratings only. */
  readonly relative: Readonly<RelativeStats>;
  readonly attackKind: AttackKind;
  /** Collision radius, world units. */
  readonly radius: number;
  /** World units per second. */
  readonly moveSpeed: number;
  readonly maxHp: number;
  /** Damage of one hit (melee) or one projectile (ranged). */
  readonly attackDamage: number;
  /**
   * Melee: reach from the character's center, world units (enemies whose body is within it are
   * hit). Ranged: distance a projectile travels before disappearing.
   */
  readonly attackRange: number;
  /** Seconds between two attacks. */
  readonly attackCooldown: number;
  /** Melee only: width of the swing arc in front, degrees. */
  readonly meleeArcDegrees: number;
  /** Ranged only: world units per second. */
  readonly projectileSpeed: number;
  /** Ranged only: projectile collision radius, world units. */
  readonly projectileRadius: number;
  /** Lob only (attackKind "lob"). */
  readonly lob?: LobStats;
  /** Special ability, triggered by its own button, on its own cooldown. */
  readonly ability: AbilityDefinition;
}

export interface RelativeStats {
  readonly hp: number;
  readonly speed: number;
  readonly range: number;
  readonly damage: number;
}

/** The 100% reference the selection screen ratings compare against. */
export const BASELINE = {
  radius: 0.5,
  moveSpeed: 6,
  maxHp: 100,
  attackDamage: 20,
  attackRange: 7,
} as const;

type Stats = Omit<CharacterDefinition, "id" | "label" | "role" | "tagline" | "relative" | "radius">;

const PROJECTILE = { projectileSpeed: 18, projectileRadius: 0.2 } as const;
/** Melee characters have no projectile; these are unused placeholders for the shared stats type. */
const NO_PROJECTILE = { projectileSpeed: 0.001, projectileRadius: 0.001 } as const;

function character(
  id: CharacterId,
  label: string,
  role: string,
  tagline: string,
  stats: Stats,
): CharacterDefinition {
  return {
    id,
    label,
    role,
    tagline,
    radius: BASELINE.radius,
    ...stats,
    relative: {
      hp: stats.maxHp / BASELINE.maxHp,
      speed: stats.moveSpeed / BASELINE.moveSpeed,
      range: stats.attackRange / BASELINE.attackRange,
      damage: stats.attackDamage / BASELINE.attackDamage,
    },
  };
}

/**
 * Roster (D054): Patatras, Pépin and Gaston fight in melee (hit harder, short reach); Lorgnon is
 * the shooter (low damage, long range); Marguerite lobs over walls and hits an area (D065). Values are tuned with the bot tournament
 * (`npm run balance`, see BALANCE.md). Each one has a special ability
 * (D057) that plays to its conquest role.
 */
export const CHARACTERS: readonly CharacterDefinition[] = [
  character("tank", "Patatras", "Robuste", "Un cochon blindé : rien ne le déloge d'une base.", {
    attackKind: "melee",
    maxHp: 150,
    moveSpeed: 5.4,
    attackDamage: 30,
    attackRange: 1.6,
    attackCooldown: 0.65,
    meleeArcDegrees: 130,
    ...NO_PROJECTILE,
    ability: {
      kind: "guard",
      label: "Carapace",
      description: "Encaisse 3 s en ne prenant que 40 % des dégâts.",
      cooldownSeconds: 10,
      durationSeconds: 3,
      damageTakenFactor: 0.4,
    },
  }),
  character("scout", "Pépin", "Rapide", "Petit, vif, déjà sur la base avant toi.", {
    attackKind: "melee",
    maxHp: 76,
    moveSpeed: 7.8,
    attackDamage: 17,
    attackRange: 1.25,
    attackCooldown: 0.45,
    meleeArcDegrees: 110,
    ...NO_PROJECTILE,
    ability: {
      kind: "dash",
      label: "Bond",
      description: "Bondit droit devant, vers la base ou loin du danger.",
      cooldownSeconds: 6,
      distance: 4.5,
    },
  }),
  character(
    "shooter",
    "Lorgnon",
    "Tireur",
    "Un hibou à monocle : il voit tout et arrose de très loin.",
    {
      attackKind: "ranged",
      maxHp: 75,
      moveSpeed: 5.3,
      attackDamage: 8,
      attackRange: 9,
      attackCooldown: 0.42,
      meleeArcDegrees: 0,
      ...PROJECTILE,
      ability: {
        kind: "volley",
        label: "Rafale",
        description: "Lâche 5 plumes en éventail d'un coup.",
        cooldownSeconds: 8,
        projectiles: 5,
        spreadDegrees: 40,
      },
    },
  ),
  character(
    "fighter",
    "Gaston",
    "Combattant",
    "Le chien de la ferme : bon partout, teigneux de près.",
    {
      attackKind: "melee",
      maxHp: 105,
      moveSpeed: 6,
      attackDamage: 33,
      attackRange: 1.6,
      attackCooldown: 0.5,
      meleeArcDegrees: 110,
      ...NO_PROJECTILE,
      ability: {
        kind: "spin",
        label: "Tourbillon",
        description: "Frappe tout autour et repousse les ennemis hors de la zone.",
        cooldownSeconds: 8,
        rangeFactor: 1.5,
        damageFactor: 1,
        knockback: 3,
      },
    },
  ),
  character(
    "artillery",
    "Marguerite",
    "Artilleuse",
    "Une vache placide qui bombarde les bases à coups de bidons de lait.",
    {
      attackKind: "lob",
      maxHp: 95,
      moveSpeed: 5,
      attackDamage: 24,
      attackRange: 8,
      attackCooldown: 1,
      meleeArcDegrees: 0,
      ...NO_PROJECTILE,
      lob: { flightSeconds: 0.8, splashRadius: 1.5, minRange: 2 },
      ability: {
        kind: "bombard",
        label: "Gros bidon",
        description: "Lance une grosse cuve de lait : zone et dégâts presque doublés.",
        cooldownSeconds: 9,
        damageFactor: 1.8,
        splashFactor: 1.8,
      },
    },
  ),
];
