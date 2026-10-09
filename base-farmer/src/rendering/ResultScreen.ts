import type Phaser from "phaser";
import { viewHeight, viewWidth } from "./viewport";
import { resultReason, STRINGS } from "../config/strings";
import type { MatchResult } from "../core/MatchState";
import type { CharacterId, TeamId } from "../core/types";
import { Stage3D } from "./three/Stage3D";
import { modelFor } from "./characterArt";
import { bodyText, displayText, drawPanel, UI, UiButton } from "./ui/uiKit";
import { THEME } from "./theme";

/**
 * End-of-match screen (roadmap step 7): the player's own character in 3D on a podium, doing its
 * victory pose after a win and looking worried after a loss; the result on a ribbon, why, and
 * two buttons: replay (gold, main action) or change character.
 */
export class ResultScreen {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly reason: Phaser.GameObjects.Text;
  private readonly replay: UiButton;
  private readonly change: UiButton;
  private stage: Stage3D | null = null;
  private shown = false;
  private won = false;
  private draw = false;
  private shownAtMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    onReplay: () => void,
    onChangeCharacter: () => void,
  ) {
    this.dim = scene.add.rectangle(0, 0, 10, 10, UI.ink, 0.72).setOrigin(0, 0);
    this.g = scene.add.graphics();
    this.title = displayText(scene, 0, 0, "", 54);
    this.reason = bodyText(scene, 0, 0, "", 16, UI.cream);
    this.replay = new UiButton(
      scene,
      STRINGS.result.replay.toUpperCase(),
      240,
      60,
      UI.gold,
      UI.goldDark,
      onReplay,
      28,
    );
    this.change = new UiButton(
      scene,
      STRINGS.result.changeCharacter,
      240,
      50,
      UI.slate,
      UI.slateDark,
      onChangeCharacter,
      20,
    );
    this.setVisible(false);
    // Rematch / change character restart the scene: free the 3D stage's WebGL context.
    scene.events.once("shutdown", () => {
      this.stage?.destroy(scene);
      this.stage = null;
    });
  }

  get isShown(): boolean {
    return this.shown;
  }

  show(result: MatchResult, localTeam: TeamId, localCharacter: CharacterId): void {
    this.won = result.winner === localTeam;
    this.draw = result.winner === "draw";
    this.title.setText(
      this.draw ? STRINGS.result.draw : this.won ? STRINGS.result.victory : STRINGS.result.defeat,
    );
    this.reason.setText(resultReason(result, localTeam));
    this.shown = true;
    this.shownAtMs = this.scene.time.now;
    const team = THEME.teams[localTeam];
    this.stage = new Stage3D(this.scene, team, 0, 0, 260, modelFor(localCharacter), "match");
    this.setVisible(true);
    this.layout();
  }

  /** Animates the character (call every frame while shown). */
  update(): void {
    if (!this.stage) return;
    const t = (this.scene.time.now - this.shownAtMs) / 1000;
    this.stage.render(
      0.35,
      0,
      0,
      Infinity,
      t,
      this.won ? "joyeux" : this.draw ? "neutre" : "inquiet",
      this.won ? t : Infinity,
    );
  }

  layout(): void {
    const width = viewWidth(this.scene);
    const height = viewHeight(this.scene);
    this.dim.setSize(width, height);
    const cx = width / 2;
    // Character on top, ribbon and reason in the middle, buttons below.
    const stageSize = Math.min(260, height * 0.34, width * 0.7);
    const stageY = height * 0.08 + stageSize / 2;
    this.stage?.image.setPosition(cx, stageY).setDisplaySize(stageSize, stageSize);
    const ribbonY = stageY + stageSize / 2 + 30;
    const ribbonW = Math.min(360, width - 32);
    this.g.clear();
    // Podium under the character.
    this.g
      .fillStyle(UI.ink, 0.5)
      .fillEllipse(cx, stageY + stageSize * 0.42, stageSize * 0.62, stageSize * 0.14);
    const fill = this.draw ? UI.slate : this.won ? UI.gold : 0x6b7594;
    drawPanel(this.g, cx, ribbonY, ribbonW, 76, {
      fill,
      dark: this.draw ? UI.slateDark : this.won ? UI.goldDark : 0x4a5370,
      radius: 18,
    });
    this.title.setPosition(cx, ribbonY - 3).setFontSize(Math.min(54, ribbonW / 6));
    this.reason.setPosition(cx, ribbonY + 62);
    this.replay.setPosition(cx, ribbonY + 128);
    this.change.setPosition(cx, ribbonY + 198);
  }

  private setVisible(visible: boolean): void {
    for (const o of [this.dim, this.g, this.title, this.reason]) o.setVisible(visible);
    this.replay.setVisible(visible);
    this.change.setVisible(visible);
  }
}
