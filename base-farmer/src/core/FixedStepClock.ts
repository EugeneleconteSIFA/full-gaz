/**
 * Runs the simulation at a fixed rate independent of the render frame rate.
 * Leftover time is exposed as `alpha` so rendering can interpolate between ticks.
 */
export class FixedStepClock {
  private accumulatorMs = 0;

  constructor(
    readonly stepMs: number,
    private readonly maxStepsPerFrame: number,
  ) {
    if (!(stepMs > 0)) throw new Error(`stepMs must be > 0, got ${stepMs}`);
    if (!(maxStepsPerFrame >= 1)) throw new Error(`maxStepsPerFrame must be >= 1`);
  }

  /** Advances by a frame's elapsed time, calling `onStep` once per fixed tick. Returns ticks run. */
  advance(frameMs: number, onStep: () => void): number {
    this.accumulatorMs += Math.max(0, frameMs);
    let steps = 0;
    while (this.accumulatorMs >= this.stepMs && steps < this.maxStepsPerFrame) {
      onStep();
      this.accumulatorMs -= this.stepMs;
      steps++;
    }
    // After a long stall (background tab, debugger), drop the backlog instead of fast-forwarding.
    if (steps === this.maxStepsPerFrame && this.accumulatorMs >= this.stepMs) {
      this.accumulatorMs = 0;
    }
    return steps;
  }

  /** Fraction [0, 1) of the next tick already elapsed. */
  get alpha(): number {
    return this.accumulatorMs / this.stepMs;
  }
}
