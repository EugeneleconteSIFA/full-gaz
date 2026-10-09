import type Phaser from "phaser";
import { drawPanel, UI } from "./ui/uiKit";
import { viewHeight, viewWidth } from "./viewport";
import { STRINGS } from "../config/strings";
import type { PlayerState } from "../core/MatchState";
import { RESOURCE_IDS, UPGRADE_IDS, type UpgradeId } from "../core/types";
import { MAX_UPGRADE_LEVEL } from "../data/upgrades";
import { canAfford, getUpgrade, nextLevelCost } from "../gameplay/upgrades/UpgradeSystem";
import type { UiInputState } from "../input/UiInputState";
import { drawResourceIcon } from "./resourceIcon";
import { resourceIconKey } from "./ui/resourceIcons";
import { THEME } from "./theme";

interface UpgradeButton {
  readonly id: UpgradeId;
  readonly box: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  readonly hotkey: Phaser.GameObjects.Text;
  readonly marks: Phaser.GameObjects.Graphics;
  readonly costTexts: Phaser.GameObjects.Text[];
  /** 3D resource icons of the cost (docs/13); hidden when unused. */
  readonly costIcons: Phaser.GameObjects.Image[];
}

/**
 * Always-visible upgrade buttons: name, level pips, cost of the next level, hotkey on desktop.
 * Lit when affordable, dimmed otherwise, "MAX" when complete. Bottom row in landscape, right-edge
 * column in portrait (away from where thumbs usually rest). Buying never opens a menu.
 */
export class UpgradeBar {
  private readonly buttons: UpgradeButton[];
  /** Wallet + levels at the last redraw; buttons are redrawn only when one of them changes. */
  private readonly shown: number[] = [];
  private readonly showHotkeys: boolean;
  /** Every button's chunky panel (kit), under the buttons' icons and texts. */
  private readonly panels: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerState,
    private readonly uiInput: UiInputState,
  ) {
    this.showHotkeys = !scene.sys.game.device.input.touch;
    this.panels = scene.add.graphics();
    const style = THEME.upgradeBar;
    this.buttons = UPGRADE_IDS.map((id, i) => {
      const box = scene.add
        .rectangle(0, 0, style.buttonWidthPx, style.buttonHeightPx, style.button)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => (this.uiInput.pointerOverUi = true))
        .on("pointerout", () => (this.uiInput.pointerOverUi = false))
        .on("pointerup", () => this.uiInput.purchases.push(id));
      const text = (fontPx: number, color: string) =>
        scene.add
          .text(0, 0, "", {
            fontFamily: UI.displayFont,
            fontSize: `${fontPx}px`,
            color,
          })
          .setOrigin(0.5)
          .setStroke("#1b1f2a", 3);
      return {
        id,
        box,
        label: text(style.labelFontPx, style.text).setText(getUpgrade(id).label),
        hotkey: text(style.hotkeyFontPx, style.muted).setText(String(i + 1)),
        marks: scene.add.graphics(),
        costTexts: [text(style.costFontPx, style.text), text(style.costFontPx, style.text)],
        costIcons: [0, 1].map(() => scene.add.image(0, 0, "__DEFAULT").setVisible(false)),
      };
    });
    this.layout();
  }

  update(): void {
    // Plain loops, no strings or arrays: this runs every frame.
    let changed = false;
    let i = 0;
    for (const id of UPGRADE_IDS) {
      const level = this.player.upgrades[id];
      if (this.shown[i] !== level) changed = true;
      this.shown[i++] = level;
    }
    for (const id of RESOURCE_IDS) {
      const amount = this.player.resources[id];
      if (this.shown[i] !== amount) changed = true;
      this.shown[i++] = amount;
    }
    if (changed) this.layout();
  }

  /** Positions and redraws every button for the current screen size. Call on resize. */
  layout(): void {
    const style = THEME.upgradeBar;
    const width = viewWidth(this.scene);
    const height = viewHeight(this.scene);
    const portrait = height > width;
    const n = this.buttons.length;
    const w = style.buttonWidthPx;
    const h = style.buttonHeightPx;
    const gap = style.gapPx;
    this.panels.clear();

    this.buttons.forEach((button, i) => {
      const x = portrait
        ? width - style.edgeMarginPx - w / 2
        : width / 2 - ((n - 1) * (w + gap)) / 2 + i * (w + gap);
      const y = portrait
        ? height / 2 - ((n - 1) * (h + gap)) / 2 + i * (h + gap)
        : height - style.edgeMarginPx - h / 2;
      this.drawButton(button, x, y);
    });
  }

  private drawButton(button: UpgradeButton, x: number, y: number): void {
    const style = THEME.upgradeBar;
    const level = this.player.upgrades[button.id];
    const maxed = level >= MAX_UPGRADE_LEVEL;
    const affordable = canAfford(this.player, button.id);
    const w = style.buttonWidthPx;
    const h = style.buttonHeightPx;
    const top = y - h / 2;

    // Colored arcade button: the upgrade's color, dimmed toward slate when it can't be bought.
    const base = style.colors[button.id] ?? style.button;
    const fill = affordable || maxed ? base : mixColor(base, style.button, 0.55);
    // The box is only the hit area now; the look is a kit panel (white rim when affordable).
    button.box.setPosition(x, y).setFillStyle(fill, 0.001).setStrokeStyle(0);
    drawPanel(this.panels, x, y, w, h, {
      fill,
      dark: mixColor(fill, 0x000000, 0.35),
      radius: 12,
      rim: affordable ? 0xffffff : undefined,
      rimPx: affordable ? 3 : undefined,
      outline: affordable ? 5 : UI.outlinePx,
    });
    const alpha = affordable || maxed ? 1 : 0.8;
    button.label.setPosition(x, top + 35).setAlpha(alpha);
    button.hotkey
      .setPosition(x - w / 2 + 9, top + 9)
      .setVisible(this.showHotkeys)
      .setAlpha(alpha);

    const g = button.marks.clear();
    drawUpgradeIcon(g, button.id, x, top + 16, 9);
    // Level pips.
    const pipGap = 12;
    for (let i = 0; i < MAX_UPGRADE_LEVEL; i++) {
      const px = x - ((MAX_UPGRADE_LEVEL - 1) * pipGap) / 2 + i * pipGap;
      const filled = i < level;
      g.fillStyle(0x1b1f2a, 0.6).fillCircle(px, top + 49, 5.5);
      g.fillStyle(filled ? style.pipFilled : 0xffffff, filled ? 1 : 0.35).fillCircle(
        px,
        top + 49,
        4,
      );
    }

    // Cost of the next level, or MAX.
    const cost = nextLevelCost(this.player, button.id);
    const [first, second] = button.costTexts;
    if (!first || !second) return;
    for (const icon of button.costIcons) icon.setVisible(false);
    if (!cost) {
      first
        .setText(STRINGS.upgrades.max)
        .setPosition(x, top + 66)
        .setAlpha(1)
        .setVisible(true);
      second.setVisible(false);
      return;
    }
    const slot = cost.length === 1 ? [0] : [-16, 16];
    cost.forEach((part, i) => {
      const cx = x + (slot[i] ?? 0);
      const enough = this.player.resources[part.resourceId] >= part.amount;
      const key = resourceIconKey(this.scene, part.resourceId);
      const icon = button.costIcons[i];
      if (key && icon) {
        const px = style.costIconSizePx * 3.4;
        icon
          .setTexture(key)
          .setDisplaySize(px, px)
          .setPosition(cx - 7, top + 66)
          .setAlpha(alpha);
        icon.setVisible(true);
      } else drawResourceIcon(g, part.resourceId, cx - 7, top + 66, style.costIconSizePx);
      const text = button.costTexts[i];
      text
        ?.setText(String(part.amount))
        .setColor(enough ? style.text : style.missing)
        .setPosition(cx + 6, top + 66)
        .setAlpha(alpha)
        .setVisible(true);
    });
    if (cost.length === 1) second.setVisible(false);
  }
}

