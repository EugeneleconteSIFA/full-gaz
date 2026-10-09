import type Phaser from "phaser";
import { GAME_CONFIG } from "../config/gameConfig";
import type { MapId, TeamId } from "../core/types";
import type { Obstacle } from "../world/geometry";
import type { MapLayout } from "../world/MapLayout";
import { bakeGraphics, freezeGraphics } from "./cachedGraphics";
import { blob, mix } from "./artKit";
import { BAKE_SCALE } from "./bake";
import { bakeCanvas, css, pathOf, shadeVolume } from "./canvasBake";
import { createGroundLayer } from "./groundLayer";
import { paintGround, type Yard } from "./groundArt";
import { ensurePropTextures, PROP_FEET } from "./propArt";
import { depthAt, LAYER, screenX, screenY, TILT } from "./projection";
import { THEME, type BiomeTheme } from "./theme";
import { toPixels } from "./units";

/** Fixed seed: decor is purely visual and identical from one match to the next. */
const DECOR_SEED = 0x5eed;

export function biomeFor(mapId: MapId): BiomeTheme {
  const biomes: Record<string, BiomeTheme | undefined> = THEME.biomes;
  return biomes[mapId] ?? THEME.biomes.meadow;
}

/**
 * Draws the static map once, in the tilted view (D050):
 * - flat on the ground (a layer squashed by the tilt): biome ground, border band, decor, spawn
 *   pads and obstacle shadows;
 * - standing, depth-sorted: rocks as boulders and walls as blocks with a top face and a front
 *   face, plus a hedge along the back edge.
 * The footprint of every obstacle on the ground is exactly its collision shape.
 */
/**
 * The painted ground alone, as a canvas (top-down, `scale` texture pixels per world pixel): the
 * 3D renderer lays it on its ground plane (D058), with the same yards and decor as the 2D view.
 */
export function paintGroundCanvas(
  scene: Phaser.Scene,
  map: MapLayout,
  mapId: MapId,
  yards: readonly Yard[] = [],
): HTMLCanvasElement {
  const ground = paintGround(
    scene,
    mapId,
    biomeFor(mapId),
    map.width,
    map.height,
    (x, y) => isClear(map, x, y, THEME.decor.clearanceUnits * 0.5),
    DECOR_SEED,
    "ground_painted_3d",
    yards,
    GAME_CONFIG.capture.radius,
  );
  return scene.textures.get(ground.key).getSourceImage() as HTMLCanvasElement;
}

export function renderMap(
  scene: Phaser.Scene,
  map: MapLayout,
  mapId: MapId,
  yards: readonly Yard[] = [],
): void {
  const biome = biomeFor(mapId);
  const width = toPixels(map.width);
  const height = toPixels(map.height);
  const flat = createGroundLayer(scene, LAYER.ground);

  // Painted ground (Canvas 2D, once per match): variation, slabs, tufts, flowers, edge shadow.
  const ground = paintGround(
    scene,
    mapId,
    biome,
    map.width,
    map.height,
    (x, y) => isClear(map, x, y, THEME.decor.clearanceUnits * 0.5),
    DECOR_SEED,
    undefined,
    yards,
    GAME_CONFIG.capture.radius,
  );
  flat.add(
    scene.add
      .image(0, 0, ground.key)
      .setOrigin(0, 0)
      .setScale(1 / ground.scale),
  );

  // Border band around the playable area (hedge / cliff / water), drawn outside it.
  const border = THEME.ground.borderWidthPx;
  const frame = scene.make.graphics({}, false);
  frame.fillStyle(biome.border).fillRect(-border, -border, width + border * 2, border);
  frame.fillRect(-border, height, width + border * 2, border);
  frame.fillRect(-border, 0, border, height);
  frame.fillRect(width, 0, border, height);
  flat.add(bakeGraphics(scene, frame, -border, -border, width + border * 2, height + border * 2));

  // Decor, spawn pads and shadows never change: baked once into a texture (Graphics would be
  // re-tessellated every frame, ~4 ms on Quatre-Coins).
  flat.add(
    freezeGraphics(
      scene,
      (g) => {
        for (const team of ["teamA", "teamB"] as const) drawSpawnPad(g, map, team);
        for (const o of map.obstacles) drawObstacleShadow(g, o);
      },
      0,
      0,
      width,
      height,
    ),
  );

  drawBackHedge(scene, width, biome);
  drawBoardEdge(scene, width, height, biome);
  for (const o of map.obstacles) {
    if (o.look === "barrel" || o.look === "crate") drawProp(scene, o);
    else if (o.look === "fence") drawFence(scene, o as Extract<Obstacle, { kind: "rect" }>);
    else if (o.kind === "circle") drawRock(scene, o, biome);
    else drawWall(scene, o, biome);
  }
}

