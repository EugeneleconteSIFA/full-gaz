import { GAME_CONFIG } from "../../config/gameConfig";
import type { PlayerStats, PlayerState } from "../../core/MatchState";
import type { ResourceId, UpgradeId } from "../../core/types";
import type { CharacterDefinition } from "../../data/characters";
import { getCharacter } from "../../data/registry";
import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_LEVEL_COSTS,
  UPGRADES,
  type UpgradeDefinition,
} from "../../data/upgrades";

export function createUpgradeLevels(): Record<UpgradeId, number> {
  return { hp: 0, speed: 0, range: 0, damage: 0, fireRate: 0 };
}

export function getUpgrade(id: UpgradeId): UpgradeDefinition {
  const definition = UPGRADES.find((u) => u.id === id);
  if (!definition) throw new Error(`Unknown upgrade id "${id}"`);
  return definition;
}

/** Character stats with upgrade levels applied: +bonusPerLevel of the base stat per level. */
export function computeStats(
  character: CharacterDefinition,
  levels: Readonly<Record<UpgradeId, number>>,
): PlayerStats {
  const bonus = (id: UpgradeId) => 1 + levels[id] * GAME_CONFIG.upgrades.bonusPerLevel;
  return {
    attackKind: character.attackKind,
    meleeArc: (character.meleeArcDegrees * Math.PI) / 180,
    radius: character.radius,
    maxHp: Math.round(character.maxHp * bonus("hp")),
    moveSpeed: character.moveSpeed * bonus("speed"),
    attackRange: character.attackRange * bonus("range"),
    attackDamage: Math.round(character.attackDamage * bonus("damage")),
    // Fire rate +15% per level = cooldown divided by the same factor.
    attackCooldown: character.attackCooldown / bonus("fireRate"),
    projectileSpeed: character.projectileSpeed,
    projectileRadius: character.projectileRadius,
    lobFlightSeconds: character.lob?.flightSeconds ?? 0,
    splashRadius: character.lob?.splashRadius ?? 0,
    lobMinRange: character.lob?.minRange ?? 0,
  };
}

export interface ResourceCost {
  readonly resourceId: ResourceId;
  readonly amount: number;
}

/** What the next level of `upgradeId` costs this player, or null when already maxed. */
export function nextLevelCost(
  player: PlayerState,
  upgradeId: UpgradeId,
): readonly ResourceCost[] | null {
  const level = player.upgrades[upgradeId];
  const cost = UPGRADE_LEVEL_COSTS[level];
  if (level >= MAX_UPGRADE_LEVEL || !cost) return null;
  const upgrade = getUpgrade(upgradeId);
  const parts: ResourceCost[] = [{ resourceId: upgrade.primary, amount: cost.primary }];
  if (cost.secondary > 0) parts.push({ resourceId: upgrade.secondary, amount: cost.secondary });
  return parts;
}

export function canAfford(player: PlayerState, upgradeId: UpgradeId): boolean {
  const cost = nextLevelCost(player, upgradeId);
  return cost !== null && cost.every((c) => player.resources[c.resourceId] >= c.amount);
}

/**
 * Buys the next level if affordable: pays the cost from the personal wallet, raises the level
 * and recomputes stats. A max HP upgrade also heals by the HP it adds (living players only).
 * Allowed at any time, including while dead. Returns whether the purchase happened.
 */
export function tryBuyUpgrade(player: PlayerState, upgradeId: UpgradeId): boolean {
  const cost = nextLevelCost(player, upgradeId);
  if (!cost || !canAfford(player, upgradeId)) return false;

  for (const part of cost) player.resources[part.resourceId] -= part.amount;
  player.upgrades[upgradeId]++;

  const previousMaxHp = player.stats.maxHp;
  player.stats = computeStats(getCharacter(player.characterId), player.upgrades);
  if (player.respawnAtTick === null) player.hp += player.stats.maxHp - previousMaxHp;
  return true;
}
