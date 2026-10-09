import { describe, expect, it } from "vitest";
import { GAME_CONFIG, secondsToTicks } from "../config/gameConfig";
import type { GameCommand } from "../core/commands";
import { setVec2 } from "../core/math";
import { isAlive, type MatchState } from "../core/MatchState";
import { createMatchState, stepMatch } from "../core/Simulation";
import { getCharacter, getMap } from "../data/registry";
import { applyDamage } from "../gameplay/combat/DamageSystem";
import { makePlayer, playerAt, clearObstacles } from "./helpers";

/** Projectile tests use the only ranged character. */
const shooter = getCharacter("shooter");
const map = getMap("meadow");

/** Shooter "a" (team A) and target "b" (team B) facing each other `distance` apart, open field. */
function duel(distance: number): MatchState {
  const state = clearObstacles(
    createMatchState({
      seed: 1,
      mapId: "meadow",
      players: [
        { id: "a", teamId: "teamA", characterId: "shooter" },
        { id: "b", teamId: "teamB", characterId: "shooter" },
      ],
    }),
  );
  const cy = map.height / 2;
  setVec2(playerAt(state, 0).position, 10, cy);
  setVec2(playerAt(state, 0).aim, 1, 0);
  setVec2(playerAt(state, 1).position, 10 + distance, cy);
  return state;
}

const fire = (playerId: string, active = true): GameCommand => ({
  type: "attack",
  playerId,
  active,
});

/** Fires exactly one shot from "a": press for one tick, release on the next. */
function shootOnce(state: MatchState): void {
  stepMatch(state, [fire("a")]);
  stepMatch(state, [fire("a", false)]);
  expect(state.nextEntityId - 1).toBeGreaterThanOrEqual(1);
}

function run(state: MatchState, ticks: number, commands: readonly GameCommand[] = []): void {
  for (let i = 0; i < ticks; i++) stepMatch(state, commands);
}

describe("firing", () => {
  it("spawns a projectile along the aim, outside the shooter's body", () => {
    const state = duel(5);
    stepMatch(state, [fire("a")]);
    expect(state.projectiles).toHaveLength(1);
    const shot = state.projectiles[0];
    expect(shot?.ownerId).toBe("a");
    expect(shot?.velocity.x).toBeCloseTo(shooter.projectileSpeed);
    expect(shot?.velocity.y).toBeCloseTo(0);
    expect(shot?.position.x).toBeGreaterThan(10 + shooter.radius);
  });

  it("respects the attack cooldown while attack is held", () => {
    const state = duel(30);
    const cooldownTicks = secondsToTicks(shooter.attackCooldown);
    stepMatch(state, [fire("a")]);
    run(state, cooldownTicks - 1);
    expect(state.nextEntityId - 1).toBe(1);
    stepMatch(state, []);
    expect(state.nextEntityId - 1).toBe(2);
  });

  it("stops firing when attack is released", () => {
    const state = duel(30);
    stepMatch(state, [fire("a")]);
    stepMatch(state, [fire("a", false)]);
    run(state, secondsToTicks(shooter.attackCooldown) * 3);
    expect(state.nextEntityId - 1).toBe(1);
  });
});

