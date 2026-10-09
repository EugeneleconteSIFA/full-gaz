import { describe, expect, it } from "vitest";
import { FixedStepClock } from "../core/FixedStepClock";

describe("FixedStepClock", () => {
  it("runs one tick per elapsed step and keeps the remainder", () => {
    const clock = new FixedStepClock(10, 5);
    let ticks = 0;
    expect(clock.advance(25, () => ticks++)).toBe(2);
    expect(ticks).toBe(2);
    expect(clock.alpha).toBeCloseTo(0.5);
    expect(clock.advance(5, () => ticks++)).toBe(1);
    expect(clock.alpha).toBeCloseTo(0);
  });

  it("caps catch-up after a stall and drops the backlog", () => {
    const clock = new FixedStepClock(10, 3);
    let ticks = 0;
    expect(clock.advance(1000, () => ticks++)).toBe(3);
    expect(clock.alpha).toBe(0);
    expect(clock.advance(0, () => ticks++)).toBe(0);
  });

  it("ignores negative frame times", () => {
    const clock = new FixedStepClock(10, 3);
    expect(clock.advance(-50, () => undefined)).toBe(0);
    expect(clock.alpha).toBe(0);
  });
});
