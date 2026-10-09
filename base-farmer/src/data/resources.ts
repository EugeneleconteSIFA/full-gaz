import type { ResourceId } from "../core/types";

export interface ResourceDefinition {
  readonly id: ResourceId;
  /** Display name: renamed here only (ids never change). "power" is flour since D059. */
  readonly label: string;
  /** Key of the drawn icon (see src/rendering/resourceIcon.ts). */
  readonly icon: ResourceId;
}

export const RESOURCES: readonly ResourceDefinition[] = [
  { id: "food", label: "Légumes", icon: "food" },
  { id: "wood", label: "Bois", icon: "wood" },
  { id: "stone", label: "Pierre", icon: "stone" },
  { id: "metal", label: "Métal", icon: "metal" },
  { id: "power", label: "Farine", icon: "power" },
];