/** The board's front edge below the map: gives the whole map a thickness, like a diorama. */
function drawBoardEdge(
  scene: Phaser.Scene,
  widthPx: number,
  heightPx: number,
  biome: BiomeTheme,
): void {
  const border = THEME.ground.borderWidthPx;
  const y = heightPx * TILT + border * TILT;
  const h = THEME.obstacles3d.boardEdgePx;
  const g = scene.make.graphics({}, false);
  g.fillStyle(darker(biome.border, 0.7)).fillRect(-border, y, widthPx + border * 2, h);
  g.fillStyle(darker(biome.border, 0.5)).fillRect(
    -border,
    y + h * 0.6,
    widthPx + border * 2,
    h * 0.4,
  );
  bakeGraphics(scene, g, -border, y, widthPx + border * 2, h).setDepth(LAYER.ground + 1);
}

/** A hedge standing along the back (top) edge: the map reads as a raised board. */
function drawBackHedge(scene: Phaser.Scene, widthPx: number, biome: BiomeTheme): void {
  const h = THEME.obstacles3d.hedgeHeightPx;
  const border = THEME.ground.borderWidthPx;
  const g = scene.make.graphics({}, false);
  g.fillStyle(darker(biome.border, 0.8)).fillRect(-border, -h, widthPx + border * 2, h);
  g.fillStyle(biome.border);
  for (let x = -border; x < widthPx + border; x += 14) g.fillCircle(x + 7, -h, 9);
  bakeGraphics(scene, g, -border, -h - 9, widthPx + border * 2, h + 11, 6).setDepth(depthAt(0) - 1);
}

function isClear(map: MapLayout, x: number, y: number, clearance: number): boolean {
  const zone = GAME_CONFIG.capture.radius + clearance;
  for (const base of map.bases) {
    if (Math.hypot(base.position.x - x, base.position.y - y) < zone) return false;
  }
  for (const spawn of Object.values(map.spawns)) {
    if (Math.hypot(spawn.x - x, spawn.y - y) < THEME.spawnPad.radiusUnits + clearance) return false;
  }
  for (const o of map.obstacles) {
    if (o.kind === "circle") {
      if (Math.hypot(o.center.x - x, o.center.y - y) < o.radius + clearance) return false;
    } else if (
      Math.abs(o.center.x - x) < o.halfWidth + clearance &&
      Math.abs(o.center.y - y) < o.halfHeight + clearance
    ) {
      return false;
    }
  }
  return true;
}

function drawSpawnPad(g: Phaser.GameObjects.Graphics, map: MapLayout, team: TeamId): void {
  const style = THEME.spawnPad;
  const colors = THEME.teams[team];
  const x = toPixels(map.spawns[team].x);
  const y = toPixels(map.spawns[team].y);
  const r = toPixels(style.radiusUnits);
  g.fillStyle(colors.primary, style.alpha).fillCircle(x, y, r);
  g.lineStyle(style.ringPx, colors.primary, 0.8).strokeCircle(x, y, r);
  g.lineStyle(2, colors.primary, 0.5).strokeCircle(x, y, r * 0.7);
  const s = style.symbolPx;
  g.fillStyle(colors.dark, 0.6);
  if (colors.symbol === "circle") g.fillCircle(x, y, s);
  else {
    g.fillPoints(
      [
        { x, y: y - s * 1.25 },
        { x: x + s * 1.25, y },
        { x, y: y + s * 1.25 },
        { x: x - s * 1.25, y },
      ],
      true,
    );
  }
}

/**
 * Long cast shadow (light from the top left): the footprint swept toward the bottom right by the
 * obstacle's height, drawn flat (the ground layer applies the tilt). One strong, simple shape
 * per obstacle: it anchors the volume and reads as "solid" at a glance.
 */
