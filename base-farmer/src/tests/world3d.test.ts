import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { screenX, screenY } from "../rendering/projection";
import { createWorldCamera, fitWorldCamera } from "../rendering/world3d/camera";

/** Phaser pixel where the 3D camera draws a world point, for a view of the given rectangle. */
function project(view: { x: number; y: number; width: number; height: number }, p: THREE.Vector3) {
  const camera = createWorldCamera();
  fitWorldCamera(camera, view);
  const ndc = p.clone().project(camera);
  return {
    x: view.x + ((ndc.x + 1) / 2) * view.width,
    y: view.y + ((1 - ndc.y) / 2) * view.height,
  };
}

describe("3D world camera (D058)", () => {
  const view = { x: 120, y: 200, width: 480, height: 360 };

  it("draws every ground point where the 2D projection does", () => {
    for (const [wx, wy] of [
      [5, 9],
      [12.5, 14],
      [18, 21],
    ] as const) {
      const at = project(view, new THREE.Vector3(wx, 0, wy));
      expect(at.x).toBeCloseTo(screenX(wx), 3);
      expect(at.y).toBeCloseTo(screenY(wy), 3);
    }
  });

  it("draws standing things upward on screen", () => {
    const feet = project(view, new THREE.Vector3(10, 0, 12));
    const head = project(view, new THREE.Vector3(10, 2, 12));
    expect(head.x).toBeCloseTo(feet.x, 5);
    expect(head.y).toBeLessThan(feet.y);
  });
});
