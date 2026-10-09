import Phaser from "phaser";
import { KEYBOARD_BINDINGS, UPGRADE_HOTKEYS, type KeyboardAction } from "../config/controls";
import { UPGRADE_IDS, type UpgradeId } from "../core/types";
import { clampLengthInPlace, setVec2, type Vec2 } from "../core/math";
import { digitalAxis } from "./joystick";

type BoundKeys = Record<KeyboardAction, Phaser.Input.Keyboard.Key[]>;

export class KeyboardInput {
  private readonly keys: BoundKeys | null;
  private readonly upgradeKeys: Phaser.Input.Keyboard.Key[][] = [];

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null) {
    if (!keyboard) {
      this.keys = null;
      return;
    }
    const bind = (names: readonly string[]) => names.map((name) => keyboard.addKey(name));
    this.upgradeKeys = UPGRADE_HOTKEYS.map(bind);
    this.keys = {
      up: bind(KEYBOARD_BINDINGS.up),
      down: bind(KEYBOARD_BINDINGS.down),
      left: bind(KEYBOARD_BINDINGS.left),
      right: bind(KEYBOARD_BINDINGS.right),
      attack: bind(KEYBOARD_BINDINGS.attack),
      ability: bind(KEYBOARD_BINDINGS.ability),
      interact: bind(KEYBOARD_BINDINGS.interact),
    };
  }

  isDown(action: KeyboardAction): boolean {
    if (!this.keys) return false;
    for (const key of this.keys[action]) {
      if (key.isDown) return true;
    }
    return false;
  }

  /** Pressed since the last call, even if already released (a quick tap between two samples). */
  wasPressed(action: KeyboardAction): boolean {
    if (!this.keys) return false;
    let pressed = false;
    // No early return: every key's JustDown flag must be consumed.
    for (const key of this.keys[action]) {
      if (Phaser.Input.Keyboard.JustDown(key)) pressed = true;
    }
    return pressed;
  }

  /** Appends the upgrades whose hotkey was pressed since the last call (each press counts once). */
  readUpgradePresses(out: UpgradeId[]): void {
    this.upgradeKeys.forEach((keys, i) => {
      const id = UPGRADE_IDS[i];
      if (id && keys.some((key) => Phaser.Input.Keyboard.JustDown(key))) out.push(id);
    });
  }

  /** Writes the WASD/arrow movement vector (length <= 1) into `out`. */
  readMove(out: Vec2): Vec2 {
    setVec2(
      out,
      digitalAxis(this.isDown("left"), this.isDown("right")),
      digitalAxis(this.isDown("up"), this.isDown("down")),
    );
    return clampLengthInPlace(out, 1);
  }
}