function drawObstacleShadow(g: Phaser.GameObjects.Graphics, o: Obstacle): void {
  const { color } = THEME.shadow;
  const heightPx =
    o.look === "fence"
      ? 20
      : o.look === "barrel" || o.look === "crate"
        ? 22
        : o.kind === "circle"
          ? toPixels(o.radius) * 1.3
          : THEME.obstacles3d.wallHeightPx + 4;
  // Screen shift (0.6h, 0.4h); the flat layer is squashed by TILT on y.
  const dx = heightPx * 0.6;
  const dy = (heightPx * 0.4) / TILT;
  const x = toPixels(o.center.x);
  const y = toPixels(o.center.y);
  const rock = o.kind === "circle" && !o.look;
  // Rocks have no contour: a longer, darker cast shadow is what separates them from the ground.
  g.fillStyle(color, o.look === "fence" ? 0.22 : rock ? 0.55 : 0.3);
  if (o.kind === "circle") {
    const r = toPixels(o.radius);
    const a = Math.atan2(dy, dx);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = a + Math.PI / 2 + (i / 12) * Math.PI;
      pts.push({ x: x + Math.cos(t) * r, y: y + Math.sin(t) * r });
    }
    for (let i = 0; i <= 12; i++) {
      const t = a - Math.PI / 2 + (i / 12) * Math.PI;
      pts.push({ x: x + dx + Math.cos(t) * r, y: y + dy + Math.sin(t) * r });
    }
    g.fillPoints(pts, true);
    if (rock) {
      // Contact occlusion: a dark rim where the boulder meets the ground.
      const r2 = toPixels(o.radius);
      g.fillStyle(color, 0.45).fillEllipse(x + r2 * 0.12, y + r2 * 0.15, r2 * 2.2, r2 * 2.15);
    }
  } else {
    // A fence is only posts and rails: its shadow is a thin band, not a block.
    const hw = o.look === "fence" && o.halfWidth < o.halfHeight ? 0.12 : o.halfWidth;
    const hh = o.look === "fence" && o.halfHeight <= o.halfWidth ? 0.12 : o.halfHeight;
    const x0 = toPixels(o.center.x - hw);
    const x1 = toPixels(o.center.x + hw);
    const y0 = toPixels(o.center.y - hh);
    const y1 = toPixels(o.center.y + hh);
    g.fillPoints(
      [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1 + dx, y: y0 + dy },
        { x: x1 + dx, y: y1 + dy },
        { x: x0 + dx, y: y1 + dy },
        { x: x0, y: y1 },
      ],
      true,
    );
  }
}

/** Barrel (circle) or crate (rect) from propArt, sized from the collision shape. */
function drawProp(scene: Phaser.Scene, o: Obstacle): void {
  // propArt draws a barrel 0.72 x size wide and a crate 0.8 x size wide.
  const widthPx = o.kind === "circle" ? toPixels(o.radius * 2) : toPixels(o.halfWidth * 2);
  const size = widthPx / (o.look === "barrel" ? 0.72 : 0.8);
  ensurePropTextures(scene, PROP_SIZE_PX);
  const front = o.kind === "circle" ? o.radius * 0.6 : o.halfHeight;
  scene.add
    .image(
      screenX(o.center.x),
      screenY(o.center.y + front),
      o.look === "barrel" ? "prop_barrel" : "prop_crate",
    )
    .setOrigin(0.5, PROP_FEET)
    .setScale(size / PROP_SIZE_PX / BAKE_SCALE)
    .setDepth(depthAt(o.center.y + front));
}

const PROP_SIZE_PX = 40;
const FENCE_HEIGHT_PX = 24;
const FENCE_WOOD = { light: 0xe0a86a, mid: 0xb07a43, dark: 0x6e4224, outline: 0x4a2c17 };

/**
 * Wooden fence along a thin rect: one image across (posts + two rails), or, when it runs up the
 * screen, one slice per world unit (post + rails seen edge-on), each depth-sorted like walls.
 */
