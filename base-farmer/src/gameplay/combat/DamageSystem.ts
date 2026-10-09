import { GAME_CONFIG, secondsToTicks } from "../../config/gameConfig";
import { isAlive, type PlayerState } from "../../core/MatchState";
import { getCharacter } from "../../data/registry";

/**
 * Applies damage to a living player. At 0 HP the player leaves the field until the respawn
 * delay elapses. Death keeps resources, per the gameplay rules. A guarding
 * player (guard ability) takes only a fraction of the damage.
 * Returns true if this hit killed the player.
 */
export function applyDamage(player: PlayerState, amount: number, tick: number): boolean {
  if (!isAlive(player)) return false;
  if (!(amount > 0)) throw new Error(`Damage must be > 0, got ${amount}`);

  if (tick < player.guardUntilTick) amount *= guardDamageFactor(player);
  player.hp = Math.max(0, player.hp - amount);
  if (player.hp > 0) return false;

  player.respawnAtTick = tick + secondsToTicks(GAME_CONFIG.combat.respawnDelaySeconds);
  player.attackIntent = false;
  player.abilityIntent = false;
  player.guardUntilTick = 0;
  return true;
}

function guardDamageFactor(player: PlayerState): number {
  const ability = getCharacter(player.characterId).ability;
  return ability.kind === "guard" ? ability.damageTakenFactor : 1;
}
