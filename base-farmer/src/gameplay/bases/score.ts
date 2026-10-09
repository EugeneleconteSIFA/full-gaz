import type { BaseState } from "../../core/MatchState";
import type { BaseOwner } from "../../core/types";

export type BaseCounts = Record<BaseOwner, number>;

export function createBaseCounts(): BaseCounts {
  return { teamA: 0, teamB: 0, neutral: 0 };
}

/** Counts bases per owner into `out` (reused to avoid allocation). This is the match score. */
export function countBases(bases: readonly BaseState[], out: BaseCounts): BaseCounts {
  out.teamA = 0;
  out.teamB = 0;
  out.neutral = 0;
  for (const base of bases) out[base.owner]++;
  return out;
}
