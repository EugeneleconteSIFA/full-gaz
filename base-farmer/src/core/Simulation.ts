import { FIXED_STEP_SECONDS, GAME_CONFIG, secondsToTicks } from "../config/gameConfig";
import { getCharacter, getMap } from "../data/registry";
import { updateCapture } from "../gameplay/bases/CaptureSystem";
import { tryUseAbility } from "../gameplay/abilities/AbilitySystem";
import { tryFire } from "../gameplay/combat/CombatSystem";
import { computeResult } from "../gameplay/match/endCondition";
import {
  buildProductionPlan,
  buildProductionTicks,
  createWallet,
  drawBaseResources,
  runProduction,
} from "../gameplay/resources/ProductionSystem";
import { updateProjectiles } from "../gameplay/combat/ProjectileSystem";
import { updateShells } from "../gameplay/combat/ShellSystem";
import { applyMovement } from "../gameplay/movement/MovementSystem";
import {
  computeStats,
  createUpgradeLevels,
  tryBuyUpgrade,
} from "../gameplay/upgrades/UpgradeSystem";
import { buildMatchLayout } from "../world/MapLayout";
import { placeAtSpawn, respawnDuePlayers } from "../world/SpawnSystem";
import type { GameCommand } from "./commands";
import { normalizeInto, setVec2, vec2 } from "./math";
import { isAlive, type MatchState, type PlayerState } from "./MatchState";
import { createRng } from "./Random";
import { RESOURCE_IDS, type CharacterId, type MapId, type PlayerId, type TeamId } from "./types";

export interface PlayerSetup {
  readonly id: PlayerId;
  readonly teamId: TeamId;
  readonly characterId: CharacterId;
}

export interface MatchSetup {
  readonly seed: number;
  readonly mapId: MapId;
  readonly players: readonly PlayerSetup[];
  /** Debug only: start the match clock this many seconds in (e.g. to test the endgame). */
  readonly startAtSeconds?: number;
}

export function createMatchState(setup: MatchSetup): MatchState {
  const layout = buildMatchLayout(getMap(setup.mapId), setup.seed);
  const ids = new Set<PlayerId>();

  const players = setup.players.map((p): PlayerState => {
    if (ids.has(p.id)) throw new Error(`Duplicate player id "${p.id}"`);
    ids.add(p.id);

    const character = getCharacter(p.characterId);
    const upgrades = createUpgradeLevels();
    const player: PlayerState = {
      id: p.id,
      teamId: p.teamId,
      characterId: p.characterId,
      position: vec2(),
      aim: vec2(1, 0),
      aimDistance: null,
      moveIntent: vec2(),
      attackIntent: false,
      hp: 0,
      attackReadyTick: 0,
      abilityIntent: false,
      abilityReadyTick: 0,
      guardUntilTick: 0,
      respawnAtTick: null,
      resources: createWallet(),
      upgrades,
      stats: computeStats(character, upgrades),
    };
    placeAtSpawn(player, layout);
    return player;
  });

  const durationTicks = secondsToTicks(GAME_CONFIG.match.durationSeconds);
  const startTick = secondsToTicks(setup.startAtSeconds ?? 0);
  if (startTick < 0 || startTick >= durationTicks) {
    throw new Error(`startAtSeconds must be in [0, ${GAME_CONFIG.match.durationSeconds})`);
  }

  // RNG draw order is part of determinism: base resources first, then the production plan.
  const rng = createRng(setup.seed);
  const baseResources = drawBaseResources(rng, RESOURCE_IDS, layout.bases.length);
  const productionTicks = buildProductionTicks(
    GAME_CONFIG.match.phases,
    GAME_CONFIG.match.durationSeconds,
  );
  const productionPlan = buildProductionPlan(rng, RESOURCE_IDS, productionTicks);
  // A debug start skips events that are already in the past.
  const nextProductionIndex = productionPlan.filter((e) => e.tick < startTick).length;

  return {
    seed: setup.seed,
    mapId: setup.mapId,
    layout,
    tick: startTick,
    durationTicks,
    result: null,
    rng,
    players,
    projectiles: [],
    shells: [],
    bases: layout.bases.map((b, i) => ({
      id: b.id,
      resourceId: baseResources[i] ?? fail(`No resource drawn for base "${b.id}"`),
      owner: "neutral",
      captureTeam: null,
      captureProgress: 0,
      contested: false,
    })),
    productionPlan,
    nextProductionIndex,
    lastProduction: null,
    nextEntityId: 1,
  };
}

function fail(message: string): never {
  throw new Error(message);
}

function findPlayer(state: MatchState, id: PlayerId): PlayerState {
  for (const player of state.players) {
    if (player.id === id) return player;
  }
  throw new Error(`Command for unknown player "${id}"`);
}

function applyCommand(state: MatchState, command: GameCommand): void {
  const player = findPlayer(state, command.playerId);
  switch (command.type) {
    case "move":
      setVec2(player.moveIntent, command.vector.x, command.vector.y);
      return;
    case "aim":
      // A zero vector keeps the previous aim.
      normalizeInto(player.aim, command.direction.x, command.direction.y);
      player.aimDistance = command.distance ?? null;
      return;
    case "attack":
      // Dead players cannot queue a shot for when they respawn.
      player.attackIntent = command.active && isAlive(player);
      return;
    case "ability":
      player.abilityIntent = command.active && isAlive(player);
      return;
    case "buyUpgrade":
      tryBuyUpgrade(player, command.upgradeId);
      return;
  }
}

/**
 * Advances the match by exactly one fixed tick (FIXED_STEP_SECONDS).
 * Pure game rules: no rendering, no device input. Does nothing once the match has ended.
 */
export function stepMatch(state: MatchState, commands: readonly GameCommand[]): void {
  if (state.result !== null) return;
  const dt = FIXED_STEP_SECONDS;
  for (const command of commands) applyCommand(state, command);

  // Production uses base ownership as it stands at the start of the tick.
  runProduction(state);

  respawnDuePlayers(state);

  for (const player of state.players) {
    if (!isAlive(player)) continue;
    applyMovement(player, player.stats.moveSpeed, player.stats.radius, state.layout, dt);
    tryFire(state, player);
    tryUseAbility(state, player);
  }

  updateProjectiles(state, dt);
  updateShells(state);
  // After combat, so a player killed this tick no longer holds a zone.
  updateCapture(state, dt);
  state.tick++;

  // The match ends immediately at the final tick, decided by the bases at that moment.
  if (state.tick >= state.durationTicks) state.result = computeResult(state.bases);
}
