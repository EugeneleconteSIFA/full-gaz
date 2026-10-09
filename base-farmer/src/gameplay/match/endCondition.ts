import { GAME_CONFIG } from "../../config/gameConfig";
import type { BaseState, MatchResult } from "../../core/MatchState";
import type { TeamId } from "../../core/types";

function leader(a: number, b: number, tolerance: number): TeamId | null {
  if (Math.abs(a - b) <= tolerance) return null;
  return a > b ? "teamA" : "teamB";
}

/**
 * Decides the match from the bases at the final tick:
 * 1. most bases controlled;
 * 2. if tied, most unfinished capture progress (a team's progress on any base it is
 *    neutralizing or capturing at the end);
 * 3. otherwise a draw.
 */
export function computeResult(bases: readonly BaseState[]): MatchResult {
  const owned = { teamA: 0, teamB: 0 };
  const progress = { teamA: 0, teamB: 0 };
  for (const base of bases) {
    if (base.owner !== "neutral") owned[base.owner]++;
    if (base.captureTeam !== null) progress[base.captureTeam] += base.captureProgress;
  }

  const byBases = leader(owned.teamA, owned.teamB, 0);
  if (byBases)
    return { winner: byBases, decidedBy: "bases", bases: owned, captureProgress: progress };

  const byProgress = leader(progress.teamA, progress.teamB, GAME_CONFIG.match.progressTieTolerance);
  if (byProgress) {
    return {
      winner: byProgress,
      decidedBy: "captureProgress",
      bases: owned,
      captureProgress: progress,
    };
  }

  return { winner: "draw", decidedBy: "draw", bases: owned, captureProgress: progress };
}
