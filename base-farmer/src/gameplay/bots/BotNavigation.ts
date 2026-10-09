import type { MapLayout } from "../../world/MapLayout";
import { DistanceField, NavGrid } from "../../world/navigation";

/** Shared by every bot of a match: the walk grid and one distance field per base. */
export interface BotNavigation {
  readonly grid: NavGrid;
  /** Same order as the layout's bases. */
  readonly baseFields: readonly DistanceField[];
}

export function createBotNavigation(layout: MapLayout): BotNavigation {
  const grid = new NavGrid(layout);
  return { grid, baseFields: layout.bases.map((b) => new DistanceField(grid, b.position)) };
}
