import { GAME_CONFIG, secondsToTicks } from "../config/gameConfig";
import type { GameCommand } from "../core/commands";
import { createMatchState, stepMatch } from "../core/Simulation";
import type { CharacterId, MapId, TeamId } from "../core/types";
import type { BotDifficulty } from "../data/bots";
import { BotController } from "../gameplay/bots/BotController";
import { createBotNavigation } from "../gameplay/bots/BotNavigation";
import type { MatchResult } from "../core/MatchState";

export interface SimulatedPlayer {
  readonly character: CharacterId;
  readonly difficulty: BotDifficulty;
}

export interface MatchStats {
  readonly result: MatchResult;
  /** Base lead (teamA - teamB) when the opening ends, when the endgame starts. */
  readonly leadAtOpeningEnd: number;
  readonly leadAtEndgame: number;
  /** Seconds into the match of each team's first purchase (null = never). */
  readonly firstPurchase: Readonly<Record<TeamId, number | null>>;
  readonly upgradesBought: Readonly<Record<TeamId, number>>;
  readonly resourcesEarned: Readonly<Record<TeamId, number>>;
  readonly deaths: Readonly<Record<TeamId, number>>;
  readonly captures: number;
}

/** Plays one bot-vs-bot 1v1 to the end, headless, and records balance metrics. */
export function simulateMatch(
  mapId: MapId,
  seed: number,
  a: SimulatedPlayer,
  b: SimulatedPlayer,
): MatchStats {
  const state = createMatchState({
    seed,
    mapId,
    players: [
      { id: "a", teamId: "teamA", characterId: a.character },
      { id: "b", teamId: "teamB", characterId: b.character },
    ],
  });
  const nav = createBotNavigation(state.layout);
  const bots = [
    new BotController("a", a.difficulty, seed, nav),
    new BotController("b", b.difficulty, seed, nav),
  ];
  const commands: GameCommand[] = [];
  const team = (i: number): TeamId => (i === 0 ? "teamA" : "teamB");

  const openingEnd = secondsToTicks(GAME_CONFIG.match.phases[1]?.startsAtSeconds ?? 60);
  const endgame = secondsToTicks(GAME_CONFIG.match.phases[2]?.startsAtSeconds ?? 300);
  const lead = () =>
    state.bases.reduce(
      (n, base) => n + (base.owner === "teamA" ? 1 : base.owner === "teamB" ? -1 : 0),
      0,
    );
  const firstPurchase: Record<TeamId, number | null> = { teamA: null, teamB: null };
  const deaths = { teamA: 0, teamB: 0 };
  const earned = { teamA: 0, teamB: 0 };
  let leadAtOpeningEnd = 0;
  let leadAtEndgame = 0;
  let captures = 0;
  let lastProductionTick = -1;

  while (state.result === null) {
    commands.length = 0;
    for (const bot of bots) commands.push(...bot.think(state));
    const alive = state.players.map((p) => p.respawnAtTick === null);
    const owners = state.bases.map((x) => x.owner);
    const levels = state.players.map((p) => Object.values(p.upgrades).reduce((s, v) => s + v, 0));
    stepMatch(state, commands);

    state.players.forEach((p, i) => {
      if (alive[i] && p.respawnAtTick !== null) deaths[team(i)]++;
      const now = Object.values(p.upgrades).reduce((s, v) => s + v, 0);
      if (now > (levels[i] ?? 0) && firstPurchase[team(i)] === null) {
        firstPurchase[team(i)] = state.tick / GAME_CONFIG.simulation.ticksPerSecond;
      }
    });
    state.bases.forEach((x, i) => {
      if (x.owner !== owners[i] && x.owner !== "neutral") captures++;
    });
    const last = state.lastProduction;
    if (last && last.tick !== lastProductionTick) {
      lastProductionTick = last.tick;
      earned.teamA += last.amountByTeam.teamA;
      earned.teamB += last.amountByTeam.teamB;
    }
    if (state.tick === openingEnd) leadAtOpeningEnd = lead();
    if (state.tick === endgame) leadAtEndgame = lead();
  }

  const upgrades = (i: number) =>
    Object.values(state.players[i]?.upgrades ?? {}).reduce((s, v) => s + v, 0);
  return {
    result: state.result,
    leadAtOpeningEnd,
    leadAtEndgame,
    firstPurchase,
    upgradesBought: { teamA: upgrades(0), teamB: upgrades(1) },
    resourcesEarned: earned,
    deaths,
    captures,
  };
}
