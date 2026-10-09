import * as THREE from "three";
import { gltfLoader } from "./loader";
import {
  blinkAmount,
  easeExpression,
  EXPRESSIONS,
  gaze,
  SHOUT,
  type Expression,
  type ExpressionName,
} from "./face";

/**
 * A character built by the Blender pipeline (art/characters/<id>/build.py → art/out/models,
 * packed into public/models/<id>.glb),
 * rendered with the shared Supercell-style material and animated procedurally by bone name.
 *
 * Material (character-3d skill §6): vertex colours (RGB) with baked ambient occlusion (alpha),
 * a soft 2-tone ramp whose shadow is a cool hue-shifted tint (not grey), a Fresnel rim light and
 * a slight vertical gradient (feet darker than the head).
 */

/** The shared light ramp (characters and world use the same one: one art direction). */
export const RAMP = (() => {
  // 4 texels, linear filtered: soft terminator. Shadow tinted violet-blue, light warm.
  const data = new Uint8Array([
    // Lit side = the pure albedo (white), so colours stay clean; shadow cool and saturated.
    132, 118, 186, 255, 168, 152, 212, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  ]);
  const t = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
})();

/**
 * The characters' own ramp (docs/10 v2): a crisper terminator than the world's (8 texels, the
 * light/shadow switch within one eighth of the range) and a saturated violet shadow, so volumes
 * read as graphic light and shadow instead of a soft pastel gradient.
 */
const CHARACTER_RAMP = (() => {
  const shadow = [150, 126, 196, 255];
  const lit = [255, 255, 255, 255];
  const data = new Uint8Array([
    ...shadow,
    ...shadow,
    ...shadow,
    ...shadow,
    ...lit,
    ...lit,
    ...lit,
    ...lit,
  ]);
  const t = new THREE.DataTexture(data, 8, 1, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
})();

/**
 * The look parameters of the two material modes. "world" is the world's look (unchanged by the
 * character art pass); "character" (docs/10 v2) is punchier: less fill (contrast between lit and
 * shadow sides, and no clipping to white on the lit side, the cause of the pastel look), coloured
 * occlusion instead of grey, a warm narrow rim, a milder vertical gradient, and stylised
 * specular highlights where the model says the surface is glossy (eyes, snouts, metal).
 */
const LOOK = {
  world: {
    key: 1.0,
    fill: 1.0,
    ao: "vec3(0.78)",
    grad: "0.92",
    rim: "vec3(0.62, 0.74, 1.0) * 0.35",
    spec: 0.0,
  },
  character: {
    key: 1.0,
    fill: 0.45,
    ao: "vec3(0.72, 0.62, 0.8)",
    grad: "0.96",
    rim: "vec3(1.0, 0.95, 0.86) * 0.3",
    spec: 0.6,
  },
} as const;

/**
 * The shared Supercell-style material (characters and world props). `tint` multiplies the
 * vertex colours: props painted in greys take the map's biome colour this way.
 * Vertex data: RGB = albedo, A = baked occlusion; characters also carry a per-vertex gloss
 * (attribute `aGloss`, from the build's "Gloss" UV map).
 */
export function supercellMaterial(
  tint = 0xffffff,
  mode: keyof typeof LOOK = "world",
): THREE.MeshToonMaterial {
  const look = LOOK[mode];
  const mat = new THREE.MeshToonMaterial({
    color: tint,
    gradientMap: mode === "character" ? CHARACTER_RAMP : RAMP,
    vertexColors: true,
  });
  // The two modes share this function's source: key the compiled program by mode.
  mat.customProgramCacheKey = () => `supercell-${mode}`;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "void main() {",
        "attribute float aGloss;\nvarying float vHeight;\nvarying float vGloss;\nvoid main() {",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvHeight = position.y;\nvGloss = aGloss;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "varying float vHeight;\nvarying float vGloss;\nvoid main() {")
      // RGB is the albedo; alpha carries the baked occlusion (never transparency).
      .replace(
        "#include <color_fragment>",
        "diffuseColor.rgb *= vColor.rgb;\nfloat bakedAO = vColor.a;",
      )
      .replace(
        "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;",
        `vec3 outgoingLight = reflectedLight.directDiffuse * ${look.key.toFixed(2)} + reflectedLight.indirectDiffuse * ${look.fill.toFixed(2)} + totalEmissiveRadiance;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `outgoingLight *= mix(${look.ao}, vec3(1.0), bakedAO);
outgoingLight *= mix(${look.grad}, 1.02, smoothstep(0.0, 2.8, vHeight));
float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
outgoingLight += ${look.rim} * rim * bakedAO;
#if NUM_DIR_LIGHTS > 0
if (${look.spec.toFixed(2)} > 0.0 && vGloss > 0.01) {
  // Stylised highlight: a crisp spot, sharper and stronger on glossier surfaces.
  vec3 H = normalize(directionalLights[0].direction + normalize(vViewPosition));
  // Broad enough to be seen on a 100 px character; glossier = tighter and brighter.
  float s = pow(max(dot(normal, H), 0.0), mix(6.0, 28.0, vGloss));
  // Metals (gloss >= 0.7: copper, iron) take a highlight tinted by their own colour, so copper
  // shines copper, not plastic white; eyes, snouts and beaks keep a white glint.
  vec3 specColor = mix(vec3(1.0, 0.98, 0.92), diffuseColor.rgb * 1.7, smoothstep(0.65, 0.8, vGloss));
  outgoingLight += specColor * smoothstep(0.3, 0.45, s) * vGloss * ${look.spec.toFixed(2)};
}
#endif
#include <opaque_fragment>`,
      );
  };
  return mat;
}

