import { describe, expect, it } from "vitest";
import type { GameCommand } from "../core/commands";
import { createMatchState, stepMatch, type MatchSetup } from "../core/Simulation";
import { getCharacter, getMap } from "../data/registry";
import { playerAt } from "./helpers";

const setup: MatchSetup = {
  seed: 7,
  mapId: "meadow",
  players: [
    { id: "a", teamId: "teamA", characterId: "fighter" },
    { id: "b", teamId: "teamB", characterId: "fighter" },
  ],
};

const DT = 1 / 60; // matches GAME_CONFIG.simulation.ticksPerSecond

describe("createMatchState", () => {
  it("spawns players at their team spawn, facing the map center", () => {
    const state = createMatchState(setup);
    const map = getMap("meadow");
    const [a, b] = state.players;
    expect(a?.position).toEqual(map.spawns.teamA);
    expect(b?.position).toEqual(map.spawns.teamB);
    expect(a?.aim.x).toBeGreaterThan(0);
    expect(b?.aim.x).toBeLessThan(0);
    expect(state.tick).toBe(0);
    expect(a?.hp).toBe(getCharacter("fighter").maxHp);
    expect(state.projectiles).toEqual([]);
  });

  it("is serializable plain data", () => {
    const state = createMatchState(setup);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("rejects duplicate players, unknown characters and unknown maps", () => {
    expect(() =>
      createMatchState({
        ...setup,
        players: [setup.players[0], setup.players[0]].filter((p) => p !== undefined),
      }),
    ).toThrow(/Duplicate player/);
    expect(() =>
      createMatchState({ ...setup, players: [{ id: "x", teamId: "teamA", characterId: "nope" }] }),
    ).toThrow(/Unknown character/);
    expect(() => createMatchState({ ...setup, mapId: "nope" })).toThrow(/Unknown map/);
  });
});

describe("stepMatch", () => {
  it("applies move commands as persistent intent", () => {
    const state = createMatchState(setup);
    const startX = playerAt(state, 0).position.x;
    const speed = getCharacter("fighter").moveSpeed;

    stepMatch(state, [{ type: "move", playerId: "a", vector: { x: 1, y: 0 } }]);
    stepMatch(state, []);

    // Light inertia: the player starts moving at once but below top speed.
    const moved = playerAt(state, 0).position.x - startX;
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(speed * DT * 2);
    expect(playerAt(state, 1).position).toEqual(getMap("meadow").spawns.teamB);
    expect(state.tick).toBe(2);
  });

  it("normalizes aim and ignores zero aim", () => {
    const state = createMatchState(setup);
    stepMatch(state, [{ type: "aim", playerId: "a", direction: { x: 0, y: 5 } }]);
    expect(playerAt(state, 0).aim).toEqual({ x: 0, y: 1 });
    stepMatch(state, [{ type: "aim", playerId: "a", direction: { x: 0, y: 0 } }]);
    expect(playerAt(state, 0).aim).toEqual({ x: 0, y: 1 });
  });

  it("fails visibly on commands for unknown players", () => {
    const state = createMatchState(setup);
    const bad: GameCommand = { type: "move", playerId: "ghost", vector: { x: 1, y: 0 } };
    expect(() => stepMatch(state, [bad])).toThrow(/unknown player/);
  });

  it("is deterministic for the same setup and command sequence", () => {
    const run = () => {
      const state = createMatchState(setup);
      for (let i = 0; i < 600; i++) {
        const angle = i * 0.05;
        stepMatch(state, [
          { type: "move", playerId: "a", vector: { x: Math.cos(angle), y: Math.sin(angle) } },
        ]);
      }
      return state;
    };
    expect(run()).toEqual(run());
  });
});
