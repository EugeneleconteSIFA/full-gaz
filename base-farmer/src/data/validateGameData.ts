import type { AbilityDefinition } from "./abilities";
import { GAME_CONFIG } from "../config/gameConfig";
import { RESOURCE_IDS } from "../core/types";
import type { ResourceDefinition } from "./resources";
import type { UpgradeCost, UpgradeDefinition } from "./upgrades";
import { UPGRADE_IDS } from "../core/types";
import type { CharacterDefinition } from "./characters";
import type { MapDefinition } from "./maps";
import { findLayoutErrors } from "../world/MapLayout";
import { findPhaseErrors, type PhaseDefinition } from "../gameplay/match/matchClock";

export interface GameData {
  readonly characters: readonly CharacterDefinition[];
  readonly maps: readonly MapDefinition[];
  readonly resources: readonly ResourceDefinition[];
  readonly upgrades: readonly UpgradeDefinition[];
  readonly upgradeLevelCosts: readonly UpgradeCost[];
  readonly phases: readonly PhaseDefinition[];
  readonly matchDurationSeconds: number;
}

const POSITIVE_CHARACTER_STATS = [
  "radius",
  "moveSpeed",
  "maxHp",
  "attackDamage",
  "attackRange",
  "attackCooldown",
  "projectileSpeed",
  "projectileRadius",
] as const satisfies readonly (keyof CharacterDefinition)[];

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function checkUniqueIds(kind: string, items: readonly { readonly id: string }[], errors: string[]) {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (id.length === 0) errors.push(`${kind} has an empty id`);
    if (seen.has(id)) errors.push(`Duplicate ${kind} id "${id}"`);
    seen.add(id);
  }
}

/** Returns every problem found. Empty array = valid. */
export function findGameDataErrors(data: GameData): string[] {
  const errors: string[] = [];

  if (data.characters.length === 0) errors.push("No characters defined");
  checkUniqueIds("character", data.characters, errors);
  for (const c of data.characters) {
    for (const stat of POSITIVE_CHARACTER_STATS) {
      if (!isPositive(c[stat])) errors.push(`Character "${c.id}" ${stat} must be > 0`);
    }
    if (c.label.trim() === "" || c.tagline.trim() === "") {
      errors.push(`Character "${c.id}" needs a label and a tagline`);
    }
    errors.push(...findAbilityErrors(c.ability, `Character "${c.id}" ability`));
    if (c.ability.kind === "bombard" && c.attackKind !== "lob") {
      errors.push(`Character "${c.id}" bombard ability needs a lob attack`);
    }
    if (c.attackKind === "lob") {
      const lob = c.lob;
      if (!lob) errors.push(`Character "${c.id}" lobs but has no lob stats`);
      else if (!isPositive(lob.flightSeconds) || !isPositive(lob.splashRadius)) {
        errors.push(`Character "${c.id}" lob flight and splash must be > 0`);
      } else if (!(lob.minRange >= 0 && lob.minRange < c.attackRange)) {
        errors.push(`Character "${c.id}" lob min range must be in [0, attackRange)`);
      }
    }
  }

  if (data.maps.length === 0) errors.push("No maps defined");
  checkUniqueIds("map", data.maps, errors);
  for (const m of data.maps) {
    if (m.label.trim() === "") errors.push(`Map "${m.id}" has an empty label`);
    errors.push(...findLayoutErrors(m, `Map "${m.id}"`));
  }
  // The walkability check uses one body size: no character may be bigger.
  for (const c of data.characters) {
    if (c.radius > GAME_CONFIG.maps.walkerRadius) {
      errors.push(`Character "${c.id}" is wider than the walkability check (maps.walkerRadius)`);
    }
  }

  checkUniqueIds("resource", data.resources, errors);
  for (const id of RESOURCE_IDS) {
    if (!data.resources.some((r) => r.id === id))
      errors.push(`Missing resource definition "${id}"`);
  }
  for (const r of data.resources) {
    if (!RESOURCE_IDS.includes(r.id)) errors.push(`Unknown resource id "${r.id}"`);
    if (r.label.trim() === "") errors.push(`Resource "${r.id}" has an empty label`);
  }

  checkUniqueIds("upgrade", data.upgrades, errors);
  for (const id of UPGRADE_IDS) {
    if (!data.upgrades.some((u) => u.id === id)) errors.push(`Missing upgrade definition "${id}"`);
  }
  for (const u of data.upgrades) {
    if (u.primary === u.secondary) errors.push(`Upgrade "${u.id}" needs two different resources`);
    for (const r of [u.primary, u.secondary]) {
      if (!data.resources.some((d) => d.id === r))
        errors.push(`Upgrade "${u.id}" uses unknown resource "${r}"`);
    }
  }
  if (data.upgradeLevelCosts.length === 0) errors.push("No upgrade levels defined");
  data.upgradeLevelCosts.forEach((cost, i) => {
    const valid = (n: number) => Number.isInteger(n) && n >= 0;
    if (!valid(cost.primary) || !valid(cost.secondary) || cost.primary + cost.secondary === 0) {
      errors.push(`Upgrade level ${i + 1} has an invalid cost`);
    }
  });

  errors.push(...findPhaseErrors(data.phases, data.matchDurationSeconds));
  return errors;
}

/** Fails fast at startup so bad data never reaches a match. */
export function assertValidGameData(data: GameData): void {
  const errors = findGameDataErrors(data);
  if (errors.length > 0) {
    throw new Error(`Invalid game data:\n- ${errors.join("\n- ")}`);
  }
}

function findAbilityErrors(a: AbilityDefinition, where: string): string[] {
  const errors: string[] = [];
  if (a.label.trim() === "" || a.description.trim() === "") {
    errors.push(`${where} needs a label and a description`);
  }
  if (!isPositive(a.cooldownSeconds)) errors.push(`${where} cooldownSeconds must be > 0`);
  switch (a.kind) {
    case "guard":
      if (!isPositive(a.durationSeconds)) errors.push(`${where} durationSeconds must be > 0`);
      if (!(a.damageTakenFactor >= 0 && a.damageTakenFactor < 1)) {
        errors.push(`${where} damageTakenFactor must be in [0, 1)`);
      }
      break;
    case "dash":
      if (!isPositive(a.distance)) errors.push(`${where} distance must be > 0`);
      break;
    case "volley":
      if (!Number.isInteger(a.projectiles) || a.projectiles < 1) {
        errors.push(`${where} projectiles must be a whole number >= 1`);
      }
      if (!(a.spreadDegrees >= 0 && a.spreadDegrees < 180)) {
        errors.push(`${where} spreadDegrees must be in [0, 180)`);
      }
      break;
    case "spin":
      for (const key of ["rangeFactor", "damageFactor", "knockback"] as const) {
        if (!isPositive(a[key])) errors.push(`${where} ${key} must be > 0`);
      }
      break;
    case "bombard":
      for (const key of ["damageFactor", "splashFactor"] as const) {
        if (!isPositive(a[key])) errors.push(`${where} ${key} must be > 0`);
      }
      break;
  }
  return errors;
}
