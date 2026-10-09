import { describe, expect, it } from "vitest";
import type { GameCommand } from "../core/commands";
import { buildLocalMatchSetup } from "../core/localMatch";
import { setVec2 } from "../core/math";
import type { MatchState } from "../core/MatchState";
import { createMatchState, stepMatch } from "../core/Simulation";
import { BOT_UPGRADE_PRIORITIES, type BotDifficulty } from "../data/bots";
import { CHARACTERS } from "../data/characters";
import { MAPS } from "../data/maps";
import { BotController } from "../gameplay/bots/BotController";
import { createBotNavigation } from "../gameplay/bots/BotNavigation";
import { tryFire } from "../gameplay/combat/CombatSystem";
import { buildMatchLayout } from "../world/MapLayout";
import { DistanceField, NavGrid } from "../world/navigation";
import { playerAt } from "./helpers";

describe("navigation", () => {
  it("finds walking distances around walls on every map", () => {
    for (const map of MAPS) {
      const layout = buildMatchLayout(map, 1);
      const nav = createBotNavigation(layout);
      for (const field of nav.baseFields) {
        for (const spawn of [layout.spawns.teamA, layout.spawns.teamB]) {
          const walk = field.distanceAt(spawn.x, spawn.y);
          const straight = Math.hypot(field.goal.x - spawn.x, field.goal.y - spawn.y);
          expect(walk).toBeLessThan(Infinity);
          expect(walk).toBeGreaterThanOrEqual(straight - 1);
        }
      }
    }
  });

  it("routes around the Canyon wall instead of through it", () => {
    const canyon = MAPS[1] ?? expect.unreachable("no canyon");
    const grid = new NavGrid(canyon);
    // Inside the corridor, west of the middle gap: a wall stands between the bot and a point
    // straight above it, so the path is longer than the straight line and does not start
    // straight up into the wall.
    const goal = { x: 21, y: 5 };
    const field = new DistanceField(grid, goal);
    expect(grid.hasLineOfSight(21, 13, goal.x, goal.y)).toBe(false);
    expect(field.distanceAt(21, 13)).toBeGreaterThan(13 - goal.y + 2);
    const dir = field.directionFrom(21, 13, { x: 0, y: 0 });
    expect(Math.abs(dir.x)).toBeGreaterThan(0.3);
  });

  it("walks straight when the way is clear", () => {
    const meadow = MAPS[0] ?? expect.unreachable("no maps");
    const field = new DistanceField(new NavGrid(meadow), { x: 10, y: 16 });
    const dir = field.directionFrom(4, 16, { x: 0, y: 0 });
    expect(dir.x).toBeCloseTo(1);
    expect(dir.y).toBeCloseTo(0);
  });
});

/** Runs a full match driven by bots (and optionally passive players); returns the final state. */
function playMatch(
  mapId: string,
  seed: number,
  bots: readonly {
    id: string;
    team: "teamA" | "teamB";
    difficulty: BotDifficulty;
    character?: string;
  }[],
): { state: MatchState; deaths: number; captures: number; damage: number } {
  const state = createMatchState({
    seed,
    mapId,
    players: bots.map((b) => ({ id: b.id, teamId: b.team, characterId: b.character ?? "fighter" })),
  });
  const nav = createBotNavigation(state.layout);
  const controllers = bots.map((b) => new BotController(b.id, b.difficulty, seed, nav));
  const commands: GameCommand[] = [];
  let deaths = 0;
  let captures = 0;
  let damage = 0;
  while (state.result === null) {
    commands.length = 0;
    for (const c of controllers) commands.push(...c.think(state));
    const alive = state.players.map((p) => p.respawnAtTick === null);
    const hp = state.players.map((p) => p.hp);
    const owners = state.bases.map((b) => b.owner);
    stepMatch(state, commands);
    state.players.forEach((p, i) => {
      if (alive[i] && p.respawnAtTick !== null) deaths++;
      damage += Math.max(0, (hp[i] ?? 0) - p.hp);
    });
    state.bases.forEach((b, i) => {
      if (b.owner !== owners[i] && b.owner !== "neutral") captures++;
    });
  }
  return { state, deaths, captures, damage };
}

const duel = (a: BotDifficulty, b: BotDifficulty) => [
  { id: "a", team: "teamA" as const, difficulty: a },
  { id: "b", team: "teamB" as const, difficulty: b },
];

