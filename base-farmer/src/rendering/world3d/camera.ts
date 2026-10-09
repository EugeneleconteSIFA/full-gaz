import * as THREE from "three";
import { GAME_CONFIG } from "../../config/gameConfig";

/**
 * The 3D world camera (D058). Orthographic, pitched so the ground is foreshortened exactly like
 * src/rendering/projection.ts (screen = x * PPU, y * PPU * TILT): the Phaser camera keeps doing
 * the follow, zoom and bounds, and the 3D camera shows the same rectangle of the same ground.
 * World axes: x = world x, z = world y (toward the viewer), y = up.
 */

const PPU = GAME_CONFIG.rendering.pixelsPerUnit;
/** Pitch from vertical: the ground's depth axis appears scaled by cos(PITCH) = TILT. */
export const PITCH = Math.acos(GAME_CONFIG.rendering.tilt);
/** Distance from the look-at origin; near/far must enclose the whole map. */
const DISTANCE = 150;

/** Phaser's visible world rectangle, in Phaser world pixels (zoom 1). */
export interface ViewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function createWorldCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
  // Looking down and toward the back of the map; screen up = toward smaller world y.
  const dir = new THREE.Vector3(0, -Math.cos(PITCH), -Math.sin(PITCH));
  camera.up.set(0, Math.sin(PITCH), -Math.cos(PITCH));
  camera.position.copy(dir.multiplyScalar(-DISTANCE));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

/** Frames exactly the rectangle the Phaser world camera shows. */
export function fitWorldCamera(camera: THREE.OrthographicCamera, view: ViewRect): void {
  camera.left = view.x / PPU;
  camera.right = (view.x + view.width) / PPU;
  // Camera-space up of a ground point is -(screen down) / PPU.
  camera.top = -view.y / PPU;
  camera.bottom = -(view.y + view.height) / PPU;
  camera.updateProjectionMatrix();
}

/** Characters are this tall, world units (Brawl Stars-like size, roadmap decision). */
export const CHARACTER_HEIGHT = 2.2;
/**
 * Characters lean back this much (radians) so the steep camera shows their face, not the top of
 * their head (D058).
 */
export const CHARACTER_LEAN = (-30 * Math.PI) / 180;

/** On-screen height of a leaning character, Phaser pixels at zoom 1 (health bar, effects). */
export function characterScreenHeight(height = CHARACTER_HEIGHT): number {
  // The body axis (leaned back) projected on the camera's screen-up axis.
  return height * Math.sin(PITCH - CHARACTER_LEAN) * PPU;
}
