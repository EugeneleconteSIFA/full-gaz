import type Phaser from "phaser";
import type { MapId, ResourceId } from "../core/types";
import { mix } from "./artKit";
import { css, valueNoise } from "./canvasBake";
import { scatter } from "./scatter";
import type { BiomeTheme } from "./theme";
import { THEME } from "./theme";
import { toPixels } from "./units";

/**
 * The whole playable ground of a map, painted once in Canvas 2D (game-art skill, §8):
 * 1. soft large-scale color variation (smooth noise, no grid);
 * 2. flat features per biome: stone slabs, cracks, clover, pebbles;
 * 3. small standing-looking details: grass tufts, flowers (kept out of gameplay areas);
 * 4. ambient occlusion along the board edges.
 * Everything stays within a narrow value range around the ground color, so characters, zones and
 * obstacles keep the strongest contrast. Drawn top-down: the ground layer applies the tilt.
 */

/** Many mobile GPUs cap textures at 4096 px per side. */
const MAX_TEXTURE_PX = 4096;
const MAX_SCALE = 2;
const KEY = "ground_painted";

export interface GroundTexture {
  readonly key: string;
  /** Texture pixels per world pixel: display the image at 1 / scale. */
  readonly scale: number;
}

type Ctx = CanvasRenderingContext2D;
type Rand = () => number;

export function paintGround(
  scene: Phaser.Scene,
  mapId: MapId,
  biome: BiomeTheme,
  widthUnits: number,
  heightUnits: number,
  allowed: (x: number, y: number) => boolean,
  seed: number,
  key = KEY,
  yards: readonly Yard[] = [],
  yardRadiusUnits = 0,
): GroundTexture {
  const w = toPixels(widthUnits);
  const h = toPixels(heightUnits);
  const k = Math.min(MAX_SCALE, MAX_TEXTURE_PX / Math.max(w, h));
  // The layout (bases, obstacles) changes per match: always repaint.
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * k);
  canvas.height = Math.ceil(h * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D context for the ground");
  ctx.scale(k, k);

  let s = seed % 2147483647 || 1;
  const rnd: Rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const unit = toPixels(1);
  const style = groundStyle(mapId, biome);

  ctx.fillStyle = css(biome.ground);
  ctx.fillRect(0, 0, w, h);
  paintVariation(ctx, w, h, biome, seed);

  const area = widthUnits * heightUnits;
  const place = (
    clusters: number,
    perCluster: readonly [number, number],
    spread: number,
    minGap: number,
    where: (x: number, y: number) => boolean,
  ) =>
    scatter({
      width: widthUnits,
      height: heightUnits,
      seed: Math.floor(rnd() * 1e9),
      clusters: Math.round(clusters),
      perCluster,
      spread,
      minGap,
      allowed: where,
    });
  const anywhere = () => true;

  // Flat features: allowed under zones too (they read as ground, not as objects).
  for (const p of place(area / style.slabEvery, [2, 5], 1.8, 1.1, anywhere)) {
    slab(ctx, p.x * unit, p.y * unit, unit * (0.5 + p.pick * 0.45) * p.scale, style, rnd);
  }
  if (style.cracks) {
    for (const p of place(area / 45, [1, 1], 2, 3, anywhere))
      crack(ctx, p.x * unit, p.y * unit, unit, style.crack, rnd);
  }
  for (const p of place(area / 60, [3, 7], 1.1, 0.35, anywhere)) {
    clover(ctx, p.x * unit, p.y * unit, unit * 0.22 * p.scale, style.patch);
  }
  // Small details are drawn once as stamps (a few variants), then copied: drawing every blade
  // with its own gradient cost ~220 ms on Quatre-Coins.
  const stamp = (half: number, draw: (c: Ctx) => void): HTMLCanvasElement => {
    const c = document.createElement("canvas");
    c.width = c.height = Math.ceil(half * 2 * k);
    const sctx = c.getContext("2d");
    if (!sctx) throw new Error("No 2D context for a ground stamp");
    sctx.scale(k, k);
    sctx.translate(half, half);
    draw(sctx);
    return c;
  };
  const put = (
    st: HTMLCanvasElement,
    half: number,
    x: number,
    y: number,
    scale: number,
    flip = false,
  ) => {
    const d = half * scale;
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(st, -d, -d, d * 2, d * 2);
    ctx.restore();
  };
  const pebbleHalf = unit * 0.2;
  const pebbleStamp = stamp(pebbleHalf, (c) => pebble(c, 0, 0, unit * 0.1, biome));
  for (const p of place(area / 70, [2, 4], 1, 0.4, allowed)) {
    put(pebbleStamp, pebbleHalf, p.x * unit, p.y * unit, p.scale, p.flip);
  }
  // Standing-looking details: never inside zones, spawns or next to obstacles.
  const tuftHalf = unit * 0.5;
  const tufts = Array.from({ length: 6 }, () =>
    stamp(tuftHalf, (c) => tuft(c, 0, 0, unit * 0.32, style, false, rnd)),
  );
  for (const p of place(area / style.tuftEvery, [3, 6], 1.2, 0.42, allowed)) {
    const st = tufts[Math.floor(p.pick * tufts.length)] as HTMLCanvasElement;
    put(st, tuftHalf, p.x * unit, p.y * unit, p.scale, p.flip);
  }
  const flowerHalf = unit * 0.2;
  const flowers = [biome.flower, style.flower2].map((color) =>
    stamp(flowerHalf, (c) => flower(c, 0, 0, unit * 0.07, color)),
  );
  for (const p of place(area / style.flowerEvery, [2, 5], 0.9, 0.35, allowed)) {
    put(
      flowers[p.pick < 0.65 ? 0 : 1] as HTMLCanvasElement,
      flowerHalf,
      p.x * unit,
      p.y * unit,
      p.scale,
    );
  }
  paintYards(ctx, yards, yardRadiusUnits, k, seed);
  edgeOcclusion(ctx, w, h, unit);

  scene.textures.addCanvas(key, canvas);
  return { key, scale: k };
}

