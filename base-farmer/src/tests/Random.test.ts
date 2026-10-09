import { describe, expect, it } from "vitest";
import { createRng, nextFloat, nextInt } from "../core/Random";

describe("seeded RNG", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const seqA = Array.from({ length: 20 }, () => nextFloat(a));
    const seqB = Array.from({ length: 20 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(nextFloat(a)).not.toEqual(nextFloat(b));
  });

  it("stays in [0, 1) and nextInt stays in range", () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const f = nextFloat(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = nextInt(rng, 3, 8);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThan(8);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it("can resume from serialized state", () => {
    const rng = createRng(99);
    nextFloat(rng);
    const resumed = JSON.parse(JSON.stringify(rng)) as typeof rng;
    expect(nextFloat(resumed)).toEqual(nextFloat(rng));
  });

  it("rejects invalid seeds and ranges", () => {
    expect(() => createRng(1.5)).toThrow();
    expect(() => nextInt(createRng(1), 5, 5)).toThrow();
  });
});
