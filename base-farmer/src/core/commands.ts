import type { Vec2 } from "./math";
import type { PlayerId, UpgradeId } from "./types";

/** Desired movement direction for the player; length is clamped to 1 by the simulation. */
export interface MoveCommand {
  type: "move";
  playerId: PlayerId;
  vector: Vec2;
}

/** Desired aim direction; ignored when zero-length. */
export interface AimCommand {
  type: "aim";
  playerId: PlayerId;
  direction: Vec2;
  /** How far, world units; null = as far as possible. Only lobs use it. */
  distance?: number;
}

/** Whether the player is holding fire. The simulation fires whenever the cooldown allows. */
export interface AttackCommand {
  type: "attack";
  playerId: PlayerId;
  active: boolean;
}

/** Whether the player is holding the ability button. Used whenever the cooldown allows. */
export interface UseAbilityCommand {
  type: "ability";
  playerId: PlayerId;
  active: boolean;
}

/** Buy the next level of an upgrade. Ignored if unaffordable or maxed. */
export interface BuyUpgradeCommand {
  type: "buyUpgrade";
  playerId: PlayerId;
  upgradeId: UpgradeId;
}

/**
 * Everything input can ask of the simulation. Commands are the only way input reaches gameplay,
 * which is what lets the simulation move to a server later.
 */
export type GameCommand =
  MoveCommand | AimCommand | AttackCommand | UseAbilityCommand | BuyUpgradeCommand;
