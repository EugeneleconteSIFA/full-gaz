import Phaser from "phaser";
import {
  parseCharacter,
  parseMap,
  parseOpponent,
  parseStartAtSeconds,
} from "./core/debugParams";
import {
  buildLocalMatchSetup,
  LOCAL_PLAYER_ID,
  OPPONENT_PLAYER_ID,
  type MapChoice,
  type OpponentChoice,
} from "./core/localMatch";
import { parseSeed, randomSeed } from "./core/seed";
import { createMatchState } from "./core/Simulation";
import type { CharacterId } from "./core/types";
import { BOT_DIFFICULTIES, type BotDifficulty } from "./data/bots";
import { CHARACTERS } from "./data/characters";
import { MAPS } from "./data/maps";
import { GAME_DATA } from "./data/gameData";
import { assertValidGameData } from "./data/validateGameData";
import { createTouchState } from "./input/TouchInput";
import { createUiInputState } from "./input/UiInputState";
import { THEME } from "./rendering/theme";
import { DPR } from "./rendering/viewport";
import { prepareResourceIcons } from "./rendering/ui/resourceIcons";
import type { MatchContext } from "./scenes/MatchContext";
import { MatchScene } from "./scenes/MatchScene";
import { SCENE_KEYS } from "./scenes/sceneKeys";
import { SelectScene, type SelectSceneData } from "./scenes/SelectScene";
import { UiScene } from "./scenes/UiScene";

assertValidGameData(GAME_DATA);

/** Read once: debug params are cleared on rematch, but the canvas setup cannot change. */

const LAST_CHARACTER_KEY = "baseFarmer.lastCharacter";
const LAST_MAP_KEY = "baseFarmer.lastMap";
const LAST_DIFFICULTY_KEY = "baseFarmer.lastDifficulty";
const characterIds = CHARACTERS.map((c) => c.id);
const mapIds = MAPS.map((m) => m.id);

/** Per-browser convenience only: storage may be unavailable, so failures fall back silently. */
function loadSaved<T extends string>(
  key: string,
  valid: (value: string) => value is T,
  fallback: T,
): T {
  try {
    const saved = window.localStorage.getItem(key);
    if (saved && valid(saved)) return saved;
  } catch {
    // Private mode or blocked storage: use the default.
  }
  return fallback;
}

function save(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not critical: the selection screen just won't remember.
  }
}

const isCharacter = (v: string): v is CharacterId => characterIds.includes(v);
const isMapChoice = (v: string): v is MapChoice => v === "random" || mapIds.includes(v);
const isDifficulty = (v: string): v is BotDifficulty =>
  (BOT_DIFFICULTIES as readonly string[]).includes(v);
const isOpponent = (v: string): v is OpponentChoice => v === "dummy" || isDifficulty(v);

/** Max wait for the UI font; offline or slow networks fall back to the system font. */
const FONT_TIMEOUT_MS = 1500;

/** The HTML loading screen (index.html): progress 0..1 and the current step. */
function loading(progress: number, step: string): void {
  const fill = document.querySelector<HTMLElement>("#loader .fill");
  const text = document.querySelector<HTMLElement>("#loader p");
  if (fill) fill.style.width = `${Math.round(8 + progress * 92)}%`;
  if (text) text.textContent = step;
}

function loaded(): void {
  const loader = document.getElementById("loader");
  if (!loader) return;
  loading(1, "C'est parti !");
  loader.classList.add("done");
  window.setTimeout(() => loader.remove(), 400);
}

loading(0.15, "Polices…");
// Phaser rasterizes text once: the font must be ready before the first scene draws.
await Promise.race([
  Promise.all([
    document.fonts.load("700 20px Fredoka"),
    document.fonts.load("500 20px Fredoka"),
    document.fonts.load("20px 'Lilita One'"),
  ]).catch(() => undefined),
  new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS)),
]);

// Resource icons are 3D renders (docs/13), needed by the first HUD: render them before any
// scene. On failure the HUD falls back to the flat 2D icons.
loading(0.45, "Icônes…");
await prepareResourceIcons().catch((error: unknown) => {
  console.warn("[icons] 3D resource icons unavailable, using the flat ones", error);
});

// The canvas is sized in device pixels and shown at 1/DPR, so it is sharp on Retina screens and
// phones (Phaser's RESIZE mode would render at CSS resolution and let the browser upscale it).
const parent = document.getElementById("game");
if (!parent) throw new Error("Missing #game element");
/**
 * Never 0: a page loaded hidden (background tab, collapsed pane) reports 0x0, and a 0-sized
 * canvas makes WebGL fail to boot. The resize listener fixes the size once the page shows.
 */
