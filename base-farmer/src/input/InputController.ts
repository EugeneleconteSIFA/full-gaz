import type Phaser from "phaser";
import { clampLengthInPlace, setVec2 } from "../core/math";
import { screenToWorldDirection } from "../rendering/projection";
import { createInputState, type InputState } from "./InputState";
import { KeyboardInput } from "./KeyboardInput";
import type { TouchState } from "./TouchInput";
import type { UiInputState } from "./UiInputState";

/**
 * Merges keyboard and touch into one InputState (no mouse: on desktop the character hits where
 * it looks, i.e. where it last moved). Touch wins while a stick is held.
 * On touch, holding the aim stick also fires (twin-stick style), so two thumbs are enough.
 */
export class InputController {
  readonly state: InputState = createInputState();
  private readonly keyboard: KeyboardInput;

  constructor(
    scene: Phaser.Scene,
    private readonly touch: TouchState,
    private readonly ui: UiInputState,
  ) {
    this.keyboard = new KeyboardInput(scene.input.keyboard);
  }

  /** The aim comes from the touch stick this tick (the aim assist applies only then). */
  get isTouchAiming(): boolean {
    return this.touch.aimActive;
  }

  /**
   * Samples all devices. The player's on-screen feet position is needed to turn the cursor into a
   * direction; the attack range turns the aim stick's push into a distance (lobs land there).
   */
  sample(_playerScreenX: number, _playerScreenY: number, attackRange: number): InputState {
    const s = this.state;

    // Touch sticks are dragged on the tilted screen: convert so "push toward that spot" is exact.
    if (this.touch.moveActive)
      screenToWorldDirection(s.moveVector, this.touch.move.x, this.touch.move.y);
    else this.keyboard.readMove(s.moveVector);
    clampLengthInPlace(s.moveVector, 1);

    if (this.touch.aimActive) {
      screenToWorldDirection(s.aimVector, this.touch.aim.x, this.touch.aim.y);
      s.aimDistance = Math.min(1, Math.hypot(this.touch.aim.x, this.touch.aim.y)) * attackRange;
    } else if (s.moveVector.x !== 0 || s.moveVector.y !== 0) {
      // Desktop: aim follows the movement; standing still keeps the last aim (zero = keep).
      setVec2(s.aimVector, s.moveVector.x, s.moveVector.y);
      s.aimDistance = null;
    } else {
      setVec2(s.aimVector, 0, 0);
      s.aimDistance = null;
    }

    // Desktop: Space attacks where the character looks. Touch: holding the aim stick fires.
    s.attackPressed = this.touch.aimActive || this.keyboard.isDown("attack");
    // Held or tapped since the last sample: a quick tap between two samples still counts.
    s.abilityPressed =
      this.keyboard.wasPressed("ability") ||
      this.keyboard.isDown("ability") ||
      this.ui.abilityHeld ||
      this.ui.abilityTapped;
    this.ui.abilityTapped = false;
    s.interactPressed = this.keyboard.isDown("interact");

    s.buyRequests.length = 0;
    this.keyboard.readUpgradePresses(s.buyRequests);
    s.buyRequests.push(...this.ui.purchases);
    this.ui.purchases.length = 0;
    return s;
  }
}
