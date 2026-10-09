import { it } from "vitest";
import { CHARACTERS } from "../data/characters";
import { MAPS } from "../data/maps";
import { simulateMatch, type MatchStats } from "./simulateMatch";

/**
 * Per-map balance report, to compare map designs (bot vs bot, Normal):
 *   MAP=<id> BALANCE_SEEDS=<n> npx vitest run --config vitest.balance.config.ts mapReport.run
 * Not part of `npm test`.
 */
it("map report", () => {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  const seeds = Number(env?.BALANCE_SEEDS ?? 4);
  const only = env?.MAP;
  const ids = CHARACTERS.map((c) => c.id);
  const pct = (n: number, d: number) => (d === 0 ? "-" : `${Math.round((100 * n) / d)}%`);
  const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;
  const lines: string[] = [];
  for (const map of MAPS.filter((m) => !only || m.id === only)) {
    const all: MatchStats[] = [];
    const won = new Map<string, number>();
    const played = new Map<string, number>();
    let seed = 5000;
    for (const x of ids) {
      for (const y of ids) {
        if (x === y) continue;
        for (let k = 0; k < seeds; k++) {
          const xIsA = k % 2 === 0;
          const s = simulateMatch(
            map.id,
            seed++,
            { character: xIsA ? x : y, difficulty: "normal" },
            { character: xIsA ? y : x, difficulty: "normal" },
          );
          all.push(s);
          played.set(x, (played.get(x) ?? 0) + 1);
          if (s.result.winner === (xIsA ? "teamA" : "teamB")) won.set(x, (won.get(x) ?? 0) + 1);
        }
      }
    }
    const decided = all.filter((s) => s.result.winner !== "draw");
    const lead = (f: (s: MatchStats) => number) => {
      const w = decided.filter((s) => f(s) !== 0);
      return pct(w.filter((s) => f(s) > 0 === (s.result.winner === "teamA")).length, w.length);
    };
    lines.push(
      `${map.id}: ${ids.map((x) => `${x} ${pct(won.get(x) ?? 0, played.get(x) ?? 0)}`).join(" · ")}` +
        ` | lead@1:00 wins ${lead((s) => s.leadAtOpeningEnd)} · lead@5:00 wins ${lead((s) => s.leadAtEndgame)}` +
        ` | draws ${pct(all.length - decided.length, all.length)}` +
        ` | captures ${median(all.map((s) => s.captures))} · deaths ${median(all.flatMap((s) => [s.deaths.teamA, s.deaths.teamB]))}` +
        ` · final bases ${median(all.map((s) => s.result.bases.teamA + s.result.bases.teamB))}`,
    );
  }
  console.log(lines.join("\n"));
}, 900_000);
