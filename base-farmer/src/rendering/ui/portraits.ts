import type Phaser from "phaser";
import * as THREE from "three";
import { CHARACTERS } from "../../data/characters";
import { animateGltf, loadCharacter } from "../three/gltfCharacter";
import { artFor, modelFor } from "../characterArt";

/**
 * Character portraits for the interface (roadmap step 7): each character rendered once from its
 * 3D model (the light match version), three-quarter front view, signature expression, in the
 * game's light, onto a transparent canvas registered as the Phaser texture `portraitKey(id)`.
 * Selection cards, the score mini-map and the result screen use them: the interface shows the
 * same characters as the match.
 */

const PX = 320;

export function portraitKey(characterId: string): string {
  return `portrait3d_${characterId}`;
}

let rendering: Promise<void> | null = null;

/** Renders every portrait once per game (later calls return the same promise). */
export function ensurePortraits(game: Phaser.Game): Promise<void> {
  rendering ??= renderAll(game).catch((error: unknown) => {
    rendering = null;
    throw error;
  });
  return rendering;
}

async function renderAll(game: Phaser.Game): Promise<void> {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(PX, PX, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  const pitch = (16 * Math.PI) / 180;
  const dist = 10.5;
  camera.position.set(0, 1.55 + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  camera.lookAt(0, 1.55, 0);
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(-4, 7, 5);
  scene.add(key, new THREE.HemisphereLight(0xdfe8ff, 0x5a4a6a, 1.1));

  try {
    for (const character of CHARACTERS) {
      const rig = await loadCharacter(modelFor(character.id), "match");
      // Same height for everyone (3.4 units in this framing).
      const box = new THREE.Box3().setFromObject(rig.root);
      rig.root.scale.setScalar(3.1 / Math.max(0.01, box.max.y - box.min.y));
      rig.root.rotation.y = 0; // facing the player (front view)
      // Settle the face on the signature expression (eased: run it for a while).
      for (let i = 0; i < 40; i++) {
        animateGltf(rig, {
          run: 0,
          phase: 0,
          attackT: Infinity,
          time: 1 + i * 0.05,
          dt: 0.05,
          expression: artFor(character.id).signature,
          victoryT: Infinity,
        });
      }
      scene.add(rig.root);
      renderer.render(scene, camera);
      scene.remove(rig.root);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = PX;
      canvas.getContext("2d")?.drawImage(renderer.domElement, 0, 0);
      const k = portraitKey(character.id);
      if (game.textures.exists(k)) game.textures.remove(k);
      game.textures.addCanvas(k, canvas);
    }
  } finally {
    renderer.dispose();
  }
}
