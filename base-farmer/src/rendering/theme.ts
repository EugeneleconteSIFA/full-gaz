import type { BaseOwner, ResourceId } from "../core/types";

export interface BiomeTheme {
  readonly ground: number;
  readonly groundShade: number;
  /** Grass tufts / pebbles. */
  readonly detail: number;
  readonly flower: number;
  /** Hedge, cliff or water around the playable area. */
  readonly border: number;
  readonly rock: number;
  readonly rockShade: number;
  readonly rockOutline: number;
  readonly wall: number;
  readonly wallShade: number;
  /** Moss / stone cap along the top of walls. */
  readonly wallCap: number;
  readonly wallOutline: number;
}

/** Visual-only values. Nothing here affects gameplay. */
export const THEME = {
  background: 0x181c26,
  /**
   * "Diorama Vinyl" art direction (docs/09_ART_DIRECTION_PROMPT.md, D049): muted, mid-value
   * grounds; saturated gameplay elements outlined in a darker shade of their own color.
   */
  ground: {
    borderWidthPx: 10,
  },
  /** One look per map. Maps without an entry use `meadow`. */
  biomes: {
    meadow: {
      ground: 0x89a06c,
      groundShade: 0x758a55,
      detail: 0xa3b385,
      flower: 0xfff3c4,
      border: 0x4f6b35,
      rock: 0xa8acb3,
      rockShade: 0x80858f,
      rockOutline: 0x4d525c,
      wall: 0xb88c5a,
      wallShade: 0x8a643c,
      wallCap: 0x7f9a5a,
      wallOutline: 0x5a3e22,
    },
    canyon: {
      ground: 0xbc8a5f,
      groundShade: 0xaa7b51,
      detail: 0xc8a078,
      flower: 0xf6d7a8,
      border: 0x7a3f22,
      rock: 0xc0654a,
      rockShade: 0x96472f,
      rockOutline: 0x5c2a1a,
      wall: 0x9b7650,
      wallShade: 0x735537,
      wallCap: 0xc9a27a,
      wallOutline: 0x4a3420,
    },
    corners: {
      ground: 0x7c9b7f,
      groundShade: 0x69876d,
      detail: 0x94af95,
      flower: 0xe7f2c8,
      border: 0x2d5b6b,
      rock: 0xb3bdb0,
      rockShade: 0x8a968a,
      rockOutline: 0x46524a,
      wall: 0xa9714f,
      wallShade: 0x7e5136,
      wallCap: 0xc9a77a,
      wallOutline: 0x4b2e1e,
    },
  } satisfies Record<string, BiomeTheme>,
  /** Flat ground details: never outlined, so they never read as obstacles. */
  decor: {
    clearanceUnits: 1.2,
    alpha: 0.75,
  },
  /** Heights of standing obstacles in the tilted view, px (purely visual). */
  obstacles3d: {
    wallHeightPx: 22,
    rockHeightRatio: 0.5,
    hedgeHeightPx: 26,
    boardEdgePx: 22,
  },
  spawnPad: {
    radiusUnits: 2,
    alpha: 0.18,
    ringPx: 4,
    symbolPx: 14,
  },
  /** Ground shadow under every solid thing: light comes from the top left. */
  shadow: { color: 0x10141d, alpha: 0.35, offsetPx: 4 },
  /** Every owner has a color AND a shape, so ownership never relies on color alone. */
  teams: {
    teamA: { primary: 0x2a72e5, dark: 0x163c7b, symbol: "circle" },
    teamB: { primary: 0xe63946, dark: 0x8b1e26, symbol: "diamond" },
    neutral: { primary: 0x9e9e9e, dark: 0x5a5a5a, symbol: "ring" },
  } satisfies Record<
    BaseOwner,
    { primary: number; dark: number; symbol: "circle" | "diamond" | "ring" }
  >,
  /**
   * Resource icon colors. Icons also differ by shape, so color is never the only cue. Metal is
   * copper so it never matches the contested yellow or team A's blue.
   */
  resources: {
    food: 0xff70a6,
    wood: 0xd4a373,
    stone: 0x8d99ae,
    metal: 0xe8833a,
    /** Flour (D059): cream, far from every team / contested / metal colour. */
    power: 0xf2e3c2,
  } satisfies Record<ResourceId, number>,
  /** Dark round badge behind resource icons drawn on the ground (contrast >= 5.9:1 on any biome). */
  resourceBadge: { fill: 0x181c26, stroke: 0xffffff, strokePx: 2 },
  base: {
    /** Resource badge below the building (fraction of zone radius). */
    resourceIconOffset: 0.62,
    /** Capture shockwave across the zone. */
    coreOutline: 0x181c26,
    contested: 0xffb703,
  },
  character: {
    /** Body materials (never team colors): team color is on one clothing piece and the ground ring. */
    skin: 0xf2c9a0,
    /**
     * Characters are drawn bigger than their hitbox, brawler style (chunky and readable); the
     * ground ring keeps showing the real collision footprint.
     */
    figureScale: 1.35,
    pupil: 0x23262f,
    /** Idle breathing: scale amplitude and cycles per second. */
    breathe: 0.035,
    /** Puppet (puppet/PuppetAnimator.ts): attack anticipation+strike+recovery, turn speed,
     * stride length (multiples of r per leg cycle) and leg swing (radians). */
    attackMs: 320,
  },
  healthBar: {
    widthPx: 50,
    heightPx: 8,
    gapPx: 9,
    background: 0x181c26,
    numberFontPx: 12,
  },
  /** Combat feedback (CombatFx). */
  fx: {
    flashMs: 140,
    ringMs: 320,
    sparks: 6,
    sparkMs: 380,
    muzzleMs: 110,
    dustMs: 360,
    damageMs: 700,
    damageFontPx: 18,
  },
  projectile: {},
  upgradeBar: {
    buttonWidthPx: 76,
    buttonHeightPx: 80,
    gapPx: 8,
    edgeMarginPx: 12,
    button: 0x1b1f2a,
    stroke: 0x47506a,
    strokePx: 2,
    /** One color per upgrade (art direction v3: colored arcade buttons, not grey boxes). */
    colors: {
      hp: 0xe0455a,
      speed: 0x3fae4f,
      range: 0x2f7fd8,
      damage: 0xe0702f,
      fireRate: 0x8e5bd6,
    } as Record<string, number>,
    pipFilled: 0xffb703,
    labelFontPx: 13,
    hotkeyFontPx: 11,
    costFontPx: 14,
    costIconSizePx: 7,
    text: "#ffffff",
    muted: "#9aa3b8",
    missing: "#ff8a8a",
  },
  /** Round ability button, bottom-right corner (D057). */
  abilityButton: {
    radiusPx: 40,
    edgeMarginPx: 16,
    fill: 0xffb703,
    cooldownFill: 0x1b1f2a,
    cooldownAlpha: 0.7,
    stroke: 0xffffff,
    activeStroke: 0x7dff8a,
    labelFontPx: 13,
    cooldownFontPx: 24,
    hotkeyFontPx: 11,
    text: "#ffffff",
    muted: "#9aa3b8",
  },
  select: {
    background: 0x181c26,
    card: 0x2b3142,
    cardStroke: 0x47506a,
    /** Standing portrait height on a selection card, px. */
    textColor: "#ffffff",
    mutedColor: "#b8c0d4",
  },
  hud: {
    fontFamily: "Fredoka, system-ui, sans-serif",
    scoreFontPx: 26,
    scoreTopPx: 46,
    timerTopPx: 8,
    timerFontPx: 26,
    timerColor: "#ffffff",
    timerWarningColor: "#ffb703",
    timerCriticalColor: "#e63946",
    /** Seconds left when the timer turns warning / critical, and the big countdown starts. */
    timerWarningSeconds: 30,
    finalCountdownSeconds: 10,
    finalCountdownFontPx: 110,
    /** Below the mini-map (scoreTopPx + minimapMaxHeightPx + gap). */
    walletTopPx: 158,
    walletIconSizePx: 10,
    walletFontPx: 18,
    walletSlotPx: 58,
    /** Below this screen width the wallet and the next production share one line. */
    compactWidthPx: 520,
    compactWalletSlotPx: 46,
    compactWalletFontPx: 16,
    compactNextGapPx: 10,
    nextProductionFontPx: 15,
    productionToastFontPx: 22,
    productionToastMs: 3000,
    gainColor: "#7dff8a",
    noGainColor: "#cccccc",
    bannerYFraction: 0.38,
    bannerTitleFontPx: 40,
    compactBannerTitleFontPx: 26,
    bannerSubtitleFontPx: 18,
    bannerMs: 2200,
    bannerFadeMs: 400,
    pipSizePx: 7,
    /** Mini-map of flags (D056): max size, icon sizes and colors. */
    minimapWidthPx: 210,
    minimapCompactWidthPx: 132,
    minimapMaxHeightPx: 92,
    minimapIconPx: 22,
    minimapDotPx: 4.5,
    minimapGround: 0x3c4a35,
    minimapEdge: 0x9aa3b8,
    minimapObstacle: 0x1f2630,
    panel: 0x1b1f2a,
    respawnText: "#ffffff",
  },
  joystick: {
    base: 0x000000,
    baseAlpha: 0.25,
    stroke: 0xffffff,
    strokeAlpha: 0.5,
    thumb: 0xffffff,
    thumbAlpha: 0.6,
  },
} as const;
