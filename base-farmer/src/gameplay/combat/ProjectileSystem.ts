import { isAlive, type MatchState } from "../../core/MatchState";
import type { TeamId } from "../../core/types";
import { circleOverlapsObstacle } from "../../world/geometry";
import { applyDamage } from "./DamageSystem";

/** Squared distance from (px, py) to the segment a→b. */
function segmentDistanceSq(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const cx = ax + dx * t - px;
  const cy = ay + dy * t - py;
  return cx * cx + cy * cy;
}

/**
 * Damages the first living enemy of `teamId` touched by a shot of `radius` sweeping a→b
 * (closest to a wins). Testing the whole sweep, not just the end point, means a shot cannot
 * jump over a body in one tick, even point-blank. Returns whether someone was hit.
 */
export function hitFirstEnemyAlong(
  state: MatchState,
  teamId: TeamId,
  radius: number,
  damage: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  let target = null;
  let closest = Infinity;
  for (const player of state.players) {
    if (player.teamId === teamId || !isAlive(player)) continue;
    const reach = player.stats.radius + radius;
    const { x, y } = player.position;
    if (segmentDistanceSq(ax, ay, bx, by, x, y) > reach * reach) continue;
    const fromStart = (x - ax) ** 2 + (y - ay) ** 2;
    if (fromStart < closest) {
      closest = fromStart;
      target = player;
    }
  }
  if (!target) return false;
  applyDamage(target, damage, state.tick);
  return true;
}

/**
 * Moves every projectile one tick. A projectile is removed when it hits an enemy, reaches its
 * range, leaves the map or hits an obstacle. Obstacles are thicker than one tick of travel
 * (validated), so a shot that reaches a wall cannot hit anyone behind it. Each projectile damages
 * at most one player.
 */
export function updateProjectiles(state: MatchState, dtSeconds: number): void {
  const map = state.layout;
  const projectiles = state.projectiles;
  let kept = 0;

  for (const projectile of projectiles) {
    const step = Math.min(
      Math.hypot(projectile.velocity.x, projectile.velocity.y) * dtSeconds,
      projectile.remainingDistance,
    );
    const scale = step / Math.hypot(projectile.velocity.x, projectile.velocity.y);
    const fromX = projectile.position.x;
    const fromY = projectile.position.y;
    projectile.position.x += projectile.velocity.x * scale;
    projectile.position.y += projectile.velocity.y * scale;
    projectile.remainingDistance -= step;

    const p = projectile.position;
    const hit = hitFirstEnemyAlong(
      state,
      projectile.teamId,
      projectile.radius,
      projectile.damage,
      fromX,
      fromY,
      p.x,
      p.y,
    );
    if (hit) continue;
    const outside = p.x < 0 || p.y < 0 || p.x > map.width || p.y > map.height;
    let blocked = outside;
    for (const o of map.obstacles) {
      if (blocked) break;
      blocked = circleOverlapsObstacle(p.x, p.y, projectile.radius, o);
    }
    if (!blocked && projectile.remainingDistance > 0) projectiles[kept++] = projectile;
  }

  // Compact in place: no new array per tick.
  projectiles.length = kept;
}
