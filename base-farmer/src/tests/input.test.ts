import { describe, expect, it } from "vitest";
import { vec2 } from "../core/math";
import { CommandWriter } from "../input/CommandWriter";
import { createInputState } from "../input/InputState";
import { digitalAxis, joystickVector } from "../input/joystick";

describe("joystickVector", () => {
  it("reads zero inside the dead zone", () => {
    expect(joystickVector(0, 0, 5, 0, 100, 0.1, vec2())).toEqual({ x: 0, y: 0 });
  });

  it("reaches full magnitude at the radius and clamps beyond it", () => {
    const out = joystickVector(0, 0, 300, 0, 100, 0.1, vec2());
    expect(out.x).toBeCloseTo(1);
    expect(out.y).toBeCloseTo(0);
  });

  it("rescales the range outside the dead zone", () => {
    const out = joystickVector(0, 0, 0, 55, 100, 0.1, vec2());
    expect(out.y).toBeCloseTo(0.5);
  });
});

describe("digitalAxis", () => {
  it("combines opposing keys", () => {
    expect(digitalAxis(true, false)).toBe(-1);
    expect(digitalAxis(false, true)).toBe(1);
    expect(digitalAxis(true, true)).toBe(0);
  });
});

describe("CommandWriter", () => {
  it("always writes move, attack and ability, and writes aim only when aiming", () => {
    const writer = new CommandWriter("p1");
    const input = createInputState();
    input.moveVector = vec2(0.5, 0);

    let commands = writer.write(input);
    expect(commands).toEqual([
      { type: "move", playerId: "p1", vector: { x: 0.5, y: 0 } },
      { type: "attack", playerId: "p1", active: false },
      { type: "ability", playerId: "p1", active: false },
    ]);

    input.aimVector = vec2(3, 4);
    input.attackPressed = true;
    input.abilityPressed = true;
    commands = writer.write(input);
    expect(commands).toHaveLength(4);
    expect(commands[1]).toEqual({ type: "aim", playerId: "p1", direction: { x: 3, y: 4 } });
    expect(commands[2]).toEqual({ type: "attack", playerId: "p1", active: true });
    expect(commands[3]).toEqual({ type: "ability", playerId: "p1", active: true });
  });
});