describe("bot behaviour", () => {
  it("plays a full match on every map: captures, fights and upgrades", () => {
    // Two melee bots (Gaston) can avoid each other on a big map: require fights everywhere and
    // kills overall, not kills on every map. A single seed can end with no kill at all (any
    // layout change reshuffles the whole match), so kills are summed over a second match.
    let totalDeaths = 0;
    for (const map of MAPS) {
      totalDeaths += playMatch(map.id, 2, duel("normal", "normal")).deaths;
      const { state, deaths, captures, damage } = playMatch(map.id, 1, duel("normal", "normal"));
      totalDeaths += deaths;
      expect(captures, map.id).toBeGreaterThan(20);
      expect(damage, map.id).toBeGreaterThan(100);
      for (const p of state.players) {
        expect(
          Object.values(p.upgrades).reduce((a, b) => a + b, 0),
          `${map.id} ${p.id}`,
        ).toBeGreaterThan(0);
      }
    }
    expect(totalDeaths).toBeGreaterThan(3);
  }, 30_000);

  it("is deterministic for a given seed", () => {
    const a = playMatch("canyon", 5, duel("normal", "hard")).state;
    const b = playMatch("canyon", 5, duel("normal", "hard")).state;
    expect(a).toEqual(b);
  });

  it("wins more often on higher difficulties", () => {
    let hardWins = 0;
    for (let seed = 0; seed < 6; seed++) {
      // Alternate sides so the starting side cannot explain the result.
      const hardIsA = seed % 2 === 0;
      const { state } = playMatch(
        MAPS[seed % MAPS.length]?.id ?? "meadow",
        seed,
        hardIsA ? duel("hard", "easy") : duel("easy", "hard"),
      );
      if (state.result?.winner === (hardIsA ? "teamA" : "teamB")) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(5);
  }, 30_000);

  it("captures freely against a passive opponent, even on Facile", () => {
    for (const difficulty of ["easy", "normal"] as const) {
      const state = createMatchState(buildLocalMatchSetup(2, "scout", "meadow"));
      const nav = createBotNavigation(state.layout);
      const bot = new BotController("p1", difficulty, 2, nav);
      for (let i = 0; i < 60 * 60 && state.result === null; i++) stepMatch(state, bot.think(state));
      expect(
        state.bases.filter((b) => b.owner === "teamA").length,
        difficulty,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it("makes Facile clearly weaker than Normal", () => {
    let normalWins = 0;
    for (let seed = 0; seed < 4; seed++) {
      const normalIsA = seed % 2 === 0;
      const { state } = playMatch(
        MAPS[seed % MAPS.length]?.id ?? "meadow",
        seed,
        normalIsA ? duel("normal", "easy") : duel("easy", "normal"),
      );
      if (state.result?.winner === (normalIsA ? "teamA" : "teamB")) normalWins++;
    }
    expect(normalWins).toBe(4);
  });

  it("buys upgrades in its character's priority order", () => {
    for (const c of CHARACTERS) expect(BOT_UPGRADE_PRIORITIES[c.id]).toHaveLength(5);
    const state = createMatchState(buildLocalMatchSetup(1, "fighter", "meadow"));
    const me = playerAt(state, 1);
    Object.assign(me.resources, { food: 5, wood: 5, stone: 5, metal: 5, power: 5 });
    const bot = new BotController("p2", "normal", 1, createBotNavigation(state.layout));
    stepMatch(state, bot.think(state));
    const first =
      BOT_UPGRADE_PRIORITIES[me.characterId]?.[0] ?? expect.unreachable("no priorities");
    expect(me.upgrades[first]).toBe(1);
    expect(Object.values(me.upgrades).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("goes back to defend a base the enemy is taking", () => {
    const state = createMatchState(buildLocalMatchSetup(1, "fighter", "meadow"));
    state.bases.forEach((b) => (b.owner = "teamB"));
    const target = state.bases[3];
    if (!target) throw new Error("no base");
    target.captureTeam = "teamA";
    target.captureProgress = 0.5;
    const bot = new BotController("p2", "hard", 1, createBotNavigation(state.layout));
    bot.think(state);
    expect(bot.target).toBe(target.id);
  });
});

describe("point-blank shots", () => {
  it("hit an enemy standing inside the shooter's reach", () => {
    const state = createMatchState(buildLocalMatchSetup(1, "fighter", "meadow"));
    const shooter = playerAt(state, 0);
    const target = playerAt(state, 1);
    setVec2(shooter.position, 20, 16);
    setVec2(target.position, 20.2, 16);
    setVec2(shooter.aim, 1, 0);
    shooter.attackIntent = true;
    tryFire(state, shooter);
    expect(target.hp).toBe(target.stats.maxHp - shooter.stats.attackDamage);
    expect(state.projectiles).toHaveLength(0);
  });

  it("cannot skip over a body between two ticks", () => {
    const state = createMatchState(buildLocalMatchSetup(1, "fighter", "meadow"));
    const shooter = playerAt(state, 0);
    const target = playerAt(state, 1);
    setVec2(shooter.position, 20, 16);
    setVec2(shooter.aim, 1, 0);
    // Just past the spawn point: the end-of-tick position alone would have missed it.
    setVec2(target.position, 20.9, 16);
    stepMatch(state, [{ type: "attack", playerId: "p1", active: true }]);
    expect(target.hp).toBeLessThan(target.stats.maxHp);
  });
});
