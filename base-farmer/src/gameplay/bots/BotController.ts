import { FIXED_STEP_SECONDS, secondsToTicks } from "../../config/gameConfig";
import type { GameCommand } from "../../core/commands";
import { setVec2, vec2, type Vec2 } from "../../core/math";
import { isAlive, type BaseState, type MatchState, type PlayerState } from "../../core/MatchState";
import { createRng, nextFloat, type RngState } from "../../core/Random";
import type { BaseId, PlayerId, TeamId } from "../../core/types";
import {
  BOT_DIFFICULTY_SETTINGS,
  BOT_TUNING,
  BOT_UPGRADE_PRIORITIES,
  type BotDifficulty,
  type BotDifficultySettings,
} from "../../data/bots";
import { CommandWriter } from "../../input/CommandWriter";
import { createInputState, type InputState } from "../../input/InputState";
import type { DistanceField, NavGrid } from "../../world/navigation";
import { getCharacter } from "../../data/registry";
import { canAfford } from "../upgrades/UpgradeSystem";
import type { BotNavigation } from "./BotNavigation";

const BOT_SEED_SALT = 0x27d4eb2f;

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A simple objective-focused bot (docs/01_GAMEPLAY_RULES.md §10). It reads the match state and
 * produces the same commands a human would, through the same CommandWriter, so it plays by
 * exactly the same rules:
 *
 * 1. picks a target base (every decision interval, not every tick);
 * 2. walks there around obstacles;
 * 3. captures it by standing in the zone;
 * 4. shoots enemies it can see, after a reaction delay, with some aim error;
 * 5. avoids fights and enemy-held areas when low on HP;
 * 6. buys upgrades in its character's priority order;
 * 7. uses its ability when it pays (normal and hard levels).
 *
 * Deterministic: its randomness comes from its own RNG seeded by the match seed and its id.
 */
export class BotController {
  private readonly settings: BotDifficultySettings;
  private readonly rng: RngState;
  private readonly input: InputState = createInputState();
  private readonly writer: CommandWriter;
  private readonly decisionTicks: number;
  private readonly steeringTicks: number;
  private readonly reactionTicks: number;

  private nextDecisionTick = 0;
  private nextSteeringTick = 0;
  private nextUpgradeTick = 0;
  private pausedUntilTick = 0;
  private targetBase: BaseId | null = null;
  private aimOffset = 0;
  private enemySeenSince: number | null = null;
  private readonly lastEnemyPositions = new Map<PlayerId, Vec2>();
  private readonly moveDirection = vec2();
  private readonly scratch = vec2();

  constructor(
    readonly playerId: PlayerId,
    difficulty: BotDifficulty,
    seed: number,
    private readonly nav: BotNavigation,
  ) {
    this.settings = BOT_DIFFICULTY_SETTINGS[difficulty];
    this.rng = createRng((seed ^ BOT_SEED_SALT ^ hashId(playerId)) >>> 0);
    this.writer = new CommandWriter(playerId);
    this.decisionTicks = Math.max(1, secondsToTicks(this.settings.decisionInterval));
    this.steeringTicks = Math.max(1, secondsToTicks(BOT_TUNING.steeringInterval));
    this.reactionTicks = secondsToTicks(this.settings.reactionTime);
  }

  /** Current target, for debugging and tests. */
  get target(): BaseId | null {
    return this.targetBase;
  }

