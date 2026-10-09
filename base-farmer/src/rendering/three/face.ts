/**
 * Facial expression model (research: AnimSchool "eye mask", Bloop blinks/darts, FACS/ARKit
 * decomposition, Osipa's two-axis mouth). Every control is normalised; the rig maps it to bones.
 *
 * Upper face: browIn/browOut (+ up), squeeze (inner ends together, the "angry knot"), lidUp
 * (0 = just touching the iris, - = wide, + = closing), lidLow (cheek push / squint, 0..1),
 * pupil (scale). Lower face: jaw (0..1), corners per side (+ up), width (+ wide, - "O"),
 * sneer per side (upper lip lifts off the canines), nose (wrinkle).
 */
export interface Expression {
  browIn: number;
  browOut: number;
  squeeze: number;
  lidUp: number;
  lidLow: number;
  pupil: number;
  jaw: number;
  cornerL: number;
  cornerR: number;
  width: number;
  sneerL: number;
  sneerR: number;
  nose: number;
}

/** Presets (values from the expression research, tuned for a chibi bulldog). */
export const EXPRESSIONS = {
  teigneux: {
    browIn: -0.8,
    browOut: 0.2,
    squeeze: 0.7,
    lidUp: 0.35,
    lidLow: 0.3,
    pupil: 0.9,
    jaw: 0.05,
    cornerL: 0.4,
    cornerR: -0.1,
    width: 0.1,
    sneerL: 0.3,
    sneerR: 0,
    nose: 0.3,
  },
  neutre: {
    browIn: 0,
    browOut: 0,
    squeeze: 0.1,
    lidUp: 0.1,
    lidLow: 0.05,
    pupil: 1,
    jaw: 0,
    cornerL: 0,
    cornerR: -0.05,
    width: 0,
    sneerL: 0,
    sneerR: 0,
    nose: 0,
  },
  joyeux: {
    browIn: 0.3,
    browOut: 0.4,
    squeeze: 0,
    lidUp: 0.15,
    lidLow: 0.6,
    pupil: 1.2,
    jaw: 0.5,
    cornerL: 1,
    cornerR: 1,
    width: 0.5,
    sneerL: 0,
    sneerR: 0,
    nose: 0.1,
  },
  surpris: {
    browIn: 1,
    browOut: 0.9,
    squeeze: 0,
    lidUp: -0.3,
    lidLow: 0,
    pupil: 0.8,
    jaw: 0.6,
    cornerL: -0.1,
    cornerR: -0.1,
    width: -0.4,
    sneerL: 0,
    sneerR: 0,
    nose: 0,
  },
  inquiet: {
    browIn: 0.8,
    browOut: -0.3,
    squeeze: 0.6,
    lidUp: 0.05,
    lidLow: 0.15,
    pupil: 0.95,
    jaw: 0.05,
    cornerL: -0.4,
    cornerR: -0.4,
    width: -0.2,
    sneerL: 0,
    sneerR: 0,
    nose: 0,
  },
  aïe: {
    browIn: 0.6,
    browOut: -0.5,
    squeeze: 1,
    lidUp: 0.8,
    lidLow: 0.6,
    pupil: 0.8,
    jaw: 0.3,
    cornerL: -0.3,
    cornerR: -0.3,
    width: 0.7,
    sneerL: 0.5,
    sneerR: 0.5,
    nose: 0.7,
  },
  victorieux: {
    browIn: 0.1,
    browOut: 0.5,
    squeeze: 0,
    lidUp: 0.25,
    lidLow: 0.55,
    pupil: 1.05,
    jaw: 0.55,
    cornerL: 1,
    cornerR: 0.9,
    width: 0.55,
    sneerL: 0.2,
    sneerR: 0,
    nose: 0.1,
  },
  // Signature expressions (one per personality).
  placide: {
    browIn: 0.15,
    browOut: 0.1,
    squeeze: 0,
    lidUp: 0.5,
    lidLow: 0.25,
    pupil: 1.1,
    jaw: 0,
    cornerL: 0.35,
    cornerR: 0.35,
    width: 0.1,
    sneerL: 0,
    sneerR: 0,
    nose: 0,
  },
  insolent: {
    browIn: -0.3,
    browOut: 0.7,
    squeeze: 0.2,
    lidUp: 0.3,
    lidLow: 0.3,
    pupil: 1,
    jaw: 0.1,
    cornerL: 0.6,
    cornerR: 0.1,
    width: 0.2,
    sneerL: 0.2,
    sneerR: 0,
    nose: 0,
  },
  /** Bernadette: sly granny, squinting eyes and a lopsided closed smile. */
  malicieux: {
    browIn: -0.2,
    browOut: 0.5,
    squeeze: 0.55,
    lidUp: 0.45,
    lidLow: 0.45,
    pupil: 1,
    jaw: 0,
    cornerL: 0.75,
    cornerR: 0.2,
    width: 0.2,
    sneerL: 0.3,
    sneerR: 0,
    nose: 0,
  },
  /** Ernest: grumpy foreman, knotted brows, corners down. */
  grincheux: {
    browIn: -0.6,
    browOut: -0.1,
    squeeze: 0.6,
    lidUp: 0.3,
    lidLow: 0.15,
    pupil: 0.9,
    jaw: 0,
    cornerL: -0.5,
    cornerR: -0.4,
    width: 0,
    sneerL: 0.1,
    sneerR: 0.1,
    nose: 0.4,
  },
  hautain: {
    browIn: 0.35,
    browOut: 0.5,
    squeeze: 0,
    lidUp: 0.45,
    lidLow: 0.15,
    pupil: 0.9,
    jaw: 0,
    cornerL: 0.15,
    cornerR: -0.1,
    width: -0.1,
    sneerL: 0,
    sneerR: 0.1,
    nose: 0.1,
  },
} satisfies Record<string, Expression>;
export type ExpressionName = keyof typeof EXPRESSIONS;

