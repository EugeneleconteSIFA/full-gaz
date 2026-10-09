import { GAME_CONFIG, secondsToTicks } from "../../config/gameConfig";
import type { PhaseId } from "../../core/types";

export interface PhaseDefinition {
  readonly id: PhaseId;
  readonly startsAtSeconds: number;
  readonly productionIntervalSeconds: number | null;
}

const PHASES: readonly PhaseDefinition[] = GAME_CONFIG.match.phases;

/** The phase active at `tick`: the last phase whose start is not after it. */
export function phaseAt(
  tick: number,
  phases: readonly PhaseDefinition[] = PHASES,
): PhaseDefinition {
  let current = phases[0];
  if (!current) throw new Error("No match phases configured");
  for (const phase of phases) {
    if (tick >= secondsToTicks(phase.startsAtSeconds)) current = phase;
  }
  return current;
}

/** Whole seconds left, rounded up, so the display shows 0:00 only when the match is over. */
export function secondsRemaining(tick: number, durationTicks: number): number {
  return Math.ceil(Math.max(0, durationTicks - tick) / GAME_CONFIG.simulation.ticksPerSecond);
}

/** "m:ss". */
export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function findPhaseErrors(
  phases: readonly PhaseDefinition[],
  durationSeconds: number,
): string[] {
  const errors: string[] = [];
  if (!(durationSeconds > 0)) errors.push("Match duration must be > 0");
  if (phases[0]?.startsAtSeconds !== 0) errors.push("The first phase must start at 0 s");
  phases.forEach((phase, i) => {
    const previous = phases[i - 1];
    if (previous && phase.startsAtSeconds <= previous.startsAtSeconds) {
      errors.push(`Phase "${phase.id}" must start after "${previous.id}"`);
    }
    if (phase.startsAtSeconds >= durationSeconds) {
      errors.push(`Phase "${phase.id}" starts after the match ends`);
    }
    const interval = phase.productionIntervalSeconds;
    if (interval !== null && !(interval > 0)) {
      errors.push(`Phase "${phase.id}" production interval must be > 0`);
    }
  });
  return errors;
}
