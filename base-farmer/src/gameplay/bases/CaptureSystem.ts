import { GAME_CONFIG } from "../../config/gameConfig";
import { isAlive, type BaseState, type MatchState } from "../../core/MatchState";
import type { TeamId } from "../../core/types";

/** Completed progress is compared with a tolerance so 1.5 s takes exactly 90 ticks, not 91. */
const COMPLETE = 1 - 1e-9;

/** Progress per second for the base's current phase: neutralizing an owned base or taking a neutral one. */
function captureRate(base: BaseState): number {
  const { neutralizeSeconds, captureSeconds } = GAME_CONFIG.capture;
  return 1 / (base.owner === "neutral" ? captureSeconds : neutralizeSeconds);
}

function reduceProgress(base: BaseState, amount: number): void {
  base.captureProgress -= amount;
  if (base.captureProgress <= 0) {
    base.captureProgress = 0;
    base.captureTeam = null;
  }
}

/**
 * One tick of zone capture for one base, given which teams have a living player in its zone.
 *
 * - Both teams present: contested, nothing moves.
 * - Nobody present: unfinished progress decays slowly.
 * - Only the owner present: the owner pushes enemy progress back at full speed.
 * - Only an attacker present: an enemy base is first neutralized, then captured. If another
 *   team had progress on it, that progress is undone before the attacker's own starts.
 *
 * Team size in the zone does not change the speed.
 */
export function stepCapture(
  base: BaseState,
  teamAPresent: boolean,
  teamBPresent: boolean,
  dtSeconds: number,
): void {
  base.contested = teamAPresent && teamBPresent;
  if (base.contested) return;

  const rate = captureRate(base) * dtSeconds;
  const present: TeamId | null = teamAPresent ? "teamA" : teamBPresent ? "teamB" : null;

  if (present === null) {
    if (base.captureTeam !== null)
      reduceProgress(base, rate * GAME_CONFIG.capture.decaySpeedFactor);
    return;
  }

  if (present === base.owner || (base.captureTeam !== null && base.captureTeam !== present)) {
    if (base.captureTeam !== null) reduceProgress(base, rate);
    return;
  }

  base.captureTeam = present;
  base.captureProgress += rate;
  if (base.captureProgress >= COMPLETE) {
    base.owner = base.owner === "neutral" ? present : "neutral";
    base.captureProgress = 0;
    base.captureTeam = null;
  }
}

/** Runs capture on every base. 7 bases x a handful of players: cheap enough to do every tick. */
export function updateCapture(state: MatchState, dtSeconds: number): void {
  const map = state.layout;
  const radiusSq = GAME_CONFIG.capture.radius ** 2;

  for (let i = 0; i < state.bases.length; i++) {
    const base = state.bases[i];
    const definition = map.bases[i];
    if (!base || !definition) throw new Error(`Base state/definition mismatch at index ${i}`);

    let teamA = false;
    let teamB = false;
    for (const player of state.players) {
      if (!isAlive(player)) continue;
      const dx = player.position.x - definition.position.x;
      const dy = player.position.y - definition.position.y;
      if (dx * dx + dy * dy > radiusSq) continue;
      if (player.teamId === "teamA") teamA = true;
      else teamB = true;
    }
    stepCapture(base, teamA, teamB, dtSeconds);
  }
}
