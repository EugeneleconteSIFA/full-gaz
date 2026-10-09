import { GAME_CONFIG } from "../config/gameConfig";
import { CHARACTERS } from "./characters";
import { MAPS } from "./maps";
import { RESOURCES } from "./resources";
import { UPGRADE_LEVEL_COSTS, UPGRADES } from "./upgrades";
import type { GameData } from "./validateGameData";

/** Everything validated at startup. */
export const GAME_DATA: GameData = {
  characters: CHARACTERS,
  maps: MAPS,
  resources: RESOURCES,
  upgrades: UPGRADES,
  upgradeLevelCosts: UPGRADE_LEVEL_COSTS,
  phases: GAME_CONFIG.match.phases,
  matchDurationSeconds: GAME_CONFIG.match.durationSeconds,
};
