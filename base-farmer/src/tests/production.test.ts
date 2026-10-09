import { describe, expect, it } from "vitest";
import { GAME_CONFIG, secondsToTicks } from "../config/gameConfig";
import type { MatchState } from "../core/MatchState";
import { createRng } from "../core/Random";
import { createMatchState, stepMatch, type MatchSetup } from "../core/Simulation";
import { RESOURCE_IDS, type ResourceId } from "../core/types";
import { applyDamage } from "../gameplay/combat/DamageSystem";
import {
  buildProductionTicks,
  drawBaseResources,
  drawFromBag,
  runProduction,
} from "../gameplay/resources/ProductionSystem";
import { playerAt } from "./helpers";

const { phases, durationSeconds } = GAME_CONFIG.match;

describe("production schedule", () => {
  it("produces every minute in development and every 30 s in the endgame, never at 7:00", () => {
    const seconds = buildProductionTicks(phases, durationSeconds).map(
      (t) => t / GAME_CONFIG.simulation.ticksPerSecond,
    );
    expect(seconds).toEqual([60, 120, 180, 240, 300, 330, 360, 390]);
  });
});

describe("shuffle bag", () => {
  it("draws every resource once per bag", () => {
    const sequence = drawFromBag(createRng(9), RESOURCE_IDS, 15);
    for (let bag = 0; bag < 3; bag++) {
      expect([...sequence.slice(bag * 5, bag * 5 + 5)].sort()).toEqual([...RESOURCE_IDS].sort());
    }
  });

  it("is deterministic per seed and varies between seeds", () => {
    expect(drawFromBag(createRng(1), RESOURCE_IDS, 8)).toEqual(
      drawFromBag(createRng(1), RESOURCE_IDS, 8),
    );
    const orders = new Set(
      Array.from({ length: 20 }, (_, s) => drawFromBag(createRng(s), RESOURCE_IDS, 5).join()),
    );
    expect(orders.size).toBeGreaterThan(5);
  });

  it("truncates the last bag to the requested count", () => {
    expect(drawFromBag(createRng(2), RESOURCE_IDS, 8)).toHaveLength(8);
  });
});

describe("base resources", () => {
  it("draws one valid resource per base, deterministically", () => {
    const a = drawBaseResources(createRng(5), RESOURCE_IDS, 7);
    expect(a).toHaveLength(7);
    expect(a.every((r) => RESOURCE_IDS.includes(r))).toBe(true);
    expect(drawBaseResources(createRng(5), RESOURCE_IDS, 7)).toEqual(a);
  });
});

const setup: MatchSetup = {
  seed: 11,
  mapId: "meadow",
  players: [
    { id: "a1", teamId: "teamA", characterId: "fighter" },
    { id: "a2", teamId: "teamA", characterId: "fighter" },
    { id: "b1", teamId: "teamB", characterId: "fighter" },
  ],
};

/** Forces the next event to `resource` and gives bases to owners, by index. */
function prepare(
  state: MatchState,
  resource: ResourceId,
  owners: Record<number, "teamA" | "teamB">,
) {
  const event = state.productionPlan[state.nextProductionIndex];
  if (!event) throw new Error("no event left");
  (state.productionPlan as { tick: number; resourceId: ResourceId }[])[state.nextProductionIndex] =
    {
      tick: state.tick,
      resourceId: resource,
    };
  state.bases.forEach((base, i) => {
    (base as { resourceId: ResourceId }).resourceId = i < 3 ? "wood" : "stone";
    base.owner = owners[i] ?? "neutral";
  });
}

describe("runProduction (D055)", () => {
  it("pays every controlled base x1 of its resource, and the featured resource x3", () => {
    const state = createMatchState(setup);
    // Bases 0-2 produce wood, the others stone. Featured: wood.
    prepare(state, "wood", { 0: "teamA", 1: "teamA", 2: "teamB", 3: "teamA", 4: "teamB" });
    runProduction(state);
    // Team A: 2 wood bases x3 + 1 stone base x1, for each of its players.
    expect(playerAt(state, 0).resources.wood).toBe(6);
    expect(playerAt(state, 0).resources.stone).toBe(1);
    expect(playerAt(state, 1).resources.wood).toBe(6);
    // Team B: 1 wood base x3 + 1 stone base x1.
    expect(playerAt(state, 2).resources.wood).toBe(3);
    expect(playerAt(state, 2).resources.stone).toBe(1);
    expect(state.lastProduction?.amountByTeam).toEqual({ teamA: 7, teamB: 4 });
    expect(state.lastProduction?.gainsByTeam.teamA.wood).toBe(6);
  });

  it("still pays x1 when nobody owns a featured base", () => {
    const state = createMatchState(setup);
    prepare(state, "metal", { 3: "teamA" });
    runProduction(state);
    expect(playerAt(state, 0).resources.stone).toBe(1);
    expect(playerAt(state, 0).resources.metal).toBe(0);
    expect(state.lastProduction?.amountByTeam).toEqual({ teamA: 1, teamB: 0 });
  });

  it("gives nothing for neutral bases", () => {
    const state = createMatchState(setup);
    prepare(state, "wood", {});
    runProduction(state);
    expect(state.players.every((p) => Object.values(p.resources).every((v) => v === 0))).toBe(true);
  });

  it("pays dead players too and keeps wallets through death", () => {
    const state = createMatchState(setup);
    prepare(state, "wood", { 0: "teamA" });
    applyDamage(playerAt(state, 0), 1000, state.tick);
    runProduction(state);
    expect(playerAt(state, 0).resources.wood).toBe(3);
  });

  it("does nothing before the event tick and runs each event once", () => {
    const state = createMatchState(setup);
    runProduction(state);
    expect(state.nextProductionIndex).toBe(0);
    expect(state.lastProduction).toBeNull();
  });
});

describe("production in a match", () => {
  it("runs exactly 8 events over a full match and none in the opening", () => {
    const state = createMatchState(setup);
    const seen: number[] = [];
    while (state.result === null) {
      stepMatch(state, []);
      if (state.lastProduction && seen.at(-1) !== state.lastProduction.tick)
        seen.push(state.lastProduction.tick);
    }
    expect(seen).toEqual(buildProductionTicks(phases, durationSeconds));
    expect(state.nextProductionIndex).toBe(8);
  });

  it("skips past events when the clock starts late (debug ?skip)", () => {
    const state = createMatchState({ ...setup, startAtSeconds: 310 });
    expect(state.nextProductionIndex).toBe(5);
    expect(state.productionPlan[5]?.tick).toBe(secondsToTicks(330));
  });

  it("draws base resources and the plan from the seed", () => {
    const a = createMatchState(setup);
    const b = createMatchState(setup);
    expect(a.bases.map((x) => x.resourceId)).toEqual(b.bases.map((x) => x.resourceId));
    expect(a.productionPlan).toEqual(b.productionPlan);
    const other = createMatchState({ ...setup, seed: 12 });
    expect(other.productionPlan).not.toEqual(a.productionPlan);
  });
});
