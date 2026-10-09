import { describe, expect, it } from "vitest";
import { secondsToTicks } from "../config/gameConfig";
import { buildLocalMatchSetup } from "../core/localMatch";
import { createMatchState, stepMatch } from "../core/Simulation";
import { RESOURCE_IDS, UPGRADE_IDS } from "../core/types";
import { GAME_DATA } from "../data/gameData";
import { getCharacter } from "../data/registry";
import { UPGRADES } from "../data/upgrades";
import { findGameDataErrors } from "../data/validateGameData";
import { applyDamage } from "../gameplay/combat/DamageSystem";
import {
  canAfford,
  computeStats,
  createUpgradeLevels,
  nextLevelCost,
  tryBuyUpgrade,
} from "../gameplay/upgrades/UpgradeSystem";
import { CommandWriter } from "../input/CommandWriter";
import { createInputState } from "../input/InputState";
import { makePlayer, playerAt } from "./helpers";

function richPlayer() {
  const p = makePlayer();
  for (const r of RESOURCE_IDS) p.resources[r] = 10;
  return p;
}

describe("upgrade catalogue", () => {
  it("uses every resource once as primary and once as secondary", () => {
    for (const r of RESOURCE_IDS) {
      expect(UPGRADES.filter((u) => u.primary === r)).toHaveLength(1);
      expect(UPGRADES.filter((u) => u.secondary === r)).toHaveLength(1);
    }
  });

  it("validates upgrade data", () => {
    const bad = findGameDataErrors({
      ...GAME_DATA,
      upgrades: [{ id: "hp", label: "Vie", primary: "food", secondary: "food" }],
      upgradeLevelCosts: [{ primary: 0, secondary: 0 }],
    });
    expect(bad).toContain('Upgrade "hp" needs two different resources');
    expect(bad).toContain('Missing upgrade definition "speed"');
    expect(bad).toContain("Upgrade level 1 has an invalid cost");
  });
});

describe("costs", () => {
  it("costs 1, then 2, then 3 resources, mixing in the secondary from level 2", () => {
    const p = richPlayer();
    expect(nextLevelCost(p, "hp")).toEqual([{ resourceId: "food", amount: 1 }]);
    tryBuyUpgrade(p, "hp");
    expect(nextLevelCost(p, "hp")).toEqual([
      { resourceId: "food", amount: 1 },
      { resourceId: "stone", amount: 1 },
    ]);
    tryBuyUpgrade(p, "hp");
    expect(nextLevelCost(p, "hp")).toEqual([
      { resourceId: "food", amount: 2 },
      { resourceId: "stone", amount: 1 },
    ]);
    tryBuyUpgrade(p, "hp");
    expect(nextLevelCost(p, "hp")).toBeNull();
    expect(p.resources.food).toBe(10 - 4);
    expect(p.resources.stone).toBe(10 - 2);
  });

  it("refuses purchases the wallet cannot pay, without touching it", () => {
    const p = makePlayer();
    p.resources.metal = 1;
    expect(tryBuyUpgrade(p, "damage")).toBe(true);
    expect(canAfford(p, "damage")).toBe(false);
    p.resources.metal = 1;
    expect(tryBuyUpgrade(p, "damage")).toBe(false); // needs metal + power
    expect(p.resources.metal).toBe(1);
    expect(p.upgrades.damage).toBe(1);
  });

  it("stops at the max level", () => {
    const p = richPlayer();
    for (let i = 0; i < 5; i++) tryBuyUpgrade(p, "speed");
    expect(p.upgrades.speed).toBe(3);
  });
});

