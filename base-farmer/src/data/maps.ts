import type { MapId } from "../core/types";
import type { Obstacle } from "../world/geometry";
import type { BaseLayout, MapLayout } from "../world/MapLayout";

/** Immutable base configuration. Runtime ownership lives in BaseState. */
export type BaseDefinition = BaseLayout;

/** A hand-authored map: a reference layout plus its name. Matches play a seeded variant of it. */
export interface MapDefinition extends MapLayout {
  readonly id: MapId;
  readonly label: string;
}

const rock = (x: number, y: number, radius: number): Obstacle => ({
  kind: "circle",
  center: { x, y },
  radius,
});

const wall = (x: number, y: number, halfWidth: number, halfHeight: number): Obstacle => ({
  kind: "rect",
  center: { x, y },
  halfWidth,
  halfHeight,
});

/** Farm props: same collision as a wall or a rock, drawn as a fence, a crate or a barrel. */
const fence = (x: number, y: number, halfWidth: number, halfHeight: number): Obstacle => ({
  ...wall(x, y, halfWidth, halfHeight),
  look: "fence",
});
const crate = (x: number, y: number): Obstacle => ({ ...wall(x, y, 0.6, 0.6), look: "crate" });
const barrel = (x: number, y: number): Obstacle => ({ ...rock(x, y, 0.45), look: "barrel" });

/**
 * The obstacles given plus their point mirror (x, y) -> (w - x, h - y): authoring one half of a
 * map is enough, and the twins required by the symmetry check are exact by construction.
 */
function mirrored(w: number, h: number, half: readonly Obstacle[]): Obstacle[] {
  return [
    ...half,
    ...half.map((o) => ({ ...o, center: { x: w - o.center.x, y: h - o.center.y } })),
  ];
}

/**
 * Hand-authored maps. Everything (spawns, bases, obstacles) is point-symmetric around the map
 * center, so every base close to one spawn has a twin equally close to the other. Startup
 * validation checks symmetry, placement and that every base can be walked to from both spawns.
 */
export const MAPS: readonly MapDefinition[] = [
  {
    // Open farmland in three lanes (D060): a walled central plaza with gaps on every side,
    // hedges of rock along the spawn sides, a stone wall splitting each team's two near bases
    // from the middle lane. Flanks for the fast, cover for melee walking up to a shooter.
    id: "meadow",
    label: "Prairie",
    width: 48,
    height: 32,
    spawns: { teamA: { x: 5, y: 16 }, teamB: { x: 43, y: 16 } },
    bases: [
      { id: "center", position: { x: 24, y: 16 } },
      { id: "north", position: { x: 24, y: 4.5 } },
      { id: "south", position: { x: 24, y: 27.5 } },
      { id: "northwest", position: { x: 12.5, y: 6.5 } },
      { id: "southeast", position: { x: 35.5, y: 25.5 } },
      { id: "southwest", position: { x: 12.5, y: 25.5 } },
      { id: "northeast", position: { x: 35.5, y: 6.5 } },
    ],
    obstacles: mirrored(48, 32, [
      // Central plaza: four wall pieces, open in the middle of each side.
      wall(19.5, 11, 2.5, 0.5),
      wall(28.5, 11, 2.5, 0.5),
      // Rocks screening the spawn lanes.
      rock(9, 12, 1.1),
      rock(9, 20, 1.1),
      // Stone wall between the near bases and the middle lane, a flank path above it.
      wall(17.5, 16, 0.5, 2.2),
      // Fence guarding the north base's open side.
      fence(19, 4.5, 0.4, 1.6),
      crate(30, 2.2),
      barrel(4.5, 27),
    ]),
  },
  {
    // The canyon corridor (D060): two long walls, now broken by a gap in the middle so the
    // center base can be reached from the north and south bases too; rock pillars inside the
    // corridor for cover. Evening light (lighting.ts).
    id: "canyon",
    label: "Canyon",
    width: 52,
    height: 30,
    spawns: { teamA: { x: 5, y: 15 }, teamB: { x: 47, y: 15 } },
    bases: [
      { id: "center", position: { x: 26, y: 15 } },
      { id: "north", position: { x: 26, y: 4.5 } },
      { id: "south", position: { x: 26, y: 25.5 } },
      { id: "northwest", position: { x: 13, y: 7.5 } },
      { id: "southeast", position: { x: 39, y: 22.5 } },
      { id: "southwest", position: { x: 13, y: 22.5 } },
      { id: "northeast", position: { x: 39, y: 7.5 } },
    ],
    obstacles: mirrored(52, 30, [
      // Corridor walls with a 4-unit gap at the middle.
      wall(20, 10, 4, 0.6),
      wall(32, 10, 4, 0.6),
      // Pillars inside the corridor.
      rock(19.5, 15, 0.9),
      // Open corridor mouth; short fences in the outer lanes give the fast a screened run
      // between the near bases and the far ones.
      fence(32, 4.5, 0.4, 1.4),
      rock(6, 4, 1.1),
      crate(19, 4.5),
      barrel(8, 25.5),
    ]),
  },
  {
    // Wide map, bases in the corners and mid-edges (D060), a little tighter than before so a
    // trailing team can still swing a far base late: four walls box a crossroads around the
    // center, rocks between the center and the edge bases give a shooter lines and cover.
    id: "corners",
    label: "Quatre-Coins",
    width: 56,
    height: 34,
    spawns: { teamA: { x: 5, y: 17 }, teamB: { x: 51, y: 17 } },
    bases: [
      { id: "center", position: { x: 28, y: 17 } },
      { id: "north", position: { x: 28, y: 4 } },
      { id: "south", position: { x: 28, y: 30 } },
      { id: "northwest", position: { x: 9.5, y: 5.5 } },
      { id: "southeast", position: { x: 46.5, y: 28.5 } },
      { id: "southwest", position: { x: 9.5, y: 28.5 } },
      { id: "northeast", position: { x: 46.5, y: 5.5 } },
    ],
    obstacles: mirrored(56, 34, [
      // Crossroads around the center.
      wall(21, 11.5, 0.6, 2.5),
      wall(35, 11.5, 0.6, 2.5),
      // Between the center and the north / south bases.
      rock(28, 10.5, 1.3),
      // Corner screens.
      fence(15.5, 9.5, 2, 0.4),
      crate(18, 30.5),
      barrel(13, 13.5),
      rock(4, 9, 1),
    ]),
  },
];
