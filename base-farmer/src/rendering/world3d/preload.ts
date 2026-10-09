import { loadCharacter } from "../three/gltfCharacter";
import { CHARACTER_MODEL } from "../characterArt";
import { loadBuildings, loadProps } from "./props";

/**
 * Starts loading every 3D asset of the match (light character models, props, buildings) while
 * the player is still on the selection screen: the loaders cache their promise, so the match
 * finds them ready instead of popping characters in after it starts. Failures surface in the
 * match, where the same loaders are awaited.
 */
export function preloadMatchAssets(): void {
  for (const model of new Set(Object.values(CHARACTER_MODEL))) {
    loadCharacter(model, "match").catch(() => undefined);
  }
  loadProps().catch(() => undefined);
  loadBuildings().catch(() => undefined);
}
