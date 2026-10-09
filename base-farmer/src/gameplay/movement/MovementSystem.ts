import { GAME_CONFIG } from "../../config/gameConfig";
import { clamp, clampLengthInPlace } from "../../core/math";
import type { PlayerState } from "../../core/MatchState";
import { pushCircleOut, type Obstacle } from "../../world/geometry";

export interface Bounds {
  readonly width: number;
  readonly height: number;
  readonly obstacles?: readonly Obstacle[];
}

/**
 * Integrates one tick of free movement, slides the body out of any obstacle it entered, and
 * keeps it inside the map. Mutates `player.position` in place (no allocation in the hot loop).
 */
export function applyMovement(
  player: PlayerState,
  moveSpeed: number,
  radius: number,
  bounds: Bounds,
  dtSeconds: number,
): void {
  // Diagonal input must not be faster than straight input.
  const intent = clampLengthInPlace(player.moveIntent, 1);
  // Light inertia: velocity eases toward the target (accelerating) or toward 0 (stopping).
  const v = (player.velocity ??= { x: 0, y: 0 });
  const tx = intent.x * moveSpeed;
  const ty = intent.y * moveSpeed;
  const moving = tx !== 0 || ty !== 0;
  const { accelRate, decelRate } = GAME_CONFIG.movement;
  const k = Math.min(1, (moving ? accelRate : decelRate) * dtSeconds);
  v.x += (tx - v.x) * k;
  v.y += (ty - v.y) * k;
  if (!moving && Math.abs(v.x) + Math.abs(v.y) < 1e-3) v.x = v.y = 0;
  const p = player.position;
  const beforeX = p.x;
  const beforeY = p.y;
  p.x += v.x * dtSeconds;
  p.y += v.y * dtSeconds;
  for (const obstacle of bounds.obstacles ?? []) pushCircleOut(p, radius, obstacle);
  p.x = clamp(p.x, radius, bounds.width - radius);
  p.y = clamp(p.y, radius, bounds.height - radius);
  // Blocked by a wall or the map edge: keep only the velocity actually travelled (no build-up).
  if (dtSeconds > 0) {
    v.x = (p.x - beforeX) / dtSeconds;
    v.y = (p.y - beforeY) / dtSeconds;
  }
}