export interface GltfRig {
  readonly root: THREE.Object3D;
  readonly bones: Map<string, THREE.Bone>;
  readonly rest: Map<string, { q: THREE.Quaternion; p: THREE.Vector3; world: THREE.Quaternion }>;
  /** Swappable mouth decals by shape (grin, smirk, frown, o, shout). */
  readonly mouths: Map<string, THREE.Mesh[]>;
  readonly expr: Expression;
  /** This instance's material (hit flash: emissive). */
  readonly material: THREE.MeshToonMaterial;
}

/** "showcase": the full model (viewer); "match": the light version (make_match.py). */
export type ModelVariant = "showcase" | "match";

const cache = new Map<string, Promise<THREE.Group>>();

/**
 * The build writes each vertex's gloss in the U of the "Gloss" UV map (TEXCOORD_0): move it to
 * a one-float `aGloss` attribute (half the data) that the character shader reads.
 */
function glossFromUv(mesh: THREE.Mesh): void {
  const uv = mesh.isMesh ? mesh.geometry.getAttribute("uv") : undefined;
  if (!uv) return;
  const gloss = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i++) gloss[i] = uv.getX(i);
  mesh.geometry.setAttribute("aGloss", new THREE.BufferAttribute(gloss, 1));
  mesh.geometry.deleteAttribute("uv");
}

