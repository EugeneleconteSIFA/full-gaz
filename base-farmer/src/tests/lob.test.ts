import { describe, expect, it } from "vitest";
import { secondsToTicks } from "../config/gameConfig";
import type { GameCommand } from "../core/commands";
import { setVec2 } from "../core/math";
import type { MatchState } from "../core/MatchState";
import { createMatchState, stepMatch } from "../core/Simulation";
import { getCharacter, getMap } from "../data/registry";
import { clearObstacles, playerAt } from "./helpers";

/** Marguerite, the lobber (D065). */
const cow = getCharacter("artillery");
const lob = cow.lob ?? expect.unreachable("Marguerite has lob stats");
const flightTicks = secondsToTicks(lob.flightSeconds);
const cy = getMap("meadow").height / 2;

/** Marguerite "a" (team A) at (10, cy) aiming right; enemies "b" and "c" (team B) parked aside. */
function field(): MatchState {
  const state = clearObstacles(
    createMatchState({
      seed: 1,
      mapId: "meadow",
      players: [
        { id: "a", teamId: "teamA", characterId: "artillery" },
        { id: "b", teamId: "teamB", characterId: "tank" },
        { id: "c", teamId: "teamB", characterId: "tank" },
      ],
    }),
  );
  setVec2(playerAt(state, 0).position, 10, cy);
  setVec2(playerAt(state, 1).position, 10, cy + 12);
  setVec2(playerAt(state, 2).position, 12, cy + 12);
  return state;
}

const aim = (distance?: number): GameCommand => ({
  type: "aim",
  playerId: "a",
  direction: { x: 1, y: 0 },
  ...(distance === undefined ? {} : { distance }),
});
const attack = (active: boolean): GameCommand => ({ type: "attack", playerId: "a", active });

function throwOnce(state: MatchState, distance?: number): void {
  stepMatch(state, [aim(distance), attack(true)]);
  stepMatch(state, [attack(false)]);
}

function run(state: MatchState, ticks: number): void {
  for (let i = 0; i < ticks; i++) stepMatch(state, []);
}

describe("lob (Marguerite)", () => {
  it("lands on the aimed spot, clamped between its min range and its range", () => {
    for (const [asked, expected] of [
      [5, 5],
      [0.5, lob.minRange],
      [50, cow.attackRange],
      [undefined, cow.attackRange],
    ] as const) {
      const state = field();
      throwOnce(state, asked);
      expect(state.shells).toHaveLength(1);
      expect(state.shells[0]?.to.x).toBeCloseTo(10 + expected);
      expect(state.shells[0]?.to.y).toBeCloseTo(cy);
    }
  });

  it("hurts nobody in flight, then everyone in the splash when it lands", () => {
    const state = field();
    const b = playerAt(state, 1);
    const c = playerAt(state, 2);
    const far = playerAt(state, 0); // reused below as a reference for HP
    // Two enemies around the landing spot, one right in the flight path.
    setVec2(b.position, 16, cy + lob.splashRadius * 0.5);
    setVec2(c.position, 13, cy);
    throwOnce(state, 6);
    run(state, flightTicks - 4);
    expect(c.hp).toBe(c.stats.maxHp); // flew over it
    expect(b.hp).toBe(b.stats.maxHp);
    run(state, 4);
    expect(state.shells).toHaveLength(0);
    expect(b.hp).toBe(b.stats.maxHp - cow.attackDamage);
    expect(c.hp).toBe(c.stats.maxHp);
    expect(far.hp).toBe(far.stats.maxHp); // never hurts its own team
  });

  it("hits several enemies with one shell", () => {
    const state = field();
    const b = playerAt(state, 1);
    const c = playerAt(state, 2);
    setVec2(b.position, 16, cy - 0.6);
    setVec2(c.position, 16, cy + 0.6);
    throwOnce(state, 6);
    run(state, flightTicks + 2);
    expect(b.hp).toBe(b.stats.maxHp - cow.attackDamage);
    expect(c.hp).toBe(c.stats.maxHp - cow.attackDamage);
  });

  it("flies over walls", () => {
    const state = field();
    const b = playerAt(state, 1);
    setVec2(b.position, 16, cy);
    (state.layout.obstacles as unknown[]).push({
      kind: "rect",
      center: { x: 13, y: cy },
      halfWidth: 0.5,
      halfHeight: 3,
    });
    throwOnce(state, 6);
    run(state, flightTicks + 2);
    expect(b.hp).toBe(b.stats.maxHp - cow.attackDamage);
  });

  it("throws one big shell as its ability: wider and harder", () => {
    const ability = cow.ability.kind === "bombard" ? cow.ability : expect.unreachable("bombard");
    const state = field();
    const b = playerAt(state, 1);
    // Out of a normal splash, inside the big one.
    setVec2(b.position, 16, cy + lob.splashRadius * 1.5);
    stepMatch(state, [aim(6), { type: "ability", playerId: "a", active: true }]);
    expect(state.shells).toHaveLength(1);
    expect(state.projectiles).toHaveLength(0);
    run(state, flightTicks + 2);
    expect(b.hp).toBe(b.stats.maxHp - Math.round(cow.attackDamage * ability.damageFactor));
  });
});
