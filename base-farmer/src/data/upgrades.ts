import type { ResourceId, UpgradeId } from "../core/types";

export interface UpgradeCost {
  readonly primary: number;
  readonly secondary: number;
}

export interface UpgradeDefinition {
  readonly id: UpgradeId;
  readonly label: string;
  readonly primary: ResourceId;
  readonly secondary: ResourceId;
}

/**
 * Cost of each level, by index (level 1 = index 0): 1, then 2, then 3 resources in total,
 * mixing in the secondary resource from level 2.
 */
export const UPGRADE_LEVEL_COSTS: readonly UpgradeCost[] = [
  { primary: 1, secondary: 0 },
  { primary: 1, secondary: 1 },
  { primary: 2, secondary: 1 },
];

export const MAX_UPGRADE_LEVEL = UPGRADE_LEVEL_COSTS.length;

/**
 * Personal upgrades. Every resource is the primary cost of exactly one upgrade and the
 * secondary cost of exactly one other, so no resource is worthless or mandatory.
 */
export const UPGRADES: readonly UpgradeDefinition[] = [
  { id: "hp", label: "Vie", primary: "food", secondary: "stone" },
  { id: "speed", label: "Vitesse", primary: "wood", secondary: "food" },
  { id: "range", label: "Portée", primary: "stone", secondary: "wood" },
  { id: "damage", label: "Dégâts", primary: "metal", secondary: "power" },
  { id: "fireRate", label: "Cadence", primary: "power", secondary: "metal" },
];