const MIN_CSS_PX = 320;
const cssSize = () => ({
  width: Math.max(MIN_CSS_PX, parent.clientWidth || window.innerWidth),
  height: Math.max(MIN_CSS_PX, parent.clientHeight || window.innerHeight),
});
const initial = cssSize();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  backgroundColor: THEME.background,
  scale: {
    mode: Phaser.Scale.NONE,
    width: Math.round(initial.width * DPR),
    height: Math.round(initial.height * DPR),
    zoom: 1 / DPR,
  },
  input: { activePointers: 3 },
  // 3D renderer (D058): the three.js world shows through the Phaser canvas, which keeps the HUD.
  transparent: true,
});
window.addEventListener("resize", () => {
  const { width, height } = cssSize();
  game.scale.resize(Math.round(width * DPR), Math.round(height * DPR));
  game.scale.setZoom(1 / DPR);
});

let lastCharacter: CharacterId = loadSaved(LAST_CHARACTER_KEY, isCharacter, "fighter");
let lastMap: MapChoice = loadSaved(LAST_MAP_KEY, isMapChoice, "random");
let lastDifficulty: BotDifficulty = loadSaved(LAST_DIFFICULTY_KEY, isDifficulty, "normal");
/** Dev only: `?opponent=dummy` swaps the bot for the passive training dummy, for the whole session. */
let opponentOverride: OpponentChoice | null = null;

function startMatch(
  characterId: CharacterId,
  mapChoice: MapChoice,
  difficulty: BotDifficulty,
  seed: number,
  startAtSeconds = 0,
): void {
  lastCharacter = characterId;
  lastMap = mapChoice;
  lastDifficulty = difficulty;
  save(LAST_CHARACTER_KEY, characterId);
  save(LAST_MAP_KEY, mapChoice);
  save(LAST_DIFFICULTY_KEY, difficulty);
  const opponent: OpponentChoice = opponentOverride ?? difficulty;

  const state = createMatchState(
    buildLocalMatchSetup(seed, characterId, mapChoice, startAtSeconds),
  );
  console.info(
    `[match] seed=${seed} character=${characterId} map=${state.mapId} opponent=${opponent} (replay with ?seed=${seed}&map=${mapChoice})`,
  );

  const context: MatchContext = {
    localPlayerId: LOCAL_PLAYER_ID,
    bots: opponent === "dummy" ? [] : [{ playerId: OPPONENT_PLAYER_ID, difficulty: opponent }],
    touch: createTouchState(),
    uiInput: createUiInputState(),
    state,
    rematch: () => {
      clearDebugParams();
      // Same character and same map choice; "Aléatoire" draws a new map.
      startMatch(lastCharacter, lastMap, lastDifficulty, randomSeed());
    },
    changeCharacter: () => {
      clearDebugParams();
      showSelection();
    },
  };
  game.scene.stop(SCENE_KEYS.select);
  game.scene.start(SCENE_KEYS.match, context);
  game.scene.start(SCENE_KEYS.ui, context);
}

function showSelection(): void {
  game.scene.stop(SCENE_KEYS.match);
  game.scene.stop(SCENE_KEYS.ui);
  const data: SelectSceneData = {
    selected: lastCharacter,
    selectedMap: lastMap,
    selectedDifficulty: lastDifficulty,
    onPick: (characterId, mapChoice, difficulty) =>
      startMatch(characterId, mapChoice, difficulty, randomSeed()),
  };
  game.scene.start(SCENE_KEYS.select, data);
}

/** Debug URL params apply to the first match only. */
function clearDebugParams(): void {
  window.history.replaceState(null, "", window.location.pathname);
}

// Render order: selection, then match, then the UI above the match.
game.scene.add(SCENE_KEYS.select, SelectScene, false);
game.scene.add(SCENE_KEYS.match, MatchScene, false);
game.scene.add(SCENE_KEYS.ui, UiScene, false);

const search = window.location.search;
const debug = import.meta.env.DEV;
const debugCharacter = debug ? parseCharacter(search, characterIds) : null;
const debugMap = debug ? parseMap(search, mapIds) : null;
if (debugMap && isMapChoice(debugMap)) lastMap = debugMap;
const debugOpponent = debug ? parseOpponent(search, ["dummy", ...BOT_DIFFICULTIES]) : null;
if (debugOpponent && isOpponent(debugOpponent)) {
  if (debugOpponent === "dummy") opponentOverride = "dummy";
  else lastDifficulty = debugOpponent;
}
const firstSeed = parseSeed(search, randomSeed);
const firstStart = debug ? parseStartAtSeconds(search) : 0;
if (debugCharacter && isCharacter(debugCharacter)) {
  startMatch(debugCharacter, lastMap, lastDifficulty, firstSeed, firstStart);
} else {
  const data: SelectSceneData = {
    selected: lastCharacter,
    selectedMap: lastMap,
    selectedDifficulty: lastDifficulty,
    // ?seed / ?skip still apply to the first match picked from the selection screen.
    onPick: (characterId, mapChoice, difficulty) =>
      startMatch(characterId, mapChoice, difficulty, firstSeed, firstStart),
  };
  game.scene.start(SCENE_KEYS.select, data);
}

if (import.meta.env.DEV) {
  // Debug handle for the browser console. Never read by game code.
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

// The first screen is up: the HTML loading screen fades out (the selection screen then loads
// the 3D models in the background, preloadMatchAssets).
loading(0.85, "Préparation…");
game.events.once(Phaser.Core.Events.POST_RENDER, loaded);
