import type { CharacterDefinition, RelativeStats } from "../../data/characters";

export type RatedStat = keyof RelativeStats;

/** Display order on the selection screen. */
export const RATED_STATS: readonly RatedStat[] = ["hp", "speed", "range", "damage"];

/** 1–5 stars from a multiplier: 100% = 3 stars, each ±20% = one star. */
export function starsFor(multiplier: number): number {
  // Snap away float noise first: (0.7 - 1) / 0.2 is -1.5000000000000002, which must read as -1.5.
  const steps = Math.round(((multiplier - 1) / 0.2) * 1e6) / 1e6;
  return Math.min(5, Math.max(1, 3 + Math.round(steps)));
}

/**
 * The `count` stats that most define a character (furthest from 100%), in display order.
 * Ranking by the raw multiplier, not by stars, keeps a small specialty (Combattant's +5% damage)
 * visible even when every stat rounds to 3 stars.
 * The selection screen shows these instead of a full stat sheet.
 */
export function definingStats(character: CharacterDefinition, count = 3): RatedStat[] {
  const chosen = [...RATED_STATS]
    .sort((a, b) => Math.abs(character.relative[b] - 1) - Math.abs(character.relative[a] - 1))
    .slice(0, count);
  return RATED_STATS.filter((s) => chosen.includes(s));
}
