import type { Vec2 } from "./math";
import type { MapLayout } from "../world/MapLayout";
import type { RngState } from "./Random";
import type {
  BaseId,
  BaseOwner,
  CharacterId,
  MapId,
  PlayerId,
  ResourceId,
  TeamId,
  UpgradeId,
} from "./types";

/** Character stats after upgrades. Recomputed on purchase; read by every gameplay system. */
export interface PlayerStats {
  readonly attackKind: "melee" | "ranged" | "lob";
  /** Melee only: full width of the swing arc, radians. */
  readonly meleeArc: number;
  readonly radius: number;
  readonly maxHp: number;
  readonly moveSpeed: number;
  readonly attackRange: number;
  readonly attackDamage: number;
  readonly attackCooldown: number;
  readonly projectileSpeed: number;
  readonly projectileRadius: number;
  /** Lob only (0 otherwise): see LobStats in data/characters.ts. */
  readonly lobFlightSeconds: number;
  readonly splashRadius: number;
  readonly lobMinRange: number;
}

/**
 * Mutable runtime state. Must stay plain, serializable data: no Phaser objects, no class instances.
 */
export interface PlayerState {
  readonly id: PlayerId;
  readonly teamId: TeamId;
  readonly characterId: CharacterId;
  position: Vec2;
  /** Unit vector the player is aiming at. */
  aim: Vec2;
  /** How far the player aims, world units; null = as far as possible. Only lobs use it. */
  aimDistance: number | null;
  /** Latest movement intent, length <= 1. Set by commands, consumed by the movement system each tick. */
  moveIntent: Vec2;
  /** Current velocity, world units/s (inertia: eases toward moveIntent x speed). Optional for
   * hand-built test players; the movement system creates it on first use. */
  velocity?: Vec2;
  /** Whether the player wants to fire. Set by commands, consumed by the combat system each tick. */
  attackIntent: boolean;
  hp: number;
  /** First tick at which the player may fire again. */
  attackReadyTick: number;
  /** Whether the player wants to use their ability. Set by commands, consumed each tick. */
  abilityIntent: boolean;
  /** First tick at which the ability may be used again. */
  abilityReadyTick: number;
  /** Guard ability: damage is reduced until this tick (exclusive). */
  guardUntilTick: number;
  /** Tick at which a dead player comes back; null while alive. */
  respawnAtTick: number | null;
  /** Personal wallet. Never shared, never lost on death. */
  resources: Record<ResourceId, number>;
  /** Level bought for each upgrade, 0 = none. */
  upgrades: Record<UpgradeId, number>;
  stats: PlayerStats;
}

export interface ProjectileState {
  readonly id: number;
  readonly ownerId: PlayerId;
  readonly teamId: TeamId;
  position: Vec2;
  /** World units per second. */
  readonly velocity: Vec2;
  readonly radius: number;
  readonly damage: number;
  /** World units left before the projectile expires. */
  remainingDistance: number;
}

/**
 * A lobbed shell (attackKind "lob"): flies from `from` to `to` over everything, lands at
 * `landTick` and hurts every enemy within `splashRadius` of `to`. Its height is for the renderer.
 */
export interface ShellState {
  readonly id: number;
  readonly ownerId: PlayerId;
  readonly teamId: TeamId;
  readonly from: Vec2;
  readonly to: Vec2;
  readonly launchTick: number;
  readonly landTick: number;
  readonly damage: number;
  readonly splashRadius: number;
}

/**
 * Capture meter: `captureTeam` is the team currently pushing the base toward a change of owner
 * (neutralizing an enemy base, or taking a neutral one), `captureProgress` how far, 0..1.
 */
export interface BaseState {
  readonly id: BaseId;
  /** Drawn from the seed at match start; fixed for the match. */
  readonly resourceId: ResourceId;
  owner: BaseOwner;
  captureTeam: TeamId | null;
  captureProgress: number;
  /** Both teams are in the zone: progress is frozen. */
  contested: boolean;
}

export interface ProductionEvent {
  readonly tick: number;
  readonly resourceId: ResourceId;
}

export interface ProductionResult extends ProductionEvent {
  /** Amount each player of the team received (= bases of that resource the team controlled). */
  /** Total each player of the team received, all resources together. */
  readonly amountByTeam: Readonly<Record<TeamId, number>>;
  /** Detail per resource of what each player of the team received. */
  readonly gainsByTeam: Readonly<Record<TeamId, Readonly<Record<ResourceId, number>>>>;
}

export type MatchWinner = TeamId | "draw";

/** Which rule decided the match (see docs/01_GAMEPLAY_RULES.md, tie-breaker). */
export type MatchDecider = "bases" | "captureProgress" | "draw";

export interface MatchResult {
  readonly winner: MatchWinner;
  readonly decidedBy: MatchDecider;
  readonly bases: Readonly<Record<TeamId, number>>;
  /** Sum of each team's unfinished capture progress at the end, in bases (0..7). */
  readonly captureProgress: Readonly<Record<TeamId, number>>;
}

export interface MatchState {
  readonly seed: number;
  readonly mapId: MapId;
  /** The geometry this match is played on: the map, mirrored and with bases nudged from the seed. */
  readonly layout: MapLayout;
  /** Number of simulation ticks elapsed. Match time = tick * fixed step. */
  tick: number;
  /** The match ends when `tick` reaches this. */
  readonly durationTicks: number;
  /** Set once at the end; the simulation is frozen afterwards. */
  result: MatchResult | null;
  readonly rng: RngState;
  readonly players: PlayerState[];
  readonly projectiles: ProjectileState[];
  readonly shells: ShellState[];
  /** Same order as the map's base definitions. */
  readonly bases: BaseState[];
  /** Every production event of the match, drawn from the seed at match start, in tick order. */
  readonly productionPlan: readonly ProductionEvent[];
  /** Index in `productionPlan` of the next event to run. */
  nextProductionIndex: number;
  /** Latest event that ran, for HUD feedback. */
  lastProduction: ProductionResult | null;
  /** Next id handed to a spawned entity (projectiles for now). */
  nextEntityId: number;
}

export function isAlive(player: PlayerState): boolean {
  return player.respawnAtTick === null;
}
