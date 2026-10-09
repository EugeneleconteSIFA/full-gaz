import type { CharacterId } from "../core/types";
import type { ExpressionName } from "./three/face";
import type { AttackStyle } from "./three/gltfCharacter";

/**
 * How each 3D model looks and moves, keyed by model file (art/characters/<model>/build.py,
 * public/models/<model>.glb and <model>.match.glb). The only place to edit when a model is added:
 * the match, the selection screen, the portraits, the viewer and the lab all read it.
 * Models listed here but not yet in the roster (hypotheses) can be previewed with
 * `?model=<model>` in the character viewer.
 */
export interface ModelArt {
  /** The attack animation, and the standing attitude that goes with it. */
  readonly attackStyle: AttackStyle;
  /** Default face, kept for the whole match (docs/11). */
  readonly signature: ExpressionName;
}

export const MODEL_ART: Readonly<Record<string, ModelArt>> = {
  gaston: { attackStyle: "thrust", signature: "teigneux" },
  tank: { attackStyle: "smash", signature: "placide" },
  scout: { attackStyle: "sweep", signature: "insolent" },
  shooter: { attackStyle: "shoot", signature: "hautain" },
  cow: { attackStyle: "smash", signature: "placide" },
};

/**
 * Model of each roster character (data/characters.ts id -> MODEL_ART key). A new character gets
 * one line here; tests check that every roster character has one and that its files exist.
 */
export const CHARACTER_MODEL: Readonly<Record<CharacterId, string>> = {
  tank: "tank",
  scout: "scout",
  shooter: "shooter",
  fighter: "gaston", // Gaston's file predates the per-id naming.
  artillery: "cow",
};

const FALLBACK_MODEL = "gaston";

export function modelFor(characterId: CharacterId): string {
  return CHARACTER_MODEL[characterId] ?? FALLBACK_MODEL;
}

export function artForModel(model: string): ModelArt {
  return (
    MODEL_ART[model] ?? MODEL_ART[FALLBACK_MODEL] ?? { attackStyle: "thrust", signature: "neutre" }
  );
}

export function artFor(characterId: CharacterId): ModelArt {
  return artForModel(modelFor(characterId));
}