interface GroundStyle {
  readonly slab: number;
  readonly slabEdge: number;
  readonly slabEvery: number;
  readonly cracks: boolean;
  readonly crack: number;
  readonly patch: number;
  readonly blade: number;
  readonly bladeTip: number;
  readonly tuftEvery: number;
  readonly flowerEvery: number;
  readonly flower2: number;
}

function groundStyle(mapId: MapId, biome: BiomeTheme): GroundStyle {
  const base = {
    slab: mix(biome.ground, biome.detail, 0.35),
    slabEdge: mix(biome.groundShade, 0x10141d, 0.25),
    slabEvery: 45,
    cracks: false,
    crack: mix(biome.groundShade, 0x10141d, 0.35),
    patch: mix(biome.ground, biome.groundShade, 0.75),
    blade: mix(biome.groundShade, 0x1e3a14, 0.3),
    bladeTip: biome.detail,
    tuftEvery: 13,
    flowerEvery: 70,
    flower2: 0xffd166,
  };
  if (mapId === "canyon") {
    // Dry sandstone floor: big pale slabs, cracks, few dry tufts.
    return {
      ...base,
      slab: mix(biome.ground, 0xffe2b8, 0.45),
      slabEvery: 6,
      cracks: true,
      blade: 0x9a7a3a,
      bladeTip: 0xd9c27a,
      tuftEvery: 30,
      flowerEvery: 120,
      flower2: 0xf6d7a8,
    };
  }
  if (mapId === "corners") {
    // Old courtyard: grey-green flagstones in the grass, moss.
    return {
      ...base,
      slab: mix(biome.rock, biome.ground, 0.55),
      slabEvery: 18,
      flower2: 0xc9b6ff,
    };
  }
  return base;
}

/** Large soft blotches: a tiny noise canvas stretched with smoothing (cheap, no grid). */
function paintVariation(ctx: Ctx, w: number, h: number, biome: BiomeTheme, seed: number): void {
  const cell = 40;
  const cw = Math.ceil(w / cell) + 1;
  const ch = Math.ceil(h / cell) + 1;
  const small = document.createElement("canvas");
  small.width = cw;
  small.height = ch;
  const sctx = small.getContext("2d");
  if (!sctx) return;
  const n = valueNoise(seed);
  const n2 = valueNoise(seed + 7);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const v = n(x / 5, y / 5) * 0.7 + n2(x / 1.7, y / 1.7) * 0.3;
      const color =
        v < 0.5
          ? mix(biome.groundShade, biome.ground, v * 2)
          : mix(biome.ground, biome.detail, (v - 0.5) * 1.2);
      sctx.fillStyle = css(color);
      sctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, cw * cell, ch * cell);
  ctx.restore();
}

