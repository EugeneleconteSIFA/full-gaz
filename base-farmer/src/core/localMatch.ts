import type { BotDifficulty } from "../data/bots";
import { CHARACTERS } from "../data/characters";
import { MAPS } from "../data/maps";
import { createRng, nextInt } from "./Random";
import type { MatchSetup } from "./Simulation";
import type { CharacterId, MapId, PlayerId } from "./types";

/** What the player picked on the selection screen. */
export type MapChoice = MapId | "random";

/** Who plays team B: a bot of some difficulty, or (dev only) the passive training dummy. */
export type OpponentChoice = BotDifficulty | "dummy";

export const LOCAL_PLAYER_ID: PlayerId = "p1";
export const OPPONENT_PLAYER_ID: PlayerId = "p2";

/** Offsets the seed so picking the opponent's character never shifts the match RNG sequence. */
const OPPONENT_SEED_SALT = 0x9e3779b9;
const MAP_SEED_SALT = 0xc2b2ae35;

/** "Aléatoire": the map is drawn from the seed, so a seed always replays the same map. */
export function resolveMapChoice(choice: MapChoice, seed: number): MapId {
  if (choice !== "random") return choice;
  const picked = MAPS[nextInt(createRng((seed ^ MAP_SEED_SALT) >>> 0), 0, MAPS.length)];
  if (!picked) throw new Error("No maps defined");
  return picked.id;
}

/** The opponent's character: drawn from the seed, so a seed always replays the same matchup. */
export function pickOpponentCharacter(seed: number): CharacterId {
  const rng = createRng((seed ^ OPPONENT_SEED_SALT) >>> 0);
  const picked = CHARACTERS[nextInt(rng, 0, CHARACTERS.length)];
  if (!picked) throw new Error("No characters defined");
  return picked.id;
}

/** 1v1 local match: the player (team A) against the opponent (team B). */
export function buildLocalMatchSetup(
  seed: number,
  characterId: CharacterId,
  mapChoice: MapChoice = "random",
  startAtSeconds = 0,
): MatchSetup {
  return {
    seed,
    mapId: resolveMapChoice(mapChoice, seed),
    startAtSeconds,
    players: [
      { id: LOCAL_PLAYER_ID, teamId: "teamA", characterId },
      { id: OPPONENT_PLAYER_ID, teamId: "teamB", characterId: pickOpponentCharacter(seed) },
    ],
  };
}
