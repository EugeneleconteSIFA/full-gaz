import * as THREE from "three";
import { gltfLoader } from "../three/loader";
import type { Obstacle } from "../../world/geometry";
import type { BiomeTheme } from "../theme";
import { supercellMaterial } from "../three/gltfCharacter";

/**
 * Obstacle props built by art/world/props/build.py (docs/12), in world units. Each obstacle of
 * src/data/maps.ts becomes props that match its collision shape exactly:
 * - barrel and crate: used as modelled (the collision has their size);
 * - rock: scaled to the circle's radius;
 * - wall / fence: 1-unit segments tiled along the long side, scaled to the thickness.
 * Rocks and walls are modelled in greys and tinted with the map's biome colour.
 */

type PropName = "barrel" | "crate" | "rock" | "fence_seg" | "fence_post" | "wall_seg";

export type PropLibrary = ReadonlyMap<PropName, THREE.BufferGeometry>;

let library: Promise<PropLibrary> | null = null;

export function loadProps(): Promise<PropLibrary> {
  library ??= gltfLoader().loadAsync("/models/props.glb").then((gltf) => {
    const out = new Map<PropName, THREE.BufferGeometry>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) out.set(mesh.name as PropName, mesh.geometry);
    });
    return out;
  });
  return library;
}

/** The props standing for one obstacle. Materials are shared through `material`. */
export function obstacleProps(
  o: Obstacle,
  props: PropLibrary,
  biome: BiomeTheme,
  material: (tint: number) => THREE.Material,
): THREE.Object3D[] {
  const get = (name: PropName) => {
    const g = props.get(name);
    if (!g) throw new Error(`props.glb has no "${name}"`);
    return g;
  };
  const wood = material(0xffffff);
  if (o.kind === "circle") {
    if (o.look === "barrel")
      return [at(new THREE.Mesh(get("barrel"), wood), o.center.x, o.center.y)];
    const rock = at(new THREE.Mesh(get("rock"), material(biome.rock)), o.center.x, o.center.y);
    rock.scale.setScalar(o.radius);
    // A seeded-looking but stable turn per rock, so a row of rocks does not repeat.
    rock.rotation.y = (o.center.x * 12.9898 + o.center.y * 78.233) % (Math.PI * 2);
    return [rock];
  }
  if (o.look === "crate") return [at(new THREE.Mesh(get("crate"), wood), o.center.x, o.center.y)];

  // Wall or fence: tile 1-unit segments along the long side.
  const alongX = o.halfWidth >= o.halfHeight;
  const length = 2 * (alongX ? o.halfWidth : o.halfHeight);
  const thickness = 2 * (alongX ? o.halfHeight : o.halfWidth);
  const fence = o.look === "fence";
  const segment = get(fence ? "fence_seg" : "wall_seg");
  const mat = fence ? wood : material(biome.wall);
  const n = Math.max(1, Math.round(length));
  const step = length / n;
  const out: THREE.Object3D[] = [];
  for (let i = 0; i < n; i++) {
    const t = -length / 2 + step * (i + 0.5);
    const mesh = new THREE.Mesh(segment, mat);
    mesh.scale.set(step, 1, fence ? 1 : thickness);
    out.push(mesh);
    place(mesh, o.center.x, o.center.y, t, alongX);
  }
  if (fence) {
    const post = new THREE.Mesh(get("fence_post"), wood);
    place(post, o.center.x, o.center.y, length / 2 - 0.09, alongX);
    out.push(post);
  }
  return out;
}

function at(mesh: THREE.Mesh, x: number, y: number): THREE.Mesh {
  mesh.position.set(x, 0, y);
  return mesh;
}

/** Puts a segment at offset `t` along the obstacle's long side, turned to follow it. */
function place(mesh: THREE.Mesh, cx: number, cy: number, t: number, alongX: boolean): void {
  if (alongX) mesh.position.set(cx + t, 0, cy);
  else {
    mesh.position.set(cx, 0, cy + t);
    mesh.rotation.y = Math.PI / 2;
  }
}

/** Props share the characters' material (same ramp, rim and baked occlusion: docs/12 §5). */
export function propMaterialCache(): (tint: number) => THREE.Material {
  const cache = new Map<number, THREE.Material>();
  return (tint) => {
    let m = cache.get(tint);
    if (!m) {
      m = supercellMaterial(tint);
      cache.set(tint, m);
    }
    return m;
  };
}

/** Building model per resource (art/world/buildings/build.py); power = flour (D059). */
export const BUILDING_FOR: Readonly<Partial<Record<string, string>>> = {
  food: "barn",
  wood: "sawmill",
  stone: "quarry",
  metal: "forge",
  power: "windmill",
};

/** Windmill sails: a separate node, spun by the game around this hub (building coordinates). */
export const SAILS_HUB: readonly [number, number, number] = [0, 2.75, 0.84];

let buildings: Promise<ReadonlyMap<string, THREE.BufferGeometry>> | null = null;

export function loadBuildings(): Promise<ReadonlyMap<string, THREE.BufferGeometry>> {
  buildings ??= gltfLoader().loadAsync("/models/buildings.glb").then((gltf) => {
    const out = new Map<string, THREE.BufferGeometry>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) out.set(mesh.name, mesh.geometry);
    });
    return out;
  });
  return buildings;
}
