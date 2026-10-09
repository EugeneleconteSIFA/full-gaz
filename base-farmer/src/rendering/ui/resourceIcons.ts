import type Phaser from "phaser";
import * as THREE from "three";
import { gltfLoader } from "../three/loader";
import { RESOURCE_IDS, type ResourceId } from "../../core/types";
import { supercellMaterial } from "../three/gltfCharacter";
import { UI } from "./uiKit";

/**
 * Resource icons (docs/13): the 3D models of art/world/icons/build.py (carrot, log, cut stone,
 * horseshoe, flour sack) rendered once, in the cast's light and material, with an ink outline,
 * onto canvases. Rendered before the first screen (main.ts), so every HUD element can use them
 * synchronously: `resourceIconKey(scene, id)` for Phaser, `resourceIconCanvas(id)` for three.js.
 */

const PX = 160;
const OUTLINE_PX = 7;
const canvases = new Map<ResourceId, HTMLCanvasElement>();

export async function prepareResourceIcons(): Promise<void> {
  if (canvases.size > 0) return;
  const gltf = await gltfLoader().loadAsync("/models/icons.glb");
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(PX, PX, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
  // Three-quarter view from slightly above, like the game camera but gentler.
  camera.position.set(0.9, 2.4, 4.3);
  camera.lookAt(0, 0.45, 0);
  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(-3, 6, 4);
  scene.add(key, new THREE.HemisphereLight(0xdfe8ff, 0x5a4a6a, 1.15));
  const material = supercellMaterial();
  try {
    for (const id of RESOURCE_IDS) {
      const node = gltf.scene.getObjectByName(id) as THREE.Mesh | undefined;
      if (!node?.isMesh) throw new Error(`icons.glb has no "${id}"`);
      const mesh = new THREE.Mesh(node.geometry, material);
      // Fit each icon to the frame (they have different sizes).
      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3());
      const k = 1 / Math.max(size.x, size.y, size.z);
      mesh.scale.setScalar(k);
      mesh.position.set(
        -((box.min.x + box.max.x) / 2) * k,
        -box.min.y * k,
        -((box.min.z + box.max.z) / 2) * k,
      );
      scene.add(mesh);
      renderer.render(scene, camera);
      scene.remove(mesh);
      canvases.set(id, outlined(renderer.domElement));
    }
  } finally {
    renderer.dispose();
  }
}

/** Copies the render with an ink outline around its silhouette (reads on any background). */
function outlined(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = out.height = PX;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("No 2D context for a resource icon");
  // Silhouette in ink: the image stamped around, then recoloured.
  const stamp = document.createElement("canvas");
  stamp.width = stamp.height = PX;
  const sctx = stamp.getContext("2d");
  if (!sctx) throw new Error("No 2D context for a resource icon");
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    sctx.drawImage(source, Math.cos(a) * OUTLINE_PX, Math.sin(a) * OUTLINE_PX);
  }
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = UI.inkCss;
  sctx.fillRect(0, 0, PX, PX);
  ctx.drawImage(stamp, 0, 0);
  ctx.drawImage(source, 0, 0);
  return out;
}

export function resourceIconCanvas(id: ResourceId): HTMLCanvasElement | undefined {
  return canvases.get(id);
}

/** Phaser texture key of a resource icon (registered on first use), or null if not rendered. */
export function resourceIconKey(scene: Phaser.Scene, id: ResourceId): string | null {
  const key = `resicon_${id}`;
  if (scene.textures.exists(key)) return key;
  const canvas = canvases.get(id);
  if (!canvas) return null;
  scene.textures.addCanvas(key, canvas);
  return key;
}
