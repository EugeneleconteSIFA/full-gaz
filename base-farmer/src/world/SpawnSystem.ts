import { normalizeInto, setVec2 } from "../core/math";
import type { MatchState, PlayerState } from "../core/MatchState";
import type { MapLayout } from "./MapLayout";

/** Puts a player at their team spawn with full health (upgrades included), facing the map center. */
export function placeAtSpawn(player: PlayerState, map: MapLayout): void {
  const spawn = map.spawns[player.teamId];
  setVec2(player.position, spawn.x, spawn.y);
  normalizeInto(player.aim, map.width / 2 - spawn.x, map.height / 2 - spawn.y);
  player.hp = player.stats.maxHp;
  player.respawnAtTick = null;
  if (player.velocity) setVec2(player.velocity, 0, 0);
}

/** Brings back every dead player whose respawn timer has elapsed. */
export function respawnDuePlayers(state: MatchState): void {
  for (const player of state.players) {
    if (player.respawnAtTick !== null && state.tick >= player.respawnAtTick) {
      placeAtSpawn(player, state.layout);
    }
  }
}
