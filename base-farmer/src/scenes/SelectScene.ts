import Phaser from "phaser";
import { RulesPanel } from "../rendering/ui/RulesPanel";
import { Stage3D } from "../rendering/three/Stage3D";
import { modelFor } from "../rendering/characterArt";
import { THEME } from "../rendering/theme";
import { preloadMatchAssets } from "../rendering/world3d/preload";
import { useCssPixels, viewHeight, viewWidth } from "../rendering/viewport";
import { STRINGS } from "../config/strings";
import type { MapChoice } from "../core/localMatch";
import { BOT_DIFFICULTIES, BOT_DIFFICULTY_SETTINGS, type BotDifficulty } from "../data/bots";
import type { CharacterId } from "../core/types";
import { CHARACTERS, type CharacterDefinition } from "../data/characters";
import { MAPS } from "../data/maps";
import { definingStats, starsFor } from "../gameplay/characters/ratings";
import { ensurePortraits, portraitKey } from "../rendering/ui/portraits";
import { bodyText, displayText, drawPanel, UI, UiButton } from "../rendering/ui/uiKit";
import { CharacterViewer } from "./CharacterViewer";
import { SCENE_KEYS } from "./sceneKeys";

export interface SelectSceneData {
  /** Pre-selected character (the last one played). */
  readonly selected: CharacterId;
  /** Pre-selected map choice (the last one played). */
  readonly selectedMap: MapChoice;
  /** Pre-selected bot difficulty (the last one played). */
  readonly selectedDifficulty: BotDifficulty;
  readonly onPick: (
    characterId: CharacterId,
    mapChoice: MapChoice,
    difficulty: BotDifficulty,
  ) => void;
}

/** Map options in display order: random first, then every map. */
const MAP_CHOICES: readonly MapChoice[] = ["random", ...MAPS.map((m) => m.id)];

const LOGO_KEY = "brand-logo";

const STAR = "★";
const EMPTY_STAR = "☆";

/**
 * Pre-match character selection: the 4 characters as cards with their 2–3 defining stats and a
 * one-line pitch, then a row of map choices ("Aléatoire" or a named map) and a row of opponent
 * difficulties. Tap/click to select, then "Jouer". Keyboard: 1–4 or arrows for the character,
 * M for the map, D for the difficulty, Enter to play.
 * Cards stack 2x2 in portrait and 4 in a row in landscape.
 */
