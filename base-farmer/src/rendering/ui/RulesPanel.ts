import type Phaser from "phaser";
import { STRINGS } from "../../config/strings";
import { viewHeight, viewWidth } from "../viewport";
import { bodyText, displayText, drawPanel, UI, UiButton } from "./uiKit";

/**
 * "Comment jouer" (selection screen): how to win, take bases, harvest, upgrade and fight, plus
 * the controls of the current device, on one kit panel. A tap on the veil or the button closes
 * it. Sized to fit an iPhone mini in portrait.
 */
export class RulesPanel {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly button: UiButton;

  constructor(
    scene: Phaser.Scene,
    private readonly onClose: () => void,
  ) {
    const width = viewWidth(scene);
    const height = viewHeight(scene);
    const depth = 2000;
    const panelW = Math.min(width - 24, 560);
    const textW = panelW - 44;
    const cx = width / 2;
    const touch = scene.sys.game.device.input.touch;
    const rules = STRINGS.rules;

    const veil = scene.add
      .rectangle(0, 0, width, height, UI.ink, 0.78)
      .setOrigin(0)
      .setDepth(depth)
      .setInteractive()
      .on("pointerup", () => this.close());
    const frame = scene.add.graphics().setDepth(depth);
    this.objects.push(veil, frame);

    // Lay the content out first (top-down) to know the panel's height, then centre it.
    const items: { text: Phaser.GameObjects.Text; y: number }[] = [];
    let y = 0;
    const add = (text: Phaser.GameObjects.Text, gapAfter: number) => {
      text.setDepth(depth);
      items.push({ text, y });
      y += text.height + gapAfter;
      this.objects.push(text);
    };
    add(displayText(scene, cx, 0, rules.title, 30, "#ffc93c").setOrigin(0.5, 0), 14);
    for (const section of rules.sections) {
      add(displayText(scene, cx, 0, section.heading, 19).setOrigin(0.5, 0), 4);
      add(bodyText(scene, cx, 0, section.text, 13).setOrigin(0.5, 0).setWordWrapWidth(textW), 12);
    }
    add(
      bodyText(scene, cx, 0, touch ? rules.controlsTouch : rules.controlsDesktop, 12, UI.muted)
        .setOrigin(0.5, 0)
        .setWordWrapWidth(textW),
      16,
    );
    const buttonH = 52;
    const panelH = Math.min(height - 24, y + buttonH + 36);
    const top = height / 2 - panelH / 2 + 20;
    drawPanel(frame, cx, height / 2, panelW, panelH, { radius: 20 });
    for (const item of items) item.text.setY(top + item.y);

    // Swallows taps on the panel itself (only the veil and the button close).
    const blocker = scene.add
      .zone(cx, height / 2, panelW, panelH)
      .setDepth(depth)
      .setInteractive();
    this.objects.push(blocker);
    this.button = new UiButton(
      scene,
      rules.close,
      220,
      buttonH,
      UI.gold,
      UI.goldDark,
      () => this.close(),
      24,
    ).setPosition(cx, height / 2 + panelH / 2 - buttonH / 2 - 16);
    this.button.g.setDepth(depth + 1);
    this.button.label.setDepth(depth + 1);
    this.button.zone.setDepth(depth + 1);
  }

  close(): void {
    for (const o of this.objects) o.destroy();
    this.objects.length = 0;
    this.button.destroy();
    this.onClose();
  }
}
