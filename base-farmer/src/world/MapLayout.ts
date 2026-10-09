import { GAME_CONFIG } from "../config/gameConfig";
import { length, type Vec2 } from "../core/math";
import { createRng, nextFloat, type RngState } from "../core/Random";
import { TEAM_IDS, type BaseId, type TeamId } from "../core/types";
import { circleOverlapsObstacle, pointMirror, type Obstacle } from "./geometry";

export interface BaseLayout {
  readonly id: BaseId;
  readonly position: Readonly<Vec2>;
}

/**
 * The geometry a match is played on. A map definition is a layout; a match uses a variant of
 * it (mirrored, bases nudged) generated from the seed and stored in the match state.
 */
export interface MapLayout {
  /** World units. The playable area is [0, width] x [0, height]. */
  readonly width: number;
  readonly height: number;
  readonly spawns: Readonly<Record<TeamId, Readonly<Vec2>>>;
  readonly bases: readonly BaseLayout[];
  readonly obstacles: readonly Obstacle[];
}

/** Separate from the match RNG so map variation never shifts resources or production. */
const LAYOUT_SEED_SALT = 0x85ebca6b;
/** Distance under which two points count as each other's mirror image. */
const MIRROR_TOLERANCE = 1e-6;

function mirrorPoint(
  p: Readonly<Vec2>,
  w: number,
  h: number,
  flipX: boolean,
  flipY: boolean,
): Vec2 {
  return { x: flipX ? w - p.x : p.x, y: flipY ? h - p.y : p.y };
}

function mirrorLayout(layout: MapLayout, flipX: boolean, flipY: boolean): MapLayout {
  const { width: w, height: h } = layout;
  const m = (p: Readonly<Vec2>) => mirrorPoint(p, w, h, flipX, flipY);
  return {
    width: w,
    height: h,
    spawns: { teamA: m(layout.spawns.teamA), teamB: m(layout.spawns.teamB) },
    bases: layout.bases.map((b) => ({ id: b.id, position: m(b.position) })),
    obstacles: layout.obstacles.map((o) => ({ ...o, center: m(o.center) })),
  };
}

/**
 * Nudges each pair of point-symmetric bases by a random offset, applied mirrored to the twin,
 * so the layout stays point-symmetric (fair). A base that is its own mirror (the map center)
 * does not move.
 */
function jitterBases(layout: MapLayout, rng: RngState, maxOffset: number): MapLayout {
  const { width: w, height: h } = layout;
  const moved = layout.bases.map((b) => ({ id: b.id, position: { ...b.position } }));
  const done = new Set<number>();

  moved.forEach((base, i) => {
    if (done.has(i)) return;
    done.add(i);
    const image = pointMirror(base.position, w, h);
    const twin = moved.findIndex(
      (other, j) =>
        !done.has(j) &&
        length(other.position.x - image.x, other.position.y - image.y) < MIRROR_TOLERANCE,
    );
    if (twin < 0) return; // self-symmetric (or asymmetric, rejected by validation anyway)
    done.add(twin);
    const angle = nextFloat(rng) * Math.PI * 2;
    const distance = nextFloat(rng) * maxOffset;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    base.position.x += dx;
    base.position.y += dy;
    const other = moved[twin];
    if (other) {
      other.position.x -= dx;
      other.position.y -= dy;
    }
  });

  return { ...layout, bases: moved };
}

/**
 * The layout a match is played on: the map, randomly flipped horizontally (which side each team
 * starts on) and vertically, with bases nudged symmetrically. Invalid nudges are retried, then
 * dropped, so the result always passes `findLayoutErrors`.
 */
export function buildMatchLayout(map: MapLayout, seed: number): MapLayout {
  const rng = createRng((seed ^ LAYOUT_SEED_SALT) >>> 0);
  const { baseJitter, jitterAttempts } = GAME_CONFIG.maps;
  const mirrored = mirrorLayout(map, nextFloat(rng) < 0.5, nextFloat(rng) < 0.5);

  for (let attempt = 0; attempt < jitterAttempts; attempt++) {
    const candidate = jitterBases(mirrored, rng, baseJitter);
    if (findLayoutErrors(candidate).length === 0) return candidate;
  }
  return mirrored;
}

// ---------------------------------------------------------------------------------------------
// Validation

/** Clearance used for walkability: the biggest character body. */
function walkerRadius(): number {
  return GAME_CONFIG.maps.walkerRadius;
}

function blocked(layout: MapLayout, x: number, y: number, r: number): boolean {
  if (x - r < 0 || y - r < 0 || x + r > layout.width || y + r > layout.height) return true;
  return layout.obstacles.some((o) => circleOverlapsObstacle(x, y, r, o));
}

/**
 * Grid flood fill from `from` (cells of `cellSize`): which grid cells a character body can
 * reach. Returns a function telling whether a point is reachable.
 */
