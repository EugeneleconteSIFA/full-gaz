import type { CharacterId, MapId, ResourceId } from "../core/types";
import { CHARACTERS, type CharacterDefinition } from "./characters";
import { MAPS, type MapDefinition } from "./maps";
import { RESOURCES, type ResourceDefinition } from "./resources";

function indexById<T extends { readonly id: string }>(items: readonly T[]): ReadonlyMap<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

const charactersById = indexById(CHARACTERS);
const mapsById = indexById(MAPS);
const resourcesById = indexById(RESOURCES);

export function getCharacter(id: CharacterId): CharacterDefinition {
  const definition = charactersById.get(id);
  if (!definition) throw new Error(`Unknown character id "${id}"`);
  return definition;
}

export function getMap(id: MapId): MapDefinition {
  const definition = mapsById.get(id);
  if (!definition) throw new Error(`Unknown map id "${id}"`);
  return definition;
}

export function getResource(id: ResourceId): ResourceDefinition {
  const definition = resourcesById.get(id);
  if (!definition) throw new Error(`Unknown resource id "${id}"`);
  return definition;
}
