import type { UpgradeId } from "../core/types";

/** Written by the UI scene (buttons), read by the match scene when it samples input. */
export interface UiInputState {
  /** Upgrades clicked/tapped since the last sample. */
  readonly purchases: UpgradeId[];
  /** The on-screen ability button is held down. */
  abilityHeld: boolean;
  /** The ability button was pressed since the last sample, so a quick tap is never missed. */
  abilityTapped: boolean;
  /** The mouse is over a UI button: clicks there must not also fire. */
  pointerOverUi: boolean;
}

export function createUiInputState(): UiInputState {
  return { purchases: [], abilityHeld: false, abilityTapped: false, pointerOverUi: false };
}
