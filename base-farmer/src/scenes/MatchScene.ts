import Phaser from "phaser";
import { FIXED_STEP_SECONDS, GAME_CONFIG } from "../config/gameConfig";
import { FixedStepClock } from "../core/FixedStepClock";
import type { Vec2 } from "../core/math";
import { isAlive, type MatchState, type PlayerState } from "../core/MatchState";
import { stepMatch } from "../core/Simulation";
import type { PlayerId } from "../core/types";
import type { GameCommand } from "../core/commands";
import { BotController } from "../gameplay/bots/BotController";
import { createBotNavigation } from "../gameplay/bots/BotNavigation";
import { CommandWriter } from "../input/CommandWriter";
import { assistAim } from "../input/aimAssist";
import { InputController } from "../input/InputController";
import type { NavGrid } from "../world/navigation";
import { computeCameraZoom } from "../rendering/cameraZoom";
import { paintGroundCanvas } from "../rendering/MapRenderer";
import { BACK_ROW_MARGIN_PX, screenX, screenY } from "../rendering/projection";
import { toPixels } from "../rendering/units";
import { MatchOverlay } from "../rendering/world3d/MatchOverlay";
import { World3D } from "../rendering/world3d/World3D";
import type { MatchContext } from "./MatchContext";
import { SCENE_KEYS } from "./sceneKeys";

/** Wires input → simulation → rendering. Holds no game rules itself. */
export class MatchScene extends Phaser.Scene {
  private state!: MatchState;
  private localPlayerId!: PlayerId;
  private localPlayer!: PlayerState;
  private clock!: FixedStepClock;
  private controls!: InputController;
  private commands!: CommandWriter;
  // 3D world under a Phaser overlay (D058).
  private world3d!: World3D;
  private overlay!: MatchOverlay;
  /** What the Phaser camera follows (the local player's feet on screen). */
  private follow!: Phaser.GameObjects.Zone;
  private bots: BotController[] = [];
  private nav!: NavGrid;
  /** Reused every tick by the touch aim assist. */
  private readonly enemyPositions: { x: number; y: number }[] = [];
  /** Reused every tick: local commands followed by every bot's. */
  private readonly tickCommands: GameCommand[] = [];

  constructor() {
    super(SCENE_KEYS.match);
  }

  create(context: MatchContext): void {
    this.state = context.state;
    this.localPlayerId = context.localPlayerId;
    const local = this.state.players.find((p) => p.id === this.localPlayerId);
    if (!local) throw new Error(`Local player "${this.localPlayerId}" missing from match`);
    this.localPlayer = local;
    this.clock = new FixedStepClock(
      FIXED_STEP_SECONDS * 1000,
      GAME_CONFIG.simulation.maxStepsPerFrame,
    );

    const map = this.state.layout;
    // Each base zone gets ground matching its resource (wheat field, garden, sawdust...).
    const yards = map.bases.flatMap((b) => {
      const base = this.state.bases.find((s) => s.id === b.id);
      return base ? [{ x: b.position.x, y: b.position.y, resourceId: base.resourceId }] : [];
    });
    const parent = this.game.canvas.parentElement;
    if (!parent) throw new Error("Phaser canvas has no parent");
    const world = new World3D(
      parent,
      this.state,
      paintGroundCanvas(this, map, this.state.mapId, yards),
    );
    this.world3d = world;
    this.overlay = new MatchOverlay(this, this.state, this.localPlayerId);
    this.follow = this.add.zone(0, 0, 1, 1);
    if (new URLSearchParams(window.location.search).has("fps")) this.showFps(parent, world);
    const onResize = () => world.resize();
    window.addEventListener("resize", onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("resize", onResize);
      world.destroy();
    });

    this.controls = new InputController(this, context.touch, context.uiInput);
    this.commands = new CommandWriter(this.localPlayerId);
    const nav = createBotNavigation(this.state.layout);
    this.nav = nav.grid;
    this.bots = context.bots.map(
      (b) => new BotController(b.playerId, b.difficulty, this.state.seed, nav),
    );

