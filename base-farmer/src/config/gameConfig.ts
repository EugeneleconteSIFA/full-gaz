/**
 * Central tuning values. World distances are in world units (wu), never pixels.
 */
export const GAME_CONFIG = {
  simulation: {
    ticksPerSecond: 60,
    /** Caps catch-up work after a stall so the game never spirals. */
    maxStepsPerFrame: 5,
  },
  combat: {
    /** Seconds a dead player stays off the field. */
    respawnDelaySeconds: 5,
  },
  production: {
    /** Each controlled base pays this much of its own resource at every production event. */
    perBase: 1,
    /** Bases of the event's featured ("maxée") resource pay this many times more. */
    featuredMultiplier: 3,
  },
  match: {
    durationSeconds: 420,
    /** Every map must define exactly this many bases. */
    baseCount: 7,
    /**
     * Phases in start order. `productionIntervalSeconds` is used by resource production
     * (Milestone 5); null = no production.
     */
    phases: [
      { id: "opening", startsAtSeconds: 0, productionIntervalSeconds: null },
      // Every minute, then every 30 s in the endgame; every base pays at each event (D055).
      { id: "development", startsAtSeconds: 60, productionIntervalSeconds: 60 },
      { id: "endgame", startsAtSeconds: 300, productionIntervalSeconds: 30 },
    ],
    /** Two teams with capture progress closer than this are tied on the progress tie-breaker. */
    progressTieTolerance: 1e-6,
  },
  capture: {
    /** Capture zone radius around a base, world units. */
    radius: 2.5,
    /** Seconds alone in the zone to turn an enemy base neutral. */
    neutralizeSeconds: 1.5,
    /** Seconds alone in the zone to take a neutral base. */
    captureSeconds: 1.5,
    /** Unfinished progress falls back at this fraction of the capture speed when the zone is empty. */
    decaySpeedFactor: 0.5,
  },
  maps: {
    /** Max distance a base pair is nudged at match start, world units. */
    baseJitter: 1.5,
    /** Nudge attempts before falling back to the unnudged (mirrored) layout. */
    jitterAttempts: 8,
    /** Body radius used to check that every base can be walked to (the largest character). */
    walkerRadius: 0.5,
    /** Grid cell size for that check, world units. */
    reachabilityCellSize: 0.5,
    /** Thinner obstacles could let a projectile skip through in one tick. */
    minObstacleHalfSize: 0.4,
  },
  upgrades: {
    /** Each upgrade level adds this fraction of the character's base stat. */
    bonusPerLevel: 0.15,
  },
  feedback: {
    /** Vibration patterns (ms), touch devices only. */
    vibrateOnHit: [35],
    vibrateOnCapture: [20, 50, 20],
  },
  rendering: {
    /** Pixels per world unit at camera zoom 1. Purely visual. */
    pixelsPerUnit: 32,
    /**
     * Vertical squash of the ground plane (1 = straight top-down). Below 1 the map reads as tilted
     * toward the viewer, brawler style, while gameplay stays a flat top-down simulation.
     */
    /** 0.82 (was 0.72): a steeper, brawler-like camera (~55°); distances on the ground read better. */
    tilt: 0.82,
  },
  /** Light inertia: speed eases toward the stick's target instead of snapping (sense of weight). */
  movement: {
    /** Exponential approach rates, 1/s: ~95% of top speed in 0.12 s, stop in ~0.1 s. */
    accelRate: 25,
    decelRate: 30,
  },
  camera: {
    /** World units visible along the shorter screen side (portrait width / landscape height). */
    /** 11 (was 14): characters dominate the screen, arcade style (art direction v3). */
    visibleUnitsShortSide: 11,
    /** Follow smoothing, 0..1 (1 = locked to the player). */
    followLerp: 0.15,
  },
  input: {
    /** Touch joystick travel radius, in CSS pixels. */
    joystickRadiusPx: 60,
    /** Fraction of the joystick radius ignored as noise. */
    joystickDeadZone: 0.15,
    /** Touch only: aim snaps to an enemy within this angle of the aim stick, degrees. */
    aimAssistConeDegrees: 12,
    /** Touch only: and within this distance beyond the attack range, world units. */
    aimAssistRangeMargin: 1,
  },
} as const;

export const FIXED_STEP_SECONDS = 1 / GAME_CONFIG.simulation.ticksPerSecond;

/** Converts a tuning duration to whole simulation ticks (timers are tick-based for determinism). */
export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * GAME_CONFIG.simulation.ticksPerSecond);
}