export class SelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private mapIndex = 0;
  private difficultyIndex = 1;
  private onPick!: SelectSceneData["onPick"];
  /** Everything drawn by layout(), destroyed and rebuilt on resize or selection change. */
  private readonly drawn: Phaser.GameObjects.GameObject[] = [];
  /** Portrait rigs animated every frame (idle breathing, the selected one hops). */
  /** Open inspection modal: it owns the keyboard while open. */
  private viewer: CharacterViewer | null = null;
  /** The selected character, live in 3D, celebrating. */
  private stage: Stage3D | null = null;
  /** Open "Comment jouer" panel: it owns the keyboard while open. */
  private rules: RulesPanel | null = null;
  private stageAtMs = 0;
  private readonly portraits: {
    image: Phaser.GameObjects.Image;
    baseY: number;
    selected: boolean;
    phase: number;
  }[] = [];

  constructor() {
    super(SCENE_KEYS.select);
  }

  create(data: SelectSceneData): void {
    preloadMatchAssets();
    useCssPixels(this, Phaser);
    this.onPick = data.onPick;
    this.selectedIndex = Math.max(
      0,
      CHARACTERS.findIndex((c) => c.id === data.selected),
    );
    this.mapIndex = Math.max(0, MAP_CHOICES.indexOf(data.selectedMap));
    this.difficultyIndex = Math.max(0, BOT_DIFFICULTIES.indexOf(data.selectedDifficulty));
    this.cameras.main.setBackgroundColor(UI.background);
    // 3D portraits render once (a few hundred ms): the cards show them as soon as they exist.
    void ensurePortraits(this.game).then(() => {
      if (this.scene.isActive()) this.layout();
    });

    // The round logo (public/brand/logo.svg) sits next to the title once it has loaded.
    if (!this.textures.exists(LOGO_KEY)) {
      this.load.svg(LOGO_KEY, "brand/logo-light.svg", { width: 192, height: 192 });
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (this.scene.isActive()) this.layout();
      });
      this.load.start();
    }

    this.input.keyboard?.on("keydown", this.onKey, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroyStage();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.drawn.length = 0;
    });
    this.layout();
  }

  private onKey(event: KeyboardEvent): void {
    if (this.rules) {
      if (event.key === "Escape" || event.key === "Enter") this.rules.close();
      return;
    }
    if (this.viewer) return;
    const n = CHARACTERS.length;
    // event.code is the physical key: "Digit1" on QWERTY and AZERTY alike (event.key is "&" on AZERTY).
    const digit = Number(/^(?:Digit|Numpad)(\d)$/.exec(event.code)?.[1] ?? NaN);
    if (Number.isInteger(digit) && digit >= 1 && digit <= n) this.select(digit - 1);
    else if (event.key === "ArrowRight" || event.key === "ArrowDown")
      this.select((this.selectedIndex + 1) % n);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      this.select((this.selectedIndex + n - 1) % n);
    else if (event.code === "KeyM") this.selectMap((this.mapIndex + 1) % MAP_CHOICES.length);
    else if (event.code === "KeyD")
      this.selectDifficulty((this.difficultyIndex + 1) % BOT_DIFFICULTIES.length);
    else if (event.key === "Enter" || event.key === " ") this.confirm();
  }

  private select(index: number): void {
    this.selectedIndex = index;
    this.layout();
  }

  private selectMap(index: number): void {
    this.mapIndex = index;
    this.layout();
  }

  private selectDifficulty(index: number): void {
    this.difficultyIndex = index;
    this.layout();
  }

  private confirm(): void {
    const picked = CHARACTERS[this.selectedIndex];
    const map = MAP_CHOICES[this.mapIndex];
    const difficulty = BOT_DIFFICULTIES[this.difficultyIndex];
    if (picked && map && difficulty) this.onPick(picked.id, map, difficulty);
  }

  /** Frees the live 3D stage (its WebGL context) before a relayout or when leaving. */
  private destroyStage(): void {
    if (!this.stage) return;
    const image = this.stage.image;
    const index = this.drawn.indexOf(image);
    if (index >= 0) this.drawn.splice(index, 1);
    this.stage.destroy(this);
    this.stage = null;
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.drawn.push(object);
    return object;
  }

  override update(time: number): void {
    if (this.stage) {
      const t = (time - this.stageAtMs) / 1000;
      this.stage.render(0, 0, 0, Infinity, t, "joyeux", t);
    }
    for (const p of this.portraits) {
      const t = time / 1000 + p.phase;
      // The selected character bounces on the spot, happy to be picked; the others breathe.
      const y = p.selected ? -Math.abs(Math.sin(t * Math.PI * 1.6)) * 7 : Math.sin(t * 1.6) * 1.2;
      p.image.setY(p.baseY + y);
    }
  }

  private layout(): void {
    this.viewer?.close();
    this.rules?.close();
    this.destroyStage();
    for (const object of this.drawn) object.destroy();
    this.drawn.length = 0;
    this.portraits.length = 0;

    const width = viewWidth(this);
    const height = viewHeight(this);
    const portrait = height > width;
    // Portrait: 2 per row up to 4 characters, then 3 (6 fit in 2 rows on a phone).
    const cols = portrait ? (CHARACTERS.length > 4 ? 3 : 2) : CHARACTERS.length;
    const rows = Math.ceil(CHARACTERS.length / cols);
    const gap = 14;
    const cardW = Math.min(230, (width - gap * (cols + 1)) / cols);
    // Logo on top, choices and the play button below: cards take the height that is left.
    const logoH = Math.min(96, height * 0.13);
    const belowH = 290;
    const cardH = Math.max(200, Math.min(290, (height - logoH - belowH - gap * (rows + 1)) / rows));
    const gridW = cols * cardW + (cols - 1) * gap;
    const gridH = rows * cardH + (rows - 1) * gap;
    const top = Math.max(logoH + 8, (height - gridH - belowH) / 2 + logoH / 2);

    // Logo: the game's name in gold, the call to action under it.
    const logoPx = Math.min(54, Math.floor(width / 8.5));
    const titleY = top - logoH * 0.62;
    const title = this.track(
      displayText(this, width / 2, titleY, "BASE FARMER", logoPx, "#ffc93c"),
    );
    if (this.textures.exists(LOGO_KEY)) {
      // Title and round logo centred together as one lockup: logo on the left.
      const size = logoPx * 1.5;
      const gapPx = logoPx * 0.25;
      const lockupW = size + gapPx + title.width;
      title.setX(width / 2 + (size + gapPx) / 2);
      this.track(
        this.add
          .image(width / 2 - lockupW / 2 + size / 2, titleY, LOGO_KEY)
          .setDisplaySize(size, size),
      );
    }
    this.track(
      bodyText(
        this,
        width / 2,
        top - logoH * 0.62 + logoPx * 0.72,
        STRINGS.select.title,
        14,
        UI.muted,
      ),
    );

    CHARACTERS.forEach((character, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (width - gridW) / 2 + col * (cardW + gap);
      const y = top + row * (cardH + gap);
      this.drawCard(character, i, x, y, cardW, cardH);
    });

    const mapY = top + gridH + 52;
    const mapLabels = MAP_CHOICES.map((choice) =>
      choice === "random"
        ? STRINGS.select.randomMap
        : (MAPS.find((m) => m.id === choice)?.label ?? choice),
    );
    this.drawChoiceRow(width, mapY, STRINGS.select.map, mapLabels, this.mapIndex, (i) =>
      this.selectMap(i),
    );
    const opponentY = mapY + 62;
    const difficultyLabels = BOT_DIFFICULTIES.map((d) => BOT_DIFFICULTY_SETTINGS[d].label);
    this.drawChoiceRow(
      width,
      opponentY,
      STRINGS.select.opponent,
      difficultyLabels,
      this.difficultyIndex,
      (i) => this.selectDifficulty(i),
    );

    const play = new UiButton(
      this,
      STRINGS.select.play.toUpperCase(),
      220,
      58,
      UI.gold,
      UI.goldDark,
      () => this.confirm(),
      30,
    ).setPosition(width / 2, opponentY + 62);
    for (const o of play.objects) this.track(o);
    const rules = new UiButton(
      this,
      STRINGS.rules.button,
      200,
      42,
      UI.slate,
      UI.slateDark,
      () => this.openRules(),
      18,
    ).setPosition(width / 2, opponentY + 122);
    for (const o of rules.objects) this.track(o);
    if (!this.sys.game.device.input.touch) {
      this.track(bodyText(this, width / 2, opponentY + 162, STRINGS.select.hint, 12, UI.muted));
    }
  }

  /** A captioned row of chunky pills, one of them selected (gold). */
  private drawChoiceRow(
    width: number,
    y: number,
    caption: string,
    labels: readonly string[],
    selectedIndex: number,
    onSelect: (index: number) => void,
  ): void {
    const pillH = 34;
    this.track(bodyText(this, width / 2, y - pillH / 2 - 13, caption.toUpperCase(), 12, UI.muted));
    const n = labels.length;
    const gap = 8;
    const pillW = Math.min(132, (width - 32 - gap * (n - 1)) / n);
    const startX = width / 2 - ((n - 1) * (pillW + gap)) / 2;
    const g = this.track(this.add.graphics());
    labels.forEach((label, i) => {
      const x = startX + i * (pillW + gap);
      const selected = i === selectedIndex;
      drawPanel(g, x, y, pillW, pillH, {
        fill: selected ? UI.gold : UI.slate,
        dark: selected ? UI.goldDark : UI.slateDark,
        radius: pillH / 2,
      });
      // Long names (Quatre-Coins) shrink to fit the pill on narrow phones.
      const px = Math.min(15, Math.floor(pillW / (label.length * 0.52)));
      this.track(displayText(this, x, y - 1, label, px, selected ? UI.white : UI.cream));
      this.track(
        this.add
          .zone(x, y, pillW, pillH)
          .setInteractive({ useHandCursor: true })
          .on("pointerup", () => onSelect(i)),
      );
    });
  }

  private drawCard(
    character: CharacterDefinition,
    index: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const selected = index === this.selectedIndex;
    const cx = x + w / 2;
    const g = this.track(this.add.graphics());
    drawPanel(g, cx, y + h / 2, w, h, {
      fill: selected ? 0x34477a : UI.panel,
      dark: UI.panelDark,
      rim: selected ? UI.selected : undefined,
      rimPx: selected ? 3 : undefined,
      outline: selected ? 6 : UI.outlinePx,
    });
    this.track(
      this.add
        .zone(cx, y + h / 2, w, h)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => this.select(index)),
    );

    // 3D portrait (rendered once from the character's model), on a soft ground shadow.
    const portraitH = h * 0.44;
    const feetY = y + 10 + portraitH;
    g.fillStyle(UI.ink, 0.35).fillEllipse(cx, feetY - portraitH * 0.06, w * 0.5, portraitH * 0.14);
    const key = portraitKey(character.id);
    if (selected) {
      // The selected character is live 3D, celebrating being picked (its victory pose).
      const size = portraitH * 1.5;
      this.stage = new Stage3D(
        this,
        THEME.teams.teamA,
        cx,
        feetY - portraitH * 0.5,
        size,
        modelFor(character.id),
        "match",
      );
      this.stageAtMs = this.time.now;
      this.track(this.stage.image);
    } else if (this.textures.exists(key)) {
      const image = this.track(
        this.add
          .image(cx, feetY, key)
          .setOrigin(0.5, 0.97)
          .setDisplaySize(portraitH * 1.05, portraitH * 1.05),
      );
      this.portraits.push({ image, baseY: feetY, selected, phase: index * 1.3 });
    }

    // Magnifier, top-right: opens the 3D viewer (turntable, run, attack, victory).
    const lensX = x + w - 22;
    const lensY = y + 22;
    drawPanel(g, lensX, lensY, 30, 30, {
      fill: UI.slate,
      dark: UI.slateDark,
      radius: 15,
      outline: 2,
    });
    g.lineStyle(3, 0xffffff, 0.95)
      .strokeCircle(lensX - 2, lensY - 3, 6.5)
      .lineBetween(lensX + 3, lensY + 2, lensX + 8, lensY + 7);
    this.track(
      this.add
        .zone(lensX, lensY, 34, 34)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => this.openViewer(character)),
    );

    let lineY = feetY + 18;
    this.track(displayText(this, cx, lineY, character.label.toUpperCase(), Math.min(24, w / 7)));
    lineY += 24;
    // Narrow cards (3 per row on a phone): tighter margins and smaller text, or label and stars meet.
    const narrow = w < 140;
    const pad = narrow ? 7 : 14;
    const statPx = narrow ? 10 : 12;
    for (const stat of definingStats(character)) {
      const stars = starsFor(character.relative[stat]);
      this.track(
        bodyText(this, x + pad, lineY, STRINGS.select.stats[stat], statPx, UI.muted).setOrigin(
          0,
          0.5,
        ),
      );
      this.track(
        bodyText(
          this,
          x + w - pad,
          lineY,
          STAR.repeat(stars) + EMPTY_STAR.repeat(5 - stars),
          statPx,
          "#ffc93c",
        ).setOrigin(1, 0.5),
      );
      lineY += 17;
    }
    // The ability: its name on every card, what it does on the selected one.
    lineY += 6;
    this.track(displayText(this, cx, lineY, character.ability.label, 15, "#ffc93c"));
    const text = selected ? character.ability.description : character.tagline;
    const room = y + h - (lineY + 12);
    if (room > 18) {
      this.track(
        bodyText(this, cx, lineY + 12, text, 11, UI.cream)
          .setOrigin(0.5, 0)
          .setWordWrapWidth(w - 22)
          .setAlpha(selected ? 1 : 0.75),
      );
    }
  }

  private openRules(): void {
    if (this.rules) return;
    this.rules = new RulesPanel(this, () => {
      this.rules = null;
    });
  }

  private openViewer(character: CharacterDefinition): void {
    this.viewer?.close();
    this.viewer = new CharacterViewer(this, character, () => {
      this.viewer = null;
    });
  }
}
