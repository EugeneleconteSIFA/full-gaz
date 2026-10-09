import type Phaser from "phaser";
import type { ResourceId } from "../core/types";
import { THEME } from "./theme";

const OUTLINE = 0x181c26;

/**
 * Draws a resource icon of half-size `size` centered on (x, y). Each resource has its own
 * silhouette: food = round fruit with a leaf, wood = log, stone = pentagon,
 * metal = ingot, power (flour, D059) = a tied flour sack.
 */
export function drawResourceIcon(
  g: Phaser.GameObjects.Graphics,
  id: ResourceId,
  x: number,
  y: number,
  size: number,
): void {
  const color = THEME.resources[id];
  const line = Math.max(1.5, size * 0.2);
  g.fillStyle(color).lineStyle(line, OUTLINE);
  const poly = (pts: readonly (readonly [number, number])[]) => {
    const points = pts.map(([px, py]) => ({ x: x + px * size, y: y + py * size }));
    g.fillPoints(points, true).strokePoints(points, true);
  };

  switch (id) {
    case "food":
      g.fillCircle(x, y + size * 0.1, size * 0.85).strokeCircle(x, y + size * 0.1, size * 0.85);
      g.fillStyle(0x5fbf4a);
      poly([
        [0, -0.7],
        [0.6, -1.1],
        [0.25, -0.55],
      ]);
      return;
    case "wood":
      g.fillRoundedRect(x - size, y - size * 0.55, size * 2, size * 1.1, size * 0.3);
      g.strokeRoundedRect(x - size, y - size * 0.55, size * 2, size * 1.1, size * 0.3);
      g.fillStyle(0xd9a86c)
        .fillCircle(x + size * 0.6, y, size * 0.35)
        .strokeCircle(x + size * 0.6, y, size * 0.35);
      return;
    case "stone":
      poly([
        [0, -1],
        [0.95, -0.3],
        [0.6, 0.85],
        [-0.6, 0.85],
        [-0.95, -0.3],
      ]);
      return;
    case "metal":
      poly([
        [-0.6, -0.55],
        [0.6, -0.55],
        [1, 0.55],
        [-1, 0.55],
      ]);
      return;
    case "power":
      // Flour sack: a plump body, a tied neck and a little flared top.
      poly([
        [-0.3, -0.55],
        [-0.8, -0.1],
        [-0.85, 0.65],
        [-0.55, 0.95],
        [0.55, 0.95],
        [0.85, 0.65],
        [0.8, -0.1],
        [0.3, -0.55],
        [0.5, -0.95],
        [-0.5, -0.95],
      ]);
      g.fillStyle(0xc9a46a);
      g.fillRoundedRect(x - size * 0.42, y - size * 0.62, size * 0.84, size * 0.2, size * 0.08);
      return;
  }
}

/**
 * Resource icon on a dark round badge with a light rim: readable on every biome, whatever the
 * resource color (the ground alone gives these colors less than 3:1 contrast).
 */
export function drawResourceBadge(
  g: Phaser.GameObjects.Graphics,
  id: ResourceId,
  x: number,
  y: number,
  size: number,
): void {
  const badge = THEME.resourceBadge;
  const r = size * 1.75;
  g.fillStyle(badge.fill).fillCircle(x, y, r);
  g.lineStyle(badge.strokePx, badge.stroke).strokeCircle(x, y, r);
  drawResourceIcon(g, id, x, y, size);
}
