import type Phaser from "phaser";

/**
 * Base Farmer's interface kit (roadmap step 7, docs/13): one look for every screen and HUD
 * element, in the spirit of the 3D cast (Supercell-like: chunky, rounded, ink outlines).
 *
 * - Display text: Lilita One, white (or a colour), thick ink stroke, a short drop shadow.
 * - Panels: deep slate, ink outline, a lighter band on top (light from above), a darker lip and
 *   a drop shadow below: they read as objects, not as boxes.
 * - Buttons: the same shape in a colour; gold = the main action, slate = secondary. They sink
 *   when pressed.
 * - Team blue and red are kept for team information only (docs/12 §3).
 */

export const UI = {
  displayFont: "'Lilita One', Fredoka, system-ui, sans-serif",
  bodyFont: "Fredoka, system-ui, sans-serif",
  ink: 0x161b2e,
  inkCss: "#161b2e",
  panel: 0x2a3658,
  panelLight: 0x3a4a74,
  panelDark: 0x1d2640,
  /** Main action (Jouer, Rejouer). */
  gold: 0xffc93c,
  goldDark: 0xd9921c,
  /** Secondary action / unselected choice. */
  slate: 0x4a5a85,
  slateDark: 0x323f63,
  cream: "#fff4dc",
  muted: "#b9c3de",
  white: "#ffffff",
  good: "#7dff8a",
  /** Selection highlight: a warm gold rim, not a team colour. */
  selected: 0xffd34d,
  background: 0x1b2340,
  outlinePx: 3,
  radiusPx: 14,
  shadowPx: 4,
} as const;

/** Chunky display text: Lilita One, ink stroke and a short drop shadow. */
export function displayText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  px: number,
  color: string = UI.white,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, value, {
      fontFamily: UI.displayFont,
      fontSize: `${px}px`,
      color,
      stroke: UI.inkCss,
      strokeThickness: Math.max(3, Math.round(px / 6)),
      align: "center",
    })
    .setShadow(0, Math.max(2, Math.round(px / 12)), UI.inkCss, 0, true, false)
    .setOrigin(0.5);
}

/** Small body text (descriptions, captions): Fredoka, light, thin outline for the map. */
export function bodyText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  px: number,
  color: string = UI.cream,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, value, {
      fontFamily: UI.bodyFont,
      fontSize: `${px}px`,
      fontStyle: "bold",
      color,
      align: "center",
    })
    .setOrigin(0.5);
}

export interface PanelStyle {
  readonly fill?: number;
  readonly dark?: number;
  readonly radius?: number;
  readonly outline?: number;
  /** Rim colour instead of ink (selection). */
  readonly rim?: number | undefined;
  readonly rimPx?: number | undefined;
  readonly alpha?: number;
  /** Drawn pressed: no shadow, moved down by it. */
  readonly pressed?: boolean;
}

/**
 * A chunky panel centred on (x, y): drop shadow, ink outline, body, darker lip at the bottom and
 * a light band on top. Draws into `g` (does not clear it).
 */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  style: PanelStyle = {},
): void {
  const r = Math.min(style.radius ?? UI.radiusPx, h / 2, w / 2);
  const fill = style.fill ?? UI.panel;
  const dark = style.dark ?? mix(fill, 0x000000, 0.3);
  const alpha = style.alpha ?? 1;
  const o = style.outline ?? UI.outlinePx;
  const shadow = style.pressed ? 0 : UI.shadowPx;
  const top = y - h / 2 + (style.pressed ? UI.shadowPx : 0);
  const left = x - w / 2;
  if (shadow > 0) g.fillStyle(UI.ink, 0.45 * alpha).fillRoundedRect(left, top + shadow, w, h, r);
  g.fillStyle(style.rim ?? UI.ink, alpha).fillRoundedRect(
    left - o,
    top - o,
    w + o * 2,
    h + o * 2,
    r + o,
  );
  if (style.rim !== undefined && style.rimPx) {
    const k = style.rimPx;
    g.fillStyle(UI.ink, alpha).fillRoundedRect(
      left - o + k,
      top - o + k,
      w + (o - k) * 2,
      h + (o - k) * 2,
      r + o - k,
    );
  }
  g.fillStyle(dark, alpha).fillRoundedRect(left, top, w, h, r);
  g.fillStyle(fill, alpha).fillRoundedRect(left, top, w, h - Math.min(6, h * 0.12), r);
  // Light band on the upper part: the light comes from above (game-art rule). Thin on tall
  // panels (a gloss, not a title bar), half the height on buttons.
  const band = h > 70 ? 10 : h * 0.4;
  g.fillStyle(0xffffff, (h > 70 ? 0.1 : 0.16) * alpha).fillRoundedRect(
    left + 5,
    top + 4,
    w - 10,
    band,
    Math.max(2, Math.min(r - 4, band / 2)),
  );
}

/** A tappable chunky button: a panel, a label, and a sink when pressed. Rebuilt by layout(). */
export class UiButton {
  readonly g: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
  private pressed = false;
  private x = 0;
  private y = 0;

  constructor(
    scene: Phaser.Scene,
    text: string,
    private w: number,
    private h: number,
    private readonly fill: number,
    private readonly dark: number,
    onClick: () => void,
    fontPx = 24,
  ) {
    this.g = scene.add.graphics();
    this.label = displayText(scene, 0, 0, text, fontPx);
    this.zone = scene.add
      .zone(0, 0, w, h)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.press(true))
      .on("pointerout", () => this.press(false))
      .on("pointerup", () => {
        if (!this.pressed) return;
        this.press(false);
        onClick();
      });
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.zone.setPosition(x, y);
    this.redraw();
    return this;
  }

  setSize(w: number, h: number): this {
    this.w = w;
    this.h = h;
    this.zone.setSize(w, h);
    this.redraw();
    return this;
  }

  setVisible(visible: boolean): this {
    this.g.setVisible(visible);
    this.label.setVisible(visible);
    this.zone.setVisible(visible);
    if (visible) this.zone.setInteractive();
    else this.zone.disableInteractive();
    return this;
  }

  destroy(): void {
    this.g.destroy();
    this.label.destroy();
    this.zone.destroy();
  }

  get objects(): Phaser.GameObjects.GameObject[] {
    return [this.g, this.label, this.zone];
  }

  private press(down: boolean): void {
    if (this.pressed === down) return;
    this.pressed = down;
    this.redraw();
  }

  private redraw(): void {
    this.g.clear();
    drawPanel(this.g, this.x, this.y, this.w, this.h, {
      fill: this.fill,
      dark: this.dark,
      pressed: this.pressed,
    });
    this.label.setPosition(this.x, this.y - 2 + (this.pressed ? UI.shadowPx : 0));
  }
}

export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - t) + ((b >> s) & 0xff) * t) << s;
  return ch(16) | ch(8) | ch(0);
}

export function css(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