/** Flat irregular stone slab: drop shadow down-right, lit rim up-left, a few specks. */
function slab(ctx: Ctx, x: number, y: number, r: number, st: GroundStyle, rnd: Rand): void {
  const n = 5 + Math.floor(rnd() * 3);
  const rot = rnd() * Math.PI;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const rr = r * (0.6 + rnd() * 0.45);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85]);
  }
  const trace = (dx: number, dy: number) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy)));
    ctx.closePath();
  };
  trace(r * 0.08, r * 0.12);
  ctx.fillStyle = css(st.slabEdge, 0.25);
  ctx.fill();
  trace(0, 0);
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, css(mix(st.slab, 0xffffff, 0.12)));
  g.addColorStop(1, css(st.slab));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = css(st.slabEdge, 0.2);
  ctx.stroke();
  ctx.fillStyle = css(st.slabEdge, 0.18);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r * 0.8, 0.8 + rnd(), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A big dry-earth crack: a long wandering line with one or two branches (few, bold shapes). */
function crack(ctx: Ctx, x: number, y: number, unit: number, color: number, rnd: Rand): void {
  const branch = (sx: number, sy: number, a0: number, steps: number, width: number) => {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    let a = a0;
    let px = sx;
    let py = sy;
    const forks: [number, number, number][] = [];
    for (let i = 0; i < steps; i++) {
      a += (rnd() - 0.5) * 0.9;
      px += Math.cos(a) * unit * 0.55;
      py += Math.sin(a) * unit * 0.55;
      ctx.lineTo(px, py);
      if (i > 1 && rnd() < 0.25) forks.push([px, py, a + (rnd() < 0.5 ? 0.9 : -0.9)]);
    }
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = css(color, 0.55);
    ctx.stroke();
    return forks;
  };
  const forks = branch(x, y, rnd() * Math.PI * 2, 8, 2.6);
  for (const [fx, fy, fa] of forks.slice(0, 2)) branch(fx, fy, fa, 3, 1.6);
}

