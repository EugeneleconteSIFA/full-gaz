import { describe, expect, it } from "vitest";
import { BOT_UPGRADE_PRIORITIES } from "../data/bots";
import { CHARACTERS } from "../data/characters";
import { CHARACTER_MODEL, MODEL_ART } from "../rendering/characterArt";

/**
 * Adding a character (docs/14_ADD_A_CHARACTER.md): every roster character must be wired
 * everywhere, or the game falls back to Gaston's model / an idle bot without saying so.
 */
/** Model files shipped to the game (paths only: nothing is loaded). */
const SHIPPED = new Set(
  Object.keys(import.meta.glob("/public/models/*.glb")).map((p) => p.replace("/public/", "")),
);
const existsSync = (path: string) => SHIPPED.has(path.replace("public/", ""));

describe("roster wiring", () => {
  it.each(CHARACTERS.map((c) => [c.label, c.id]))("%s is fully wired", (_label, id) => {
    const model = CHARACTER_MODEL[id];
    expect(model, "line in CHARACTER_MODEL (rendering/characterArt.ts)").toBeDefined();
    expect(MODEL_ART[model ?? ""], "entry in MODEL_ART (rendering/characterArt.ts)").toBeDefined();
    expect(existsSync(`public/models/${model}.glb`), `public/models/${model}.glb`).toBe(true);
    expect(existsSync(`public/models/${model}.match.glb`), `public/models/${model}.match.glb`).toBe(
      true,
    );
    expect(BOT_UPGRADE_PRIORITIES[id], "BOT_UPGRADE_PRIORITIES (data/bots.ts)").toHaveLength(5);
  });

  it("has unique ids and names", () => {
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(CHARACTERS.length);
    expect(new Set(CHARACTERS.map((c) => c.label)).size).toBe(CHARACTERS.length);
  });

  it("maps only roster ids", () => {
    const ids = new Set(CHARACTERS.map((c) => c.id));
    for (const id of Object.keys(CHARACTER_MODEL)) expect(ids.has(id), id).toBe(true);
  });
});
