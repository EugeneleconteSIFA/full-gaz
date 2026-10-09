/**
 * Deterministic set-dressing placement (game-art skill, §8): clustered Poisson-disk points in
 * world units, kept away from gameplay areas. Pure function, no Phaser: testable and bake-time only.
 */

export interface ScatterOptions {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  /** Number of clusters, items per cluster [min, max], cluster spread (wu). */
  readonly clusters: number;
  readonly perCluster: readonly [number, number];
  readonly spread: number;
  /** Minimum distance between two items (wu). */
  readonly minGap: number;
  /** Returns false where nothing may be placed (bases, spawns, obstacles, firing lanes). */
  readonly allowed: (x: number, y: number) => boolean;
}

export interface ScatterItem {
  readonly x: number;
  readonly y: number;
  /** 0.8..1.2 size multiplier, and whether to mirror the sprite. */
  readonly scale: number;
  readonly flip: boolean;
  /** Stable 0..1 value to pick a variant. */
  readonly pick: number;
}

export function scatter(o: ScatterOptions): ScatterItem[] {
  let s = o.seed % 2147483647 || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const items: ScatterItem[] = [];
  const free = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x <= o.width &&
    y <= o.height &&
    o.allowed(x, y) &&
    items.every((i) => (i.x - x) ** 2 + (i.y - y) ** 2 >= o.minGap ** 2);
  for (let c = 0; c < o.clusters; c++) {
    const cx = rnd() * o.width;
    const cy = rnd() * o.height;
    const [lo, hi] = o.perCluster;
    const n = lo + Math.floor(rnd() * (hi - lo + 1));
    for (let k = 0, tries = 0; k < n && tries < n * 12; tries++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * o.spread;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      if (!free(x, y)) continue;
      items.push({ x, y, scale: 0.8 + rnd() * 0.4, flip: rnd() < 0.5, pick: rnd() });
      k++;
    }
  }
  return items;
}
