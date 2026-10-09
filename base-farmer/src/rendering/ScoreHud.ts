import type Phaser from "phaser";
import { drawPanel, UI } from "./ui/uiKit";
import { isAlive, type MatchState, type PlayerState } from "../core/MatchState";
import type { BaseOwner, PlayerId } from "../core/types";
import { countBases, createBaseCounts } from "../gameplay/bases/score";
import type { MapLayout } from "../world/MapLayout";
import { TILT } from "./projection";
import { drawOwnerSymbol } from "./teamSymbol";
import { THEME } from "./theme";
import { ensurePortraits, portraitKey } from "./ui/portraits";
import { viewWidth } from "./viewport";

/**
 * Top-center score as a mini-map (D056): team A's base count, a small tilted map showing every
 * base's flag where it really is (owner symbol, yellow ring while contested), live icons of the
 * opposing characters and a dot for the local player, then team B's base count. You see at a
 * glance where to go to take a flag, and where the enemy is.
 *
 * The map drawing is redrawn only when a base changes; the icons move every frame.
 */
export class ScoreHud {
  private readonly counts = createBaseCounts();
  private readonly lastOwners: (BaseOwner | null)[];
  private readonly lastContested: boolean[];
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly board: Phaser.GameObjects.Graphics;
  private readonly flags: Phaser.GameObjects.Graphics;
  private readonly teamAText: Phaser.GameObjects.Text;
  private readonly teamBText: Phaser.GameObjects.Text;
  private readonly enemyIcons: { player: PlayerState; icon: Phaser.GameObjects.Image }[] = [];
  private readonly localDot: Phaser.GameObjects.Arc | null;
  private readonly local: PlayerState | null;
  /** Mini-map box, CSS pixels: top-left corner and scale (pixels per world unit). */
  private box = { x: 0, y: 0, width: 0, height: 0, scale: 1 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: MapLayout,
    state: MatchState,
    localPlayerId: PlayerId | null = null,
  ) {
    const hud = THEME.hud;
    const textStyle = (color: number): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: UI.displayFont,
      fontSize: `${hud.scoreFontPx}px`,
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: UI.inkCss,
      strokeThickness: 5,
    });

    this.lastOwners = map.bases.map(() => null);
    this.lastContested = map.bases.map(() => false);
    this.panel = scene.add.graphics();
    this.board = scene.add.graphics();
    this.flags = scene.add.graphics();
    this.teamAText = scene.add.text(0, 0, "0", textStyle(0xffffff)).setOrigin(1, 0.5);
    this.teamBText = scene.add.text(0, 0, "0", textStyle(0xffffff)).setOrigin(0, 0.5);

    this.local = state.players.find((p) => p.id === localPlayerId) ?? null;
    // Enemies (of the local player, or team B when watching) as small character icons.
    const myTeam = this.local?.teamId ?? "teamA";
    // 3D portraits, rendered once per game (already done during the selection screen).
    void ensurePortraits(scene.game).then(() => {
      for (const player of state.players) {
        if (player.teamId === myTeam || !this.panel.active) continue;
        const icon = scene.add.image(0, 0, portraitKey(player.characterId)).setOrigin(0.5, 0.92);
        icon.setScale((hud.minimapIconPx * 1.5) / icon.height);
        this.enemyIcons.push({ player, icon });
      }
      this.layout();
    });
    this.localDot = this.local
      ? scene.add
          .circle(0, 0, hud.minimapDotPx, THEME.teams[this.local.teamId].primary)
          .setStrokeStyle(2, 0xffffff)
      : null;
    this.layout();
  }

  update(state: MatchState): void {
    let changed = false;
    for (let i = 0; i < state.bases.length; i++) {
      const base = state.bases[i];
      if (!base) continue;
      if (this.lastOwners[i] !== base.owner || this.lastContested[i] !== base.contested) {
        this.lastOwners[i] = base.owner;
        this.lastContested[i] = base.contested;
        changed = true;
      }
    }
    if (changed) this.redrawFlags(state);
    this.placeIcons();
  }

  /** Re-lays out the HUD for the current screen width. */
  layout(): void {
    const hud = THEME.hud;
    const screenW = viewWidth(this.scene);
    const maxW = screenW < hud.compactWidthPx ? hud.minimapCompactWidthPx : hud.minimapWidthPx;
    // Fit the tilted map inside maxW x minimapMaxHeightPx.
    const scale = Math.min(
      maxW / this.map.width,
      hud.minimapMaxHeightPx / (this.map.height * TILT),
    );
    const width = this.map.width * scale;
    const height = this.map.height * TILT * scale;
    const x = screenW / 2 - width / 2;
    const y = hud.scoreTopPx;
    this.box = { x, y, width, height, scale };

    const pad = 6;
    const midY = y + height / 2;
    // The map in a slate panel, each team's count in a shield of its colour on either side.
    const shield = 34;
    const ax = x - pad - 8 - shield / 2;
    const bx = x + width + pad + 8 + shield / 2;
    this.panel.clear();
    drawPanel(this.panel, screenW / 2, midY, width + pad * 2, height + pad * 2, { radius: 10 });
    for (const [cx, team] of [
      [ax, THEME.teams.teamA],
      [bx, THEME.teams.teamB],
    ] as const) {
      drawPanel(this.panel, cx, midY, shield, shield + 4, {
        fill: team.primary,
        dark: team.dark,
        radius: 10,
      });
    }
    this.teamAText.setOrigin(0.5).setPosition(ax, midY - 1);
    this.teamBText.setOrigin(0.5).setPosition(bx, midY - 1);

    this.drawBoard();
    this.redrawFlags(null);
    this.placeIcons();
  }

  /** Static part: the board and its obstacles as faint shapes, for orientation. */
  private drawBoard(): void {
    const { x, y, width, height, scale } = this.box;
    const hud = THEME.hud;
    const g = this.board.clear();
    g.fillStyle(hud.minimapGround, 0.9).fillRoundedRect(x, y, width, height, 4);
    g.lineStyle(1.5, hud.minimapEdge, 0.9).strokeRoundedRect(x, y, width, height, 4);
    g.fillStyle(hud.minimapObstacle, 0.75);
    for (const o of this.map.obstacles) {
      const ox = x + o.center.x * scale;
      const oy = y + o.center.y * TILT * scale;
      if (o.kind === "circle")
        g.fillEllipse(ox, oy, o.radius * 2 * scale, o.radius * 2 * TILT * scale);
      else {
        const w = Math.max(1.5, o.halfWidth * 2 * scale);
        const h = Math.max(1.5, o.halfHeight * 2 * TILT * scale);
        g.fillRect(ox - w / 2, oy - h / 2, w, h);
      }
    }
  }

  /** Flags: owner symbol at each base, yellow ring while contested. Also refreshes the counts. */
  private redrawFlags(state: MatchState | null): void {
    if (state) {
      countBases(state.bases, this.counts);
      this.teamAText.setText(String(this.counts.teamA));
      this.teamBText.setText(String(this.counts.teamB));
    }
    const hud = THEME.hud;
    const g = this.flags.clear();
    this.map.bases.forEach((base, i) => {
      const { px, py } = this.toBox(base.position.x, base.position.y);
      if (this.lastContested[i]) {
        g.lineStyle(2.5, THEME.base.contested).strokeCircle(px, py, hud.pipSizePx + 4);
      }
      drawOwnerSymbol(
        g,
        this.lastOwners[i] ?? "neutral",
        px,
        py,
        hud.pipSizePx,
        THEME.base.coreOutline,
      );
    });
  }

  private placeIcons(): void {
    for (const { player, icon } of this.enemyIcons) {
      const alive = isAlive(player);
      icon.setVisible(alive);
      if (!alive) continue;
      const { px, py } = this.toBox(player.position.x, player.position.y);
      icon.setPosition(px, py + THEME.hud.minimapIconPx * 0.15).setFlipX(player.aim.x < 0);
    }
    if (this.local && this.localDot) {
      this.localDot.setVisible(isAlive(this.local));
      const { px, py } = this.toBox(this.local.position.x, this.local.position.y);
      this.localDot.setPosition(px, py);
    }
  }

  private toBox(wx: number, wy: number): { px: number; py: number } {
    const { x, y, scale } = this.box;
    return { px: x + wx * scale, py: y + wy * TILT * scale };
  }
}
