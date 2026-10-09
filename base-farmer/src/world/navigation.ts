import { GAME_CONFIG } from "../config/gameConfig";
import { setVec2, type Vec2 } from "../core/math";
import { circleOverlapsObstacle } from "./geometry";
import type { MapLayout } from "./MapLayout";

const SQRT2 = Math.SQRT2;
const NEIGHBORS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

/**
 * Walkability grid over a layout, for a body of `walkerRadius`. Built once per match from the
 * (immutable) layout; never stored in the match state since it can always be rebuilt.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  private readonly walkable: Uint8Array;

  constructor(
    readonly layout: MapLayout,
    readonly radius: number = GAME_CONFIG.maps.walkerRadius,
    cell: number = GAME_CONFIG.maps.reachabilityCellSize,
  ) {
    this.cell = cell;
    this.cols = Math.ceil(layout.width / cell);
    this.rows = Math.ceil(layout.height / cell);
    this.walkable = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.walkable[r * this.cols + c] = this.isClear((c + 0.5) * cell, (r + 0.5) * cell) ? 1 : 0;
      }
    }
  }

  /** Can a body stand at (x, y)? */
  isClear(x: number, y: number): boolean {
    const r = this.radius;
    const { width, height, obstacles } = this.layout;
    if (x - r < 0 || y - r < 0 || x + r > width || y + r > height) return false;
    for (const o of obstacles) if (circleOverlapsObstacle(x, y, r, o)) return false;
    return true;
  }

  indexOf(x: number, y: number): number {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell)));
    return r * this.cols + c;
  }

  isWalkableIndex(i: number): boolean {
    return this.walkable[i] === 1;
  }

  cellCenter(i: number, out: Vec2): Vec2 {
    return setVec2(
      out,
      ((i % this.cols) + 0.5) * this.cell,
      (Math.floor(i / this.cols) + 0.5) * this.cell,
    );
  }

  /**
   * Is the straight segment a→b free for the body? Sampled every quarter cell, which is finer
   * than any obstacle allowed by validation.
   */
  hasLineOfSight(ax: number, ay: number, bx: number, by: number, radius = this.radius): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (this.cell * 0.5)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = ax + dx * t;
      const y = ay + dy * t;
      for (const o of this.layout.obstacles)
        if (circleOverlapsObstacle(x, y, radius, o)) return false;
    }
    return true;
  }

  /** Neighbor offsets that are walkable without cutting a blocked corner. */
  forEachNeighbor(i: number, visit: (j: number, cost: number) => void): void {
    const c = i % this.cols;
    const r = Math.floor(i / this.cols);
    for (const [dc, dr, cost] of NEIGHBORS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
      const j = nr * this.cols + nc;
      if (!this.isWalkableIndex(j)) continue;
      if (dc !== 0 && dr !== 0) {
        // No diagonal squeeze between two blocked orthogonal cells.
        if (!this.isWalkableIndex(r * this.cols + nc) || !this.isWalkableIndex(nr * this.cols + c))
          continue;
      }
      visit(j, cost * this.cell);
    }
  }
}

/**
 * Walking distance from every cell to one goal (Dijkstra over the grid, 8 directions).
 * Following the decreasing distance leads around obstacles to the goal.
 */
export class DistanceField {
  /** Float64 on purpose: Float32 rounding made settled nodes look stale and stopped the search. */
  private readonly distance: Float64Array;
  private readonly scratch: Vec2 = { x: 0, y: 0 };

  constructor(
    private readonly grid: NavGrid,
    readonly goal: Readonly<Vec2>,
  ) {
    const n = grid.cols * grid.rows;
    this.distance = new Float64Array(n).fill(Infinity);
    const start = this.nearestWalkable(grid.indexOf(goal.x, goal.y));
    if (start < 0) return;

    // Small grids (< 15k cells): a binary heap keeps this well under a millisecond per field.
    const heap = new MinHeap();
    this.distance[start] = 0;
    heap.push(start, 0);
    while (heap.size > 0) {
      const [i, d] = heap.pop();
      if (d > (this.distance[i] ?? Infinity)) continue;
      grid.forEachNeighbor(i, (j, cost) => {
        const nd = d + cost;
        if (nd < (this.distance[j] ?? Infinity)) {
          this.distance[j] = nd;
          heap.push(j, nd);
        }
      });
    }
  }

  private nearestWalkable(i: number): number {
    if (this.grid.isWalkableIndex(i)) return i;
    let best = -1;
    let bestD = Infinity;
    const center = this.grid.cellCenter(i, { x: 0, y: 0 });
    for (let j = 0; j < this.grid.cols * this.grid.rows; j++) {
      if (!this.grid.isWalkableIndex(j)) continue;
      const p = this.grid.cellCenter(j, this.scratch);
      const d = Math.hypot(p.x - center.x, p.y - center.y);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    return best;
  }

  /** Walking distance from (x, y) to the goal; Infinity if unreachable. */
  distanceAt(x: number, y: number): number {
    return this.distance[this.grid.indexOf(x, y)] ?? Infinity;
  }

  /**
   * Writes into `out` the unit direction to walk from (x, y): straight at the goal when the path
   * is clear, otherwise toward the neighboring cell closest to the goal. Zero when at the goal or
   * stuck.
   */
  directionFrom(x: number, y: number, out: Vec2): Vec2 {
    const gx = this.goal.x - x;
    const gy = this.goal.y - y;
    const toGoal = Math.hypot(gx, gy);
    if (toGoal < 1e-6) return setVec2(out, 0, 0);
    if (this.grid.hasLineOfSight(x, y, this.goal.x, this.goal.y))
      return setVec2(out, gx / toGoal, gy / toGoal);

    const here = this.grid.indexOf(x, y);
    let best = -1;
    let bestD = this.distance[here] ?? Infinity;
    this.grid.forEachNeighbor(here, (j, cost) => {
      const d = (this.distance[j] ?? Infinity) + cost * 0.001;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    });
    if (best < 0) {
      // Pushed into an unwalkable cell (against a wall): head for the closest walkable neighbor.
      return setVec2(out, gx / toGoal, gy / toGoal);
    }
    const p = this.grid.cellCenter(best, this.scratch);
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy);
    return d < 1e-6 ? setVec2(out, gx / toGoal, gy / toGoal) : setVec2(out, dx / d, dy / d);
  }
}

/** Minimal binary min-heap of (index, priority) pairs. */
class MinHeap {
  private readonly items: number[] = [];
  private readonly priorities: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    this.items.push(item);
    this.priorities.push(priority);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((this.priorities[parent] ?? 0) <= priority) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): [number, number] {
    const top: [number, number] = [this.items[0] ?? -1, this.priorities[0] ?? Infinity];
    const lastItem = this.items.pop();
    const lastPriority = this.priorities.pop();
    if (this.items.length > 0 && lastItem !== undefined && lastPriority !== undefined) {
      this.items[0] = lastItem;
      this.priorities[0] = lastPriority;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.items.length && (this.priorities[l] ?? 0) < (this.priorities[smallest] ?? 0))
          smallest = l;
        if (r < this.items.length && (this.priorities[r] ?? 0) < (this.priorities[smallest] ?? 0))
          smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const item = this.items[a] ?? 0;
    const priority = this.priorities[a] ?? 0;
    this.items[a] = this.items[b] ?? 0;
    this.priorities[a] = this.priorities[b] ?? 0;
    this.items[b] = item;
    this.priorities[b] = priority;
  }
}