  /** Commands for this tick. Call once per tick, before stepMatch. */
  think(state: MatchState): readonly GameCommand[] {
    const input = this.input;
    input.buyRequests.length = 0;
    const me = this.me(state);

    const deciding = state.tick >= this.nextDecisionTick;
    if (deciding) {
      this.nextDecisionTick = state.tick + this.decisionTicks;
      if (state.tick >= this.nextUpgradeTick && this.buyUpgrade(me)) {
        this.nextUpgradeTick = state.tick + secondsToTicks(this.settings.upgradeIntervalSeconds);
      }
    }

    if (!isAlive(me)) {
      setVec2(input.moveVector, 0, 0);
      setVec2(input.aimVector, 0, 0);
      input.attackPressed = false;
      input.abilityPressed = false;
      this.enemySeenSince = null;
      return this.writer.write(input);
    }

    if (deciding) {
      const previous = this.targetBase;
      const reached =
        previous !== null && state.bases.some((b) => b.id === previous && b.owner === me.teamId);
      if (
        reached &&
        this.settings.pauseAfterCaptureSeconds > 0 &&
        this.pausedUntilTick < state.tick
      ) {
        // Hesitates after a capture before heading off again (easier levels only).
        this.pausedUntilTick = state.tick + secondsToTicks(this.settings.pauseAfterCaptureSeconds);
      }
      this.targetBase = this.chooseTarget(state, me);
      this.aimOffset =
        (nextFloat(this.rng) * 2 - 1) * ((this.settings.aimErrorDegrees * Math.PI) / 180);
    }

    const enemy = this.visibleEnemy(state, me);
    this.steer(state, me, enemy);
    this.fight(state, me, enemy);
    input.abilityPressed = this.settings.usesAbility && this.wantsAbility(state, me, enemy);
    this.rememberEnemyPositions(state, me.teamId);
    return this.writer.write(input);
  }

  private me(state: MatchState): PlayerState {
    for (const p of state.players) if (p.id === this.playerId) return p;
    throw new Error(`Bot player "${this.playerId}" missing from match`);
  }

  // --- Strategy ---------------------------------------------------------------------------------

  private chooseTarget(state: MatchState, me: PlayerState): BaseId | null {
    const enemies = state.players.filter((p) => p.teamId !== me.teamId && isAlive(p));
    const avoidFights = me.hp < me.stats.maxHp * BOT_TUNING.lowHpFraction;
    const upcoming = state.productionPlan[state.nextProductionIndex];
    const soon =
      upcoming !== undefined &&
      upcoming.tick - state.tick <= secondsToTicks(BOT_TUNING.nextResourceWindowSeconds);

    let best: BaseId | null = null;
    let bestScore = 0;
    state.bases.forEach((base, i) => {
      const position = state.layout.bases[i]?.position;
      const field = this.nav.baseFields[i];
      if (!position || !field) return;

      let value = this.baseValue(base, me.teamId);
      if (value <= 0) return;
      if (soon && upcoming.resourceId === base.resourceId) value += BOT_TUNING.nextResourceBonus;
      if (
        avoidFights &&
        enemies.some(
          (e) =>
            Math.hypot(e.position.x - position.x, e.position.y - position.y) <
            BOT_TUNING.avoidEnemyRadius,
        )
      ) {
        return;
      }

      const travelSeconds = field.distanceAt(me.position.x, me.position.y) / me.stats.moveSpeed;
      if (!Number.isFinite(travelSeconds)) return;
      let score = value * 0.5 ** (travelSeconds / BOT_TUNING.travelHalfLifeSeconds);
      score *= 1 + this.settings.choiceNoise * nextFloat(this.rng);
      if (base.id === this.targetBase) score *= 1 + BOT_TUNING.stickiness;
      if (score > bestScore) {
        bestScore = score;
        best = base.id;
      }
    });

    return best ?? this.frontlineBase(state, me, enemies);
  }

  /** How much taking or holding this base is worth to `team` right now (0 = nothing to do). */
  private baseValue(base: BaseState, team: TeamId): number {
    const underAttack = base.contested || (base.captureTeam !== null && base.captureTeam !== team);
    if (base.owner === team) return underAttack ? BOT_TUNING.defendValue : 0;
    if (base.owner === "neutral") return BOT_TUNING.neutralValue;
    return BOT_TUNING.enemyValue;
  }

  /** Nothing left to take: guard the owned base closest to an enemy. */
  private frontlineBase(
    state: MatchState,
    me: PlayerState,
    enemies: readonly PlayerState[],
  ): BaseId | null {
    let best: BaseId | null = null;
    let bestDistance = Infinity;
    state.bases.forEach((base, i) => {
      const p = state.layout.bases[i]?.position;
      if (!p || base.owner !== me.teamId) return;
      for (const e of enemies) {
        const d = Math.hypot(e.position.x - p.x, e.position.y - p.y);
        if (d < bestDistance) {
          bestDistance = d;
          best = base.id;
        }
      }
    });
    return best ?? this.targetBase;
  }

