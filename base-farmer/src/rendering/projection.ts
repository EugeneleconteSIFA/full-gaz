import { GAME_CONFIG } from "../config/gameConfig";
import { setVec2, type Vec2 } from "../core/math";

/**
 * The tilted "brawler" view (D050). The simulation is flat top-down; rendering squashes the
 * ground plane vertically by TILT so the map leans toward the viewer, then draws standing things
 * (characters, buildings, rocks, walls) upright on top of it, sorted by depth.
 *
 * - Flat things (ground, zones, shadows, rings) live in a ground layer scaled (1, TILT): they keep
 *   their top-down drawing code.
 * - Standing things are placed at their feet's screen position and drawn upward.
 */
export const TILT: number = GAME_CONFIG.rendering.tilt;

const PPU = GAME_CONFIG.rendering.pixelsPerUnit;

/** World x → screen x (pixels at zoom 1). */
export function screenX(worldX: number): number {
  return worldX * PPU;
}

/** World y → screen y of a point on the ground (pixels at zoom 1). */
export function screenY(worldY: number): number {
  return worldY * PPU * TILT;
}

/** Draw order of standing objects: lower on screen = closer to the viewer = drawn later. */
export function depthAt(worldY: number): number {
  return screenY(worldY);
}

/** Screen room kept above the map's top edge for tall things standing on the back row. */
export const BACK_ROW_MARGIN_PX = 72;

/** Layers that are not depth-sorted. */
export const LAYER = {
  ground: -1_000_000,
  /** Zones, rings, shadows: above the ground, under every standing object. */
  groundMarks: -900_000,
  /** Floating effects and health bars: above every standing object. */
  overlay: 1_000_000,
} as const;

/**
 * A direction drawn on screen (a stick drag, a cursor offset) → the matching world direction,
 * same length. Undoes the vertical squash so "toward that spot on screen" stays exact.
 */
export function screenToWorldDirection(out: Vec2, dx: number, dy: number): Vec2 {
  const length = Math.hypot(dx, dy);
  const wy = dy / TILT;
  const worldLength = Math.hypot(dx, wy);
  if (worldLength === 0) return setVec2(out, 0, 0);
  return setVec2(out, (dx / worldLength) * length, (wy / worldLength) * length);
}

/** World direction → its on-screen angle (for rotating weapons and shots). */
export function screenAngle(worldDx: number, worldDy: number): number {
  return Math.atan2(worldDy * TILT, worldDx);
}