describe("projectiles", () => {
  it("expire at the attack range", () => {
    const state = duel(30);
    const startX = playerAt(state, 0).position.x;
    stepMatch(state, [fire("a")]);
    const shot = state.projectiles[0];
    stepMatch(state, [fire("a", false)]);
    run(state, 120);
    expect(state.projectiles).toHaveLength(0);
    expect(shot?.position.x).toBeCloseTo(startX + shooter.attackRange);
  });

  it("damage an enemy in range once, then disappear", () => {
    const state = duel(4);
    shootOnce(state);
    run(state, 60);
    expect(playerAt(state, 1).hp).toBe(shooter.maxHp - shooter.attackDamage);
    expect(state.projectiles).toHaveLength(0);
  });

  it("do not hit an enemy beyond the range", () => {
    const state = duel(shooter.attackRange + 2);
    shootOnce(state);
    run(state, 120);
    expect(playerAt(state, 1).hp).toBe(shooter.maxHp);
  });

  it("pass through teammates", () => {
    const state = createMatchState({
      seed: 1,
      mapId: "meadow",
      players: [
        { id: "a", teamId: "teamA", characterId: "shooter" },
        { id: "a2", teamId: "teamA", characterId: "shooter" },
      ],
    });
    setVec2(playerAt(state, 0).position, 10, 10);
    setVec2(playerAt(state, 0).aim, 1, 0);
    setVec2(playerAt(state, 1).position, 13, 10);
    shootOnce(state);
    run(state, 120);
    expect(playerAt(state, 1).hp).toBe(shooter.maxHp);
  });

  it("are removed when leaving the map", () => {
    const state = duel(30);
    setVec2(playerAt(state, 0).position, 1, 10);
    setVec2(playerAt(state, 0).aim, -1, 0);
    stepMatch(state, [fire("a")]);
    expect(state.projectiles).toHaveLength(1);
    stepMatch(state, [fire("a", false)]);
    run(state, 10);
    expect(state.projectiles).toHaveLength(0);
  });
});

describe("death and respawn", () => {
  it("kills at 0 HP and schedules the respawn", () => {
    const player = makePlayer({ hp: 15 });
    expect(applyDamage(player, 10, 100)).toBe(false);
    expect(applyDamage(player, 10, 100)).toBe(true);
    expect(player.hp).toBe(0);
    expect(player.respawnAtTick).toBe(100 + secondsToTicks(GAME_CONFIG.combat.respawnDelaySeconds));
  });

  it("ignores damage to dead players and rejects invalid damage", () => {
    const player = makePlayer({ hp: 0, respawnAtTick: 50 });
    expect(applyDamage(player, 10, 10)).toBe(false);
    expect(player.respawnAtTick).toBe(50);
    expect(() => applyDamage(makePlayer(), 0, 0)).toThrow();
  });

  it("dead players cannot move, fire or be hit, then respawn at spawn with full HP", () => {
    const state = duel(4);
    const target = playerAt(state, 1);
    applyDamage(target, shooter.maxHp, state.tick);
    const deathPos = { ...target.position };

    stepMatch(state, [
      { type: "move", playerId: "b", vector: { x: 0, y: 1 } },
      fire("b"),
      fire("a"),
    ]);
    expect(target.position).toEqual(deathPos);
    expect(state.projectiles.every((p) => p.ownerId === "a")).toBe(true);

    const delay = secondsToTicks(GAME_CONFIG.combat.respawnDelaySeconds);
    // Death happened at tick 0, so the player is back on the step that starts at tick `delay`.
    run(state, delay - 1, [fire("a", false)]);
    expect(isAlive(target)).toBe(false);
    expect(target.hp).toBe(0);

    stepMatch(state, []);
    expect(isAlive(target)).toBe(true);
    expect(target.hp).toBe(shooter.maxHp);
    // Moves on its first living tick, since the move intent was kept.
    expect(target.position.x).toBeCloseTo(map.spawns.teamB.x);
  });

  it("takes exactly maxHp / damage hits to kill", () => {
    const state = duel(3);
    const hitsToKill = Math.ceil(shooter.maxHp / shooter.attackDamage);
    run(state, secondsToTicks(shooter.attackCooldown) * (hitsToKill - 1) + 30, [fire("a")]);
    expect(isAlive(playerAt(state, 1))).toBe(false);
  });
});

describe("combat determinism", () => {
  it("gives identical state for identical commands", () => {
    const simulate = () => {
      const state = duel(5);
      for (let i = 0; i < 900; i++) {
        stepMatch(state, [
          { type: "aim", playerId: "a", direction: { x: 1, y: Math.sin(i * 0.1) * 0.2 } },
          fire("a", i % 50 < 40),
          { type: "move", playerId: "b", vector: { x: 0, y: Math.cos(i * 0.03) } },
        ]);
      }
      return state;
    };
    expect(simulate()).toEqual(simulate());
  });
});
