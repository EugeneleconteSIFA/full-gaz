import { secondsToTicks } from "../../config/gameConfig";
import { vec2 } from "../../core/math";
import { isAlive, type MatchState, type PlayerState } from "../../core/MatchState";
import { segmentBlocked } from "../../world/geometry";
import { applyDamage } from "./DamageSystem";
import { hitFirstEnemyAlong } from "./ProjectileSystem";
import { lobShell } from "./ShellSystem";

/**
 * Attacks along the player's aim when they hold attack and the cooldown allows (upgraded stats):
 * melee characters swing (see `swing`), ranged characters fire a projectile, lobbers throw a
 * shell (see ShellSystem).
 */
export function tryFire(state: MatchState, player: PlayerState): void {
  const stats = player.stats;
  if (!player.attackIntent || !isAlive(player) || state.tick < player.attackReadyTick) return;
  player.attackReadyTick = state.tick + secondsToTicks(stats.attackCooldown);
  if (stats.attackKind === "melee") swing(state, player);
  else if (stats.attackKind === "lob") lobShell(state, player, player.aim.x, player.aim.y);
  else fireProjectile(state, player, player.aim.x, player.aim.y);
}

/**
 * Melee swing: hits, at once, every living enemy whose body reaches into the arc in front of the
 * player (within `attackRange` of its center and `meleeArc` of the aim), unless an obstacle is in
 * between. Bodies touching the player are hit whatever the angle.
 */
export function swing(state: MatchState, player: PlayerState): void {
  const stats = player.stats;
  const halfArc = stats.meleeArc / 2;
  const { x, y } = player.position;
  for (const enemy of state.players) {
    if (enemy.teamId === player.teamId || !isAlive(enemy)) continue;
    const dx = enemy.position.x - x;
    const dy = enemy.position.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance > stats.attackRange + enemy.stats.radius) continue;
    const touching = distance <= stats.radius + enemy.stats.radius;
    if (!touching) {
      const angle = Math.acos(
        Math.max(-1, Math.min(1, (dx * player.aim.x + dy * player.aim.y) / distance)),
      );
      // Allow the arc to reach the edge of the enemy's body, not only its center.
      if (angle > halfArc + Math.asin(Math.min(1, enemy.stats.radius / distance))) continue;
    }
    if (segmentBlocked(state.layout.obstacles, x, y, enemy.position.x, enemy.position.y)) continue;
    applyDamage(enemy, stats.attackDamage, state.tick);
  }
}

/**
 * Fires a projectile along the unit direction (dx, dy). It spawns just outside the shooter's body;
 * an enemy already between the shooter and that point (point-blank) is hit immediately.
 */
export function fireProjectile(
  state: MatchState,
  player: PlayerState,
  dx: number,
  dy: number,
): void {
  const stats = player.stats;
  const offset = stats.radius + stats.projectileRadius;
  const spawnX = player.position.x + dx * offset;
  const spawnY = player.position.y + dy * offset;
  const pointBlank = hitFirstEnemyAlong(
    state,
    player.teamId,
    stats.projectileRadius,
    stats.attackDamage,
    player.position.x,
    player.position.y,
    spawnX,
    spawnY,
  );
  if (pointBlank) return;

  state.projectiles.push({
    id: state.nextEntityId++,
    ownerId: player.id,
    teamId: player.teamId,
    position: vec2(spawnX, spawnY),
    velocity: vec2(dx * stats.projectileSpeed, dy * stats.projectileSpeed),
    radius: stats.projectileRadius,
    damage: stats.attackDamage,
    remainingDistance: stats.attackRange - offset,
  });
}