/** Battle cry while attacking: box mouth, knotted brows, snarl. */
export const SHOUT: Expression = {
  browIn: -1,
  browOut: 0.3,
  squeeze: 1,
  lidUp: 0.2,
  lidLow: 0.35,
  pupil: 0.85,
  jaw: 1,
  cornerL: -0.3,
  cornerR: -0.3,
  width: 0.8,
  sneerL: 0.8,
  sneerR: 0.8,
  nose: 0.8,
};

/** Eases every control toward the target (brows lead, then lids, then the mouth). */
export function easeExpression(e: Expression, target: Expression, dt: number): void {
  const brow = Math.min(1, dt * 16);
  const lid = Math.min(1, dt * 13);
  const mouth = Math.min(1, dt * 10);
  e.browIn += (target.browIn - e.browIn) * brow;
  e.browOut += (target.browOut - e.browOut) * brow;
  e.squeeze += (target.squeeze - e.squeeze) * brow;
  e.lidUp += (target.lidUp - e.lidUp) * lid;
  e.lidLow += (target.lidLow - e.lidLow) * lid;
  e.pupil += (target.pupil - e.pupil) * lid;
  e.jaw += (target.jaw - e.jaw) * mouth;
  e.cornerL += (target.cornerL - e.cornerL) * mouth;
  e.cornerR += (target.cornerR - e.cornerR) * mouth;
  e.width += (target.width - e.width) * mouth;
  e.sneerL += (target.sneerL - e.sneerL) * mouth;
  e.sneerR += (target.sneerR - e.sneerR) * mouth;
  e.nose += (target.nose - e.nose) * mouth;
}

/** Deterministic pseudo-random in [0, 1) from an integer. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Blink: regular 2 closing / 1 closed / 3 opening frames (30 fps), every 2–5 s at irregular
 * intervals. Returns lid closure 0..1.
 */
export function blinkAmount(time: number): number {
  let t = 0;
  for (let i = 0; i < 200; i++) {
    const next = t + 2 + hash(i) * 3;
    if (time < next) {
      const dt = (time - t) * 30; // frames since the blink started
      if (dt < 2) return dt / 2;
      if (dt < 3) return 1;
      if (dt < 6) return 1 - (dt - 3) / 3;
      return 0;
    }
    t = next;
  }
  return 0;
}

/** Eye darts: the gaze jumps (never pans) to a new small target every 0.6–2 s. */
export function gaze(time: number): { yaw: number; pitch: number } {
  let t = 0;
  for (let i = 0; i < 400; i++) {
    const next = t + 0.6 + hash(i + 1000) * 1.4;
    if (time < next) {
      return { yaw: (hash(i + 2000) - 0.5) * 0.24, pitch: (hash(i + 3000) - 0.5) * 0.12 };
    }
    t = next;
  }
  return { yaw: 0, pitch: 0 };
}