  /** Queues the first affordable upgrade in priority order. Returns whether it queued one. */
  private buyUpgrade(me: PlayerState): boolean {
    const priorities = BOT_UPGRADE_PRIORITIES[me.characterId] ?? [];
    const affordable = priorities.find((id) => canAfford(me, id));
    if (affordable) this.input.buyRequests.push(affordable);
    return affordable !== undefined;
  }

  // --- Movement -----------------------------------------------------------------------------------

  private steer(state: MatchState, me: PlayerState, enemy: PlayerState | null): void {
    if (state.tick >= this.nextSteeringTick) {
      this.nextSteeringTick = state.tick + this.steeringTicks;
      const field = this.targetField(state);
      if (!field) setVec2(this.moveDirection, 0, 0);
      else {
        const goal = field.goal;
        const near =
          Math.hypot(goal.x - me.position.x, goal.y - me.position.y) < BOT_TUNING.arrivalRadius;
        if (near) setVec2(this.moveDirection, 0, 0);
        else field.directionFrom(me.position.x, me.position.y, this.moveDirection);
      }
    }
    this.engage(me, enemy);
    const intensity = state.tick < this.pausedUntilTick ? 0 : this.settings.moveIntensity;
    setVec2(
      this.input.moveVector,
      this.moveDirection.x * intensity,
      this.moveDirection.y * intensity,
    );
  }

  /**
   * Close-range combat movement, overriding the walk to the base:
   * - melee: step in to reach an enemy close by (unless low on HP);
   * - ranged: back away from a melee enemy that gets too close (kiting).
   * Only on a clear line: visibleEnemy already checked line of sight.
   */
  private engage(me: PlayerState, enemy: PlayerState | null): void {
    if (!enemy || me.hp < me.stats.maxHp * BOT_TUNING.lowHpFraction) return;
    const dx = enemy.position.x - me.position.x;
    const dy = enemy.position.y - me.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;
    if (me.stats.attackKind === "melee") {
      if (distance > BOT_TUNING.meleeChaseRadius) return;
      // Close enough to hit: hold position (keeps standing in the zone), otherwise step in.
      if (distance <= me.stats.attackRange * 0.8) setVec2(this.moveDirection, 0, 0);
      else setVec2(this.moveDirection, dx / distance, dy / distance);
    } else if (enemy.stats.attackKind === "melee" && distance < BOT_TUNING.kiteRadius) {
      setVec2(this.moveDirection, -dx / distance, -dy / distance);
    }
  }

  private targetField(state: MatchState): DistanceField | null {
    if (this.targetBase === null) return null;
    const index = state.bases.findIndex((b) => b.id === this.targetBase);
    return this.nav.baseFields[index] ?? null;
  }

  // --- Combat -------------------------------------------------------------------------------------

  private fight(state: MatchState, me: PlayerState, enemy: PlayerState | null): void {
    const input = this.input;
    if (!enemy) {
      this.enemySeenSince = null;
      input.attackPressed = false;
      // Face where it is going.
      setVec2(input.aimVector, this.moveDirection.x, this.moveDirection.y);
      input.aimDistance = null;
      return;
    }
    this.enemySeenSince ??= state.tick;

    const aimAt = this.predictPosition(enemy, me);
    const dx = aimAt.x - me.position.x;
    const dy = aimAt.y - me.position.y;
    const cos = Math.cos(this.aimOffset);
    const sin = Math.sin(this.aimOffset);
    setVec2(input.aimVector, dx * cos - dy * sin, dx * sin + dy * cos);
    // A lob lands where the enemy will be.
    input.aimDistance = Math.hypot(dx, dy);

    const distance = Math.hypot(enemy.position.x - me.position.x, enemy.position.y - me.position.y);
    const reacted = state.tick - this.enemySeenSince >= this.reactionTicks;
    // Melee reach counts to the edge of the enemy's body; a shot must travel to its center.
    const reach =
      me.stats.attackKind === "melee"
        ? me.stats.attackRange + enemy.stats.radius
        : me.stats.attackRange;
    // A lob never lands closer than its min range: no point throwing at an enemy inside it.
    const tooClose = me.stats.attackKind === "lob" && distance < me.stats.lobMinRange;
    input.attackPressed =
      reacted && !tooClose && distance <= reach * this.settings.fireRangeFraction;
  }

