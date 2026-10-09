import { describe, expect, it } from "vitest";
import { FIXED_STEP_SECONDS, GAME_CONFIG } from "../config/gameConfig";
import { buildLocalMatchSetup, resolveMapChoice } from "../core/localMatch";
import { setVec2, vec2 } from "../core/math";
import { createMatchState, stepMatch } from "../core/Simulation";
import { parseMap } from "../core/debugParams";
import { MAPS, type MapDefinition } from "../data/maps";
import { applyMovement } from "../gameplay/movement/MovementSystem";
import { circleOverlapsObstacle, pushCircleOut, type Obstacle } from "../world/geometry";
import { buildMatchLayout, findLayoutErrors, reachableFrom } from "../world/MapLayout";
import { makePlayer, playerAt } from "./helpers";

const rock: Obstacle = { kind: "circle", center: { x: 10, y: 10 }, radius: 1 };
const wall: Obstacle = { kind: "rect", center: { x: 10, y: 10 }, halfWidth: 3, halfHeight: 0.5 };

describe("geometry", () => {
  it("detects circle overlap with rocks and walls", () => {
    expect(circleOverlapsObstacle(11.4, 10, 0.5, rock)).toBe(true);
    expect(circleOverlapsObstacle(11.6, 10, 0.5, rock)).toBe(false);
    expect(circleOverlapsObstacle(10, 10.9, 0.5, wall)).toBe(true);
    expect(circleOverlapsObstacle(10, 11.1, 0.5, wall)).toBe(false);
    expect(circleOverlapsObstacle(13.4, 10.4, 0.5, wall)).toBe(true);
  });

  it("pushes a body out to touching distance", () => {
    const p = vec2(10.5, 10);
    pushCircleOut(p, 0.5, rock);
    expect(p.x).toBeCloseTo(11.5);
    const q = vec2(10, 10.8);
    pushCircleOut(q, 0.5, wall);
    expect(q.y).toBeCloseTo(11);
    const inside = vec2(12.9, 10);
    pushCircleOut(inside, 0.5, wall);
    expect(inside.x).toBeCloseTo(13.5);
    expect(circleOverlapsObstacle(inside.x, inside.y, 0.5, wall)).toBe(false);
  });
});

describe("shipped maps", () => {
  it("has 3 maps that pass every layout check", () => {
    expect(MAPS.map((m) => m.id)).toEqual(["meadow", "canyon", "corners"]);
    for (const m of MAPS) expect(findLayoutErrors(m, m.id)).toEqual([]);
  });

  it("keeps every seeded variant valid and point-symmetric", () => {
    for (const m of MAPS) {
      for (let seed = 0; seed < 40; seed++) {
        expect(findLayoutErrors(buildMatchLayout(m, seed), `${m.id}#${seed}`)).toEqual([]);
      }
    }
  }, 30_000);

  it("varies between seeds: mirroring and nudged bases", () => {
    const meadow = MAPS[0] ?? expect.unreachable("no maps");
    const variants = new Set(
      Array.from({ length: 20 }, (_, s) =>
        JSON.stringify(buildMatchLayout(meadow, s).bases.map((b) => b.position)),
      ),
    );
    expect(variants.size).toBeGreaterThan(10);
    const sides = new Set(
      Array.from({ length: 20 }, (_, s) => buildMatchLayout(meadow, s).spawns.teamA.x),
    );
    expect(sides).toEqual(new Set([meadow.spawns.teamA.x, meadow.width - meadow.spawns.teamA.x]));
  });

  it("nudges bases at most baseJitter and never moves the center base", () => {
    for (const m of MAPS) {
      for (let seed = 0; seed < 20; seed++) {
        const layout = buildMatchLayout(m, seed);
        const center = layout.bases.find((b) => b.id === "center");
        expect(center?.position.x).toBeCloseTo(m.width / 2);
        expect(center?.position.y).toBeCloseTo(m.height / 2);
      }
    }
    expect(GAME_CONFIG.maps.baseJitter).toBeLessThanOrEqual(2);
  });

  it("is deterministic per seed", () => {
    const canyon = MAPS[1] ?? expect.unreachable("no canyon");
    expect(buildMatchLayout(canyon, 9)).toEqual(buildMatchLayout(canyon, 9));
  });
});

