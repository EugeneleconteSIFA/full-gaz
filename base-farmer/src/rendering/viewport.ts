import type Phaser from "phaser";

/**
 * Device pixel ratio the game renders at (D053). The canvas is sized in real device pixels so
 * the picture is sharp on Retina screens and phones; capped to keep fill rate reasonable.
 */
export const MAX_DPR = 2;

export const DPR: number =
  typeof window === "undefined" ? 1 : Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));

/**
 * Screen size in CSS pixels. UI and selection scenes lay out in CSS pixels; their camera zooms
 * by DPR to map them onto the device-pixel canvas.
 */
export function viewWidth(scene: Phaser.Scene): number {
  return scene.scale.width / DPR;
}

export function viewHeight(scene: Phaser.Scene): number {
  return scene.scale.height / DPR;
}

/**
 * For screen-space scenes (UI, selection): camera zoomed by DPR from the top-left corner, and
 * every text rasterized at DPR so it is not upscaled.
 */
export function useCssPixels(scene: Phaser.Scene, PhaserNs: typeof Phaser): void {
  scene.cameras.main.setOrigin(0, 0).setZoom(DPR);
  scene.events.on(
    PhaserNs.Scenes.Events.ADDED_TO_SCENE,
    (object: Phaser.GameObjects.GameObject) => {
      if (object instanceof PhaserNs.GameObjects.Text) object.setResolution(DPR);
    },
  );
}

/** Pointer position in the CSS-pixel space of a `useCssPixels` scene. */
export function pointerCss(pointer: Phaser.Input.Pointer): { x: number; y: number } {
  return { x: pointer.x / DPR, y: pointer.y / DPR };
}