  /** Whether using the ability now pays off. Checked every tick; the cooldown does the rest. */
  private wantsAbility(state: MatchState, me: PlayerState, enemy: PlayerState | null): boolean {
    if (state.tick < me.abilityReadyTick) return false;
    const ability = getCharacter(me.characterId).ability;
    const distance = enemy
      ? Math.hypot(enemy.position.x - me.position.x, enemy.position.y - me.position.y)
      : Infinity;
    switch (ability.kind) {
      case "guard":
        return (
          distance < BOT_TUNING.guardEnemyRadius &&
          me.hp < me.stats.maxHp * BOT_TUNING.guardHpFraction
        );
      case "volley":
      case "bombard":
        return this.input.attackPressed;
      case "spin":
        return distance <= me.stats.attackRange * ability.rangeFactor + me.stats.radius;
      case "dash": {
        const goal = this.targetField(state)?.goal;
        if (!goal || state.tick < this.pausedUntilTick) return false;
        if (Math.hypot(this.moveDirection.x, this.moveDirection.y) < 0.5) return false;
        const away = Math.hypot(goal.x - me.position.x, goal.y - me.position.y);
        return away > ability.distance + BOT_TUNING.dashSpareDistance;
      }
    }
  }

  /** Closest living enemy within detection range and in the clear (no obstacle in between). */
  private visibleEnemy(state: MatchState, me: PlayerState): PlayerState | null {
    const grid: NavGrid = this.nav.grid;
    const sight =
      me.stats.attackKind === "melee" ? BOT_TUNING.meleeChaseRadius : me.stats.attackRange;
    const detection = sight + BOT_TUNING.detectionMargin;
    let best: PlayerState | null = null;
    let bestDistance = detection;
    for (const p of state.players) {
      if (p.teamId === me.teamId || !isAlive(p)) continue;
      const d = Math.hypot(p.position.x - me.position.x, p.position.y - me.position.y);
      if (d > bestDistance) continue;
      // Lobs fly over walls: no need to see the enemy.
      if (
        me.stats.attackKind !== "lob" &&
        !grid.hasLineOfSight(
          me.position.x,
          me.position.y,
          p.position.x,
          p.position.y,
          me.stats.projectileRadius,
        )
      ) {
        continue;
      }
      best = p;
      bestDistance = d;
    }
    return best;
  }

  /** Where to aim: the enemy's position, led by its current velocity on harder levels. */
  private predictPosition(enemy: PlayerState, me: PlayerState): Vec2 {
    const out = setVec2(this.scratch, enemy.position.x, enemy.position.y);
    const last = this.lastEnemyPositions.get(enemy.id);
    if (!this.settings.leadsTargets || !last) return out;
    const vx = (enemy.position.x - last.x) / FIXED_STEP_SECONDS;
    const vy = (enemy.position.y - last.y) / FIXED_STEP_SECONDS;
    const flight =
      me.stats.attackKind === "lob"
        ? me.stats.lobFlightSeconds
        : Math.hypot(enemy.position.x - me.position.x, enemy.position.y - me.position.y) /
          me.stats.projectileSpeed;
    out.x += vx * flight;
    out.y += vy * flight;
    return out;
  }

  private rememberEnemyPositions(state: MatchState, team: TeamId): void {
    for (const p of state.players) {
      if (p.teamId === team) continue;
      const last = this.lastEnemyPositions.get(p.id);
      if (last) setVec2(last, p.position.x, p.position.y);
      else this.lastEnemyPositions.set(p.id, vec2(p.position.x, p.position.y));
    }
  }
}
