import { describe, expect, it } from "vitest";
import { GAME_CONFIG, secondsToTicks } from "../config/gameConfig";
import { resultReason } from "../config/strings";
import { parseStartAtSeconds } from "../core/debugParams";
import { setVec2 } from "../core/math";
import type { BaseState } from "../core/MatchState";
import { createMatchState, stepMatch, type MatchSetup } from "../core/Simulation";
import type { BaseOwner, TeamId } from "../core/types";
import { computeResult } from "../gameplay/match/endCondition";
import {
  findPhaseErrors,
  formatClock,
  phaseAt,
  secondsRemaining,
} from "../gameplay/match/matchClock";
import { playerAt } from "./helpers";

const DURATION_TICKS = secondsToTicks(GAME_CONFIG.match.durationSeconds);

describe("match clock", () => {
  it("follows the rules' phase schedule", () => {
    expect(phaseAt(0).id).toBe("opening");
    expect(phaseAt(secondsToTicks(60) - 1).id).toBe("opening");
    expect(phaseAt(secondsToTicks(60)).id).toBe("development");
    expect(phaseAt(secondsToTicks(300) - 1).id).toBe("development");
    expect(phaseAt(secondsToTicks(300)).id).toBe("endgame");
    expect(phaseAt(DURATION_TICKS - 1).id).toBe("endgame");
  });

  it("has no production in the opening, every 60 s then every 30 s (D055)", () => {
    expect(phaseAt(0).productionIntervalSeconds).toBeNull();
    expect(phaseAt(secondsToTicks(61)).productionIntervalSeconds).toBe(60);
    expect(phaseAt(secondsToTicks(301)).productionIntervalSeconds).toBe(30);
  });

  it("counts down in whole seconds, rounded up", () => {
    expect(secondsRemaining(0, DURATION_TICKS)).toBe(420);
    expect(secondsRemaining(1, DURATION_TICKS)).toBe(420);
    expect(secondsRemaining(DURATION_TICKS - 1, DURATION_TICKS)).toBe(1);
    expect(secondsRemaining(DURATION_TICKS, DURATION_TICKS)).toBe(0);
    expect(secondsRemaining(DURATION_TICKS + 50, DURATION_TICKS)).toBe(0);
  });

  it("formats m:ss", () => {
    expect(formatClock(420)).toBe("7:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(9)).toBe("0:09");
  });

  it("rejects broken phase schedules", () => {
    const ok = GAME_CONFIG.match.phases;
    expect(findPhaseErrors(ok, 420)).toEqual([]);
    expect(findPhaseErrors(ok.slice(1), 420)).toContain("The first phase must start at 0 s");
    expect(
      findPhaseErrors(
        [ok[0], ok[2], ok[1]].filter((p) => p !== undefined),
        420,
      ),
    ).toContain('Phase "development" must start after "endgame"');
    expect(findPhaseErrors(ok, 200)).toContain('Phase "endgame" starts after the match ends');
  });
});

function base(owner: BaseOwner, captureTeam: TeamId | null = null, progress = 0): BaseState {
  return {
    id: "b",
    resourceId: "wood",
    owner,
    captureTeam,
    captureProgress: progress,
    contested: false,
  };
}

describe("computeResult", () => {
  it("is won by the team with the most bases", () => {
    const result = computeResult([
      base("teamA"),
      base("teamA"),
      base("teamB"),
      base("neutral", "teamB", 0.9),
    ]);
    expect(result.winner).toBe("teamA");
    expect(result.decidedBy).toBe("bases");
    expect(result.bases).toEqual({ teamA: 2, teamB: 1 });
  });

  it("breaks a base tie with unfinished capture progress", () => {
    const result = computeResult([
      base("teamA"),
      base("teamB", "teamA", 0.3),
      base("neutral", "teamB", 0.5),
    ]);
    expect(result.winner).toBe("teamB");
    expect(result.decidedBy).toBe("captureProgress");
    expect(result.captureProgress).toEqual({ teamA: 0.3, teamB: 0.5 });
  });

  it("is a draw when bases and progress are equal", () => {
    const result = computeResult([base("teamA"), base("teamB"), base("neutral")]);
    expect(result.winner).toBe("draw");
    expect(result.decidedBy).toBe("draw");
  });

  it("treats near-equal progress (float noise) as equal", () => {
    const result = computeResult([
      base("neutral", "teamA", 0.1 + 0.2),
      base("neutral", "teamB", 0.3),
    ]);
    expect(result.winner).toBe("draw");
  });
});

describe("resultReason", () => {
  it("explains the result from the local team's side", () => {
    const win = computeResult([base("teamA"), base("teamA"), base("teamB")]);
    expect(resultReason(win, "teamA")).toBe("2 bases contre 1");
    expect(resultReason(win, "teamB")).toBe("1 base contre 2");
    const tie = computeResult([base("teamA"), base("teamB"), base("neutral", "teamA", 0.5)]);
    expect(resultReason(tie, "teamA")).toBe(
      "Égalité 1–1 en bases, départagée par la capture en cours",
    );
  });
});

const setup: MatchSetup = {
  seed: 3,
  mapId: "meadow",
  players: [
    { id: "a", teamId: "teamA", characterId: "fighter" },
    { id: "b", teamId: "teamB", characterId: "fighter" },
  ],
};

describe("end of match", () => {
  it("ends exactly at 7:00 and records the result", () => {
    const state = createMatchState(setup);
    for (let i = 0; i < DURATION_TICKS - 1; i++) stepMatch(state, []);
    expect(state.result).toBeNull();
    stepMatch(state, []);
    expect(state.tick).toBe(DURATION_TICKS);
    expect(state.result).toEqual({
      winner: "draw",
      decidedBy: "draw",
      bases: { teamA: 0, teamB: 0 },
      captureProgress: { teamA: 0, teamB: 0 },
    });
  });

  it("freezes the simulation after the end", () => {
    const state = createMatchState({ ...setup, startAtSeconds: 419 });
    for (let i = 0; i < 60; i++) stepMatch(state, []);
    expect(state.result).not.toBeNull();
    const frozen = JSON.stringify(state);
    stepMatch(state, [{ type: "move", playerId: "a", vector: { x: 1, y: 0 } }]);
    stepMatch(state, [{ type: "attack", playerId: "a", active: true }]);
    expect(JSON.stringify(state)).toBe(frozen);
  });

  it("counts a base captured on the final tick", () => {
    const state = createMatchState({ ...setup, startAtSeconds: 418 });
    const center = state.bases[0];
    setVec2(playerAt(state, 0).position, 24, 16);
    for (let i = 0; i < 120; i++) stepMatch(state, []);
    expect(center?.owner).toBe("teamA");
    expect(state.result?.winner).toBe("teamA");
    expect(state.result?.bases.teamA).toBe(1);
  });

  it("validates the debug start time", () => {
    expect(() => createMatchState({ ...setup, startAtSeconds: 420 })).toThrow();
    expect(() => createMatchState({ ...setup, startAtSeconds: -1 })).toThrow();
    expect(createMatchState({ ...setup, startAtSeconds: 300 }).tick).toBe(secondsToTicks(300));
  });
});

describe("parseStartAtSeconds", () => {
  it("reads ?skip= and fails loudly on bad values", () => {
    expect(parseStartAtSeconds("")).toBe(0);
    expect(parseStartAtSeconds("?skip=290")).toBe(290);
    expect(() => parseStartAtSeconds("?skip=abc")).toThrow();
    expect(() => parseStartAtSeconds("?skip=-5")).toThrow();
  });
});
