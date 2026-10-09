import { describe, expect, it } from "vitest";
import { secondsToTicks } from "../config/gameConfig";
import { setVec2 } from "../core/math";
import type { MatchState } from "../core/MatchState";
import { createMatchState, stepMatch } from "../core/Simulation";
import type { CharacterId } from "../core/types";
import { CHARACTERS } from "../data/characters";
import { getCharacter } from "../data/registry";
import { displace } from "../gameplay/abilities/AbilitySystem";
import { clearObstacles, playerAt } from "./helpers";

/** "a" at (10, 16) aiming +x, enemy "b" (Patatras) at `bx`, `by`, on the open meadow. */
function duel(attacker: CharacterId, bx: number, by: number, defender: CharacterId = "tank") {
  const state = createMatchState({
    seed: 1,
    mapId: "meadow",
    players: [
      { id: "a", teamId: "teamA", characterId: attacker },
      { id: "b", teamId: "teamB", characterId: defender },
    ],
  });
  clearObstacles(state);
  setVec2(playerAt(state, 0).position, 10, 16);
  setVec2(playerAt(state, 0).aim, 1, 0);
  setVec2(playerAt(state, 1).position, bx, by);
  return state;
}

const useAbility = (state: MatchState, playerId = "a") => {
  stepMatch(state, [{ type: "ability", playerId, active: true }]);
  stepMatch(state, [{ type: "ability", playerId, active: false }]);
};

describe("abilities", () => {
  it("every character has a distinct ability with a cooldown", () => {
    const kinds = new Set(CHARACTERS.map((c) => c.ability.kind));
    expect(kinds.size).toBe(CHARACTERS.length);
    for (const c of CHARACTERS) expect(c.ability.cooldownSeconds, c.id).toBeGreaterThan(0);
  });

  it("goes on cooldown and cannot be reused before it ends", () => {
    const state = duel("scout", 30, 16);
    const a = playerAt(state, 0);
    stepMatch(state, [{ type: "ability", playerId: "a", active: true }]);
    const afterFirst = a.position.x;
    expect(afterFirst).toBeGreaterThan(14);
    const cooldown = secondsToTicks(getCharacter("scout").ability.cooldownSeconds);
    expect(a.abilityReadyTick).toBe(state.tick - 1 + cooldown);
    // Still held: nothing more happens until the cooldown is over.
    for (let i = 0; i < 30; i++)
      stepMatch(state, [{ type: "ability", playerId: "a", active: true }]);
    expect(a.position.x).toBeCloseTo(afterFirst, 5);
  });

  it("dead players cannot use it", () => {
    const state = duel("scout", 30, 16);
    playerAt(state, 0).respawnAtTick = state.tick + 100;
    useAbility(state);
    expect(playerAt(state, 0).abilityReadyTick).toBe(0);
  });

  it("Pépin's leap goes along the movement, else the aim", () => {
    const dash = getCharacter("scout").ability;
    if (dash.kind !== "dash") throw new Error("Pépin should dash");
    const state = duel("scout", 30, 30);
    useAbility(state);
    expect(playerAt(state, 0).position.x).toBeCloseTo(10 + dash.distance, 1);

    // Aiming up, moving right: the leap follows the movement.
    const moving = duel("scout", 30, 30);
    setVec2(playerAt(moving, 0).aim, 0, -1);
    stepMatch(moving, [
      { type: "move", playerId: "a", vector: { x: 1, y: 0 } },
      { type: "ability", playerId: "a", active: true },
    ]);
    expect(playerAt(moving, 0).position.x).toBeGreaterThan(10 + dash.distance - 0.1);
    expect(playerAt(moving, 0).position.y).toBeCloseTo(16, 1);
  });

  it("a leap stops at walls and at the map edge", () => {
    const state = duel("scout", 30, 30);
    const a = playerAt(state, 0);
    const wall = { kind: "rect" as const, center: { x: 12, y: 16 }, halfWidth: 0.5, halfHeight: 3 };
    displace(a, 1, 0, 5, { width: 40, height: 40, obstacles: [wall] });
    expect(a.position.x).toBeLessThanOrEqual(11.5 - a.stats.radius + 1e-6);

    setVec2(a.position, 1, 16);
    displace(a, -1, 0, 5, { width: 40, height: 40, obstacles: [] });
    expect(a.position.x).toBe(a.stats.radius);
  });

  it("Patatras's guard cuts the damage taken while it lasts", () => {
    const guard = getCharacter("tank").ability;
    if (guard.kind !== "guard") throw new Error("Patatras should guard");
    const gaston = getCharacter("fighter");
    const state = duel("fighter", 10 + gaston.attackRange, 16);
    const tank = playerAt(state, 1);
    stepMatch(state, [{ type: "ability", playerId: "b", active: true }]);
    stepMatch(state, [{ type: "attack", playerId: "a", active: true }]);
    expect(tank.hp).toBeCloseTo(tank.stats.maxHp - gaston.attackDamage * guard.damageTakenFactor);

    // After the guard: full damage again.
    state.tick = tank.guardUntilTick;
    const before = tank.hp;
    playerAt(state, 0).attackReadyTick = 0;
    stepMatch(state, [{ type: "attack", playerId: "a", active: true }]);
    expect(before - tank.hp).toBe(gaston.attackDamage);
  });

  it("Lorgnon's volley fires a fan of projectiles", () => {
    const volley = getCharacter("shooter").ability;
    if (volley.kind !== "volley") throw new Error("Lorgnon should volley");
    const state = duel("shooter", 30, 30);
    useAbility(state);
    expect(state.projectiles).toHaveLength(volley.projectiles);
    const angles = state.projectiles.map((p) => Math.atan2(p.velocity.y, p.velocity.x));
    const spread = Math.max(...angles) - Math.min(...angles);
    expect(spread).toBeCloseTo((volley.spreadDegrees * Math.PI) / 180, 5);
  });

  it("Gaston's spin hits all around and throws enemies back", () => {
    const spin = getCharacter("fighter").ability;
    if (spin.kind !== "spin") throw new Error("Gaston should spin");
    const gaston = getCharacter("fighter");
    // Behind Gaston, beyond a normal swing but within the spin.
    const state = duel("fighter", 10 - gaston.attackRange * 1.3, 16);
    const tank = playerAt(state, 1);
    const startX = tank.position.x;
    useAbility(state);
    expect(tank.hp).toBe(tank.stats.maxHp - gaston.attackDamage * spin.damageFactor);
    expect(startX - tank.position.x).toBeCloseTo(spin.knockback, 1);
  });

  it("Gaston's spin misses enemies out of reach", () => {
    const gaston = getCharacter("fighter");
    const state = duel("fighter", 10 + gaston.attackRange * 1.5 + 1.5, 16);
    useAbility(state);
    expect(playerAt(state, 1).hp).toBe(getCharacter("tank").maxHp);
  });
});
