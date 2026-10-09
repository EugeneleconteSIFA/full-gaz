import { secondsToTicks } from "../../config/gameConfig";
import { clamp, vec2 } from "../../core/math";
import { isAlive, type MatchState, type PlayerState } from "../../core/MatchState";
import { applyDamage } from "./DamageSystem";

/**
 * Throws a shell along the unit direction (dx, dy) onto the spot the player aims at
 * (`aimDistance`, kept between the lob's min range and the attack range, and on the map). It flies
 * over walls and bodies: nothing stops it before it lands (see updateShells).
 */
export function lobShell(
  state: MatchState,
  player: PlayerState,
  dx: number,
  dy: number,
  damageFactor = 1,
  splashFactor = 1,
): void {
  const stats = player.stats;
  const distance = clamp(
    player.aimDistance ?? stats.attackRange,
    stats.lobMinRange,
    stats.attackRange,
  );
  const { x, y } = player.position;
  const map = state.layout;
  state.shells.push({
    id: state.nextEntityId++,
    ownerId: player.id,
    teamId: player.teamId,
    from: vec2(x, y),
    to: vec2(clamp(x + dx * distance, 0, map.width), clamp(y + dy * distance, 0, map.height)),
    launchTick: state.tick,
    landTick: state.tick + Math.max(1, secondsToTicks(stats.lobFlightSeconds)),
    damage: Math.round(stats.attackDamage * damageFactor),
    splashRadius: stats.splashRadius * splashFactor,
  });
}

/**
 * Lands the shells due this tick: each one hurts every living enemy whose body is within its
 * splash radius of the landing spot (walls do not shelter: the blast comes from above).
 */
export function updateShells(state: MatchState): void {
  const shells = state.shells;
  let kept = 0;
  for (const shell of shells) {
    if (state.tick < shell.landTick) {
      shells[kept++] = shell;
      continue;
    }
    for (const enemy of state.players) {
      if (enemy.teamId === shell.teamId || !isAlive(enemy)) continue;
      const reach = shell.splashRadius + enemy.stats.radius;
      const dx = enemy.position.x - shell.to.x;
      const dy = enemy.position.y - shell.to.y;
      if (dx * dx + dy * dy <= reach * reach) applyDamage(enemy, shell.damage, state.tick);
    }
  }
  // Compact in place: no new array per tick.
  shells.length = kept;
}
