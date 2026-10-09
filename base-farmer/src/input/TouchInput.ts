import Phaser from "phaser";
import { DPR, pointerCss, viewWidth } from "../rendering/viewport";
import { GAME_CONFIG } from "../config/gameConfig";
import { vec2, type Vec2 } from "../core/math";
import { THEME } from "../rendering/theme";
import { joystickVector } from "./joystick";

/** Shared between the UI scene (which owns touch) and the match scene (which reads it). */
export interface TouchState {
  move: Vec2;
  moveActive: boolean;
  aim: Vec2;
  aimActive: boolean;
}

export function createTouchState(): TouchState {
  return { move: vec2(), moveActive: false, aim: vec2(), aimActive: false };
}

interface Stick {
  pointerId: number | null;
  originX: number;
  originY: number;
  readonly base: Phaser.GameObjects.Arc;
  readonly thumb: Phaser.GameObjects.Arc;
}

/**
 * Floating twin-stick touch controls in screen space: a drag on the left half moves,
 * a drag on the right half aims and fires while held. The ability button is an
 * ordinary UI button (AbilityButton), so a finger on it never spawns a stick.
 */
export class TouchInput {
  private readonly moveStick: Stick;
  private readonly aimStick: Stick;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: TouchState,
  ) {
    this.moveStick = this.createStick();
    this.aimStick = this.createStick();

    const input = scene.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    input.on(Phaser.Input.Events.GAME_OUT, this.releaseAll, this);
  }

  private createStick(): Stick {
    const { joystickRadiusPx } = GAME_CONFIG.input;
    const style = THEME.joystick;
    const base = this.scene.add
      .circle(0, 0, joystickRadiusPx, style.base, style.baseAlpha)
      .setStrokeStyle(2, style.stroke, style.strokeAlpha)
      .setVisible(false);
    const thumb = this.scene.add
      .circle(0, 0, joystickRadiusPx * 0.45, style.thumb, style.thumbAlpha)
      .setVisible(false);
    return { pointerId: null, originX: 0, originY: 0, base, thumb };
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) return;
    // A finger landing on a UI button presses the button, it does not spawn a stick.
    if (this.scene.input.hitTestPointer(pointer).length > 0) return;
    const at = pointerCss(pointer);
    const isLeft = at.x < viewWidth(this.scene) / 2;
    const stick = isLeft ? this.moveStick : this.aimStick;
    if (stick.pointerId !== null) return;

    stick.pointerId = pointer.id;
    stick.originX = at.x;
    stick.originY = at.y;
    stick.base.setPosition(at.x, at.y).setVisible(true);
    stick.thumb.setPosition(at.x, at.y).setVisible(true);
    this.update(stick, pointer);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.moveStick.pointerId) this.update(this.moveStick, pointer);
    else if (pointer.id === this.aimStick.pointerId) this.update(this.aimStick, pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.moveStick.pointerId) this.release(this.moveStick);
    else if (pointer.id === this.aimStick.pointerId) this.release(this.aimStick);
  }

  private releaseAll(): void {
    this.release(this.moveStick);
    this.release(this.aimStick);
  }

  private update(stick: Stick, pointer: Phaser.Input.Pointer): void {
    const { joystickRadiusPx, joystickDeadZone } = GAME_CONFIG.input;
    const isMove = stick === this.moveStick;
    const out = isMove ? this.state.move : this.state.aim;
    joystickVector(
      stick.originX,
      stick.originY,
      pointer.x / DPR,
      pointer.y / DPR,
      joystickRadiusPx,
      joystickDeadZone,
      out,
    );
    if (isMove) this.state.moveActive = true;
    else this.state.aimActive = true;
    stick.thumb.setPosition(
      stick.originX + out.x * joystickRadiusPx,
      stick.originY + out.y * joystickRadiusPx,
    );
  }

  private release(stick: Stick): void {
    if (stick.pointerId === null) return;
    stick.pointerId = null;
    stick.base.setVisible(false);
    stick.thumb.setVisible(false);
    if (stick === this.moveStick) {
      this.state.moveActive = false;
      this.state.move.x = this.state.move.y = 0;
    } else {
      this.state.aimActive = false;
      this.state.aim.x = this.state.aim.y = 0;
    }
  }
}
