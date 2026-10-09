import type Phaser from "phaser";
import { LAYER, TILT } from "./projection";

/**
 * A container squashed by the view tilt: anything drawn inside it in world pixels (toPixels)
 * lies flat on the tilted ground. Used for the ground itself, zones, rings and shadows.
 */
export function createGroundLayer(
  scene: Phaser.Scene,
  depth: number = LAYER.groundMarks,
): Phaser.GameObjects.Container {
  return scene.add.container(0, 0).setScale(1, TILT).setDepth(depth);
}