describe("stats", () => {
  it("adds +15% of the base stat per level", () => {
    const scout = getCharacter("scout");
    const levels = { ...createUpgradeLevels(), hp: 3, speed: 2, range: 1, damage: 3, fireRate: 2 };
    const stats = computeStats(scout, levels);
    expect(stats.maxHp).toBe(Math.round(scout.maxHp * 1.45));
    expect(stats.moveSpeed).toBeCloseTo(scout.moveSpeed * 1.3);
    expect(stats.attackRange).toBeCloseTo(scout.attackRange * 1.15);
    expect(stats.attackDamage).toBe(Math.round(scout.attackDamage * 1.45));
    expect(stats.attackCooldown).toBeCloseTo(scout.attackCooldown / 1.3);
  });

  it("is unchanged with no upgrades", () => {
    const c = getCharacter("tank");
    const stats = computeStats(c, createUpgradeLevels());
    expect(stats.maxHp).toBe(c.maxHp);
    expect(stats.moveSpeed).toBe(c.moveSpeed);
  });

  it("heals by the HP a Vie upgrade adds, only while alive", () => {
    const p = richPlayer();
    p.hp = 50;
    const base = getCharacter("fighter").maxHp;
    tryBuyUpgrade(p, "hp");
    expect(p.stats.maxHp).toBe(Math.round(base * 1.15));
    expect(p.hp).toBe(50 + Math.round(base * 1.15) - base);

    const dead = richPlayer();
    applyDamage(dead, 1000, 0);
    expect(tryBuyUpgrade(dead, "hp")).toBe(true);
    expect(dead.hp).toBe(0);
  });
});

describe("upgrades in a match", () => {
  it("buys through commands and the bonus applies to movement", () => {
    const state = createMatchState(buildLocalMatchSetup(1, "fighter"));
    const p = playerAt(state, 0);
    p.resources.wood = 1;
    stepMatch(state, [{ type: "buyUpgrade", playerId: "p1", upgradeId: "speed" }]);
    expect(p.upgrades.speed).toBe(1);
    expect(p.resources.wood).toBe(0);

    // Warm up past the light acceleration, then one second at top speed.
    for (let i = 0; i < 30; i++) {
      stepMatch(state, [{ type: "move", playerId: "p1", vector: { x: 1, y: 0 } }]);
    }
    const x0 = p.position.x;
    for (let i = 0; i < 60; i++) {
      stepMatch(state, [{ type: "move", playerId: "p1", vector: { x: 1, y: 0 } }]);
    }
    expect(p.position.x - x0).toBeCloseTo(6 * 1.15, 1);
  });

  it("fires faster and harder with fire rate and damage upgrades", () => {
    const state = createMatchState(buildLocalMatchSetup(1, "shooter"));
    const p = playerAt(state, 0);
    p.resources.power = 10;
    p.resources.metal = 10;
    for (const upgradeId of ["fireRate", "fireRate", "damage"] as const) {
      stepMatch(state, [{ type: "buyUpgrade", playerId: "p1", upgradeId }]);
    }
    stepMatch(state, [{ type: "attack", playerId: "p1", active: true }]);
    const shooter = getCharacter("shooter");
    expect(state.projectiles[0]?.damage).toBe(Math.round(shooter.attackDamage * 1.15));
    expect(p.attackReadyTick - (state.tick - 1)).toBe(secondsToTicks(shooter.attackCooldown / 1.3));
  });

  it("keeps upgraded max HP across respawn", () => {
    const state = createMatchState(buildLocalMatchSetup(1, "fighter"));
    const p = playerAt(state, 0);
    p.resources.food = 1;
    stepMatch(state, [{ type: "buyUpgrade", playerId: "p1", upgradeId: "hp" }]);
    applyDamage(p, 1000, state.tick);
    for (let i = 0; i < secondsToTicks(6); i++) stepMatch(state, []);
    expect(p.hp).toBe(Math.round(getCharacter("fighter").maxHp * 1.15));
  });
});

describe("CommandWriter purchases", () => {
  it("emits one buy command per request, in order", () => {
    const writer = new CommandWriter("p1");
    const input = createInputState();
    input.buyRequests.push("hp", "damage");
    const commands = writer.write(input).filter((c) => c.type === "buyUpgrade");
    expect(commands).toEqual([
      { type: "buyUpgrade", playerId: "p1", upgradeId: "hp" },
      { type: "buyUpgrade", playerId: "p1", upgradeId: "damage" },
    ]);
    expect(UPGRADE_IDS).toHaveLength(5);
  });
});
