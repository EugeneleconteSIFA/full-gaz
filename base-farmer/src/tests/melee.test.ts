import { describe, expect, it } from "vitest";
import { secondsToTicks } from "../config/gameConfig";
import { setVec2 } from "../core/math";
import type { MatchState } from "../core/MatchState";
import { createMatchState, stepMatch } from "../core/Simulation";
import type { CharacterId } from "../core/types";
import { CHARACTERS } from "../data/characters";
import { getCharacter } from "../data/registry";
import { clearObstacles, playerAt } from "./helpers";

/** "a" at (10, 16) aiming +x, enemy "b" placed at `bx`, `by`. Canyon has walls; meadow is open here. */
function duel(attacker: CharacterId, bx: number, by: number, mapId = "meadow"): MatchState {
  const state = createMatchState({
    seed: 1,
    mapId,
    players: [
      { id: "a", teamId: "teamA", characterId: attacker },
      { id: "b", teamId: "teamB", characterId: "tank" },
    ],
  });
  // The Prairie has cover mid-map since D060: keep the open-field duels open.
  if (mapId === "meadow") clearObstacles(state);
  setVec2(playerAt(state, 0).position, 10, 16);
  setVec2(playerAt(state, 0).aim, 1, 0);
  setVec2(playerAt(state, 1).position, bx, by);
  return state;
}

const swingOnce = (state: MatchState) => {
  stepMatch(state, [{ type: "attack", playerId: "a", active: true }]);
  stepMatch(state, [{ type: "attack", playerId: "a", active: false }]);
};

describe("roster attack kinds", () => {
  it("only Lorgnon shoots; the others fight in melee and hit harder", () => {
    const ranged = CHARACTERS.filter((c) => c.attackKind === "ranged").map((c) => c.id);
    expect(ranged).toEqual(["shooter"]);
    const shooter = getCharacter("shooter");
    for (const c of CHARACTERS.filter((x) => x.attackKind === "melee")) {
      expect(c.attackDamage, c.id).toBeGreaterThan(shooter.attackDamage * 1.8);
      expect(c.attackRange, c.id).toBeLessThan(shooter.attackRange / 4);
    }
  });
});

describe("melee swing", () => {
  it("hits an enemy in reach and in front, without any projectile", () => {
    const gaston = getCharacter("fighter");
    const state = duel("fighter", 10 + gaston.attackRange, 16);
    swingOnce(state);
    expect(playerAt(state, 1).hp).toBe(getCharacter("tank").maxHp - gaston.attackDamage);
    expect(state.projectiles).toHaveLength(0);
  });

  it("misses an enemy out of reach or behind", () => {
    const gaston = getCharacter("fighter");
    const far = duel("fighter", 10 + gaston.attackRange + 0.6, 16);
    swingOnce(far);
    expect(playerAt(far, 1).hp).toBe(getCharacter("tank").maxHp);
    const behind = duel("fighter", 8.8, 16);
    swingOnce(behind);
    expect(playerAt(behind, 1).hp).toBe(getCharacter("tank").maxHp);
  });

  it("hits within the arc and not outside it", () => {
    // Gaston's arc is 110°: 40° off the aim is in, 80° is out (at a distance where the body edge
    // does not reach back into the arc).
    const at = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      return duel("fighter", 10 + Math.cos(a) * 1.4, 16 + Math.sin(a) * 1.4);
    };
    const inside = at(40);
    swingOnce(inside);
    expect(playerAt(inside, 1).hp).toBeLessThan(getCharacter("tank").maxHp);
    const outside = at(85);
    swingOnce(outside);
    expect(playerAt(outside, 1).hp).toBe(getCharacter("tank").maxHp);
  });

  it("always hits a body touching the attacker, whatever the angle", () => {
    const state = duel("tank", 9.2, 16);
    swingOnce(state);
    expect(playerAt(state, 1).hp).toBeLessThan(getCharacter("tank").maxHp);
  });

  it("is stopped by walls", () => {
    // Canyon: wall along y = 10 (± 0.6) between x = 17 and 35.
    const state = duel("fighter", 26, 11.5, "canyon");
    setVec2(playerAt(state, 0).position, 26, 8.6);
    setVec2(playerAt(state, 0).aim, 0, 1);
    const wallY =
      state.layout.obstacles.find((o) => o.kind === "rect" && o.center.y < 15)?.center.y ?? 10;
    setVec2(playerAt(state, 0).position, 26, wallY - 1.05);
    setVec2(playerAt(state, 1).position, 26, wallY + 1.05);
    swingOnce(state);
    expect(playerAt(state, 1).hp).toBe(getCharacter("tank").maxHp);
  });

  it("respects the cooldown while held", () => {
    const pepin = getCharacter("scout");
    const state = duel("scout", 11, 16);
    const ticks = secondsToTicks(pepin.attackCooldown);
    for (let i = 0; i < ticks * 2; i++)
      stepMatch(state, [{ type: "attack", playerId: "a", active: true }]);
    expect(playerAt(state, 1).hp).toBe(getCharacter("tank").maxHp - pepin.attackDamage * 2);
  });

  it("gets longer reach from the Portée upgrade", () => {
    const gaston = getCharacter("fighter");
    const state = duel("fighter", 10 + gaston.attackRange + 0.65, 16);
    playerAt(state, 0).resources.stone = 1;
    stepMatch(state, [{ type: "buyUpgrade", playerId: "a", upgradeId: "range" }]);
    swingOnce(state);
    expect(playerAt(state, 1).hp).toBeLessThan(getCharacter("tank").maxHp);
  });
});
