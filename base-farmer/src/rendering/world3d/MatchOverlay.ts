import type Phaser from "phaser";
import { UI } from "../ui/uiKit";
import { isAlive, type MatchState, type PlayerState } from "../../core/MatchState";
import type { PlayerId } from "../../core/types";
import { CombatFx } from "../CombatFx";
import { LAYER, screenX, screenY } from "../projection";
import { THEME } from "../theme";
import { characterScreenHeight } from "./camera";

interface Bar {
  readonly root: Phaser.GameObjects.Container;
  readonly fill: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
  readonly prev: { x: number; y: number };
  lastHp: number;
  wasAlive: boolean;
}

/**
 * What stays 2D above the 3D world (D058), drawn by the Phaser world camera, which shares the 3D
 * camera's framing: health bars and damage numbers (text reads best flat on screen). Every other
 * effect is 3D (Fx3D).
 */
export class MatchOverlay {
  private readonly bars = new Map<PlayerId, Bar>();
  private readonly fx: CombatFx;
  private readonly headPx = characterScreenHeight();

  constructor(
    private readonly scene: Phaser.Scene,
    state: MatchState,
    private readonly localPlayerId: PlayerId,
  ) {
    this.fx = new CombatFx(scene);
    const style = THEME.healthBar;
    for (const p of state.players) {
      // Kit look: ink capsule with a dark track, the team colour inside.
      const w = style.widthPx;
      const h = style.heightPx;
      const frame = scene.add
        .graphics()
        .fillStyle(UI.ink, 0.45)
        .fillRoundedRect(-w / 2 - 3, -h / 2 - 1, w + 6, h + 6, 6)
        .fillStyle(UI.ink, 1)
        .fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 6)
        .fillStyle(0x3a2f3f, 1)
        .fillRoundedRect(-w / 2, -h / 2, w, h, 3);
      const fill = scene.add
        .rectangle(
          -style.widthPx / 2,
          0,
          style.widthPx,
          style.heightPx,
          THEME.teams[p.teamId].primary,
        )
        .setOrigin(0, 0.5);
      const text = scene.add
        .text(0, -style.heightPx / 2 - 8, String(Math.ceil(p.hp)), {
          fontFamily: UI.displayFont,
          fontSize: `${style.numberFontPx}px`,
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setStroke("#1b1f2a", 3);
      this.bars.set(p.id, {
        root: scene.add.container(0, 0, [frame, fill, text]).setDepth(LAYER.overlay),
        fill,
        text,
        prev: { x: p.position.x, y: p.position.y },
        lastHp: p.hp,
        wasAlive: isAlive(p),
      });
    }
  }

  capturePrevious(state: MatchState): void {
    for (const p of state.players) {
      const bar = this.bars.get(p.id);
      if (bar) {
        bar.prev.x = p.position.x;
        bar.prev.y = p.position.y;
      }
    }
  }

  render(state: MatchState, alpha: number): void {
    const now = this.scene.time.now;
    for (const p of state.players) {
      const bar = this.bars.get(p.id);
      if (!bar) continue;
      const x = screenX(bar.prev.x + (p.position.x - bar.prev.x) * alpha);
      const feet = screenY(bar.prev.y + (p.position.y - bar.prev.y) * alpha);
      const head = feet - this.headPx;
      const alive = isAlive(p);
      bar.wasAlive = alive;
      bar.root.setVisible(alive).setPosition(x, head - THEME.healthBar.gapPx);
      if (!alive) continue;

      if (p.hp !== bar.lastHp) {
        if (p.hp < bar.lastHp) this.onHurt(p, x, head, bar.lastHp - p.hp, now);
        bar.fill.setScale(Math.max(0, p.hp / p.stats.maxHp), 1);
        bar.text.setText(String(Math.ceil(p.hp)));
        bar.lastHp = p.hp;
      }
    }
    this.fx.update(now);
  }

  /** The damage number; the hit itself is a 3D effect (Fx3D.impact). */
  private onHurt(p: PlayerState, x: number, head: number, amount: number, now: number): void {
    const color = p.id === this.localPlayerId ? "#ff6b6b" : "#ffd166";
    this.fx.damage(x + 18, head - 30, amount, color, now);
  }
}
