export interface Vec2 {
  x: number;
  y: number;
}

/** Below this length a vector is treated as zero (no direction). */
export const EPSILON = 1e-6;

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function setVec2(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}

export function length(x: number, y: number): number {
  return Math.hypot(x, y);
}

/** Writes the unit vector of (x, y) into `out`. Returns false (and leaves `out` untouched) for a zero vector. */
export function normalizeInto(out: Vec2, x: number, y: number): boolean {
  const len = length(x, y);
  if (len < EPSILON) return false;
  out.x = x / len;
  out.y = y / len;
  return true;
}

/** Scales `v` down in place so its length is at most `max`. */
export function clampLengthInPlace(v: Vec2, max: number): Vec2 {
  const len = length(v.x, v.y);
  if (len > max) {
    const scale = max / len;
    v.x *= scale;
    v.y *= scale;
  }
  return v;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