/** Loads (once) and instantiates a character: a fresh clone with its own skeleton. */
export async function loadCharacter(
  id: string,
  variant: ModelVariant = "showcase",
): Promise<GltfRig> {
  // `before:` prefix: the dev bench's saved copy of the previous models (public/lab-before/).
  const before = id.startsWith("before:");
  const name = before ? id.slice(7) : id;
  const url = `/${before ? "lab-before" : "models"}/${name}${variant === "match" ? ".match" : ""}.glb`;
  let p = cache.get(url);
  if (!p) {
    p = gltfLoader()
      .loadAsync(url)
      .then((g) => {
        g.scene.traverse((o) => glossFromUv(o as THREE.Mesh));
        return g.scene;
      })
      .catch((error: unknown) => {
        // Never cache a failure: the next request retries the download.
        cache.delete(url);
        throw error;
      });
    cache.set(url, p);
  }
  const { clone } = await import("three/addons/utils/SkeletonUtils.js");
  const root = clone(await p);
  const mat = supercellMaterial(0xffffff, "character");
  const bones = new Map<string, THREE.Bone>();
  const mouths = new Map<string, THREE.Mesh[]>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) mesh.material = mat;
    const m = /^mouth_([a-z]+)_/.exec(mesh.isMesh ? mesh.name : "");
    if (m?.[1]) mouths.set(m[1], [...(mouths.get(m[1]) ?? []), mesh]);
    if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
  });
  root.updateMatrixWorld(true);
  const rest = new Map<
    string,
    { q: THREE.Quaternion; p: THREE.Vector3; world: THREE.Quaternion }
  >();
  for (const [name, b] of bones) {
    rest.set(name, {
      q: b.quaternion.clone(),
      p: b.position.clone(),
      world: b.getWorldQuaternion(new THREE.Quaternion()),
    });
  }
  return { root, bones, rest, mouths, expr: { ...EXPRESSIONS.teigneux }, material: mat };
}

const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();

/** Rotates a bone from its rest pose by Euler angles expressed in the CHARACTER's axes. */
function rot(rig: GltfRig, name: string, x: number, y = 0, z = 0): void {
  const b = rig.bones.get(name);
  const r = rig.rest.get(name);
  if (!b || !r) return;
  tmpQ.setFromEuler(tmpE.set(x, y, z));
  // local = rest * (restWorld^-1 * q * restWorld): the rotation q about character axes,
  // re-expressed in the bone's own frame.
  const local = r.world.clone().invert().multiply(tmpQ).multiply(r.world);
  b.quaternion.copy(r.q).multiply(local);
}

/** Moves a bone from its rest position by an offset in the character's axes. */
function shift(rig: GltfRig, name: string, x: number, y: number, z: number): void {
  const b = rig.bones.get(name);
  const r = rig.rest.get(name);
  if (!b || !r || !b.parent) return;
  const parentWorld = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  tmpV.set(x, y, z).applyQuaternion(parentWorld);
  b.position.copy(r.p).add(tmpV);
}

/**
 * How a character attacks, all with the tool in the left hand (same skeleton for the roster):
 * thrust = Gaston's fork, smash = Patatras's pan over the head, sweep = Pépin's rake swiped
 * across, shoot = Lorgnon's recoil.
 */
export type AttackStyle = "thrust" | "smash" | "sweep" | "shoot";

/** The ability being played, `t` seconds after use (see data/abilities.ts). */
export interface AbilityMotion {
  readonly kind: "guard" | "dash" | "volley" | "spin" | "bombard";
  readonly t: number;
}

export interface Motion {
  run: number;
  phase: number;
  attackT: number;
  /** Default "thrust" (the viewer). */
  style?: AttackStyle;
  ability?: AbilityMotion | null;
  time: number;
  dt: number;
  expression: ExpressionName;
  victoryT: number;
}

/**
 * Procedural animation (character-3d skill §8): bouncy run with lean, breathing idle,
 * fork thrust (anticipation → snap → recovery), victory hops with the free fist pumped,
 * expressions eased, blink, secondary motion on ears and tail.
 */
