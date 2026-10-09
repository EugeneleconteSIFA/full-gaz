import type { CharacterId, UpgradeId } from "../core/types";

export type BotDifficulty = "easy" | "normal" | "hard";

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ["easy", "normal", "hard"];

/** Same logic for every level; only these numbers change. */
export interface BotDifficultySettings {
  readonly label: string;
  /** Seconds between two strategic decisions (target base, upgrades). */
  readonly decisionInterval: number;
  /** Seconds between first seeing an enemy and opening fire. */
  readonly reactionTime: number;
  /** Max aim error either side, degrees. */
  readonly aimErrorDegrees: number;
  /** Aims where a moving target will be, not where it is. */
  readonly leadsTargets: boolean;
  /** Random spread added to base scores, 0..1+: higher = worse target choices. */
  readonly choiceNoise: number;
  /** Fires only when the target is within this fraction of the attack range. */
  readonly fireRangeFraction: number;
  /** Fraction of full stick it walks at (a human rarely holds the stick at 100%). */
  readonly moveIntensity: number;
  /** Stands still this long after its team captures the base it was going for, seconds. */
  readonly pauseAfterCaptureSeconds: number;
  /** Minimum time between two upgrade purchases, seconds. */
  readonly upgradeIntervalSeconds: number;
  /** Uses its special ability (D057). */
  readonly usesAbility: boolean;
}

export const BOT_DIFFICULTY_SETTINGS: Readonly<Record<BotDifficulty, BotDifficultySettings>> = {
  // Tuned down after playtest feedback ("Facile trop dur"): slower, less accurate, hesitant.
  easy: {
    label: "Facile",
    decisionInterval: 0.9,
    reactionTime: 1,
    aimErrorDegrees: 22,
    leadsTargets: false,
    choiceNoise: 1,
    fireRangeFraction: 0.7,
    moveIntensity: 0.8,
    pauseAfterCaptureSeconds: 2,
    upgradeIntervalSeconds: 40,
    usesAbility: false,
  },
  normal: {
    label: "Normal",
    decisionInterval: 0.4,
    reactionTime: 0.35,
    aimErrorDegrees: 6,
    leadsTargets: true,
    choiceNoise: 0.2,
    fireRangeFraction: 0.95,
    moveIntensity: 1,
    pauseAfterCaptureSeconds: 0,
    upgradeIntervalSeconds: 0,
    usesAbility: true,
  },
  hard: {
    label: "Difficile",
    decisionInterval: 0.25,
    reactionTime: 0.15,
    aimErrorDegrees: 2,
    leadsTargets: true,
    choiceNoise: 0,
    fireRangeFraction: 0.95,
    moveIntensity: 1,
    pauseAfterCaptureSeconds: 0,
    upgradeIntervalSeconds: 0,
    usesAbility: true,
  },
};

/** Upgrade buying order per character, playing to each one's strength first. */
export const BOT_UPGRADE_PRIORITIES: Readonly<Record<CharacterId, readonly UpgradeId[]>> = {
  tank: ["hp", "damage", "fireRate", "speed", "range"],
  scout: ["speed", "hp", "damage", "fireRate", "range"],
  shooter: ["range", "damage", "fireRate", "hp", "speed"],
  fighter: ["damage", "hp", "fireRate", "speed", "range"],
  artillery: ["damage", "range", "fireRate", "hp", "speed"],
};

/** Strategy tuning shared by all levels. */
export const BOT_TUNING = {
  /** Seconds between two steering updates (path following). */
  steeringInterval: 0.05,
  /** How far beyond its attack range the bot notices enemies, world units. */
  detectionMargin: 3,
  /** Melee bots step in toward an enemy closer than this, world units. */
  meleeChaseRadius: 6.5,
  /** Ranged bots back away from a melee enemy closer than this, world units. */
  kiteRadius: 3.5,
  /** Below this fraction of max HP, the bot avoids fights. */
  lowHpFraction: 0.3,
  /** While avoiding fights, bases closer than this to an enemy are skipped, world units. */
  avoidEnemyRadius: 8,
  /** Stops moving when this close to the base it is capturing, world units. */
  arrivalRadius: 0.8,
  /** Value of a base: neutral, enemy-owned (flipping swings the score twice), own base under attack. */
  neutralValue: 1,
  enemyValue: 1.4,
  defendValue: 1.6,
  /** Extra value for a base producing the next resource, if the event is soon. */
  nextResourceBonus: 0.4,
  nextResourceWindowSeconds: 25,
  /** Seconds of travel that halve a base's appeal. */
  travelHalfLifeSeconds: 8,
  /** Bonus for the current target, so the bot does not flip-flop between two bases. */
  stickiness: 0.2,
  /** Guard: raised when an enemy is this close, or below this fraction of max HP in a fight. */
  guardEnemyRadius: 4,
  guardHpFraction: 0.7,
  /** Dash: used on the way to a base still farther than the dash distance plus this. */
  dashSpareDistance: 2,
} as const;