export function reachableFrom(
  layout: MapLayout,
  from: Readonly<Vec2>,
): (p: Readonly<Vec2>) => boolean {
  const cell = GAME_CONFIG.maps.reachabilityCellSize;
  const r = walkerRadius();
  const cols = Math.ceil(layout.width / cell);
  const rows = Math.ceil(layout.height / cell);
  const cellOf = (p: Readonly<Vec2>) => ({
    c: Math.min(cols - 1, Math.max(0, Math.floor(p.x / cell))),
    r: Math.min(rows - 1, Math.max(0, Math.floor(p.y / cell))),
  });
  const walkable = (c: number, row: number) =>
    !blocked(layout, (c + 0.5) * cell, (row + 0.5) * cell, r);

  const seen = new Uint8Array(cols * rows);
  const start = cellOf(from);
  const queue: number[] = [];
  if (walkable(start.c, start.r)) {
    seen[start.r * cols + start.c] = 1;
    queue.push(start.r * cols + start.c);
  }
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head] ?? 0;
    const c = index % cols;
    const row = Math.floor(index / cols);
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nc = c + dc;
      const nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (seen[ni] || !walkable(nc, nr)) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return (p) => {
    const { c, r: row } = cellOf(p);
    return seen[row * cols + c] === 1;
  };
}

/** Every reason a layout is unplayable or unfair. Empty array = valid. */
export function findLayoutErrors(layout: MapLayout, name = "layout"): string[] {
  const errors: string[] = [];
  const { baseCount } = GAME_CONFIG.match;
  const zone = GAME_CONFIG.capture.radius;
  const { minObstacleHalfSize } = GAME_CONFIG.maps;
  const { width: w, height: h } = layout;

  if (!(w > 0) || !(h > 0)) errors.push(`${name}: width and height must be > 0`);
  if (layout.bases.length !== baseCount) {
    errors.push(`${name} has ${layout.bases.length} bases, expected ${baseCount}`);
  }
  const ids = new Set<string>();
  for (const b of layout.bases) {
    if (ids.has(b.id)) errors.push(`${name}: duplicate base id "${b.id}"`);
    ids.add(b.id);
  }

  for (const o of layout.obstacles) {
    const thin =
      o.kind === "circle"
        ? o.radius < minObstacleHalfSize
        : Math.min(o.halfWidth, o.halfHeight) < minObstacleHalfSize;
    if (thin)
      errors.push(
        `${name}: obstacle at (${o.center.x}, ${o.center.y}) is too thin to stop projectiles`,
      );
  }

  for (const teamId of TEAM_IDS) {
    const s = layout.spawns[teamId];
    if (blocked(layout, s.x, s.y, walkerRadius()))
      errors.push(`${name}: ${teamId} spawn is blocked or outside the map`);
  }

  layout.bases.forEach((base, i) => {
    const { x, y } = base.position;
    if (x - zone < 0 || y - zone < 0 || x + zone > w || y + zone > h) {
      errors.push(`${name}: base "${base.id}" capture zone leaves the map`);
    }
    if (layout.obstacles.some((o) => circleOverlapsObstacle(x, y, zone, o))) {
      errors.push(`${name}: base "${base.id}" capture zone overlaps an obstacle`);
    }
    for (const other of layout.bases.slice(i + 1)) {
      if (length(other.position.x - x, other.position.y - y) < 2 * zone) {
        errors.push(`${name}: bases "${base.id}" and "${other.id}" have overlapping zones`);
      }
    }
    for (const teamId of TEAM_IDS) {
      const s = layout.spawns[teamId];
      if (length(s.x - x, s.y - y) <= zone)
        errors.push(`${name}: ${teamId} spawn is inside base "${base.id}"`);
    }
  });

  // Fairness: the layout must be point-symmetric, spawns included.
  const isMirrored = (a: Readonly<Vec2>, b: Readonly<Vec2>) => {
    const image = pointMirror(a, w, h);
    return length(image.x - b.x, image.y - b.y) < 1e-6;
  };
  if (!isMirrored(layout.spawns.teamA, layout.spawns.teamB)) {
    errors.push(`${name}: spawns are not point-symmetric`);
  }
  for (const b of layout.bases) {
    if (!layout.bases.some((other) => isMirrored(b.position, other.position))) {
      errors.push(`${name}: base "${b.id}" has no symmetric twin`);
    }
  }
  for (const o of layout.obstacles) {
    if (
      !layout.obstacles.some((other) => other.kind === o.kind && isMirrored(o.center, other.center))
    ) {
      errors.push(`${name}: obstacle at (${o.center.x}, ${o.center.y}) has no symmetric twin`);
    }
  }

  // Every base must be reachable on foot from both spawns.
  if (errors.length === 0) {
    for (const teamId of TEAM_IDS) {
      const canReach = reachableFrom(layout, layout.spawns[teamId]);
      for (const b of layout.bases) {
        if (!canReach(b.position))
          errors.push(`${name}: base "${b.id}" is unreachable from the ${teamId} spawn`);
      }
    }
  }

  return errors;
}