export function animateGltf(rig: GltfRig, m: Motion): void {
  const swing = Math.sin(m.phase) * 0.7 * m.run;
  const bob = Math.abs(Math.sin(m.phase)) * 0.1 * m.run;
  const breathe = Math.sin(m.time * 2 * Math.PI * 0.8) * 0.025 * (1 - m.run);
  rot(rig, "thighL", swing);
  rot(rig, "thighR", -swing);
  const att = ATTITUDE[m.style ?? "thrust"];
  rot(rig, "spine", 0.2 * m.run + breathe * 0.4 + att.lean);
  // Joy is shown by the whole body: a light bounce and the head swaying side to side.
  const joy = m.expression === "joyeux" || Number.isFinite(m.victoryT) ? 1 : 0;
  const sway = Math.sin(m.time * 4.2) * 0.13 * joy;
  rot(
    rig,
    "head",
    -0.12 * m.run + Math.sin(m.phase * 2) * 0.04 * m.run - 0.06 * joy + att.chin,
    0,
    sway + att.headRoll,
  );
  rot(rig, "upperarmR", -swing * 0.9, 0, -att.armsOut);
  const flap = Math.sin(m.phase * 2 - 0.6) * 0.4 * m.run + Math.sin(m.time * 1.7) * 0.05;
  rot(rig, "earL", 0, 0, flap);
  rot(rig, "earR", 0, 0, -flap);
  rot(rig, "tail", 0, Math.sin(m.time * (m.run > 0.1 ? 18 : 7)) * 0.5);

  let rootY = bob + Math.abs(Math.sin(m.time * 4.2)) * 0.08 * joy * (1 - m.run);
  let squash = 0;
  const victory = Number.isFinite(m.victoryT);
  if (victory) {
    const v = victoryPose(rig, m.style ?? "thrust", m.victoryT);
    rootY = v.rootY;
    squash = v.squash;
  }
  const hips = rig.bones.get("hips");
  if (hips) shift(rig, "hips", 0, rootY, 0);
  if (hips) hips.scale.set(1 + squash * 0.1, 1 - squash * 0.14, 1 + squash * 0.1);

  const t = m.attackT;
  const pose = attackPose(m.style ?? "thrust", t, swing);
  rot(rig, "upperarmL", pose.arm, 0, pose.armZ + att.armsOut);
  rot(rig, "forearmL", pose.forearm);
  rot(rig, "hips", pose.lean, pose.twist, att.hipRoll * (1 - m.run));
  if (pose.squash !== 0 && hips) {
    hips.scale.set(1 + pose.squash * 0.08, 1 - pose.squash * 0.12, 1 + pose.squash * 0.08);
  }
  playAbility(rig, m.ability ?? null, hips ?? null);
  // Patatras's corkscrew tail springs straight on the pan's impact (roadmap step 6 gag):
  // stretched along the bone and thinned, so the spiral uncoils.
  const tail = rig.bones.get("tail");
  if (tail) {
    const k = pose.tailStretch;
    tail.scale.set(1 - 0.45 * k, 1 + 1.2 * k, 1 - 0.45 * k);
  }

  // --- Face (face.ts): ease, then map controls to bones with the coupling rules ---
  const target = victory ? EXPRESSIONS.victorieux : t < 0.4 ? SHOUT : EXPRESSIONS[m.expression];
  const e = rig.expr;
  easeExpression(e, target, m.dt);
  const browDown = Math.max(0, -(e.browIn + e.browOut) / 2);
  const smile = Math.max(0, (e.cornerL + e.cornerR) / 2);
  const blink = blinkAmount(m.time % 600);
  const look = gaze(m.time % 600);
  // Upper lid: coverage of the eye from the top (0 open .. 1 shut). Follows the brow down and
  // the gaze down. The cap is built folded back by 2 rad; asin maps coverage to its angle.
  const cover = Math.max(
    blink,
    Math.min(1, Math.max(0, 0.18 + 0.45 * e.lidUp + 0.25 * browDown - look.pitch)),
  );
  const upper = 2.0 + Math.asin(2 * cover - 1);
  // Lower lid: rises with the smile (Duchenne) and with a glare.
  const low = Math.min(0.4, Math.max(0, 0.03 + 0.22 * e.lidLow + 0.15 * smile));
  const lower = -(2.0 + Math.asin(2 * low - 1));
  for (const [n, s] of [
    ["L", 1],
    ["R", -1],
  ] as const) {
    rot(rig, `lid${n}`, upper);
    rot(rig, `lidlow${n}`, lower);
    rot(rig, `eye${n}`, look.pitch, look.yaw);
    // (Pupil size is painted on the eyeball now: no scaling, which would shrink the ball.)
    // Brow: average height, tilt (inner lower = anger), squeeze toward the nose. The mesh is
    // built with a 0.32 rad angry tilt, hence the offset.
    const tilt = (e.browOut - e.browIn) * 0.5;
    shift(
      rig,
      `brow${n}`,
      -s * 0.035 * e.squeeze,
      (0.1 * (e.browIn + e.browOut)) / 2 - 0.02 * e.squeeze,
      0,
    );
    rot(rig, `brow${n}`, 0, 0, s * (tilt - 0.32));
    const corner = n === "L" ? e.cornerL : e.cornerR;
    shift(rig, `corner${n}`, s * 0.05 * e.width, 0.14 * corner, -0.03 * Math.abs(corner));
    const sneer = n === "L" ? e.sneerL : e.sneerR;
    shift(rig, `flew${n}`, 0, 0.07 * sneer, -0.01 * sneer);
  }
  shift(rig, "wrinkle", 0, 0.035 * e.nose, 0);
  // The jaw stays shut: mouth shapes are swapped decals (see below), not a hinge.
  // Mouth swap: the designed mouth that matches the expression (decals built in Blender).
  const shape =
    victory || m.expression === "joyeux" || m.expression === "victorieux"
      ? "grin"
      : t < 0.4
        ? "shout"
        : m.expression === "surpris"
          ? "o"
          : m.expression === "inquiet" || m.expression === "aïe" || m.expression === "grincheux"
            ? "frown"
            : m.expression === "placide"
              ? "smile"
              : "smirk";
  // Birds have no mouth decals: their beak opens with the jaw bone.
  // (jaw 0 = closed: the two halves touch; the inside of the mouth shows only when it opens).
  if (rig.mouths.size === 0) rot(rig, "jaw", Math.max(0, e.jaw - 0.04) * 0.55);
  // Match models keep a single mouth (make_match.py): it stays on whatever the shape asked.
  const shown = rig.mouths.has(shape) ? shape : rig.mouths.keys().next().value;
  for (const [name, meshes] of rig.mouths) for (const mesh of meshes) mesh.visible = name === shown;
}

