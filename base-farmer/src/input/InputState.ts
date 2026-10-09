import { vec2, type Vec2 } from "../core/math";
import type { UpgradeId } from "../core/types";

/**
 * Device-independent actions. Gameplay never sees keyboard, mouse or touch directly.
 * interact is sampled now but not consumed until its milestone.
 */
export interface InputState {
  /** Length <= 1. */
  moveVector: Vec2;
  /** Aim direction, any length; zero = keep current aim. */
  aimVector: Vec2;
  /** How far the player aims, world units; null = as far as possible. Only lobs use it. */
  aimDistance: number | null;
  /** Held, not edge-triggered: the simulation fires whenever the cooldown allows. */
  attackPressed: boolean;
  /** Held, like attack: the ability is used as soon as its cooldown allows. */
  abilityPressed: boolean;
  interactPressed: boolean;
  /** Upgrades the player asked to buy since the last sample (edge-triggered). */
  buyRequests: UpgradeId[];
}

export function createInputState(): InputState {
  return {
    moveVector: vec2(),
    aimVector: vec2(),
    aimDistance: null,
    attackPressed: false,
    abilityPressed: false,
    interactPressed: false,
    buyRequests: [],
  };
}
