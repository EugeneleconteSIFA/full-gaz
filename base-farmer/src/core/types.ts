export type TeamId = "teamA" | "teamB";
export type PlayerId = string;
export type CharacterId = string;
export type MapId = string;
export type BaseId = string;

/** A base belongs to a team or to nobody. */
export type BaseOwner = TeamId | "neutral";

export const TEAM_IDS: readonly TeamId[] = ["teamA", "teamB"];

export type PhaseId = "opening" | "development" | "endgame";

/** Stable resource IDs. Display names live in src/data/resources.ts and can change freely. */
export type ResourceId = "food" | "wood" | "stone" | "metal" | "power";

export const RESOURCE_IDS: readonly ResourceId[] = ["food", "wood", "stone", "metal", "power"];

export type UpgradeId = "hp" | "speed" | "range" | "damage" | "fireRate";

export const UPGRADE_IDS: readonly UpgradeId[] = ["hp", "speed", "range", "damage", "fireRate"];
