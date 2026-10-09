import { GAME_CONFIG } from "../config/gameConfig";

/** World units → pixels at zoom 1. The only place this conversion should happen. */
export function toPixels(worldUnits: number): number {
  return worldUnits * GAME_CONFIG.rendering.pixelsPerUnit;
}
