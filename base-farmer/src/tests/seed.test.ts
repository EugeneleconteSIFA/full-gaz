import { describe, expect, it } from "vitest";
import { parseSeed } from "../core/seed";

describe("parseSeed", () => {
  it("uses ?seed= when present", () => {
    expect(parseSeed("?seed=42", () => 7)).toBe(42);
  });

  it("falls back when absent", () => {
    expect(parseSeed("", () => 7)).toBe(7);
  });

  it("fails loudly on invalid values", () => {
    expect(() => parseSeed("?seed=abc", () => 7)).toThrow();
    expect(() => parseSeed("?seed=-1", () => 7)).toThrow();
    expect(() => parseSeed("?seed=1.5", () => 7)).toThrow();
  });
});
