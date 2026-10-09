import * as THREE from "three";
import { artFor, CHARACTER_MODEL } from "../rendering/characterArt";
import {
  animateGltf,
  loadCharacter,
  supercellMaterial,
  type ModelVariant,
} from "../rendering/three/gltfCharacter";
import { outlinePass } from "../rendering/world3d/World3D";
import { CHARACTER_HEIGHT, CHARACTER_LEAN, PITCH } from "../rendering/world3d/camera";
import { lightingFor } from "../rendering/world3d/lighting";

/**
 * DEV-ONLY character bench (`/lab.html`, not part of the production build): the four characters
 * with the game's real material, light and screen-space outline, in fixed views, to compare
 * versions of the character art (character-3d skill: judge at game size first).
 *
 *   ?v=match|showcase   which model (default match)
 *   ?only=tank           one character
 *   ?mode=black          silhouettes only (readability test)
 *   ?bg=meadow|canyon|dark
 *   ?compare             each character twice: before (public/lab-before/, upper row) / now
 *   ?before=v1           compare with public/lab-before/v1/ instead (an earlier pass)
 *   ?wrap=3              views per row (default: 3 for one model, all six otherwise)
 *   ?face                close-up on the head (eyes, lids, brows), except the phone column
 *   ?samelook            the "before" row uses the current material and light (shape only)
 *
 * Columns: front, three-quarter, profile, back, match camera (lean included), match camera at
 * phone size (the character ~70 px tall).
 */

const params = new URLSearchParams(location.search);
const variant = (params.get("v") ?? "match") as ModelVariant;
const only = params.get("only");
const black = params.get("mode") === "black";
const BG: Record<string, number> = { meadow: 0x8fae69, canyon: 0xc79466, dark: 0x1b2340 };
const bg = BG[params.get("bg") ?? "meadow"] ?? 0x8fae69;
const MODELS: [string, string][] = Object.entries(CHARACTER_MODEL).filter(
  ([id]) => !only || id === only,
);
const compare = params.has("compare");
const ROWS: [string, string, string][] = MODELS.flatMap(([id, model]) =>
  compare
    ? ([
        [id, `before:${params.get("before") ? `${params.get("before")}/` : ""}${model}`, "avant"],
        [id, model, "après"],
      ] as [string, string, string][])
    : ([[id, model, ""]] as [string, string, string][]),
);

const CELL = 260;
const SMALL = 90;
const views = [
  { name: "face", yaw: 0, pitch: 0.08, lean: 0 },
  { name: "3/4", yaw: -0.7, pitch: 0.12, lean: 0 },
  { name: "profil", yaw: -Math.PI / 2, pitch: 0.08, lean: 0 },
  { name: "dos", yaw: Math.PI, pitch: 0.08, lean: 0 },
  // The match camera looks down at PITCH from vertical, i.e. 90° − PITCH below horizontal.
  { name: "match", yaw: -0.5, pitch: Math.PI / 2 - PITCH, lean: CHARACTER_LEAN },
  { name: "téléphone", yaw: -0.5, pitch: Math.PI / 2 - PITCH, lean: CHARACTER_LEAN, small: true },
];

async function main(): Promise<void> {
  // One model: the six views wrap on 2 rows of 3 (bigger on screen); several: one row each.
  const wrap = Number(params.get("wrap")) || (ROWS.length === 1 ? 3 : views.length);
  const cols = wrap;
  const rows = ROWS.length * Math.ceil(views.length / wrap);
  const width = CELL * cols;
  const height = CELL * rows;
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  document.body.append(renderer.domElement);
  // Shown scaled to the window (the image keeps its full resolution).
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "auto";
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    depthTexture: new THREE.DepthTexture(width, height),
  });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 375);
  const post = new THREE.Scene();
  post.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), outlinePass(target, camera)));
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  renderer.setRenderTarget(target);
  renderer.setClearColor(bg);
  renderer.clear();
  // Cells are drawn one by one into the same target: never clear between them.
  renderer.autoClear = false;
  renderer.setScissorTest(true);
  const bar = document.getElementById("bar");
  if (bar) bar.textContent = `${variant} · ${views.map((v) => v.name).join(" · ")}`;

  for (let r = 0; r < ROWS.length; r++) {
    const [id, model] = ROWS[r] as [string, string, string];
    const rig = await loadCharacter(model, variant);
    const box = new THREE.Box3().setFromObject(rig.root);
    rig.root.scale.setScalar(CHARACTER_HEIGHT / Math.max(0.01, box.max.y - box.min.y));
    for (let i = 0; i < 40; i++) {
      animateGltf(rig, {
        run: 0,
        phase: 0,
        attackT: Infinity,
        time: 1 + i * 0.05,
        dt: 0.05,
        expression: artFor(id).signature,
        victoryT: Infinity,
        style: artFor(id).attackStyle,
      });
    }
    // "Before" rows: the previous look too, not only the previous model (world material mode and
    // the old key light from behind), so the comparison is honest.
    const isBefore = model.startsWith("before:") && !params.has("samelook");
    if (isBefore) {
      const old = supercellMaterial(0xffffff, "world");
      rig.root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.material = old;
      });
    }
    if (black) {
      rig.root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
      });
    }
    const leaner = new THREE.Group();
    leaner.add(rig.root);
    const scene = new THREE.Scene();
    // The match's light (lighting.ts), daylight or the Canyon's evening.
    const light = lightingFor(params.get("bg") === "canyon" ? "canyon" : "meadow");
    const key = new THREE.DirectionalLight(light.key, light.keyIntensity);
    key.position.set(...light.keyFrom);
    if (isBefore) key.position.set(-6, 10, -4);
    scene.add(
      key,
      new THREE.HemisphereLight(light.sky, light.groundFill, light.fillIntensity),
      leaner,
    );

    views.forEach((v, k) => {
      const c = k % wrap;
      const rr = r * Math.ceil(views.length / wrap) + Math.floor(k / wrap);
      rig.root.rotation.y = v.yaw;
      leaner.rotation.x = v.lean;
      // Orthographic camera pitched like the view, framing the character.
      const dir = new THREE.Vector3(0, -Math.sin(v.pitch), -Math.cos(v.pitch));
      // ?face: close-up on the head (not the phone column, which shows the real size).
      const close = params.has("face") && !v.small;
      const aimY = close ? 1.42 : 1.1;
      camera.position.copy(
        dir
          .clone()
          .multiplyScalar(-150)
          .add(new THREE.Vector3(0, aimY, 0)),
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(0, aimY, 0);
      const half = v.small ? 1.45 * (CELL / SMALL) : close ? 0.5 : 1.45;
      camera.left = -half;
      camera.right = half;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
      const x = c * CELL;
      const y = (rows - 1 - rr) * CELL;
      if (v.small) {
        // Phone size: drawn small (SMALL px cell) then shown as is, centred in its cell.
        const o = (CELL - SMALL) / 2;
        camera.left = camera.bottom = -1.45;
        camera.right = camera.top = 1.45;
        camera.updateProjectionMatrix();
        target.viewport.set(x + o, y + o, SMALL, SMALL);
        target.scissor.set(x + o, y + o, SMALL, SMALL);
      } else {
        target.viewport.set(x, y, CELL, CELL);
        target.scissor.set(x, y, CELL, CELL);
      }
      // A render target's viewport / scissor are read when it is bound: rebind per cell.
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
    });
  }
  renderer.setScissorTest(false);
  renderer.setRenderTarget(null);
  renderer.autoClear = true;
  renderer.render(post, postCamera);
  document.title = "lab ready";
}

void main();
