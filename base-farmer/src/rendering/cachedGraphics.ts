import type Phaser from "phaser";

/**
 * Resolution of render textures, relative to world pixels. The camera magnifies the world up to
 * ~3.6x on Retina screens; 2x keeps cached drawings sharp at a reasonable memory cost.
 */
const RT_SCALE = 2;
/** Many mobile GPUs cap textures at 4096 px per side. */
const MAX_TEXTURE_PX = 4096;

function scaleFor(width: number, height: number): number {
  return Math.min(RT_SCALE, MAX_TEXTURE_PX / Math.max(width, height, 1));
}

/** Draws `g` into a new render texture at `scale`, displayed at 1/scale over (x, y, width, height). */
function toTexture(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
): Phaser.GameObjects.RenderTexture {
  const k = scaleFor(width, height);
  const texture = scene.add
    .renderTexture(x, y, Math.ceil(width * k), Math.ceil(height * k))
    .setOrigin(0, 0)
    .setScale(1 / k);
  g.setScale(k);
  texture.draw(g, -x * k, -y * k);
  return texture;
}

/**
 * Graphics re-tessellate every shape on every frame, which is costly for many arcs and dashes
 * (measured: ~10 ms per frame for the ground marks). A CachedGraphics draws into a hidden
 * Graphics only when its content changes, then copies the result into a RenderTexture, which
 * costs one quad per frame.
 */
export class CachedGraphics {
  readonly texture: Phaser.GameObjects.RenderTexture;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly k: number;

  /** `width` x `height` around (x, y), the center of what is drawn. */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly width: number,
    private readonly height: number,
  ) {
    this.g = scene.make.graphics({}, false);
    this.k = scaleFor(width, height);
    this.g.setScale(this.k);
    this.texture = scene.add
      .renderTexture(x, y, Math.ceil(width * this.k), Math.ceil(height * this.k))
      .setScale(1 / this.k);
  }

  /** Redraws with `draw`, whose (0, 0) is the center of the texture. */
  redraw(draw: (g: Phaser.GameObjects.Graphics) => void): void {
    this.g.clear();
    draw(this.g);
    this.texture.clear();
    this.texture.draw(this.g, (this.width * this.k) / 2, (this.height * this.k) / 2);
  }
}

/** Bakes a static Graphics into a RenderTexture once and destroys it (for drawings that never change). */
export function freezeGraphics(
  scene: Phaser.Scene,
  draw: (g: Phaser.GameObjects.Graphics) => void,
  x: number,
  y: number,
  width: number,
  height: number,
): Phaser.GameObjects.RenderTexture {
  const g = scene.make.graphics({}, false);
  draw(g);
  const texture = toTexture(scene, g, x, y, width, height);
  g.destroy();
  return texture;
}

/**
 * Bakes an already drawn, off-display Graphics (scene.make.graphics) into a RenderTexture
 * covering the screen rectangle (x, y, width, height), then destroys the Graphics. `pad` leaves
 * room for strokes.
 */
export function bakeGraphics(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  pad = 4,
): Phaser.GameObjects.RenderTexture {
  const texture = toTexture(scene, g, x - pad, y - pad, width + pad * 2, height + pad * 2);
  g.destroy();
  return texture;
}
