import { CHARACTERS } from "../data/characters";
import { MAPS } from "../data/maps";
import { simulateMatch, type MatchStats } from "./simulateMatch";

const median = (values: number[]) => {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted.length ? (sorted[Math.floor(sorted.length / 2)] ?? NaN) : NaN;
};
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "-");

/**
 * Bot-vs-bot tournament (Normal vs Normal): every character pair on every map, sides alternated,
 * `seedsPerPair` seeds each. Prints the metrics docs/08_BALANCING_NOTES.md asks about.
 */
export function balanceReport(seedsPerPair: number): string {
  const ids = CHARACTERS.map((c) => c.id);
  const wins = new Map<string, number>();
  const games = new Map<string, number>();
  const all: MatchStats[] = [];
  let sideAWins = 0;
  let mirrorDecided = 0;
  let seed = 1000;

  for (const map of MAPS) {
    for (const x of ids) {
      for (const y of ids) {
        for (let k = 0; k < seedsPerPair; k++) {
          const xIsA = k % 2 === 0;
          const a = { character: xIsA ? x : y, difficulty: "normal" as const };
          const b = { character: xIsA ? y : x, difficulty: "normal" as const };
          const stats = simulateMatch(map.id, seed++, a, b);
          all.push(stats);
          const winner = stats.result.winner;
          if (x === y) {
            if (winner !== "draw") {
              mirrorDecided++;
              if (winner === "teamA") sideAWins++;
            }
            continue;
          }
          const key = `${x}|${y}`;
          games.set(key, (games.get(key) ?? 0) + 1);
          const xWon = winner === (xIsA ? "teamA" : "teamB");
          if (xWon) wins.set(key, (wins.get(key) ?? 0) + 1);
          wins.set(`${map.id}:${x}`, (wins.get(`${map.id}:${x}`) ?? 0) + (xWon ? 1 : 0));
          games.set(`${map.id}:${x}`, (games.get(`${map.id}:${x}`) ?? 0) + 1);
        }
      }
    }
  }

  const lines: string[] = [];
  lines.push(`Matches: ${all.length} (Normal vs Normal, ${seedsPerPair} seeds per pair and map)`);
  lines.push("");
  lines.push("Win rate of the row character against the column character (all maps):");
  lines.push(["", ...ids].map((s) => s.padEnd(9)).join(""));
  for (const x of ids) {
    const row = ids.map((y) =>
      x === y ? "-" : pct(wins.get(`${x}|${y}`) ?? 0, games.get(`${x}|${y}`) ?? 0),
    );
    lines.push([x, ...row].map((s) => s.padEnd(9)).join(""));
  }
  lines.push("");
  lines.push("Overall win rate per character and map (non-mirror):");
  for (const x of ids) {
    const perMap = MAPS.map(
      (m) => `${m.id} ${pct(wins.get(`${m.id}:${x}`) ?? 0, games.get(`${m.id}:${x}`) ?? 0)}`,
    );
    const total = MAPS.reduce((s, m) => s + (wins.get(`${m.id}:${x}`) ?? 0), 0);
    const totalGames = MAPS.reduce((s, m) => s + (games.get(`${m.id}:${x}`) ?? 0), 0);
    lines.push(`  ${x.padEnd(8)} ${pct(total, totalGames).padEnd(5)} (${perMap.join(", ")})`);
  }

  const draws = all.filter((s) => s.result.winner === "draw").length;
  const tieBreaks = all.filter((s) => s.result.decidedBy === "captureProgress").length;
  const decided = all.filter((s) => s.result.winner !== "draw");
  const leaderWins = (leadOf: (s: MatchStats) => number) => {
    const withLead = decided.filter((s) => leadOf(s) !== 0);
    const won = withLead.filter((s) => leadOf(s) > 0 === (s.result.winner === "teamA")).length;
    return `${pct(won, withLead.length)} of ${withLead.length}`;
  };
  const firstPurchases = all.flatMap((s) => [s.firstPurchase.teamA, s.firstPurchase.teamB]);
  const never = firstPurchases.filter((v) => v === null).length;
  lines.push("");
  lines.push(
    `Side bias (mirror matches, team A wins): ${pct(sideAWins, mirrorDecided)} of ${mirrorDecided} decided`,
  );
  lines.push(
    `Draws: ${pct(draws, all.length)} · decided by the capture tie-breaker: ${pct(tieBreaks, all.length)}`,
  );
  lines.push(`Snowball — leader at 1:00 wins: ${leaderWins((s) => s.leadAtOpeningEnd)}`);
  lines.push(`Comeback check — leader at 5:00 wins: ${leaderWins((s) => s.leadAtEndgame)}`);
  lines.push(
    `First purchase: median ${median(firstPurchases.filter((v): v is number => v !== null)).toFixed(0)} s, never ${pct(never, firstPurchases.length)}`,
  );
  lines.push(
    `Per player and match: resources ${median(all.flatMap((s) => [s.resourcesEarned.teamA, s.resourcesEarned.teamB]))}, upgrade levels ${median(all.flatMap((s) => [s.upgradesBought.teamA, s.upgradesBought.teamB]))}, deaths ${median(all.flatMap((s) => [s.deaths.teamA, s.deaths.teamB]))}`,
  );
  lines.push(`Captures per match: median ${median(all.map((s) => s.captures))}`);
  lines.push(
    `Final bases per match (both teams): median ${median(all.map((s) => s.result.bases.teamA + s.result.bases.teamB))}`,
  );
  return lines.join("\n");
}
