import { setVec2, type Vec2 } from "../core/math";

/**
 * Converts a drag from `origin` to `current` into a stick vector of length 0..1.
 * Drags shorter than the dead zone read as zero; the remaining range is rescaled so the
 * output still starts near 0 just outside the dead zone.
 */
export function joystickVector(
  originX: number,
  originY: number,
  currentX: number,
  currentY: number,
  radius: number,
  deadZone: number,
  out: Vec2,
): Vec2 {
  const dx = currentX - originX;
  const dy = currentY - originY;
  const distance = Math.hypot(dx, dy);
  const deadDistance = deadZone * radius;
  if (distance <= deadDistance || distance === 0) return setVec2(out, 0, 0);

  const travel = Math.min(distance, radius);
  const magnitude = (travel - deadDistance) / (radius - deadDistance);
  return setVec2(out, (dx / distance) * magnitude, (dy / distance) * magnitude);
}

/** -1, 0 or 1 from two opposing digital inputs. */
export function digitalAxis(negative: boolean, positive: boolean): number {
  return (positive ? 1 : 0) - (negative ? 1 : 0);
}
