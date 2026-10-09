import Phaser from "phaser";
import { useCssPixels, viewHeight, viewWidth } from "../rendering/viewport";
import { GAME_CONFIG } from "../config/gameConfig";
import { STRINGS } from "../config/strings";
import type { MatchState, PlayerState } from "../core/MatchState";
import { TouchInput } from "../input/TouchInput";
import { hudText } from "../rendering/hudText";
import { AbilityButton } from "../rendering/AbilityButton";
import { HapticFeedback } from "../rendering/HapticFeedback";
import { MatchHud } from "../rendering/MatchHud";
import { ResourceHud } from "../rendering/ResourceHud";
import { ResultScreen } from "../rendering/ResultScreen";
import { ScoreHud } from "../rendering/ScoreHud";
import { UpgradeBar } from "../rendering/UpgradeBar";
import type { MatchContext } from "./MatchContext";
import { SCENE_KEYS } from "./sceneKeys";

/**
 * Screen-space layer above the world (unaffected by world camera zoom). Hosts touch controls
 * and HUD. Reads match state, never writes it.
 */
export class UiScene extends Phaser.Scene {
  private state!: MatchState;
  private localPlayer!: PlayerState;
  private respawnText!: Phaser.GameObjects.Text;
  private score!: ScoreHud;
  private matchHud!: MatchHud;
  private resourceHud!: ResourceHud;
  private upgradeBar!: UpgradeBar;
  private abilityButton!: AbilityButton;
  private haptics!: HapticFeedback;
  private resultScreen!: ResultScreen;
  /** Last displayed respawn countdown, so text is only rebuilt when the number changes. */
  private shownSeconds = -1;

  constructor() {
    super(SCENE_KEYS.ui);
  }

  create(context: MatchContext): void {
    useCssPixels(this, Phaser);
    // Scenes are reused on restart: reset per-match fields here, not in field initializers.
    this.shownSeconds = -1;
    this.state = context.state;
    const local = context.state.players.find((p) => p.id === context.localPlayerId);
    if (!local) throw new Error(`Local player "${context.localPlayerId}" missing from match`);
    this.localPlayer = local;

    if (this.sys.game.device.input.touch) {
      new TouchInput(this, context.touch);
    }

    this.score = new ScoreHud(this, context.state.layout, context.state, context.localPlayerId);
    this.score.update(context.state);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });

    this.matchHud = new MatchHud(this);
    this.resourceHud = new ResourceHud(this, local);
    this.upgradeBar = new UpgradeBar(this, local, context.uiInput);
    this.abilityButton = new AbilityButton(this, local, context.uiInput);
    this.haptics = new HapticFeedback(this.sys.game.device.input.touch, local, context.state);
    this.respawnText = hudText(this, 28).setVisible(false);
    // Created last so it draws above everything else.
    this.resultScreen = new ResultScreen(this, context.rematch, context.changeCharacter);
  }

  private onResize(): void {
    this.score.layout();
    this.resourceHud.layout();
    this.upgradeBar.layout();
    this.abilityButton.layout();
    if (this.resultScreen.isShown) this.resultScreen.layout();
  }

  override update(): void {
    this.score.update(this.state);
    this.matchHud.update(this.state);
    this.resourceHud.update(this.state);
    this.upgradeBar.update();
    this.abilityButton.update(this.state);
    this.haptics.update(this.state);

    if (this.state.result !== null) {
      if (!this.resultScreen.isShown)
        this.resultScreen.show(
          this.state.result,
          this.localPlayer.teamId,
          this.localPlayer.characterId,
        );
      this.resultScreen.update();
      this.respawnText.setVisible(false);
      return;
    }

    const respawnAt = this.localPlayer.respawnAtTick;
    if (respawnAt === null) {
      this.respawnText.setVisible(false);
      this.shownSeconds = -1;
      return;
    }

    const ticksLeft = Math.max(0, respawnAt - this.state.tick);
    const seconds = Math.ceil(ticksLeft / GAME_CONFIG.simulation.ticksPerSecond);
    if (seconds !== this.shownSeconds) {
      this.respawnText.setText(STRINGS.respawn(seconds));
      this.shownSeconds = seconds;
    }
    this.respawnText.setPosition(viewWidth(this) / 2, viewHeight(this) / 3).setVisible(true);
  }
}
