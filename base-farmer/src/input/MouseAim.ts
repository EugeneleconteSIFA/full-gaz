import Phaser from "phaser";
import type { Vec2 } from "../core/math";
import { GAME_CONFIG } from "../config/gameConfig";
import { screenToWorldDirection, TILT } from "../rendering/projection";

/**
 * Mouse aim: direction from the player's feet to the cursor, converted from the tilted screen to
 * world space so shots go exactly where the cursor points on the ground. Ignores touch pointers.
 */
export class MouseAim {
  private hasMouse = false;
  private readonly worldPoint = new Phaser.Math.Vector2();
  /** Ground distance from the player to the cursor at the last readAim, world units. */
  distance = 0;

  constructor(private readonly scene: Phaser.Scene) {
    scene.input.mouse?.disableContextMenu();
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch) this.hasMouse = true;
    });
  }

  private get pointer(): Phaser.Input.Pointer | null {
    const pointer = this.scene.input.mousePointer;
    return this.hasMouse && pointer && !pointer.wasTouch ? pointer : null;
  }

  /** Writes the world aim direction into `out`. Returns false when no mouse is in use. */
  readAim(playerScreenX: number, playerScreenY: number, out: Vec2): boolean {
    const pointer = this.pointer;
    if (!pointer) return false;
    this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y, this.worldPoint);
    const dx = this.worldPoint.x - playerScreenX;
    const dy = this.worldPoint.y - playerScreenY;
    screenToWorldDirection(out, dx, dy);
    this.distance = Math.hypot(dx, dy / TILT) / GAME_CONFIG.rendering.pixelsPerUnit;
    return true;
  }

  isAttackDown(): boolean {
    return this.pointer?.leftButtonDown() ?? false;
  }
}