function mixColor(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - t) + ((b >> s) & 0xff) * t) << s;
  return ch(16) | ch(8) | ch(0);
}

/**
 * Upgrade icons, white with a dark drop shadow so they read on every button color:
 * heart (health), double chevron (speed), target (range), impact star (damage), bolt (fire rate).
 */
function drawUpgradeIcon(
  g: Phaser.GameObjects.Graphics,
  id: UpgradeId,
  x: number,
  y: number,
  s: number,
): void {
  for (const [dx, dy, color, alpha] of [
    [1, 1.5, 0x1b1f2a, 0.6],
    [0, 0, 0xffffff, 1],
  ] as const) {
    const cx = x + dx;
    const cy = y + dy;
    g.fillStyle(color, alpha).lineStyle(s * 0.38, color, alpha);
    switch (id) {
      case "hp":
        g.fillCircle(cx - s * 0.48, cy - s * 0.25, s * 0.55);
        g.fillCircle(cx + s * 0.48, cy - s * 0.25, s * 0.55);
        g.fillTriangle(cx - s * 1.0, cy - s * 0.05, cx + s * 1.0, cy - s * 0.05, cx, cy + s * 1.0);
        break;
      case "speed":
        for (const ox of [-0.45, 0.35]) {
          g.beginPath();
          g.moveTo(cx + (ox - 0.4) * s, cy - s * 0.75);
          g.lineTo(cx + (ox + 0.35) * s, cy);
          g.lineTo(cx + (ox - 0.4) * s, cy + s * 0.75);
          g.strokePath();
        }
        break;
      case "range":
        g.lineStyle(s * 0.26, color, alpha).strokeCircle(cx, cy, s * 0.72);
        g.fillCircle(cx, cy, s * 0.22);
        g.lineBetween(cx - s * 1.1, cy, cx - s * 0.45, cy);
        g.lineBetween(cx + s * 0.45, cy, cx + s * 1.1, cy);
        g.lineBetween(cx, cy - s * 1.1, cx, cy - s * 0.45);
        g.lineBetween(cx, cy + s * 0.45, cx, cy + s * 1.1);
        break;
      case "damage": {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
          const rr = i % 2 === 0 ? s * 1.05 : s * 0.5;
          pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
        }
        g.fillPoints(pts, true);
        break;
      }
      case "fireRate":
        g.fillPoints(
          [
            { x: cx + s * 0.25, y: cy - s * 1.05 },
            { x: cx - s * 0.6, y: cy + s * 0.15 },
            { x: cx - s * 0.05, y: cy + s * 0.15 },
            { x: cx - s * 0.3, y: cy + s * 1.05 },
            { x: cx + s * 0.6, y: cy - s * 0.2 },
            { x: cx + s * 0.05, y: cy - s * 0.2 },
          ],
          true,
        );
        break;
    }
  }
}
