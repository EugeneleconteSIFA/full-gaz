import { vec2 } from "../core/math";
import type { MatchState, PlayerState } from "../core/MatchState";
import { createWallet } from "../gameplay/resources/ProductionSystem";
import { computeStats, createUpgradeLevels } from "../gameplay/upgrades/UpgradeSystem";
import { getCharacter } from "../data/registry";

/**
 * Removes every obstacle from a match's layout: combat tests need an open field whatever the
 * maps' current design (D060 added cover in the middle of the Prairie).
 */
export function clearObstacles(state: MatchState): MatchState {
  (state.layout.obstacles as unknown[]).length = 0;
  return state;
}

export function playerAt(state: MatchState, index: number): PlayerState {
  const player = state.players[index];
  if (!player) throw new Error(`No player at index ${index}`);
  return player;
}

export function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: "p",
    teamId: "teamA",
    characterId: "fighter",
    position: vec2(5, 5),
    aim: vec2(1, 0),
    aimDistance: null,
    moveIntent: vec2(),
    attackIntent: false,
    hp: 100,
    attackReadyTick: 0,
    abilityIntent: false,
    abilityReadyTick: 0,
    guardUntilTick: 0,
    respawnAtTick: null,
    resources: createWallet(),
    upgrades: createUpgradeLevels(),
    stats: computeStats(getCharacter("fighter"), createUpgradeLevels()),
    ...overrides,
  };
}
