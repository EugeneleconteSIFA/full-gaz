import { describe, expect, it } from "vitest";
import { vec2 } from "../core/math";
import type { PlayerState } from "../core/MatchState";
import { applyMovement } from "../gameplay/movement/MovementSystem";
import { makePlayer } from "./helpers";

function player(x: number, y: number, ix: number, iy: number): PlayerState {
  return makePlayer({ position: vec2(x, y), moveIntent: vec2(ix, iy) });
}

const bounds = { width: 20, height: 10 };

describe("applyMovement", () => {
  it("moves by speed * dt along the intent", () => {
    const p = player(5, 5, 1, 0);
    applyMovement(p, 4, 0.5, bounds, 0.5);
    expect(p.position.x).toBeCloseTo(7);
    expect(p.position.y).toBeCloseTo(5);
  });

  it("does not move faster diagonally", () => {
    const p = player(10, 5, 1, 1);
    applyMovement(p, 2, 0.5, bounds, 1);
    expect(Math.hypot(p.position.x - 10, p.position.y - 5)).toBeCloseTo(2);
  });

  it("keeps partial analog intent (joystick) proportional", () => {
    const p = player(5, 5, 0.5, 0);
    applyMovement(p, 4, 0.5, bounds, 1);
    expect(p.position.x).toBeCloseTo(7);
  });

  it("clamps the whole body inside the map", () => {
    const left = player(1, 1, -1, -1);
    applyMovement(left, 100, 0.5, bounds, 1);
    expect(left.position).toEqual({ x: 0.5, y: 0.5 });

    const right = player(19, 9, 1, 1);
    applyMovement(right, 100, 0.5, bounds, 1);
    expect(right.position).toEqual({ x: 19.5, y: 9.5 });
  });

  it("stays still with zero intent", () => {
    const p = player(5, 5, 0, 0);
    applyMovement(p, 4, 0.5, bounds, 1);
    expect(p.position).toEqual({ x: 5, y: 5 });
  });
});