/** Clover / moss patch: overlapping soft discs a little darker than the ground. */
function clover(ctx: Ctx, x: number, y: number, r: number, color: number): void {
  ctx.fillStyle = css(color, 0.55);
  for (const [dx, dy] of [
    [0, 0],
    [0.8, 0.3],
    [-0.6, 0.5],
    [0.2, -0.7],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pebble(ctx: Ctx, x: number, y: number, r: number, biome: BiomeTheme): void {
  ctx.fillStyle = css(THEME.shadow.color, 0.25);
  ctx.beginPath();
  ctx.ellipse(x + r * 0.3, y + r * 0.4, r * 1.1, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r * 1.2);
  g.addColorStop(0, css(mix(biome.rock, 0xffffff, 0.35)));
  g.addColorStop(1, css(biome.rockShade));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.1, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Grass tuft: 4–6 curved blades, dark at the root, light at the tip, with a soft root shadow. */
function tuft(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  st: GroundStyle,
  flip: boolean,
  rnd: Rand,
): void {
  ctx.fillStyle = css(THEME.shadow.color, 0.18);
  ctx.beginPath();
  ctx.ellipse(x + size * 0.1, y + size * 0.08, size * 0.6, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  const blades = 4 + Math.floor(rnd() * 3);
  const dir = flip ? -1 : 1;
  for (let i = 0; i < blades; i++) {
    const t = blades > 1 ? i / (blades - 1) - 0.5 : 0;
    const bx = x + t * size * 0.8;
    const len = size * (0.75 + rnd() * 0.5) * (1 - Math.abs(t) * 0.5);
    const lean = (t * 0.9 + dir * 0.15) * size;
    const bw = size * 0.12;
    const g = ctx.createLinearGradient(0, y, 0, y - len);
    g.addColorStop(0, css(st.blade));
    g.addColorStop(1, css(st.bladeTip));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - bw, y);
    ctx.quadraticCurveTo(bx - bw * 0.3 + lean * 0.3, y - len * 0.6, bx + lean, y - len);
    ctx.quadraticCurveTo(bx + bw * 0.3 + lean * 0.3, y - len * 0.6, bx + bw, y);
    ctx.closePath();
    ctx.fill();
  }
}

function flower(ctx: Ctx, x: number, y: number, r: number, color: number): void {
  ctx.fillStyle = css(THEME.shadow.color, 0.2);
  ctx.beginPath();
  ctx.arc(x + r * 0.4, y + r * 0.5, r * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(color);
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = css(THEME.base.contested);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Darkens the ground toward the board edges (stronger under the back hedge): the board sinks in. */
function edgeOcclusion(ctx: Ctx, w: number, h: number, unit: number): void {
  const band = unit * 1.6;
  const dark = (a: number) => `rgba(16,20,29,${a})`;
  const sides: [number, number, number, number, number, number, number, number, number][] = [
    // x0, y0, x1, y1 of the gradient, rect x, y, w, h, alpha
    [0, 0, 0, band * 1.3, 0, 0, w, band * 1.3, 0.35],
    [0, h, 0, h - band, 0, h - band, w, band, 0.2],
    [0, 0, band, 0, 0, 0, band, h, 0.22],
    [w, 0, w - band, 0, w - band, 0, band, h, 0.22],
  ];
  for (const [x0, y0, x1, y1, rx, ry, rw, rh, a] of sides) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, dark(a));
    g.addColorStop(1, dark(0));
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }
}

export interface Yard {
  /** Zone center, world units. */
  readonly x: number;
  readonly y: number;
  readonly resourceId: ResourceId;
}

/**
 * Paints the ground of each base zone after its resource (a wheat field around the windmill, a
 * vegetable garden by the barn...), so the base reads before its icon. Soft round patch fading
 * at the zone edge; the zone ring, badge and building are drawn on top.
 */
export function paintYards(
  ctx: Ctx,
  yards: readonly Yard[],
  radiusUnits: number,
  k: number,
  seed: number,
): void {
  const unit = toPixels(1);
  // A little wider than the zone: the soft edge then ends just outside the ring.
  const R = radiusUnits * unit * 1.15;
  yards.forEach((yard, i) => {
    const c = document.createElement("canvas");
    c.width = c.height = Math.ceil(R * 2 * k);
    const y = c.getContext("2d");
    if (!y) return;
    y.scale(k, k);
    y.translate(R, R);
    let s = (seed + i * 7919) % 2147483647 || 1;
    const rnd: Rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    YARD_PAINTERS[yard.resourceId](y, R, unit, rnd);
    // Soft round edge: solid middle, fading out over the outer third.
    y.globalCompositeOperation = "destination-in";
    const mask = y.createRadialGradient(0, 0, R * 0.7, 0, 0, R);
    mask.addColorStop(0, "rgba(0,0,0,1)");
    mask.addColorStop(0.6, "rgba(0,0,0,0.75)");
    mask.addColorStop(1, "rgba(0,0,0,0)");
    y.fillStyle = mask;
    y.fillRect(-R, -R, R * 2, R * 2);
    ctx.drawImage(c, yard.x * unit - R, yard.y * unit - R, R * 2, R * 2);
  });
}

type YardPainter = (c: Ctx, R: number, unit: number, rnd: Rand) => void;

const fillAll = (c: Ctx, R: number, color: number) => {
  c.fillStyle = css(color);
  c.fillRect(-R, -R, R * 2, R * 2);
};

/** Rows across the patch (seen tilted, horizontal rows read best). */
const rows = (R: number, gap: number, draw: (y: number) => void) => {
  for (let y = -R + gap / 2; y < R; y += gap) draw(y);
};

const YARD_PAINTERS: Record<ResourceId, YardPainter> = {
  // Windmill: a golden wheat field in rows, with a couple of round hay bales.
  power: (c, R, unit, rnd) => {
    fillAll(c, R, 0xd9a94a);
    rows(R, unit * 0.42, (y) => {
      c.fillStyle = css(0xa8742a, 0.7);
      c.fillRect(-R, y + unit * 0.14, R * 2, unit * 0.08);
      for (let x = -R; x < R; x += unit * 0.11) {
        const hgt = unit * (0.16 + rnd() * 0.08);
        c.strokeStyle = css(rnd() < 0.5 ? 0xf2cf6b : 0xe4b850);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x, y + unit * 0.14);
        c.lineTo(x + unit * 0.03, y + unit * 0.14 - hgt);
        c.stroke();
        c.fillStyle = css(0xfbe39a);
        c.beginPath();
        c.ellipse(x + unit * 0.035, y + unit * 0.14 - hgt, 1.6, 2.6, 0.2, 0, Math.PI * 2);
        c.fill();
      }
    });
    for (const [bx, by] of [
      [-0.55, 0.45],
      [0.6, 0.3],
    ] as const)
      bale(c, bx * R, by * R, unit * 0.32);
  },
  // Barn: tilled vegetable rows (dark soil, cabbages and carrot tops).
  food: (c, R, unit, rnd) => {
    fillAll(c, R, 0x8a6240);
    rows(R, unit * 0.5, (y) => {
      c.fillStyle = css(0x6a4528);
      c.fillRect(-R, y + unit * 0.12, R * 2, unit * 0.12);
      c.fillStyle = css(0xa47a52, 0.6);
      c.fillRect(-R, y - unit * 0.02, R * 2, unit * 0.06);
      const carrots = rnd() < 0.5;
      for (let x = -R + rnd() * unit * 0.3; x < R; x += unit * 0.38) {
        if (carrots) {
          c.fillStyle = css(0x4f9a3a);
          for (const dx of [-3, 0, 3]) {
            c.beginPath();
            c.ellipse(x + dx, y + 2, 1.6, 4.5, dx * 0.15, 0, Math.PI * 2);
            c.fill();
          }
          c.fillStyle = css(0xf08a2c);
          c.fillRect(x - 2, y + 5, 4, 3);
        } else {
          const g = c.createRadialGradient(x - 2, y - 2, 0, x, y, unit * 0.13);
          g.addColorStop(0, css(0xb9e48a));
          g.addColorStop(1, css(0x4f8f37));
          c.fillStyle = g;
          c.beginPath();
          c.arc(x, y + 2, unit * 0.12, 0, Math.PI * 2);
          c.fill();
        }
      }
    });
  },
  // Sawmill: dark bark-mulch floor (reads on the sandy canyon too), wood chips, two stumps and a few planks.
  wood: (c, R, unit, rnd) => {
    fillAll(c, R, 0x9a6a40);
    for (let i = 0; i < 320; i++) {
      c.save();
      c.translate((rnd() * 2 - 1) * R, (rnd() * 2 - 1) * R);
      c.rotate(rnd() * Math.PI);
      c.fillStyle = css(rnd() < 0.6 ? 0xe6c79a : 0x6e4a27, 0.9);
      c.fillRect(-2.5, -1, 5, 2);
      c.restore();
    }
    for (const [px, py, a] of [
      [-0.5, 0.35, 0.2],
      [0.35, 0.55, -0.15],
      [0.55, -0.15, 0.6],
    ] as const) {
      c.save();
      c.translate(px * R, py * R);
      c.rotate(a);
      c.fillStyle = "rgba(16,20,29,0.25)";
      c.fillRect(-unit * 0.45 + 2, -unit * 0.07 + 3, unit * 0.9, unit * 0.14);
      c.fillStyle = css(0xb88552);
      c.fillRect(-unit * 0.45, -unit * 0.07, unit * 0.9, unit * 0.14);
      c.strokeStyle = css(0x6e4a27);
      c.lineWidth = 1.2;
      c.strokeRect(-unit * 0.45, -unit * 0.07, unit * 0.9, unit * 0.14);
      c.restore();
    }
    for (const [sx, sy] of [
      [0.6, 0.3],
      [-0.6, -0.1],
    ] as const)
      stump(c, sx * R, sy * R, unit * 0.28);
  },
  // Quarry: grey gravel, scattered rubble and two cracked slabs.
  stone: (c, R, unit, rnd) => {
    fillAll(c, R, 0xa3a8ad);
    for (let i = 0; i < 260; i++) {
      const x = (rnd() * 2 - 1) * R;
      const y = (rnd() * 2 - 1) * R;
      const r = 1 + rnd() * 2.5;
      c.fillStyle = css(rnd() < 0.5 ? 0xc7cbd0 : 0x7b8188, 0.9);
      c.beginPath();
      c.ellipse(x, y, r * 1.3, r, rnd() * 3, 0, Math.PI * 2);
      c.fill();
    }
    for (const [bx, by] of [
      [-0.45, 0.4],
      [0.5, 0.35],
      [0.1, 0.65],
    ] as const) {
      const x = bx * R;
      const y = by * R;
      const s = unit * 0.32;
      c.fillStyle = "rgba(16,20,29,0.25)";
      c.fillRect(x - s / 2 + 2, y - s / 2 + 3, s, s * 0.8);
      const g = c.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2);
      g.addColorStop(0, css(0xdfe3e7));
      g.addColorStop(1, css(0x8d99ae));
      c.fillStyle = g;
      c.fillRect(x - s / 2, y - s / 2, s, s * 0.8);
      c.strokeStyle = css(0x5c6676);
      c.lineWidth = 1.2;
      c.strokeRect(x - s / 2, y - s / 2, s, s * 0.8);
    }
  },
  // Forge: scorched earth, soot blotches, glowing cinders and bits of scrap iron.
  metal: (c, R, unit, rnd) => {
    fillAll(c, R, 0x6f6660);
    for (let i = 0; i < 18; i++) {
      const x = (rnd() * 2 - 1) * R * 0.8;
      const y = (rnd() * 2 - 1) * R * 0.8;
      const g = c.createRadialGradient(x, y, 0, x, y, unit * (0.3 + rnd() * 0.4));
      g.addColorStop(0, "rgba(35,30,30,0.55)");
      g.addColorStop(1, "rgba(35,30,30,0)");
      c.fillStyle = g;
      c.fillRect(x - unit, y - unit, unit * 2, unit * 2);
    }
    for (let i = 0; i < 40; i++) {
      const x = (rnd() * 2 - 1) * R;
      const y = (rnd() * 2 - 1) * R;
      const g = c.createRadialGradient(x, y, 0, x, y, 4);
      g.addColorStop(0, css(0xffd27a));
      g.addColorStop(0.4, css(0xff7a2c, 0.8));
      g.addColorStop(1, css(0xff7a2c, 0));
      c.fillStyle = g;
      c.fillRect(x - 4, y - 4, 8, 8);
    }
    for (let i = 0; i < 14; i++) {
      c.save();
      c.translate((rnd() * 2 - 1) * R * 0.8, (rnd() * 2 - 1) * R * 0.8);
      c.rotate(rnd() * Math.PI);
      c.fillStyle = css(rnd() < 0.5 ? 0x8a9099 : 0xb0663a);
      c.fillRect(-4, -2, 8, 4);
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.fillRect(-4, -2, 8, 1);
      c.restore();
    }
  },
};

/** Round hay bale seen from above-front: spiral face, lit top-left, soft shadow. */
function bale(c: Ctx, x: number, y: number, r: number): void {
  c.fillStyle = "rgba(16,20,29,0.3)";
  c.beginPath();
  c.ellipse(x + r * 0.2, y + r * 0.35, r * 1.05, r * 0.8, 0, 0, Math.PI * 2);
  c.fill();
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r * 1.1);
  g.addColorStop(0, css(0xfbe39a));
  g.addColorStop(0.6, css(0xe4b850));
  g.addColorStop(1, css(0xa8742a));
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = css(0x8a5a1c);
  c.lineWidth = 2;
  c.stroke();
  c.strokeStyle = css(0xa8742a, 0.8);
  c.lineWidth = 1.2;
  c.beginPath();
  for (let a = 0; a < Math.PI * 6; a += 0.2) {
    const rr = (a / (Math.PI * 6)) * r * 0.85;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (a === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.stroke();
}

function stump(c: Ctx, x: number, y: number, r: number): void {
  c.fillStyle = "rgba(16,20,29,0.3)";
  c.beginPath();
  c.ellipse(x + r * 0.25, y + r * 0.35, r * 1.1, r * 0.85, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = css(0x6e4a27);
  c.beginPath();
  c.arc(x, y, r * 1.05, 0, Math.PI * 2);
  c.fill();
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  g.addColorStop(0, css(0xf3dcb8));
  g.addColorStop(1, css(0xc99a64));
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r * 0.85, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = css(0x9c6b3c, 0.7);
  c.lineWidth = 1;
  for (const k of [0.3, 0.55]) {
    c.beginPath();
    c.arc(x, y, r * k, 0, Math.PI * 2);
    c.stroke();
  }
}
