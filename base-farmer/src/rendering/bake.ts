import type Phaser from "phaser";

/**
 * Texture resolution multiplier. Baked art is drawn at this scale and displayed at 1/BAKE_SCALE,
 * so it stays crisp when the camera zooms in (phones, Retina screens).
 */
export const BAKE_SCALE = 3;

/**
 * Draws once into a texture of `widthPx` x `heightPx` (display pixels), with the origin at the
 * texture center. Does nothing if the key already exists, so scenes can call it freely.
 */
export function bakeTexture(
  scene: Phaser.Scene,
  key: string,
  widthPx: number,
  heightPx: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.translateCanvas((widthPx * BAKE_SCALE) / 2, (heightPx * BAKE_SCALE) / 2);
  g.scaleCanvas(BAKE_SCALE, BAKE_SCALE);
  draw(g);
  g.generateTexture(key, Math.ceil(widthPx * BAKE_SCALE), Math.ceil(heightPx * BAKE_SCALE));
  g.destroy();
  return key;
}

/** Fills then outlines a closed polygon given as [x, y] pairs. */
export function polygon(
  g: Phaser.GameObjects.Graphics,
  points: readonly (readonly [number, number])[],
  fill: number,
  outline: number,
  outlinePx: number,
): void {
  const pts = points.map(([x, y]) => ({ x, y }));
  g.fillStyle(fill).fillPoints(pts, true);
  g.lineStyle(outlinePx, outline).strokePoints(pts, true, true);
}