/**
 * Each character's standing attitude (v2, docs/10): offsets added to the shared animation, so
 * the skeleton and every move stay the same. Radians, character axes.
 * lean: torso forward; chin: head up (+) / down (-); headRoll: head tilt; armsOut: arms held
 * away from the body (silhouette); hipRoll: weight on one leg (faded out while running).
 */
const ATTITUDE: Readonly<
  Record<
    AttackStyle,
    { lean: number; chin: number; headRoll: number; armsOut: number; hipRoll: number }
  >
> = {
  // Patatras: leaning into it, head sunk and tilted, chin a touch up (unimpressed), arms out.
  // chin includes +0.14 to cancel the torso lean: the face stays front-on, only the body leans.
  smash: { lean: 0.14, chin: 0.18, headRoll: 0.08, armsOut: 0.22, hipRoll: 0.06 },
  // Pépin: chest out (leaning back), chin up, head cocked, weight on one leg: cheeky.
  sweep: { lean: -0.06, chin: 0.1, headRoll: -0.1, armsOut: 0.14, hipRoll: 0.08 },
  // Lorgnon: straight, a little arched back, beak in the air: haughty.
  shoot: { lean: -0.05, chin: 0.16, headRoll: 0.05, armsOut: 0.08, hipRoll: 0 },
  // Gaston: leaning in to charge, head low and menacing (the lean only half cancelled), arms out.
  thrust: { lean: 0.12, chin: 0.1, headRoll: 0, armsOut: 0.18, hipRoll: 0.04 },
};

interface AttackPose {
  arm: number;
  armZ: number;
  forearm: number;
  twist: number;
  lean: number;
  squash: number;
  /** 0..1: how straight the corkscrew tail springs (smash only). */
  tailStretch: number;
}

const ease = (k: number) => 1 - Math.pow(1 - k, 3);

/**
 * One attack, timed in 3 beats (character-3d skill §8: anticipation, fast strike, held
 * overshoot then recovery). Rotations about the character's axes; arm x < 0 = forward/up.
 */