    const camera = this.cameras.main;
    // Room above the top edge for the tall things standing on the back row.
    const top = BACK_ROW_MARGIN_PX;
    camera.setBounds(0, -top, screenX(map.width), screenY(map.height) + top);
    const lerp = GAME_CONFIG.camera.followLerp;
    this.placeFollow();
    camera.startFollow(this.follow, false, lerp, lerp);
    // The world canvas shows through; the Phaser camera only frames the overlay.
    camera.transparent = true;
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    });
  }

  override update(_time: number, deltaMs: number): void {
    this.clock.advance(deltaMs, this.tick);
    const alpha = this.clock.alpha;
    this.placeFollow();
    // Same rectangle as the Phaser camera; worldView lags one frame behind the follow, which
    // is invisible since both layers use it.
    this.world3d.render(alpha, this.cameras.main.worldView, Math.min(0.1, deltaMs / 1000));
    this.overlay.render(this.state, alpha);
  }

  /** `?fps`: a small corner readout of the 3D world's frame rate, render time and load time. */
  private showFps(parent: HTMLElement, world: World3D): void {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "absolute",
      left: "6px",
      bottom: "6px",
      zIndex: "5",
      font: "12px monospace",
      color: "#fff",
      background: "rgba(0,0,0,0.55)",
      padding: "3px 6px",
      pointerEvents: "none",
      whiteSpace: "pre",
    });
    parent.append(el);
    const timer = window.setInterval(() => {
      const s = world.stats;
      el.textContent = `fps ${s.fps}  3d ${s.frameMs} ms\nload ${s.loadedMs ?? "…"} ms`;
    }, 500);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.clearInterval(timer);
      el.remove();
    });
  }

  private placeFollow(): void {
    const p = this.localPlayer.position;
    this.follow.setPosition(screenX(p.x), screenY(p.y));
  }

  private readonly tick = (): void => {
    const player = this.localPlayer;

    const input = this.controls.sample(
      screenX(player.position.x),
      screenY(player.position.y),
      player.stats.attackRange,
    );
    // Locked on an enemy: a lob lands on it (the assist writes the vector to the target).
    if (this.controls.isTouchAiming && this.applyAimAssist(player, input.aimVector))
      input.aimDistance = Math.hypot(input.aimVector.x, input.aimVector.y);
    this.world3d.capturePrevious();
    this.overlay.capturePrevious(this.state);

    const commands = this.tickCommands;
    commands.length = 0;
    appendAll(commands, this.commands.write(input));
    for (const bot of this.bots) appendAll(commands, bot.think(this.state));
    stepMatch(this.state, commands);
  };

  /** Touch aim stick only: nudges the aim onto an enemy in a narrow cone. Mouse aim is exact. */
  private applyAimAssist(player: PlayerState, aim: Vec2): boolean {
    const { aimAssistConeDegrees, aimAssistRangeMargin } = GAME_CONFIG.input;
    const enemies = this.enemyPositions;
    enemies.length = 0;
    for (const p of this.state.players) {
      if (p.teamId !== player.teamId && isAlive(p)) enemies.push(p.position);
    }
    const { x, y } = player.position;
    return assistAim(
      aim,
      x,
      y,
      aim.x,
      aim.y,
      enemies,
      (aimAssistConeDegrees * Math.PI) / 180,
      player.stats.attackRange + aimAssistRangeMargin,
      // Lobs fly over walls: any enemy in range is a target.
      (tx, ty) =>
        player.stats.attackKind === "lob" ||
        this.nav.hasLineOfSight(x, y, tx, ty, player.stats.projectileRadius),
    );
  }

  private fitCamera(): void {
    const map = this.state.layout;
    const { width, height } = this.scale;
    this.cameras.main.setZoom(
      computeCameraZoom(
        width,
        height,
        screenX(map.width),
        screenY(map.height) + BACK_ROW_MARGIN_PX,
        toPixels(GAME_CONFIG.camera.visibleUnitsShortSide),
      ),
    );
  }
}

/** push(...items) without the spread's temporary argument list (runs every tick). */
function appendAll<T>(target: T[], items: readonly T[]): void {
  for (const item of items) target.push(item);
}
