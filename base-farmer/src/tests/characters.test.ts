import { describe, expect, it } from "vitest";
import { parseCharacter } from "../core/debugParams";
import { buildLocalMatchSetup, pickOpponentCharacter } from "../core/localMatch";
import { createMatchState, stepMatch } from "../core/Simulation";
import { BASELINE, CHARACTERS } from "../data/characters";
import { getCharacter } from "../data/registry";
import { definingStats, starsFor } from "../gameplay/characters/ratings";
import { playerAt } from "./helpers";

describe("roster", () => {
  it("keeps the 4 founding characters, in order, before any newcomer", () => {
    expect(CHARACTERS.map((c) => c.id).slice(0, 4)).toEqual([
      "tank",
      "scout",
      "shooter",
      "fighter",
    ]);
  });

  it("derives the selection-screen ratings from the real stats", () => {
    for (const c of CHARACTERS) {
      expect(c.relative.hp).toBeCloseTo(c.maxHp / BASELINE.maxHp);
      expect(c.relative.speed).toBeCloseTo(c.moveSpeed / BASELINE.moveSpeed);
      expect(c.relative.range).toBeCloseTo(c.attackRange / BASELINE.attackRange);
      expect(c.relative.damage).toBeCloseTo(c.attackDamage / BASELINE.attackDamage);
    }
  });
  it("keeps each character's identity: fastest Pépin, toughest Patatras, Lorgnon long and light", () => {
    const max = (pick: (c: (typeof CHARACTERS)[number]) => number) =>
      [...CHARACTERS].sort((a, b) => pick(b) - pick(a))[0]?.id;
    const min = (pick: (c: (typeof CHARACTERS)[number]) => number) =>
      [...CHARACTERS].sort((a, b) => pick(a) - pick(b))[0]?.id;
    expect(max((c) => c.moveSpeed)).toBe("scout");
    expect(max((c) => c.maxHp)).toBe("tank");
    expect(max((c) => c.attackRange)).toBe("shooter");
    expect(min((c) => c.attackDamage)).toBe("shooter");
    expect(getCharacter(max((c) => c.attackDamage) ?? "").attackKind).toBe("melee");
  });
});

describe("ratings", () => {
  it("maps multipliers to 1–5 stars, 100% = 3", () => {
    expect(starsFor(1)).toBe(3);
    expect(starsFor(1.4)).toBe(5);
    expect(starsFor(1.5)).toBe(5);
    expect(starsFor(0.7)).toBe(2);
    expect(starsFor(1.1)).toBe(4);
    expect(starsFor(0.1)).toBe(1);
  });

  it("shows 3 stats, including each character's defining one", () => {
    expect(definingStats(getCharacter("tank"))).toContain("hp");
    expect(definingStats(getCharacter("scout"))).toContain("speed");
    expect(definingStats(getCharacter("shooter"))).toContain("range");
    expect(definingStats(getCharacter("fighter"))).toContain("damage");
    for (const c of CHARACTERS) expect(definingStats(c)).toHaveLength(3);
  });
});

describe("local match setup", () => {
  it("draws the opponent's character from the seed, covering the whole roster", () => {
    expect(pickOpponentCharacter(42)).toBe(pickOpponentCharacter(42));
    const seen = new Set(Array.from({ length: 200 }, (_, s) => pickOpponentCharacter(s)));
    expect([...seen].sort()).toEqual(CHARACTERS.map((c) => c.id).sort());
  });

  it("does not change the match RNG sequence (same seed, any character = same plan)", () => {
    const a = createMatchState(buildLocalMatchSetup(7, "tank"));
    const b = createMatchState(buildLocalMatchSetup(7, "scout"));
    expect(a.productionPlan).toEqual(b.productionPlan);
    expect(a.bases.map((x) => x.resourceId)).toEqual(b.bases.map((x) => x.resourceId));
  });

  it("plays every character with its own stats", () => {
    for (const c of CHARACTERS) {
      const state = createMatchState(buildLocalMatchSetup(1, c.id));
      const player = playerAt(state, 0);
      expect(player.hp).toBe(c.maxHp);
      // Warm up past the light acceleration, then one second at top speed.
      for (let i = 0; i < 30; i++) {
        stepMatch(state, [{ type: "move", playerId: "p1", vector: { x: 1, y: 0 } }]);
      }
      const x0 = player.position.x;
      for (let i = 0; i < 60; i++) {
        stepMatch(state, [{ type: "move", playerId: "p1", vector: { x: 1, y: 0 } }]);
      }
      expect(player.position.x - x0).toBeCloseTo(c.moveSpeed, 1);
    }
  });
});

describe("parseCharacter", () => {
  it("reads ?character= and rejects unknown ids", () => {
    const ids = CHARACTERS.map((c) => c.id);
    expect(parseCharacter("", ids)).toBeNull();
    expect(parseCharacter("?character=scout", ids)).toBe("scout");
    expect(() => parseCharacter("?character=wizard", ids)).toThrow();
  });
});
