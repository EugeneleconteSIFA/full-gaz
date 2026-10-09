import { GAME_CONFIG, secondsToTicks } from "../../config/gameConfig";
import type { MatchState, ProductionEvent } from "../../core/MatchState";
import { nextInt, type RngState } from "../../core/Random";
import { RESOURCE_IDS, type ResourceId, type TeamId } from "../../core/types";
import type { PhaseDefinition } from "../match/matchClock";

export function createWallet(): Record<ResourceId, number> {
  return { food: 0, wood: 0, stone: 0, metal: 0, power: 0 };
}

/**
 * Ticks of every production event: each phase with an interval produces at its start and then
 * every interval, until the next phase starts. Nothing is produced at or after the end.
 * With the default config: 1:00, 2:00, 3:00, 4:00, then 5:00, 5:30, 6:00, 6:30.
 */
export function buildProductionTicks(
  phases: readonly PhaseDefinition[],
  durationSeconds: number,
): number[] {
  const ticks: number[] = [];
  phases.forEach((phase, i) => {
    const interval = phase.productionIntervalSeconds;
    if (interval === null) return;
    const end = phases[i + 1]?.startsAtSeconds ?? durationSeconds;
    for (let t = phase.startsAtSeconds; t < end && t < durationSeconds; t += interval) {
      ticks.push(secondsToTicks(t));
    }
  });
  return ticks;
}

/**
 * Shuffle bag: every resource comes out once, in random order, before the bag is refilled.
 * Avoids long streaks of the same resource while staying unpredictable.
 */
export function drawFromBag(
  rng: RngState,
  resources: readonly ResourceId[],
  count: number,
): ResourceId[] {
  const out: ResourceId[] = [];
  while (out.length < count) {
    const bag = [...resources];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = nextInt(rng, 0, i + 1);
      const tmp = bag[i] as ResourceId;
      bag[i] = bag[j] as ResourceId;
      bag[j] = tmp;
    }
    out.push(...bag.slice(0, count - out.length));
  }
  return out;
}

/** Free draw: each base gets any resource, independently (see DECISIONS D028). */
export function drawBaseResources(
  rng: RngState,
  resources: readonly ResourceId[],
  baseCount: number,
): ResourceId[] {
  return Array.from(
    { length: baseCount },
    () => resources[nextInt(rng, 0, resources.length)] as ResourceId,
  );
}

export function buildProductionPlan(
  rng: RngState,
  resources: readonly ResourceId[],
  ticks: readonly number[],
): ProductionEvent[] {
  const sequence = drawFromBag(rng, resources, ticks.length);
  return ticks.map((tick, i) => ({ tick, resourceId: sequence[i] as ResourceId }));
}

/**
 * Runs the production event scheduled for this tick, if any (D055): every controlled base pays
 * each player of its team `perBase` of its own resource; bases of the event's featured resource
 * pay `featuredMultiplier` times that. Dead players receive too.
 */
export function runProduction(state: MatchState): void {
  const event = state.productionPlan[state.nextProductionIndex];
  if (!event || event.tick > state.tick) return;
  state.nextProductionIndex++;

  const { perBase, featuredMultiplier } = GAME_CONFIG.production;
  const gainsByTeam: Record<TeamId, Record<ResourceId, number>> = {
    teamA: createWallet(),
    teamB: createWallet(),
  };
  const amountByTeam: Record<TeamId, number> = { teamA: 0, teamB: 0 };
  for (const base of state.bases) {
    if (base.owner === "neutral") continue;
    const amount = base.resourceId === event.resourceId ? perBase * featuredMultiplier : perBase;
    gainsByTeam[base.owner][base.resourceId] += amount;
    amountByTeam[base.owner] += amount;
  }
  for (const player of state.players) {
    const gains = gainsByTeam[player.teamId];
    for (const id of RESOURCE_IDS) player.resources[id] += gains[id];
  }
  state.lastProduction = { ...event, amountByTeam, gainsByTeam };
}
