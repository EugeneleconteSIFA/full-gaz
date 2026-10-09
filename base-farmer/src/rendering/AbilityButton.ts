import type Phaser from "phaser";
import { viewHeight, viewWidth } from "./viewport";
import { secondsToTicks } from "../config/gameConfig";
import { KEYBOARD_BINDINGS } from "../config/controls";
import type { MatchState, PlayerState } from "../core/MatchState";
import { abilityCooldownLeft, isGuarding } from "../gameplay/abilities/AbilitySystem";
import { getCharacter } from "../data/registry";
import type { UiInputState } from "../input/UiInputState";
import { hudText } from "./hudText";
import { THEME } from "./theme";
import { UI } from "./ui/uiKit";

/**
 * Round ability button in the bottom-right corner: the ability's name, a dark wedge that shrinks
 * as the cooldown runs out with the seconds left, a green rim while the guard is up. Holding it
 * (touch or mouse) uses the ability; desktop also shows its key.
 */
export class AbilityButton {
  private readonly disc: Phaser.GameObjects.Arc;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly back: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly cooldown: Phaser.GameObjects.Text;
  private readonly hotkey: Phaser.GameObjects.Text;
  private readonly cooldownTicks: number;
  /** Ticks left at the last redraw (-1 = never drawn), so the wedge is redrawn only on change. */
  private shownTicks = -1;
  private shownGuard = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerState,
    uiInput: UiInputState,
  ) {
    const style = THEME.abilityButton;
    const ability = getCharacter(player.characterId).ability;
    this.cooldownTicks = secondsToTicks(ability.cooldownSeconds);
    // Kit look: drop shadow and ink outline behind the gold disc.
    this.back = scene.add.graphics();
    this.disc = scene.add
      .circle(0, 0, style.radiusPx, style.fill)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => (uiInput.pointerOverUi = true))
      .on("pointerout", () => {
        uiInput.pointerOverUi = false;
        uiInput.abilityHeld = false;
      })
      .on("pointerdown", () => {
        uiInput.abilityHeld = true;
        uiInput.abilityTapped = true;
      })
      .on("pointerup", () => (uiInput.abilityHeld = false));
    this.overlay = scene.add.graphics();
    this.label = hudText(scene, style.labelFontPx).setText(ability.label.toUpperCase());
    this.cooldown = hudText(scene, style.cooldownFontPx).setVisible(false);
    this.hotkey = hudText(scene, style.hotkeyFontPx)
      .setColor(style.muted)
      .setText(KEYBOARD_BINDINGS.ability[0])
      .setVisible(!scene.sys.game.device.input.touch);
    this.layout();
  }

  update(state: MatchState): void {
    const ticks = Math.max(0, this.player.abilityReadyTick - state.tick);
    const guard = isGuarding(state, this.player);
    if (ticks === this.shownTicks && guard === this.shownGuard) return;
    this.shownTicks = ticks;
    this.shownGuard = guard;
    this.redraw(state, ticks, guard);
  }

  /** Bottom-right corner, clear of the upgrade bar (bottom center) and column (right middle). */
  layout(): void {
    const style = THEME.abilityButton;
    const r = style.radiusPx;
    const x = viewWidth(this.scene) - style.edgeMarginPx - r;
    const y = viewHeight(this.scene) - style.edgeMarginPx - r;
    this.disc.setPosition(x, y);
    this.back
      .clear()
      .fillStyle(UI.ink, 0.45)
      .fillCircle(x, y + UI.shadowPx, r + 4)
      .fillStyle(UI.ink, 1)
      .fillCircle(x, y, r + 4);
    this.label.setPosition(x, y + r * 0.42);
    this.cooldown.setPosition(x, y - r * 0.08);
    this.hotkey.setPosition(x - r * 0.62, y - r * 0.62);
    this.shownTicks = -1;
  }

  private redraw(state: MatchState, ticks: number, guard: boolean): void {
    const style = THEME.abilityButton;
    const r = style.radiusPx;
    const { x, y } = this.disc;
    const ready = ticks === 0;
    this.disc.setStrokeStyle(guard ? 5 : 3, guard ? style.activeStroke : style.stroke, 1);
    const g = this.overlay.clear();
    // Gloss on the top half.
    g.fillStyle(0xffffff, 0.22).fillEllipse(x, y - r * 0.45, r * 1.3, r * 0.6);
    if (!ready) {
      // Dark wedge for the part of the cooldown still to run, clockwise from 12 o'clock.
      const left = Math.min(1, ticks / this.cooldownTicks);
      const start = -Math.PI / 2;
      g.fillStyle(style.cooldownFill, style.cooldownAlpha)
        .slice(x, y, r, start, start + left * Math.PI * 2, false)
        .fillPath();
    }
    this.cooldown
      .setVisible(!ready)
      .setText(ready ? "" : String(Math.ceil(abilityCooldownLeft(state, this.player))));
    this.label.setAlpha(ready ? 1 : 0.75);
  }
}
