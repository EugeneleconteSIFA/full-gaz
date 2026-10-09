import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../config/gameConfig";
import { vec2 } from "../core/math";
import { CHARACTERS } from "../data/characters";
import {
  depthAt,
  screenAngle,
  screenToWorldDirection,
  screenX,
  screenY,
  TILT,
} from "../rendering/projection";

const PPU = GAME_CONFIG.rendering.pixelsPerUnit;

describe("tilted projection", () => {
  it("squashes the ground vertically only", () => {
    expect(TILT).toBeGreaterThan(0.5);
    expect(TILT).toBeLessThan(1);
    expect(screenX(3)).toBe(3 * PPU);
    expect(screenY(3)).toBeCloseTo(3 * PPU * TILT);
  });

  it("draws things lower on screen in front (depth grows with world y)", () => {
    expect(depthAt(5)).toBeLessThan(depthAt(5.01));
  });

  it("turns a screen drag into the matching world direction, same length", () => {
    // Straight up on screen = straight up in the world.
    const up = screenToWorldDirection(vec2(), 0, -1);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(-1);
    // Sideways is unchanged.
    expect(screenToWorldDirection(vec2(), 0.5, 0)).toEqual({ x: 0.5, y: 0 });
    // A screen diagonal points steeper in the world (the ground is squashed on screen).
    const diag = screenToWorldDirection(vec2(), 1, 1);
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(Math.SQRT2);
    expect(diag.y / diag.x).toBeCloseTo(1 / TILT);
    expect(screenToWorldDirection(vec2(), 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("round-trips: a world direction drawn on screen converts back to itself", () => {
    for (const [wx, wy] of [
      [1, 0],
      [0.6, 0.8],
      [-0.3, -0.95],
    ] as const) {
      const angle = screenAngle(wx, wy);
      const back = screenToWorldDirection(vec2(), Math.cos(angle), Math.sin(angle));
      const len = Math.hypot(back.x, back.y);
      expect(back.x / len).toBeCloseTo(wx / Math.hypot(wx, wy));
      expect(back.y / len).toBeCloseTo(wy / Math.hypot(wx, wy));
    }
  });
});

describe("characters", () => {
  it("has a name, not a role, as the shown label", () => {
    for (const c of CHARACTERS) expect(c.label).not.toBe(c.role);
    expect(CHARACTERS.map((c) => c.label)).toEqual([
      "Patatras",
      "Pépin",
      "Lorgnon",
      "Gaston",
      "Marguerite",
    ]);
  });
});