function drawFence(scene: Phaser.Scene, o: Extract<Obstacle, { kind: "rect" }>): void {
  const unit = toPixels(1);
  const fh = FENCE_HEIGHT_PX;
  if (o.halfWidth >= o.halfHeight) {
    const w = toPixels(o.halfWidth * 2);
    const posts = Math.max(2, Math.round(w / (unit * 0.9)) + 1);
    const key = bakeCanvas(scene, `fence_h_${Math.round(w)}`, w + 8, fh + 8, (ctx) => {
      ctx.translate(-w / 2, fh / 2);
      for (const railY of [-fh * 0.72, -fh * 0.38]) fencePlank(ctx, 0, railY, w, 5, true);
      for (let i = 0; i < posts; i++) fencePost(ctx, 3.5 + ((w - 7) * i) / (posts - 1), fh);
    });
    scene.add
      .image(screenX(o.center.x), screenY(o.center.y) - fh / 2, key)
      .setScale(1 / BAKE_SCALE)
      .setDepth(depthAt(o.center.y + o.halfHeight));
    return;
  }
  const top = o.center.y - o.halfHeight;
  const slices = Math.max(1, Math.round(o.halfHeight * 2));
  const step = (o.halfHeight * 2) / slices;
  const span = toPixels(step) * TILT;
  const key = bakeCanvas(scene, `fence_v_${Math.round(span)}`, 20, span + fh + 8, (ctx) => {
    ctx.translate(0, (span + fh) / 2);
    // Rails seen edge-on, running back to the previous post, then this post in front.
    fencePlank(ctx, -6, -span - fh * 0.78, 5, span + fh * 0.5, false);
    fencePlank(ctx, 1, -span - fh * 0.45, 5, span + fh * 0.2, false);
    fencePost(ctx, 0, fh, 10);
  });
  for (let i = 0; i <= slices; i++) {
    const y = top + i * step;
    scene.add
      .image(screenX(o.center.x), screenY(y) - (span + fh) / 2, key)
      .setScale(1 / BAKE_SCALE)
      .setDepth(depthAt(y));
  }
}

/** A post standing on (x, 0), pointed top, lit from the left. */
function fencePost(ctx: CanvasRenderingContext2D, x: number, fh: number, pw = 7): void {
  ctx.beginPath();
  ctx.moveTo(x - pw / 2, 0);
  ctx.lineTo(x - pw / 2, -fh + 3);
  ctx.lineTo(x, -fh);
  ctx.lineTo(x + pw / 2, -fh + 3);
  ctx.lineTo(x + pw / 2, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
  g.addColorStop(0, css(FENCE_WOOD.light));
  g.addColorStop(0.5, css(FENCE_WOOD.mid));
  g.addColorStop(1, css(FENCE_WOOD.dark));
  ctx.fillStyle = g;
  ctx.fill();
}

/** A plank (rail): horizontal = lit on top; vertical (edge-on) = lit on the left. */
function fencePlank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  horizontal: boolean,
): void {
  const g = horizontal
    ? ctx.createLinearGradient(0, y, 0, y + h)
    : ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, css(FENCE_WOOD.light));
  g.addColorStop(1, css(FENCE_WOOD.mid));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 1.5);
  ctx.fill();
}

/**
 * Standing boulder: its bottom edge sits on the footprint ellipse (the collision circle seen
 * tilted), its dome rises by heightRatio x radius. Light from the top left.
 */
function drawRock(
  scene: Phaser.Scene,
  o: Extract<Obstacle, { kind: "circle" }>,
  biome: BiomeTheme,
): void {
  const x = screenX(o.center.x);
  const y = screenY(o.center.y);
  const r = toPixels(o.radius);
  const ry = r * TILT;
  const lift = r * THEME.obstacles3d.rockHeightRatio;
  const cy = y - lift / 2;
  const halfH = ry + lift / 2;
  const pad = 6;
  // One texture per rock size and biome; Canvas 2D for a smooth lit volume (game-art skill).
  const key = bakeCanvas(
    scene,
    `rock_${biome.rock.toString(16)}_${Math.round(r)}`,
    r * 2 + pad * 2,
    halfH * 2 + pad * 2,
    (ctx) => drawBoulder(ctx, r, halfH, biome),
  );
  scene.add
    .image(x, cy, key)
    .setScale(1 / BAKE_SCALE)
    .setDepth(depthAt(o.center.y + o.radius * 0.5));
}

