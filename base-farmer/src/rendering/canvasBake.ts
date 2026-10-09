import type Phaser from "phaser";
import { BAKE_SCALE } from "./bake";

/**
 * Canvas 2D baking: same "draw once into a texture" contract as bakeTexture(), but with the full
 * Canvas 2D API — radial/linear gradients, blurred shadows, blend modes, clipping. That is what
 * makes shapes read as smooth 3D volumes (game-art skill, §6). Never call from a per-frame update.
 *
 * Coordinates are display pixels with the origin at the texture center, like bakeTexture().
 */
export function bakeCanvas(
  scene: Phaser.Scene,
  key: string,
  widthPx: number,
  heightPx: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): string {
  if (scene.textures.exists(key)) return key;
  const w = Math.ceil(widthPx * BAKE_SCALE);
  const h = Math.ceil(heightPx * BAKE_SCALE);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`Cannot create canvas texture "${key}"`);
  const ctx = tex.getContext();
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(BAKE_SCALE, BAKE_SCALE);
  draw(ctx);
  ctx.restore();
  tex.refresh();
  return key;
}

/** Light direction: top left, normalized (matches THEME.shadow). */
const LIGHT = { x: -0.55, y: -0.65 };

export const css = (c: number, a = 1): string =>
  `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

/** Traces a closed smooth path through points (use with fill/stroke/clip). */
export function pathOf(
  ctx: CanvasRenderingContext2D,
  pts: readonly { x: number; y: number }[],
): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

export interface ShadeOpts {
  /** Lit, mid and shadow colors (0xRRGGBB). Shadow should be hue-shifted, not just darker. */
  readonly light: number;
  readonly mid: number;
  readonly dark: number;
  readonly outline: number;
  readonly outlinePx: number;
  /** Specular spot opacity (0 = matte: cloth, potato; 0.6+ = glossy: goggles, metal). */
  readonly gloss?: number;
  /** Rim/bounce light along the shadow edge (0..1). */
  readonly rim?: number;
}

/**
 * The "3D look" in one call, painted like a 3D render: on the current shape it lays
 * 1. a strong radial body gradient (near-white at the light, deep cool shade away from it);
 * 2. a core shadow: the crescent of the shape that the light cannot reach (the shape minus a
 *    copy shifted toward the light), slightly blurred so the terminator stays readable;
 * 3. reflected light: a light band just inside the shadowed edge (light bouncing off the ground);
 * 4. occlusion at the bottom; 5. a sharp specular spot with a soft halo; 6. the outline.
 * `cx, cy, rad` describe the shape's rough center and radius.
 */
export function shadeVolume(
  ctx: CanvasRenderingContext2D,
  pts: readonly { x: number; y: number }[],
  cx: number,
  cy: number,
  rad: number,
  o: ShadeOpts,
): void {
  const big = rad * 4;
  ctx.save();
  pathOf(ctx, pts);
  ctx.clip();
  // 1. Body gradient, hot spot toward the light.
  const g = ctx.createRadialGradient(
    cx + LIGHT.x * rad * 0.5,
    cy + LIGHT.y * rad * 0.5,
    rad * 0.02,
    cx + LIGHT.x * rad * 0.15,
    cy + LIGHT.y * rad * 0.15,
    rad * 1.35,
  );
  g.addColorStop(0, css(mixCss(o.light, 0xffffff, 0.35)));
  g.addColorStop(0.3, css(o.light));
  g.addColorStop(0.62, css(o.mid));
  g.addColorStop(1, css(o.dark));
  ctx.fillStyle = g;
  ctx.fillRect(cx - big, cy - big, big * 2, big * 2);
  // 2. Core shadow: everything not covered by the shape shifted toward the light.
  const shift = rad * 0.32;
  ctx.save();
  ctx.filter = `blur(${Math.max(1, rad * 0.08)}px)`;
  ctx.beginPath();
  ctx.rect(cx - big, cy - big, big * 2, big * 2);
  pts.forEach((p, i) =>
    i
      ? ctx.lineTo(p.x + LIGHT.x * shift, p.y + LIGHT.y * shift)
      : ctx.moveTo(p.x + LIGHT.x * shift, p.y + LIGHT.y * shift),
  );
  ctx.closePath();
  ctx.fillStyle = css(o.dark, 0.55);
  ctx.fill("evenodd");
  ctx.restore();
  // 3. Reflected light inside the shadowed edge (lower right), cool and soft.
  if (o.rim) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.filter = `blur(${Math.max(1, rad * 0.06)}px)`;
    pathOf(ctx, pts);
    ctx.lineWidth = rad * 0.16;
    const rg = ctx.createLinearGradient(cx, cy, cx - LIGHT.x * rad, cy - LIGHT.y * rad);
    rg.addColorStop(0, "rgba(160,190,255,0)");
    rg.addColorStop(1, `rgba(170,200,255,${o.rim})`);
    ctx.strokeStyle = rg;
    ctx.stroke();
    ctx.restore();
  }
  // 4. Occlusion toward the bottom (contact with the ground or the part below).
  const ao = ctx.createLinearGradient(0, cy + rad * 0.45, 0, cy + rad);
  ao.addColorStop(0, "rgba(20,14,40,0)");
  ao.addColorStop(1, "rgba(20,14,40,0.28)");
  ctx.fillStyle = ao;
  ctx.fillRect(cx - big, cy + rad * 0.45, big * 2, rad);
  // 5. Specular: sharp core + soft halo near the light side.
  if (o.gloss) {
    const sx = cx + LIGHT.x * rad * 0.48;
    const sy = cy + LIGHT.y * rad * 0.5;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad * 0.4);
    halo.addColorStop(0, `rgba(255,255,255,${o.gloss * 0.6})`);
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, o.gloss * 1.2)})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, rad * 0.11, rad * 0.07, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // 6. Outline (none for puppet parts: their silhouettes merge into one body, 2.5D style).
  if (o.outlinePx <= 0) return;
  pathOf(ctx, pts);
  ctx.lineJoin = "round";
  ctx.lineWidth = o.outlinePx;
  ctx.strokeStyle = css(o.outline);
  ctx.stroke();
}

function mixCss(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - t) + ((b >> s) & 0xff) * t) << s;
  return ch(16) | ch(8) | ch(0);
}

/** Soft contact shadow (ambient occlusion) under a standing thing, flattened by the tilt. */
export function contactShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  alpha = 0.45,
  tilt = 0.72,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, w / 2);
  g.addColorStop(0, `rgba(16,20,29,${alpha})`);
  g.addColorStop(1, "rgba(16,20,29,0)");
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, tilt * 0.6);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y - w / 2, w, w);
  ctx.restore();
}

/**
 * Smooth value noise in [0, 1], deterministic. Use it for ground variation, stone/wood grain,
 * cloth wear — low amplitude (alpha 0.05–0.15) so it adds matter without noise at 48 px.
 */
export function valueNoise(seed: number): (x: number, y: number) => number {
  const hash = (i: number, j: number) => {
    let h = (i * 374761393 + j * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const u = smooth(x - i);
    const v = smooth(y - j);
    const a = hash(i, j);
    const b = hash(i + 1, j);
    const c = hash(i, j + 1);
    const d = hash(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Overlays noise inside the current clip/region as light and dark blotches (texture "matter"). */
export function grain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cellPx: number,
  alpha: number,
  seed = 1,
): void {
  const n = valueNoise(seed);
  const step = Math.max(1, cellPx / 3);
  for (let py = y; py < y + h; py += step) {
    for (let px = x; px < x + w; px += step) {
      const v = n(px / cellPx, py / cellPx) - 0.5;
      ctx.fillStyle =
        v > 0 ? `rgba(255,255,255,${v * alpha * 2})` : `rgba(0,0,0,${-v * alpha * 2})`;
      ctx.fillRect(px, py, step, step);
    }
  }
}

const relit = new Set<string>();

/**
 * Relights an already baked texture (Graphics or Canvas) in place: a soft light from the top left
 * and a darker base (ground occlusion), only on opaque pixels. Gives flat-shaded art a rounded,
 * lit look in one call. Bake-time only; runs once per texture key.
 */
export function relight(
  scene: Phaser.Scene,
  key: string,
  opts: { light?: number; shade?: number; base?: number } = {},
): void {
  if (relit.has(key) || !scene.textures.exists(key)) return;
  relit.add(key);
  const src = scene.textures.get(key).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const w = src.width;
  const h = src.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  const light = ctx.createRadialGradient(
    w * 0.3,
    h * 0.2,
    0,
    w * 0.3,
    h * 0.2,
    Math.max(w, h) * 0.75,
  );
  light.addColorStop(0, `rgba(255,248,230,${opts.light ?? 0.22})`);
  light.addColorStop(1, "rgba(255,248,230,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, w, h);
  const shade = ctx.createLinearGradient(w * 0.3, h * 0.2, w, h);
  shade.addColorStop(0, "rgba(30,25,60,0)");
  shade.addColorStop(1, `rgba(30,25,60,${opts.shade ?? 0.22})`);
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  const base = ctx.createLinearGradient(0, h * 0.7, 0, h);
  base.addColorStop(0, "rgba(16,20,29,0)");
  base.addColorStop(1, `rgba(16,20,29,${opts.base ?? 0.25})`);
  ctx.fillStyle = base;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}
