import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../data/characters";
import { MAPS, type MapDefinition } from "../data/maps";
import { GAME_DATA } from "../data/gameData";
import { findGameDataErrors } from "../data/validateGameData";
import { computeCameraZoom } from "../rendering/cameraZoom";

const fighter = CHARACTERS[0] ?? expect.unreachable("no characters");

describe("game data validation", () => {
  it("accepts the shipped data", () => {
    expect(findGameDataErrors(GAME_DATA)).toEqual([]);
  });

  it("reports duplicates, bad stats and spawns outside the map", () => {
    const badMap: MapDefinition = {
      id: "m",
      label: "M",
      width: 10,
      height: 10,
      spawns: { teamA: { x: 5, y: 5 }, teamB: { x: 50, y: 5 } },
      bases: [],
      obstacles: [],
    };
    const errors = findGameDataErrors({
      ...GAME_DATA,
      characters: [
        { ...fighter, id: "c", moveSpeed: 0 },
        { ...fighter, id: "c", attackCooldown: -1 },
      ],
      maps: [badMap],
    });
    expect(errors).toContain('Duplicate character id "c"');
    expect(errors).toContain('Character "c" moveSpeed must be > 0');
    expect(errors).toContain('Character "c" attackCooldown must be > 0');
    expect(errors).toContain('Map "m": teamB spawn is blocked or outside the map');
    expect(errors).toContain('Map "m" has 0 bases, expected 7');
  });

  it("reports missing, unknown and unnamed resources", () => {
    const errors = findGameDataErrors({
      ...GAME_DATA,
      resources: [
        { id: "food", label: "", icon: "food" },
        { id: "wood", label: "Bois", icon: "wood" },
      ],
    });
    expect(errors).toContain('Resource "food" has an empty label');
    expect(errors).toContain('Missing resource definition "power"');
  });

  it("reports bad base placement", () => {
    const meadow = MAPS[0] ?? expect.unreachable("no maps");
    const bases = [...meadow.bases];
    bases[1] = { id: "center", position: { x: 25, y: 16 } };
    bases[2] = { id: "edge", position: { x: 1, y: 16 } };
    bases[3] = { id: "camp", position: meadow.spawns.teamA };
    const errors = findGameDataErrors({ ...GAME_DATA, maps: [{ ...meadow, bases }] });
    expect(errors).toContain('Map "meadow": duplicate base id "center"');
    expect(errors).toContain('Map "meadow": bases "center" and "center" have overlapping zones');
    expect(errors).toContain('Map "meadow": base "edge" capture zone leaves the map');
    expect(errors).toContain('Map "meadow": teamA spawn is inside base "camp"');
    expect(errors).toContain('Map "meadow": base "edge" has no symmetric twin');
  });

  it("keeps every shipped map fair: base distances to each spawn match", () => {
    for (const m of MAPS) {
      const distances = (spawn: { x: number; y: number }) =>
        m.bases
          .map((b) => Math.hypot(b.position.x - spawn.x, b.position.y - spawn.y))
          .sort((a, b) => a - b);
      const a = distances(m.spawns.teamA);
      const b = distances(m.spawns.teamB);
      a.forEach((d, i) => expect(d).toBeCloseTo(b[i] ?? NaN));
    }
  });
});

describe("computeCameraZoom", () => {
  it("shows the configured number of pixels along the short side", () => {
    expect(computeCameraZoom(1600, 900, 10000, 10000, 450)).toBe(2);
    expect(computeCameraZoom(390, 844, 10000, 10000, 390)).toBe(1);
  });

  it("never zooms out past the map", () => {
    expect(computeCameraZoom(2000, 500, 1000, 1000, 1000)).toBe(2);
  });
});
