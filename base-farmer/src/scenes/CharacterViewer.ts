import Phaser from "phaser";
import { displayText, drawPanel, UI } from "../rendering/ui/uiKit";
import { GAME_CONFIG } from "../config/gameConfig";
import { STRINGS } from "../config/strings";
import { BASELINE, type CharacterDefinition } from "../data/characters";
import { TILT } from "../rendering/projection";
import { THEME } from "../rendering/theme";
import { viewHeight, viewWidth } from "../rendering/viewport";
import { EXPRESSIONS, type ExpressionName } from "../rendering/three/face";
import { Stage3D } from "../rendering/three/Stage3D";
import { artForModel, modelFor } from "../rendering/characterArt";

/** Turntable speed while ← / → is held, rad/s. */
const TURN_RATE = 3.2;
/** Ground dashes scrolling under the feet while running, px between dashes (before zoom). */
const DASH_GAP = 26;

/**
 * Character inspection modal (selection screen): the full 3D model, big, on a turntable.
 * ← / → turn it, ↑ runs away from the camera (back view), ↓ runs toward it, Space attacks,
 * V celebrates, E cycles expressions, Escape (or a tap outside) closes. Same rig and animation
 * as the match.
 */
export class CharacterViewer {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly dashes: Phaser.GameObjects.Graphics;
  private readonly r: number;
  private readonly maxSpeed: number;
  /** Heading on the ground plane: 0 = right, π/2 = toward the camera, -π/2 = away. */
  /** Facing the player on opening (3D yaw = π/2 − heading = 0). */
  private heading = Math.PI / 2;
  private readonly held = new Set<string>();
  private attackAtMs = -Infinity;
  private scroll = 0;
  private lastMs = 0;
  private zoom = 1;
  private stage3d: Stage3D | null;
  private runPhase = 0;
  private expression: ExpressionName;
  /** Victory start (ms), or null: toggled with V. */
  private victoryAt: number | null = null;
  private readonly exprLabel: Phaser.GameObjects.Text;
  private run = 0;
  /** ?model=<model> previews a model that is not in the roster yet (characterArt.ts). */
  private readonly model: string;
  /** Width of the ground disc, px. */
  private stageW = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    character: CharacterDefinition,
    private readonly onClose: () => void,
  ) {
    const width = viewWidth(scene);
    const height = viewHeight(scene);
    this.r = BASELINE.radius * GAME_CONFIG.rendering.pixelsPerUnit * THEME.character.figureScale;
    this.maxSpeed = character.moveSpeed * GAME_CONFIG.rendering.pixelsPerUnit;

    this.model = new URLSearchParams(window.location.search).get("model") ?? modelFor(character.id);
    // Each character opens on its signature expression (its personality).
    this.expression = artForModel(this.model).signature;
    const depth = 1000;
    const veil = scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.72)
      .setOrigin(0)
      .setDepth(depth)
      .setInteractive()
      .on("pointerup", () => this.close());
    const panelW = Math.min(width - 32, 560);
    const panelH = Math.min(height - 32, 620);
    const cx = width / 2;
    const cy = height / 2;
    // The panel swallows clicks (only the veil closes); a tap on it attacks.
    // Kit panel (roadmap step 7); the rectangle is only the hit area.
    const frame = scene.add.graphics().setDepth(depth);
    drawPanel(frame, cx, cy, panelW, panelH, { radius: 20 });
    const panel = scene.add
      .rectangle(cx, cy, panelW, panelH, 0x000000, 0.001)
      .setDepth(depth)
      .setInteractive()
      .on("pointerup", () => this.attack());
    const title = displayText(
      scene,
      cx,
      cy - panelH / 2 + 30,
      new URLSearchParams(window.location.search).has("model")
        ? `APERÇU · ${new URLSearchParams(window.location.search).get("model")}`
        : `${character.label.toUpperCase()} · 3D`,
      30,
    ).setDepth(depth);
    const hint = scene.add
      .text(cx, cy + panelH / 2 - 26, STRINGS.select.viewerHint3d, {
        fontFamily: THEME.hud.fontFamily,
        fontSize: "13px",
        color: THEME.select.mutedColor,
        align: "center",
      })
      .setOrigin(0.5)
      .setWordWrapWidth(panelW - 24)
      .setDepth(depth);
    const closeBtn = scene.add
      .text(cx + panelW / 2 - 22, cy - panelH / 2 + 22, "✕", {
        fontFamily: THEME.hud.fontFamily,
        fontSize: "22px",
        color: THEME.select.textColor,
      })
      .setOrigin(0.5)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.close());

    // Stage: a tilted ground disc under the model, which casts its own shadow.
    const feetY = cy + panelH * 0.22;
    this.stageW = Math.min(panelW * 0.86, panelH * 0.5);
    this.zoom = this.stageW / (this.r * 6);
    const stage = scene.add.graphics().setDepth(depth);
    stage.fillStyle(UI.panelLight, 1).fillEllipse(cx, feetY, this.stageW, this.stageW * TILT * 0.5);
    this.dashes = scene.add.graphics().setDepth(depth);
    this.dashes.setPosition(cx, feetY);

    const size = Math.min(panelW, panelH) * 0.95;
    this.stage3d = new Stage3D(scene, THEME.teams.teamA, cx, cy + panelH * 0.02, size, this.model);
    this.stage3d.image.setDepth(depth);
    this.exprLabel = scene.add
      .text(cx, cy - panelH / 2 + 58, this.expression, {
        fontFamily: THEME.hud.fontFamily,
        fontSize: "14px",
        color: THEME.select.mutedColor,
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.objects.push(
      veil,
      frame,
      panel,
      title,
      hint,
      closeBtn,
      stage,
      this.dashes,
      this.exprLabel,
    );
    this.lastMs = scene.time.now;
    scene.input.keyboard?.on("keydown", this.onKeyDown, this);
    scene.input.keyboard?.on("keyup", this.onKeyUp, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") this.close();
    else if (event.key === " ") this.attack();
    else if (event.code === "KeyV") {
      this.victoryAt = this.victoryAt === null ? this.scene.time.now : null;
    } else if (event.code === "KeyE") {
      // Cycle through the expression presets.
      const names = Object.keys(EXPRESSIONS) as ExpressionName[];
      this.expression =
        names[(names.indexOf(this.expression) + 1) % names.length] ?? this.expression;
      this.exprLabel.setText(this.expression);
    } else this.held.add(event.key);
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.held.delete(event.key);
  }

  private attack(): void {
    const now = this.scene.time.now;
    if (now - this.attackAtMs > THEME.character.attackMs) this.attackAtMs = now;
  }

  private update(time: number): void {
    const dt = Math.min(0.05, Math.max(0, (time - this.lastMs) / 1000));
    this.lastMs = time;
    const left = this.held.has("ArrowLeft");
    const right = this.held.has("ArrowRight");
    const up = this.held.has("ArrowUp");
    const down = this.held.has("ArrowDown");

    let vx = 0;
    let vy = 0;
    if (up || down) {
      // Run straight away from / toward the camera, on the spot (the ground scrolls).
      const target = up ? -Math.PI / 2 : Math.PI / 2;
      this.heading = target + (right ? -0.6 : left ? 0.6 : 0) * (up ? -1 : 1);
      vx = Math.cos(this.heading) * this.maxSpeed;
      vy = Math.sin(this.heading) * this.maxSpeed * TILT;
    } else if (left || right) {
      this.heading += (right ? -1 : 1) * TURN_RATE * dt;
    }
    if (this.stage3d) {
      const moving = vx !== 0 || vy !== 0;
      this.run += ((moving ? 1 : 0) - this.run) * Math.min(1, dt * 10);
      this.runPhase += dt * 11 * this.run;
      this.stage3d.render(
        Math.PI / 2 - this.heading,
        this.run,
        this.runPhase,
        (time - this.attackAtMs) / 1000,
        time / 1000,
        this.expression,
        this.victoryAt === null ? Infinity : (time - this.victoryAt) / 1000,
      );
    }

    // Treadmill: dashes slide opposite to the run so the motion reads without moving the model.
    this.scroll += Math.hypot(vx, vy) * dt;
    const g = this.dashes.clear();
    if (vx !== 0 || vy !== 0) {
      const dirX = -vx / Math.hypot(vx, vy);
      const dirY = -vy / Math.hypot(vx, vy);
      // Half-axes of the ground disc in the run direction, so dashes stay on it.
      const span = 0.45 / Math.hypot(dirX / this.stageW, dirY / (this.stageW * TILT * 0.5));
      const gap = DASH_GAP * this.zoom * 0.4;
      g.lineStyle(3, THEME.select.cardStroke, 0.9);
      for (let i = -4; i <= 4; i++) {
        const d = ((i * gap + ((this.scroll * this.zoom * 0.4) % gap)) / (gap * 4.5)) * span;
        const x = dirX * d;
        const y = dirY * d;
        g.lineBetween(x - dirX * 6, y - dirY * 6, x + dirX * 6, y + dirY * 6);
      }
    }
  }

  close(): void {
    const scene = this.scene;
    scene.input.keyboard?.off("keydown", this.onKeyDown, this);
    scene.input.keyboard?.off("keyup", this.onKeyUp, this);
    scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.stage3d?.destroy(scene);
    this.stage3d = null;
    for (const o of this.objects) o.destroy();
    this.objects.length = 0;
    this.onClose();
  }
}