function attackPose(style: AttackStyle, t: number, swing: number): AttackPose {
  const p: AttackPose = {
    arm: swing * 0.3,
    armZ: 0,
    forearm: swing * 0.12,
    twist: 0,
    lean: 0,
    squash: 0,
    tailStretch: 0,
  };
  switch (style) {
    case "thrust": {
      // Fork thrust: anticipation 90 ms, snap 110 ms, recovery 200 ms.
      if (t < 0.09) {
        p.arm = 0.5 * (t / 0.09);
        p.twist = 0.25 * (t / 0.09);
      } else if (t < 0.2) {
        const k = ease((t - 0.09) / 0.11);
        p.arm = 0.5 - 1.4 * k;
        p.twist = 0.25 - 0.55 * k;
      } else if (t < 0.4) {
        const k = (t - 0.2) / 0.2;
        p.arm = -0.9 * (1 - k);
        p.twist = -0.3 * (1 - k);
      }
      p.forearm = p.arm * 0.4;
      return p;
    }
    case "smash": {
      // Pan raised high behind the pot (120 ms), slammed down (90 ms), body squashed on impact.
      if (t < 0.12) {
        const k = t / 0.12;
        p.arm = -2.4 * k;
        p.lean = 0.12 * k;
      } else if (t < 0.21) {
        const k = ease((t - 0.12) / 0.09);
        p.arm = -2.4 + 1.9 * k;
        p.lean = 0.12 - 0.32 * k;
        p.squash = k;
        p.tailStretch = k;
      } else if (t < 0.45) {
        const k = (t - 0.21) / 0.24;
        p.arm = -0.5 * (1 - k);
        p.lean = -0.2 * (1 - k);
        p.squash = 1 - k;
        // Springs straight, then curls back with a little wobble.
        p.tailStretch = (1 - k) * (1 + 0.25 * Math.sin(k * 18));
      }
      p.forearm = p.arm * 0.15;
      return p;
    }
    case "sweep": {
      // Rake swiped across: wound to the left (80 ms), whipped right (100 ms), quick recovery.
      if (t < 0.08) {
        const k = t / 0.08;
        p.arm = -0.6 * k;
        p.armZ = 0.6 * k;
        p.twist = 0.5 * k;
      } else if (t < 0.18) {
        const k = ease((t - 0.08) / 0.1);
        p.arm = -0.6 - 0.3 * k;
        p.armZ = 0.6 - 1.5 * k;
        p.twist = 0.5 - 1.1 * k;
      } else if (t < 0.34) {
        const k = (t - 0.18) / 0.16;
        p.arm = -0.9 * (1 - k);
        p.armZ = -0.9 * (1 - k);
        p.twist = -0.6 * (1 - k);
      }
      return p;
    }
    case "shoot": {
      // Recoil: the hose kicks up and the owl rocks back, then settles.
      if (t < 0.05) {
        const k = t / 0.05;
        p.arm = -1.1 - 0.35 * k;
        p.lean = 0.12 * k;
      } else if (t < 0.25) {
        const k = (t - 0.05) / 0.2;
        p.arm = -1.45 + 0.35 * ease(k);
        p.lean = 0.12 * (1 - k);
      } else if (t < 0.45) {
        p.arm = -1.1 * (1 - (t - 0.25) / 0.2);
      }
      return p;
    }
  }
}

