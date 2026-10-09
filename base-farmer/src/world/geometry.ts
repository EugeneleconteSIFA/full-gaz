import { clamp, type Vec2 } from "../core/math";

/** Purely visual: how an obstacle is drawn. Collision only uses the shape. */
export type ObstacleLook = "rock" | "wall" | "fence" | "crate" | "barrel";

export interface CircleObstacle {
  readonly kind: "circle";
  readonly look?: ObstacleLook;
  readonly center: Readonly<Vec2>;
  readonly radius: number;
}

/** Axis-aligned rectangle, described by its center and half sizes (easy to mirror). */
export interface RectObstacle {
  readonly kind: "rect";
  readonly look?: ObstacleLook;
  readonly center: Readonly<Vec2>;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

/** Blocks movement and projectiles. */
export type Obstacle = CircleObstacle | RectObstacle;

/** Does a circle of radius `r` at (x, y) overlap the obstacle? Touching does not count. */
export function circleOverlapsObstacle(x: number, y: number, r: number, o: Obstacle): boolean {
  if (o.kind === "circle") {
    const reach = r + o.radius;
    const dx = x - o.center.x;
    const dy = y - o.center.y;
    return dx * dx + dy * dy < reach * reach;
  }
  const cx = clamp(x, o.center.x - o.halfWidth, o.center.x + o.halfWidth);
  const cy = clamp(y, o.center.y - o.halfHeight, o.center.y + o.halfHeight);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

/** Moves a circle of radius `r` (in place) to the nearest position touching, not overlapping, the obstacle. */
export function pushCircleOut(p: Vec2, r: number, o: Obstacle): void {
  if (!circleOverlapsObstacle(p.x, p.y, r, o)) return;

  if (o.kind === "circle") {
    let dx = p.x - o.center.x;
    let dy = p.y - o.center.y;
    let d = Math.hypot(dx, dy);
    if (d === 0) {
      // Dead center: push right, deterministically.
      dx = 1;
      dy = 0;
      d = 1;
    }
    const target = o.radius + r;
    p.x = o.center.x + (dx / d) * target;
    p.y = o.center.y + (dy / d) * target;
    return;
  }

  const left = o.center.x - o.halfWidth;
  const right = o.center.x + o.halfWidth;
  const top = o.center.y - o.halfHeight;
  const bottom = o.center.y + o.halfHeight;
  const inside = p.x > left && p.x < right && p.y > top && p.y < bottom;

  if (inside) {
    // Center inside the rectangle: leave by the shortest side.
    const exits = [p.x - left, right - p.x, p.y - top, bottom - p.y];
    const min = Math.min(...exits);
    if (min === exits[0]) p.x = left - r;
    else if (min === exits[1]) p.x = right + r;
    else if (min === exits[2]) p.y = top - r;
    else p.y = bottom + r;
    return;
  }

  const cx = clamp(p.x, left, right);
  const cy = clamp(p.y, top, bottom);
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d = Math.hypot(dx, dy);
  p.x = cx + (dx / d) * r;
  p.y = cy + (dy / d) * r;
}

/** Point-symmetric image of `p` around the center of a width x height map. */
export function pointMirror(p: Readonly<Vec2>, width: number, height: number): Vec2 {
  return { x: width - p.x, y: height - p.y };
}

/**
 * Does any obstacle cut the segment a→b? Sampled every 0.2 wu, finer than the thinnest obstacle
 * allowed by map validation (0.8 wu).
 */
export function segmentBlocked(
  obstacles: readonly Obstacle[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const o of obstacles) if (circleOverlapsObstacle(x, y, 0.01, o)) return true;
  }
  return false;
}
