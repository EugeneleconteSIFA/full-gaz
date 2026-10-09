import { secondsToTicks } from "../../config/gameConfig";
import { clamp, EPSILON } from "../../core/math";
import { isAlive, type MatchState, type PlayerState } from "../../core/MatchState";
import {
  ABILITY_TUNING,
  type DashAbility,
  type SpinAbility,
  type VolleyAbility,
} from "../../data/abilities";
import { getCharacter } from "../../data/registry";
import type { MapLayout } from "../../world/MapLayout";
import { pushCircleOut, segmentBlocked } from "../../world/geometry";
import { fireProjectile } from "../combat/CombatSystem";
import { lobShell } from "../combat/ShellSystem";
import { applyDamage } from "../combat/DamageSystem";

/**
 * Uses the player's ability when they hold the ability button and its cooldown allows. Every
 * effect is instant except the guard, which lasts `durationSeconds` (see applyDamage).
 */
export function tryUseAbility(state: MatchState, player: PlayerState): void {
  if (!player.abilityIntent || !isAlive(player) || state.tick < player.abilityReadyTick) return;
  const ability = getCharacter(player.characterId).ability;
  player.abilityReadyTick = state.tick + secondsToTicks(ability.cooldownSeconds);
  switch (ability.kind) {
    case "guard":
      player.guardUntilTick = state.tick + secondsToTicks(ability.durationSeconds);
      return;
    case "dash":
      dash(state, player, ability);
      return;
    case "volley":
      volley(state, player, ability);
      return;
    case "spin":
      spin(state, player, ability);
      return;
    case "bombard":
      lobShell(
        state,
        player,
        player.aim.x,
        player.aim.y,
        ability.damageFactor,
        ability.splashFactor,
      );
      return;
  }
}

/** Seconds left before the ability is ready again (0 = ready). For the HUD and bots. */
export function abilityCooldownLeft(state: MatchState, player: PlayerState): number {
  return Math.max(0, player.abilityReadyTick - state.tick) / secondsToTicks(1);
}

export function isGuarding(state: MatchState, player: PlayerState): boolean {
  return state.tick < player.guardUntilTick;
}

/** Leaps along the movement direction, or the aim when standing still. */
function dash(state: MatchState, player: PlayerState, ability: DashAbility): void {
  const intent = player.moveIntent;
  const moving = Math.hypot(intent.x, intent.y) > EPSILON;
  const dx = moving ? intent.x : player.aim.x;
  const dy = moving ? intent.y : player.aim.y;
  displace(player, dx, dy, ability.distance, state.layout);
}

/** Fires `projectiles` shots spread evenly across the fan, centered on the aim. */
function volley(state: MatchState, player: PlayerState, ability: VolleyAbility): void {
  const center = Math.atan2(player.aim.y, player.aim.x);
  const spread = (ability.spreadDegrees * Math.PI) / 180;
  const n = ability.projectiles;
  for (let i = 0; i < n; i++) {
    const angle = n === 1 ? center : center - spread / 2 + (spread * i) / (n - 1);
    fireProjectile(state, player, Math.cos(angle), Math.sin(angle));
  }
}

/**
 * Hits every living enemy within reach all around (walls block it), then throws the survivors
 * straight away from the player.
 */
function spin(state: MatchState, player: PlayerState, ability: SpinAbility): void {
  const reach = player.stats.attackRange * ability.rangeFactor;
  const damage = player.stats.attackDamage * ability.damageFactor;
  const { x, y } = player.position;
  for (const enemy of state.players) {
    if (enemy.teamId === player.teamId || !isAlive(enemy)) continue;
    const dx = enemy.position.x - x;
    const dy = enemy.position.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance > reach + enemy.stats.radius) continue;
    if (segmentBlocked(state.layout.obstacles, x, y, enemy.position.x, enemy.position.y)) continue;
    const killed = applyDamage(enemy, damage, state.tick);
    if (killed) continue;
    // Bodies exactly on top of each other: push along the player's aim.
    const away = distance > EPSILON;
    displace(
      enemy,
      away ? dx / distance : player.aim.x,
      away ? dy / distance : player.aim.y,
      ability.knockback,
      state.layout,
    );
  }
}

/**
 * Moves a body up to `distance` along the unit direction (dx, dy), in short steps that slide it
 * out of obstacles and keep it on the map, like walking. Stops at the first step a wall or the
 * map edge blocks, so it never passes through anything.
 */
export function displace(
  player: PlayerState,
  dx: number,
  dy: number,
  distance: number,
  layout: Pick<MapLayout, "width" | "height" | "obstacles">,
): void {
  const length = Math.hypot(dx, dy);
  if (length < EPSILON) return;
  const ux = dx / length;
  const uy = dy / length;
  const r = player.stats.radius;
  const p = player.position;
  const step = ABILITY_TUNING.displacementStep;
  for (let travelled = 0; travelled < distance - EPSILON;) {
    const s = Math.min(step, distance - travelled);
    const beforeX = p.x;
    const beforeY = p.y;
    p.x += ux * s;
    p.y += uy * s;
    for (const obstacle of layout.obstacles) pushCircleOut(p, r, obstacle);
    p.x = clamp(p.x, r, layout.width - r);
    p.y = clamp(p.y, r, layout.height - r);
    travelled += s;
    // Progress along the direction fell well short of the step: blocked.
    if ((p.x - beforeX) * ux + (p.y - beforeY) * uy < s * 0.5) return;
  }
}