/** Whole-body moves of the abilities (layered over the run and the attack). */
function playAbility(rig: GltfRig, a: AbilityMotion | null, hips: THREE.Bone | null): void {
  if (!a || !hips) return;
  switch (a.kind) {
    case "guard": {
      // Ducks under the pot and holds it: squashed, arms tucked, for the guard's duration.
      const k = Math.min(1, a.t / 0.12);
      hips.scale.set(1 + 0.1 * k, 1 - 0.16 * k, 1 + 0.1 * k);
      rot(rig, "upperarmR", -0.3 * k, 0, 0.6 * k);
      rot(rig, "head", 0.25 * k);
      return;
    }
    case "dash": {
      // Stretched forward through the leap, landing squash after.
      if (a.t < 0.18) {
        rot(rig, "spine", 0.6);
        hips.scale.set(0.9, 1.12, 1.1);
      } else if (a.t < 0.32) {
        const k = 1 - (a.t - 0.18) / 0.14;
        hips.scale.set(1 + 0.1 * k, 1 - 0.14 * k, 1 + 0.1 * k);
      }
      return;
    }
    case "spin": {
      // One full turn in 350 ms, arm out.
      if (a.t < 0.35) {
        const k = ease(a.t / 0.35);
        rot(rig, "hips", 0, k * Math.PI * 2);
        rot(rig, "upperarmL", -1.2, 0, 1.0);
      }
      return;
    }
    case "bombard": {
      // A heave: leans back, then throws the whole body forward.
      if (a.t < 0.4) {
        const k = a.t < 0.15 ? a.t / 0.15 : 1 - (a.t - 0.15) / 0.25;
        rot(rig, "spine", a.t < 0.15 ? -0.35 * k : 0.3 * k);
        rot(rig, "upperarmL", -1.4 * k, 0, 0.6 * k);
      }
      return;
    }
    case "volley": {
      // A bigger recoil than a single shot.
      if (a.t < 0.3) rot(rig, "spine", -0.25 * (1 - a.t / 0.3));
      return;
    }
  }
}

/**
 * Signature victory poses, each telling the character's joke (character-3d skill §8, docs/10
 * roster bible). Uses the free right arm; the tool stays in the left hand.
 */
// Head pitch: positive = chin up (head thrown back).
function victoryPose(
  rig: GltfRig,
  style: AttackStyle,
  vt: number,
): { rootY: number; squash: number } {
  const raise = Math.min(1, vt / 0.2);
  switch (style) {
    case "smash": {
      // Patatras, placide: no hop, a slow sway while he pats his belly, eyes half closed.
      rot(rig, "upperarmR", 0.35 * raise, 0, -0.5 * raise);
      rot(rig, "forearmR", -1.3 * raise + Math.abs(Math.sin(vt * 5)) * 0.35 * raise);
      rot(rig, "spine", -0.08 * raise, 0, Math.sin(vt * 2.2) * 0.08);
      return { rootY: 0, squash: 0 };
    }
    case "sweep": {
      // Pépin, insolent: fast little hops, head thrown back crowing, free wing flapping high.
      const hopT = (vt % 0.45) / 0.45;
      rot(rig, "head", 0.45 * raise);
      rot(rig, "upperarmR", -0.3 * raise, 0, (-1.9 + Math.sin(vt * 22) * 0.35) * raise);
      return {
        rootY: Math.sin(hopT * Math.PI) * 0.35,
        squash: hopT < 0.15 ? 1 - hopT / 0.15 : 0,
      };
    }
    case "shoot": {
      // Lorgnon, hautain: a stiff little bow, wing to the monocle, chin up afterwards.
      const bow = vt < 0.6 ? Math.sin((vt / 0.6) * Math.PI) : 0;
      rot(rig, "spine", 0.35 * bow);
      rot(rig, "head", 0.2 * raise * (1 - bow));
      rot(rig, "upperarmR", -1.2 * raise, 0, -1.0 * raise);
      rot(rig, "forearmR", -1.0 * raise);
      return { rootY: 0, squash: 0 };
    }
    case "thrust": {
      // Gaston, teigneux but happy: big hops, free fist pumped up and out (clears the hat brim
      // seen from above).
      const hopT = (vt % 0.75) / 0.75;
      rot(rig, "upperarmR", -0.5 * raise, 0, -2.3 * raise + Math.sin(vt * 8.4) * 0.15 * raise);
      rot(rig, "forearmR", 0, 0, -0.3 * raise);
      return {
        rootY: Math.sin(hopT * Math.PI) * 0.5,
        squash: hopT < 0.12 ? 1 - hopT / 0.12 : 0,
      };
    }
  }
}
