import { setVec2, type Vec2 } from "../core/math";

export interface AimCandidate {
  readonly x: number;
  readonly y: number;
}

/**
 * Touch aim assist: if a target lies within `coneRadians` of the aimed direction and within
 * `maxRange`, writes the direction to the closest-angle one into `out` and returns true.
 * Otherwise leaves `out` untouched and returns false. `canSee` filters out targets behind cover.
 */
export function assistAim(
  out: Vec2,
  fromX: number,
  fromY: number,
  aimX: number,
  aimY: number,
  targets: readonly AimCandidate[],
  coneRadians: number,
  maxRange: number,
  canSee: (x: number, y: number) => boolean,
): boolean {
  const aimLength = Math.hypot(aimX, aimY);
  if (aimLength === 0) return false;
  const ax = aimX / aimLength;
  const ay = aimY / aimLength;
  const minCos = Math.cos(coneRadians);

  let best: AimCandidate | null = null;
  let bestCos = minCos;
  for (const t of targets) {
    const dx = t.x - fromX;
    const dy = t.y - fromY;
    const d = Math.hypot(dx, dy);
    if (d === 0 || d > maxRange) continue;
    const cos = (dx * ax + dy * ay) / d;
    if (cos < bestCos || !canSee(t.x, t.y)) continue;
    best = t;
    bestCos = cos;
  }
  if (!best) return false;
  setVec2(out, best.x - fromX, best.y - fromY);
  return true;
}
