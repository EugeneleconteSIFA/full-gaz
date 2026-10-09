import type Phaser from "phaser";

/**
 * Small drawing kit for baked art (docs: .claude/skills/game-art/SKILL.md). Everything here runs
 * once, at bake time, into a texture: none of it may be called from a per-frame update.
 *
 * Light comes from the top left (THEME.shadow): lit side up-left, shade and heavier outline
 * down-right.
 */

export type Pt = { x: number; y: number };

/**
 * Closed Catmull-Rom spline through `pts`, sampled into a polygon. Gives organic, soft shapes
 * (beans, scarves, leaves) from a handful of control points instead of stiff ellipses.
 */
export function blob(pts: readonly (readonly [number, number])[], steps = 6): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n] as readonly [number, number];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(x0, x1, x2, x3), y: f(y0, y1, y2, y3) });
    }
  }
  return out;
}

/** Open Catmull-Rom curve through `pts` (end points kept), for limbs, stems and strokes. */
export function curve(pts: readonly (readonly [number, number])[], steps = 6): Pt[] {
  const first = pts[0] as readonly [number, number];
  const last = pts[pts.length - 1] as readonly [number, number];
  const ext = [first, ...pts, last];
  const out: Pt[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const [x0, y0] = ext[i - 1] as readonly [number, number];
    const [x1, y1] = ext[i] as readonly [number, number];
    const [x2, y2] = ext[i + 1] as readonly [number, number];
    const [x3, y3] = ext[i + 2] as readonly [number, number];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t * t +
          (-a + 3 * b - 3 * c + d) * t * t * t);
      out.push({ x: f(x0, x1, x2, x3), y: f(y0, y1, y2, y3) });
    }
  }
  out.push({ x: last[0], y: last[1] });
  return out;
}

/** Scales a shape around its centroid, then shifts it. */
export function inset(pts: readonly Pt[], k: number, dx = 0, dy = 0): Pt[] {
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts.map((p) => ({ x: cx + (p.x - cx) * k + dx, y: cy + (p.y - cy) * k + dy }));
}

function bounds(pts: readonly Pt[]): { w: number; h: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  return { w: x1 - x0, h: y1 - y0 };
}

export interface VolumeStyle {
  readonly fill: number;
  readonly shade: number;
  readonly outline: number;
  readonly outlinePx: number;
  /** Highlight (top left) and bounce light (bottom right edge) opacity; 0 turns them off. */
  readonly highlight?: number;
  readonly bounce?: number;
}

/**
 * A lit volume in 4 bake-time passes: heavier outline on the shadow side, shade, lit core shifted
 * toward the light (a 2-band gradient), soft highlight, thin bounce light, then the outline.
 */
export function volume(g: Phaser.GameObjects.Graphics, pts: readonly Pt[], s: VolumeStyle): void {
  const { w, h } = bounds(pts);
  // Shadow-side weight: the outline color peeks out down-right of the shape.
  g.fillStyle(s.outline).fillPoints(inset(pts, 1, s.outlinePx * 0.5, s.outlinePx * 0.6), true);
  g.fillStyle(s.shade).fillPoints(pts as Pt[], true);
  // Two bands: a mid tone, then the lit core, both pushed toward the top-left light.
  g.fillStyle(mix(s.shade, s.fill, 0.55)).fillPoints(
    inset(pts, 0.94, -w * 0.025, -h * 0.025),
    true,
  );
  g.fillStyle(s.fill).fillPoints(inset(pts, 0.86, -w * 0.06, -h * 0.06), true);
  if (s.highlight) {
    g.fillStyle(0xffffff, s.highlight).fillPoints(inset(pts, 0.32, -w * 0.18, -h * 0.26), true);
  }
  if (s.bounce) {
    // Bounce light: a light sliver along the lower-right edge, inside the outline.
    const edge = inset(pts, 0.9, w * 0.01, h * 0.01);
    const lower = edge.filter((_, i) => i > edge.length * 0.05 && i < edge.length * 0.45);
    g.lineStyle(s.outlinePx * 0.9, 0xffffff, s.bounce).strokePoints(lower, false, false);
  }
  g.lineStyle(s.outlinePx, s.outline).strokePoints(pts as Pt[], true, true);
}

/** A tapered stroke (limbs, stems): thick at the start, thin at the end, outlined. */
export function taper(
  g: Phaser.GameObjects.Graphics,
  path: readonly Pt[],
  from: number,
  to: number,
  fill: number,
  outline: number,
  outlinePx: number,
): void {
  for (const pass of [0, 1]) {
    for (let i = 0; i < path.length; i++) {
      const p = path[i] as Pt;
      const t = path.length > 1 ? i / (path.length - 1) : 0;
      const rad = (from + (to - from) * t) / 2;
      if (pass === 0) g.fillStyle(outline).fillCircle(p.x, p.y, rad + outlinePx);
      else g.fillStyle(fill).fillCircle(p.x, p.y, rad);
    }
  }
}

/**
 * Deterministic speckles inside a shape (skin, stone, wood grain): matter for almost no code.
 * Same seed, same speckles, so re-bakes never flicker.
 */
export function speckle(
  g: Phaser.GameObjects.Graphics,
  pts: readonly Pt[],
  count: number,
  sizePx: number,
  color: number,
  alpha: number,
  seed = 1,
): void {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  let x0 = Infinity;
  let y0 = Infinity;
  const { w, h } = bounds(pts);
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
  }
  g.fillStyle(color, alpha);
  for (let placed = 0, tries = 0; placed < count && tries < count * 20; tries++) {
    const x = x0 + rnd() * w;
    const y = y0 + rnd() * h;
    if (!inside(pts, x, y)) continue;
    g.fillCircle(x, y, sizePx * (0.6 + rnd() * 0.6));
    placed++;
  }
}

function inside(pts: readonly Pt[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i] as Pt;
    const b = pts[j] as Pt;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** Linear mix of two 0xRRGGBB colors (t = 0 gives a, 1 gives b). */
export function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t) << shift;
  return ch(16) | ch(8) | ch(0);
}
