import type Phaser from "phaser";
import * as THREE from "three";
import { artForModel } from "../characterArt";
import type { ExpressionName } from "./face";
import {
  animateGltf,
  loadCharacter,
  type AttackStyle,
  type GltfRig,
  type ModelVariant,
} from "./gltfCharacter";

/**
 * A small three.js stage rendered off-screen and copied into a Phaser canvas texture every
 * frame, so the 3D character lives inside the Phaser scene like any Image. Camera pitch
 * matches the game's tilted view; one key light from the top-left (the game-art rule) plus a
 * soft fill.
 *
 * Outlines are drawn in screen space: the scene is rendered to a target with its depth, and a
 * composite pass darkens (same hue, x0.55, thin: character-3d skill §6) the pixels of an object that border something
 * clearly farther (silhouette, arm in front of the belly, hat brim over the face). Creases and
 * hollows have no depth jump, so they never get a stray line.
 */
export class Stage3D {
  readonly image: Phaser.GameObjects.Image;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene3 = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  /** Loaded asynchronously from public/models (Blender pipeline). */
  private rig: GltfRig | null = null;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly key: string;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly post = new THREE.Scene();
  private readonly postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private lastTime = 0;
  private readonly style: AttackStyle;

  constructor(
    scene: Phaser.Scene,
    team: { primary: number; dark: number },
    x: number,
    y: number,
    size: number,
    /** Model in public/models (built by art/characters/<id>/build.py). */
    modelId: string,
    /** "match": the light model (result screen, phones); the viewer shows the full one. */
    variant: ModelVariant = "showcase",
  ) {
    // Supersampled (2x the screen pixels, capped) then filtered down: no pixelated edges.
    const px = Math.min(2400, Math.round(size * Math.min(2, window.devicePixelRatio || 1) * 2));
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(px, px, false);
    this.renderer.setClearColor(0x000000, 0);
    this.target = new THREE.WebGLRenderTarget(px, px, {
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(px, px),
    });

    // Showcase pitch: lower than the match camera (asin(tilt) ~ 46 deg) so the face reads.
    const pitch = (12 * Math.PI) / 180; // low: the viewer shows the character face-on
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    const dist = 11;
    this.camera.position.set(0, 1.7 + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
    this.camera.lookAt(0, 1.7, 0);

    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(-4, 7, 5);
    this.scene3.add(key, new THREE.HemisphereLight(0xdfe8ff, 0x5a4a6a, 1.1));

    void team;
    this.style = artForModel(modelId).attackStyle;
    void loadCharacter(modelId, variant).then((rig) => {
      this.rig = rig;
      this.scene3.add(rig.root);
    });
    // Ground shadow: a soft dark disc under the feet.
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 32),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.scene3.add(shadow);

    this.post.add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        outlinePass(this.target, this.camera, 1.6 * (px / size)),
      ),
    );

    this.key = `stage3d_${Math.random().toString(36).slice(2)}`;
    const texture = scene.textures.createCanvas(this.key, px, px);
    if (!texture) throw new Error("Stage3D: canvas texture");
    this.texture = texture;
    this.image = scene.add.image(x, y, this.key).setDisplaySize(size, size);
  }

  render(
    yaw: number,
    run: number,
    phase: number,
    attackT: number,
    time: number,
    expression: ExpressionName,
    victoryT = Infinity,
  ): void {
    const dt = Math.min(0.05, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    if (this.rig) {
      this.rig.root.rotation.y = yaw;
      animateGltf(this.rig, {
        run,
        phase,
        attackT,
        style: this.style,
        time,
        dt,
        expression,
        victoryT,
      });
    }
    this.renderer.setRenderTarget(this.target);
    this.renderer.clear();
    this.renderer.render(this.scene3, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.post, this.postCamera);
    const ctx = this.texture.getContext();
    ctx.clearRect(0, 0, this.texture.width, this.texture.height);
    ctx.drawImage(this.renderer.domElement, 0, 0);
    this.texture.refresh();
  }

  destroy(scene: Phaser.Scene): void {
    this.image.destroy();
    scene.textures.remove(this.key);
    this.target.dispose();
    this.renderer.dispose();
  }
}

/** Composite: colour + depth-jump outline, darkened in the object's own hue. */
function outlinePass(
  target: THREE.WebGLRenderTarget,
  camera: THREE.PerspectiveCamera,
  radiusPx: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: target.texture },
      tDepth: { value: target.depthTexture },
      texel: { value: new THREE.Vector2(1 / target.width, 1 / target.height) },
      radius: { value: radiusPx },
      near: { value: camera.near },
      far: { value: camera.far },
    },
    vertexShader: `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float radius;
uniform float near;
uniform float far;
varying vec2 vUv;
float lin(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return 2.0 * near * far / (far + near - z * (far - near));
}
void main() {
  vec4 c = texture2D(tColor, vUv);
  float dc = lin(vUv);
  float jump = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 o = vec2(cos(a), sin(a)) * texel * radius;
    jump = max(jump, lin(vUv + o) - dc);
  }
  float edge = smoothstep(0.05, 0.12, jump) * step(0.9, c.a);
  c.rgb *= mix(1.0, 0.55, edge);
  gl_FragColor = c;
  #include <colorspace_fragment>
}`,
    depthTest: false,
    depthWrite: false,
  });
}
