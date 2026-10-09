import type { MapId } from "../../core/types";

/**
 * The single light of a map (docs/12 §2): one key light from the top-left of the screen plus a
 * sky / ground fill, shared by characters and world. Every map is in daylight except the Canyon,
 * at the end of the day (roadmap decision): only the light's colour and height change, never the
 * ground, so the value gap between ground and characters (and the team red) stays intact.
 */
export interface MapLighting {
  readonly key: number;
  readonly keyIntensity: number;
  /** Direction the key light comes from (x left/right, y up, z toward the viewer). */
  readonly keyFrom: readonly [number, number, number];
  readonly sky: number;
  readonly groundFill: number;
  readonly fillIntensity: number;
}

const DAY: MapLighting = {
  key: 0xffffff,
  keyIntensity: 2.6,
  // Up, left and slightly toward the viewer: faces and building fronts (which face the camera)
  // are on the lit side. Was z = -4 (from behind): every face sat in shadow (docs/10 v2).
  keyFrom: [-6, 10, 3],
  sky: 0xdfe8ff,
  groundFill: 0x5a4a6a,
  fillIntensity: 1.1,
};

/** Low warm sun from the left, violet sky fill: warm lit sides, cool violet shadows. */
const SUNSET: MapLighting = {
  key: 0xffc48a,
  keyIntensity: 2.5,
  keyFrom: [-10, 5.5, 2.5],
  sky: 0xc2a8e6,
  groundFill: 0x5b3f5e,
  fillIntensity: 1.15,
};

const BY_MAP: Readonly<Partial<Record<MapId, MapLighting>>> = { canyon: SUNSET };

export function lightingFor(mapId: MapId): MapLighting {
  return BY_MAP[mapId] ?? DAY;
}
