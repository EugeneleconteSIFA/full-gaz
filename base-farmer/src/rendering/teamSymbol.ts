import type Phaser from "phaser";
import type { BaseOwner } from "../core/types";
import { THEME } from "./theme";

/** Draws an owner's symbol (circle / diamond / ring) of half-size `size` centered on (x, y). */
export function drawOwnerSymbol(
  g: Phaser.GameObjects.Graphics,
  owner: BaseOwner,
  x: number,
  y: number,
  size: number,
  outline: number,
): void {
  const { primary, symbol } = THEME.teams[owner];
  const outlinePx = Math.max(2, size * 0.25);
  switch (symbol) {
    case "circle":
      g.fillStyle(primary).fillCircle(x, y, size);
      g.lineStyle(outlinePx, outline).strokeCircle(x, y, size);
      return;
    case "diamond": {
      const d = size * 1.25;
      const points = [
        { x, y: y - d },
        { x: x + d, y },
        { x, y: y + d },
        { x: x - d, y },
      ];
      g.fillStyle(primary).fillPoints(points, true);
      g.lineStyle(outlinePx, outline).strokePoints(points, true);
      return;
    }
    case "ring":
      g.lineStyle(outlinePx * 1.5, primary).strokeCircle(x, y, size * 0.8);
      return;
  }
}
