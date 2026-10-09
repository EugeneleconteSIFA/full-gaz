import { describe, expect, it } from "vitest";
import { FIXED_STEP_SECONDS, GAME_CONFIG, secondsToTicks } from "../config/gameConfig";
import { setVec2 } from "../core/math";
import type { BaseState, MatchState } from "../core/MatchState";
import { createMatchState, stepMatch } from "../core/Simulation";
import type { BaseOwner } from "../core/types";
import { getMap } from "../data/registry";
import { stepCapture } from "../gameplay/bases/CaptureSystem";
import { countBases, createBaseCounts } from "../gameplay/bases/score";
import { applyDamage } from "../gameplay/combat/DamageSystem";
import { playerAt } from "./helpers";

const { neutralizeSeconds, captureSeconds, decaySpeedFactor } = GAME_CONFIG.capture;
const CAPTURE_TICKS = secondsToTicks(captureSeconds);
const NEUTRALIZE_TICKS = secondsToTicks(neutralizeSeconds);

function base(owner: BaseOwner = "neutral"): BaseState {
  return {
    id: "b",
    resourceId: "wood",
    owner,
    captureTeam: null,
    captureProgress: 0,
    contested: false,
  };
}

function hold(b: BaseState, ticks: number, teamA: boolean, teamB: boolean): void {
  for (let i = 0; i < ticks; i++) stepCapture(b, teamA, teamB, FIXED_STEP_SECONDS);
}

describe("stepCapture", () => {
  it("takes a neutral base in exactly captureSeconds", () => {
    const b = base();
    hold(b, CAPTURE_TICKS - 1, true, false);
    expect(b.owner).toBe("neutral");
    expect(b.captureTeam).toBe("teamA");
    hold(b, 1, true, false);
    expect(b.owner).toBe("teamA");
    expect(b.captureProgress).toBe(0);
  });

  it("flips an enemy base by neutralizing it first, then capturing it", () => {
    const b = base("teamB");
    hold(b, NEUTRALIZE_TICKS, true, false);
    expect(b.owner).toBe("neutral");
    hold(b, CAPTURE_TICKS, true, false);
    expect(b.owner).toBe("teamA");
  });

  it("freezes progress while contested", () => {
    const b = base();
    hold(b, 30, true, false);
    const progress = b.captureProgress;
    hold(b, 300, true, true);
    expect(b.contested).toBe(true);
    expect(b.captureProgress).toBe(progress);
    expect(b.owner).toBe("neutral");
    hold(b, 1, true, false);
    expect(b.contested).toBe(false);
  });

  it("decays unfinished progress slowly when the zone is empty", () => {
    const b = base();
    hold(b, 30, true, false);
    const progress = b.captureProgress;
    hold(b, 10, false, false);
    const expectedLoss = (10 * FIXED_STEP_SECONDS * decaySpeedFactor) / captureSeconds;
    expect(b.captureProgress).toBeCloseTo(progress - expectedLoss);
    hold(b, 1000, false, false);
    expect(b.captureProgress).toBe(0);
    expect(b.captureTeam).toBeNull();
    expect(b.owner).toBe("neutral");
  });

  it("lets the owner alone push enemy progress back", () => {
    const b = base("teamA");
    hold(b, 30, false, true);
    expect(b.captureTeam).toBe("teamB");
    hold(b, 30, true, false);
    expect(b.captureProgress).toBe(0);
    expect(b.captureTeam).toBeNull();
    expect(b.owner).toBe("teamA");
  });

  it("makes a new attacker undo the other team's progress before building its own", () => {
    const b = base();
    hold(b, 30, true, false);
    hold(b, 29, false, true);
    expect(b.captureTeam).toBe("teamA");
    hold(b, 2, false, true);
    expect(b.captureTeam).toBe("teamB");
    hold(b, CAPTURE_TICKS, false, true);
    expect(b.owner).toBe("teamB");
  });

  it("does nothing for an owned base with only its owner present", () => {
    const b = base("teamA");
    hold(b, 100, true, false);
    expect(b).toEqual(base("teamA"));
  });
});

/** Match with "a" (team A) and "b" (team B), both parked far from every base. */
function match(): MatchState {
  return createMatchState({
    seed: 1,
    mapId: "meadow",
    players: [
      { id: "a", teamId: "teamA", characterId: "fighter" },
      { id: "b", teamId: "teamB", characterId: "fighter" },
    ],
  });
}

const center = getMap("meadow").bases[0] ?? expect.unreachable("meadow has no bases");

describe("capture in a match", () => {
  it("starts with every base neutral", () => {
    const state = match();
    expect(state.bases).toHaveLength(GAME_CONFIG.match.baseCount);
    expect(state.bases.every((b) => b.owner === "neutral")).toBe(true);
  });

  it("captures when a living player stands in the zone, edge included", () => {
    const state = match();
    setVec2(
      playerAt(state, 0).position,
      center.position.x + GAME_CONFIG.capture.radius,
      center.position.y,
    );
    for (let i = 0; i < CAPTURE_TICKS; i++) stepMatch(state, []);
    expect(state.bases[0]?.owner).toBe("teamA");
    expect(countBases(state.bases, createBaseCounts())).toEqual({ teamA: 1, teamB: 0, neutral: 6 });
  });

  it("is contested by both teams and resumes when the defender dies", () => {
    const state = match();
    setVec2(playerAt(state, 0).position, center.position.x - 1, center.position.y);
    setVec2(playerAt(state, 1).position, center.position.x + 1, center.position.y);
    for (let i = 0; i < 300; i++) stepMatch(state, []);
    expect(state.bases[0]?.contested).toBe(true);
    expect(state.bases[0]?.owner).toBe("neutral");

    applyDamage(playerAt(state, 1), 1000, state.tick);
    for (let i = 0; i < CAPTURE_TICKS; i++) stepMatch(state, []);
    expect(state.bases[0]?.contested).toBe(false);
    expect(state.bases[0]?.owner).toBe("teamA");
  });
});