describe("layout checks", () => {
  const meadow = MAPS[0] ?? expect.unreachable("no maps");

  it("detects a base walled off from the spawns", () => {
    const center = { x: 24, y: 16 };
    const box = (dx: number, dy: number, hw: number, hh: number): Obstacle => ({
      kind: "rect",
      center: { x: center.x + dx, y: center.y + dy },
      halfWidth: hw,
      halfHeight: hh,
    });
    const sealed: MapDefinition = {
      ...meadow,
      obstacles: [
        box(0, -3, 3.6, 0.5),
        box(0, 3, 3.6, 0.5),
        box(-3.1, 0, 0.5, 3.5),
        box(3.1, 0, 0.5, 3.5),
      ],
    };
    const canReach = reachableFrom(sealed, sealed.spawns.teamA);
    expect(canReach(center)).toBe(false);
    expect(findLayoutErrors(sealed, "sealed")).toContain(
      'sealed: base "center" is unreachable from the teamA spawn',
    );
  });

  it("rejects asymmetric obstacles, thin walls and zones over obstacles", () => {
    const broken: MapDefinition = {
      ...meadow,
      obstacles: [
        { kind: "circle", center: { x: 5, y: 5 }, radius: 0.2 },
        { kind: "circle", center: { x: 24, y: 16 }, radius: 1 },
      ],
    };
    const errors = findLayoutErrors(broken, "broken");
    expect(errors).toContain("broken: obstacle at (5, 5) has no symmetric twin");
    expect(errors).toContain("broken: obstacle at (5, 5) is too thin to stop projectiles");
    expect(errors).toContain('broken: base "center" capture zone overlaps an obstacle');
  });
});

describe("obstacles in play", () => {
  it("block movement: a player slides along a wall instead of crossing it", () => {
    const p = makePlayer({ position: vec2(10, 12), moveIntent: vec2(0, -1) });
    const bounds = { width: 20, height: 20, obstacles: [wall] };
    for (let i = 0; i < 120; i++) applyMovement(p, 6, 0.5, bounds, FIXED_STEP_SECONDS);
    expect(p.position.y).toBeCloseTo(11);
    expect(circleOverlapsObstacle(p.position.x, p.position.y, 0.5, wall)).toBe(false);
  });

  it("stop projectiles before they reach a player behind cover", () => {
    const state = createMatchState(buildLocalMatchSetup(1, "fighter", "canyon"));
    const shooter = playerAt(state, 0);
    const target = playerAt(state, 1);
    // Canyon wall: center (26, 10), 18 wide. Shooter above it, target below, in range.
    const wallY =
      state.layout.obstacles.find((o) => o.kind === "rect" && o.center.y < 15)?.center.y ?? 10;
    setVec2(shooter.position, 26, wallY - 2.5);
    setVec2(target.position, 26, wallY + 2.5);
    setVec2(shooter.aim, 0, 1);
    stepMatch(state, [{ type: "attack", playerId: "p1", active: true }]);
    stepMatch(state, [{ type: "attack", playerId: "p1", active: false }]);
    for (let i = 0; i < 60; i++) stepMatch(state, []);
    expect(target.hp).toBe(target.stats.maxHp);
    expect(state.projectiles).toHaveLength(0);
  });
});

describe("map choice", () => {
  it("uses the picked map, or draws one from the seed for Aléatoire", () => {
    expect(resolveMapChoice("canyon", 1)).toBe("canyon");
    expect(resolveMapChoice("random", 5)).toBe(resolveMapChoice("random", 5));
    const drawn = new Set(Array.from({ length: 60 }, (_, s) => resolveMapChoice("random", s)));
    expect([...drawn].sort()).toEqual(MAPS.map((m) => m.id).sort());
  });

  it("plays the chosen map's variant", () => {
    const state = createMatchState(buildLocalMatchSetup(3, "tank", "corners"));
    expect(state.mapId).toBe("corners");
    expect(state.layout.width).toBe(56);
    expect(state.layout).toEqual(buildMatchLayout(MAPS[2] ?? expect.unreachable(""), 3));
  });

  it("reads ?map=", () => {
    const ids = MAPS.map((m) => m.id);
    expect(parseMap("?map=canyon", ids)).toBe("canyon");
    expect(parseMap("?map=random", ids)).toBe("random");
    expect(parseMap("", ids)).toBeNull();
    expect(() => parseMap("?map=moon", ids)).toThrow();
  });
});