/** Lumpy boulder centered on (0, 0): flat-ish bottom on the footprint, bumpy dome, facets. */
function drawBoulder(
  ctx: CanvasRenderingContext2D,
  r: number,
  halfH: number,
  biome: BiomeTheme,
): void {
  const pts = blob([
    [-r * 0.98, halfH * 0.25],
    [-r * 0.9, -halfH * 0.35],
    [-r * 0.55, -halfH * 0.85],
    [-r * 0.05, -halfH * 0.98],
    [r * 0.45, -halfH * 0.88],
    [r * 0.85, -halfH * 0.45],
    [r * 0.98, halfH * 0.2],
    [r * 0.7, halfH * 0.85],
    [0, halfH * 0.98],
    [-r * 0.7, halfH * 0.85],
  ]);
  shadeVolume(ctx, pts, -r * 0.05, -halfH * 0.1, Math.max(r, halfH), {
    light: mix(biome.rock, 0xffffff, 0.3),
    mid: biome.rock,
    dark: mix(biome.rockShade, 0x2a3350, 0.25),
    outline: biome.rockOutline,
    outlinePx: 0,
    rim: 0.25,
    gloss: 0.12,
  });
  // Facet lines and a crack: read as hard stone, drawn in the shade color.
  ctx.lineCap = "round";
  ctx.strokeStyle = css(biome.rockShade, 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -halfH * 0.75);
  ctx.quadraticCurveTo(-r * 0.15, -halfH * 0.2, r * 0.05, halfH * 0.1);
  ctx.moveTo(r * 0.3, -halfH * 0.1);
  ctx.lineTo(r * 0.5, halfH * 0.25);
  ctx.lineTo(r * 0.42, halfH * 0.55);
  ctx.stroke();
  // Lit edge along the facet (light from the top left).
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, -halfH * 0.72);
  ctx.quadraticCurveTo(-r * 0.2, -halfH * 0.2, 0, halfH * 0.08);
  ctx.stroke();
  // Moss cap on green (grassy) biomes, grit specks everywhere.
  if (((biome.ground >> 8) & 0xff) > ((biome.ground >> 16) & 0xff)) {
    ctx.save();
    pathOf(ctx, pts);
    ctx.clip();
    ctx.fillStyle = css(biome.wallCap, 0.85);
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -halfH * 0.95, r * 0.55, halfH * 0.28, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = css(biome.rockShade, 0.5);
  for (const [fx, fy] of [
    [-0.6, 0.2],
    [0.2, 0.5],
    [0.6, -0.3],
    [-0.2, 0.7],
    [0.75, 0.4],
  ] as const) {
    ctx.beginPath();
    ctx.arc(fx * r, fy * halfH, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Standing wall block: a top face (the footprint lifted by the wall height) and, facing the
 * viewer, a front face of blocks. Walls longer than one world unit along y are split into
 * one-unit slices, each depth-sorted on its own, so characters walking beside them overlap
 * correctly.
 */
function drawWall(
  scene: Phaser.Scene,
  o: Extract<Obstacle, { kind: "rect" }>,
  biome: BiomeTheme,
): void {
  const h = THEME.obstacles3d.wallHeightPx;
  const left = screenX(o.center.x - o.halfWidth);
  const right = screenX(o.center.x + o.halfWidth);
  const top = o.center.y - o.halfHeight;
  const bottom = o.center.y + o.halfHeight;
  const slices = Math.max(1, Math.ceil(bottom - top));
  const sliceUnits = (bottom - top) / slices;
  const unit = toPixels(1);

  for (let i = 0; i < slices; i++) {
    const y0 = top + i * sliceUnits;
    const y1 = y0 + sliceUnits;
    const last = i === slices - 1;
    const faceTop = screenY(y0) - h;
    const faceBottom = screenY(y1) - h;
    const bottomPx = last ? screenY(y1) : faceBottom;
    const w = right - left;
    const capH = faceBottom - faceTop;
    const pad = 3;
    // Slices of the same size share one Canvas texture (smooth stone, game-art skill).
    const key = bakeCanvas(
      scene,
      `wall_${biome.wall.toString(16)}_${Math.round(w)}_${Math.round(capH)}_${i === 0 ? 1 : 0}${last ? 1 : 0}`,
      w + pad * 2,
      bottomPx - faceTop + pad * 2,
      (ctx) => {
        ctx.translate(-w / 2, -(bottomPx - faceTop) / 2);
        drawWallSlice(ctx, w, capH, last ? h : 0, i === 0, biome, unit);
      },
    );
    scene.add
      .image(left + w / 2, faceTop + (bottomPx - faceTop) / 2, key)
      .setScale(1 / BAKE_SCALE)
      .setDepth(depthAt(y1));
  }
}

/**
 * One wall slice in local pixels, (0, 0) at its top-left: the cap (top face) and, for the front
 * slice, the front face of cut stones. Light from the top left.
 */
function drawWallSlice(
  ctx: CanvasRenderingContext2D,
  w: number,
  capH: number,
  frontH: number,
  first: boolean,
  biome: BiomeTheme,
  unit: number,
): void {
  // Cap: grassy/sandy top, lighter toward the light, with a lit front lip.
  const cap = ctx.createLinearGradient(0, 0, w, capH);
  cap.addColorStop(0, css(mix(biome.wallCap, 0xffffff, 0.2)));
  cap.addColorStop(1, css(biome.wallCap));
  ctx.fillStyle = cap;
  ctx.fillRect(0, 0, w, capH);
  // Capstones: one per world unit across, each a slightly different shade, bevelled.
  for (let x = 0, n = 0; x < w - 2; x += unit, n++) {
    const x1 = Math.min(w, x + unit);
    const shade = 0.06 * (((n * 7 + Math.round(w)) % 5) - 2);
    ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(16,20,29,${-shade})`;
    ctx.fillRect(x + 2, 2, x1 - x - 4, capH - 4);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + 2, 2, x1 - x - 4, 1.5);
    ctx.fillRect(x + 2, 2, 1.5, capH - 4);
    ctx.fillStyle = "rgba(16,20,29,0.18)";
    ctx.fillRect(x1 - 3.5, 2, 1.5, capH - 4);
  }
  if (first) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(0, 0, w, 3);
  } else {
    ctx.fillStyle = css(darker(biome.wallCap, 0.8), 0.6);
    ctx.fillRect(0, 0, w, 1.5);
  }
  if (frontH > 0) {
    const top = capH;
    ctx.fillStyle = css(biome.wallOutline);
    ctx.fillRect(0, top, w, frontH);
    // Two rows of cut stones, staggered, each one a little lit volume.
    const rows = 2;
    const rowH = frontH / rows;
    for (let row = 0; row < rows; row++) {
      const offset = row % 2 ? unit * 0.5 : 0;
      for (let x = -offset; x < w; x += unit) {
        const x0 = Math.max(0, x) + 1;
        const x1 = Math.min(w, x + unit) - 1;
        if (x1 - x0 < 3) continue;
        const y0 = top + row * rowH + 1;
        const y1 = top + (row + 1) * rowH - 1;
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, css(mix(biome.wall, 0xffffff, 0.18)));
        g.addColorStop(0.6, css(biome.wall));
        g.addColorStop(1, css(biome.wallShade));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 2.5);
        ctx.fill();
      }
    }
    // Lip shadow under the cap and ambient occlusion at the foot.
    const lip = ctx.createLinearGradient(0, top, 0, top + frontH * 0.35);
    lip.addColorStop(0, "rgba(16,20,29,0.35)");
    lip.addColorStop(1, "rgba(16,20,29,0)");
    ctx.fillStyle = lip;
    ctx.fillRect(0, top, w, frontH * 0.35);
    const foot = ctx.createLinearGradient(0, top + frontH * 0.6, 0, top + frontH);
    foot.addColorStop(0, "rgba(16,20,29,0)");
    foot.addColorStop(1, "rgba(16,20,29,0.3)");
    ctx.fillStyle = foot;
    ctx.fillRect(0, top + frontH * 0.6, w, frontH * 0.4);
  }
  // No contour (2.5D): the cap and the front face separate by light, and the slice edges by a
  // soft darkening of the right side (the side away from the light).
  const edge = ctx.createLinearGradient(w - 5, 0, w, 0);
  edge.addColorStop(0, "rgba(30,20,60,0)");
  edge.addColorStop(1, "rgba(30,20,60,0.3)");
  ctx.fillStyle = edge;
  ctx.fillRect(w - 5, 0, 5, capH + frontH);
}

/** Same hue, about 40% darker: the outline rule of the art direction. */
export function darker(color: number, factor = 0.6): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
