import { afterEach, describe, expect, it, vi } from "vitest";
import { STRINGS } from "../config/strings";
import { buildLocalMatchSetup } from "../core/localMatch";
import { vec2 } from "../core/math";
import { createMatchState } from "../core/Simulation";
import { assistAim } from "../input/aimAssist";
import { HapticFeedback } from "../rendering/HapticFeedback";
import { playerAt } from "./helpers";

const deg = (d: number) => (d * Math.PI) / 180;
const always = () => true;

describe("touch aim assist", () => {
  it("snaps onto an enemy inside the cone and in range", () => {
    const out = vec2(1, 0);
    expect(assistAim(out, 0, 0, 1, 0, [{ x: 5, y: 0.8 }], deg(12), 8, always)).toBe(true);
    expect(Math.atan2(out.y, out.x)).toBeCloseTo(Math.atan2(0.8, 5));
  });

  it("leaves the aim alone outside the cone, out of range or behind cover", () => {
    const out = vec2(1, 0);
    expect(assistAim(out, 0, 0, 1, 0, [{ x: 5, y: 3 }], deg(12), 8, always)).toBe(false);
    expect(assistAim(out, 0, 0, 1, 0, [{ x: 12, y: 0 }], deg(12), 8, always)).toBe(false);
    expect(assistAim(out, 0, 0, 1, 0, [{ x: 5, y: 0 }], deg(12), 8, () => false)).toBe(false);
    expect(out).toEqual({ x: 1, y: 0 });
  });

  it("picks the target closest to the aimed direction, not the nearest one", () => {
    const out = vec2();
    assistAim(
      out,
      0,
      0,
      1,
      0,
      [
        { x: 2, y: 0.35 },
        { x: 6, y: 0.1 },
      ],
      deg(12),
      8,
      always,
    );
    expect(out).toEqual({ x: 6, y: 0.1 });
  });

  it("does nothing without an aim direction", () => {
    expect(assistAim(vec2(), 0, 0, 0, 0, [{ x: 1, y: 0 }], deg(12), 8, always)).toBe(false);
  });
});

describe("compact HUD text", () => {
  it("keeps the production lines short", () => {
    expect(STRINGS.production.nextShort(3, "0:42")).toBe("×3 0:42");
    expect(
      STRINGS.production.receivedShort([
        ["Bois", 3],
        ["Pierre", 1],
      ]),
    ).toBe("+3 Bois +1 Pierre");
    expect(STRINGS.production.receivedShort([])).toBe("Rien reçu");
  });
});

describe("haptic feedback", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("vibrates when the local player is hit and when their team captures a base", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    const state = createMatchState(buildLocalMatchSetup(1, "fighter", "meadow"));
    const me = playerAt(state, 0);
    const haptics = new HapticFeedback(true, me, state);

    me.hp -= 10;
    haptics.update(state);
    expect(vibrate).toHaveBeenCalledTimes(1);

    const base = state.bases[0] ?? expect.unreachable("no base");
    base.owner = "teamB";
    haptics.update(state);
    expect(vibrate).toHaveBeenCalledTimes(1); // enemy capture: no vibration
    base.owner = "teamA";
    haptics.update(state);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it("stays silent when disabled (non-touch) or unsupported", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    const state = createMatchState(buildLocalMatchSetup(1, "fighter", "meadow"));
    const me = playerAt(state, 0);
    const haptics = new HapticFeedback(false, me, state);
    me.hp -= 10;
    haptics.update(state);
    expect(vibrate).not.toHaveBeenCalled();

    vi.stubGlobal("navigator", {});
    const unsupported = new HapticFeedback(true, me, state);
    me.hp -= 10;
    expect(() => unsupported.update(state)).not.toThrow();
  });
});
