/**
 * Keyboard bindings, as Phaser key names. WASD and ZQSD are both bound so QWERTY and AZERTY
 * players get the same physical layout without a settings menu.
 */
export const KEYBOARD_BINDINGS = {
  up: ["W", "Z", "UP"],
  down: ["S", "DOWN"],
  left: ["A", "Q", "LEFT"],
  right: ["D", "RIGHT"],
  /** Attack where the character looks (its last movement direction). */
  attack: ["SPACE"],
  ability: ["F"],
  interact: ["E"],
} as const satisfies Record<string, readonly string[]>;

/**
 * Upgrade hotkeys, in UPGRADE_IDS order. Phaser matches key codes, so the top-row digits work
 * on AZERTY too (where they type & é " ' ( without Shift).
 */
export const UPGRADE_HOTKEYS: readonly (readonly string[])[] = [
  ["ONE", "NUMPAD_ONE"],
  ["TWO", "NUMPAD_TWO"],
  ["THREE", "NUMPAD_THREE"],
  ["FOUR", "NUMPAD_FOUR"],
  ["FIVE", "NUMPAD_FIVE"],
];

export type KeyboardAction = keyof typeof KEYBOARD_BINDINGS;
