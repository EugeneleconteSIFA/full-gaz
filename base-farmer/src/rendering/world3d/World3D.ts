import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GAME_CONFIG } from "../../config/gameConfig";
import { isAlive, type MatchState } from "../../core/MatchState";
import type { PlayerId, TeamId } from "../../core/types";
import { biomeFor } from "../MapRenderer";
import { RAMP } from "../three/gltfCharacter";
import { BaseView3D, FLAG_SPOT } from "./BaseView3D";
import { createWorldCamera, fitWorldCamera, type ViewRect } from "./camera";
import { CharacterView3D } from "./CharacterView3D";
import { Fx3D } from "./Fx3D";
import { lightingFor } from "./lighting";
import { resourceBadgeTexture } from "./resourceBadge";
import { THEME } from "../theme";
import {
  BUILDING_FOR,
  loadBuildings,
  loadProps,
  obstacleProps,
  propMaterialCache,
  SAILS_HUB,
} from "./props";

const MAX_PROJECTILES = 48;
const PROJECTILE_COLOR = 0xfff4dc;
const MAX_SHELLS = 24;
const CAN_COLOR = 0xf4f1ea;
/** Height of a shell's arc at mid-flight: base + per world unit thrown. */
const SHELL_APEX = 1.8;
const SHELL_APEX_PER_UNIT = 0.22;

export interface WorldStats {
  fps: number;
  frameMs: number;
  calls: number;
  triangles: number;
  /** Milliseconds until every character model was loaded; null while loading. */
  loadedMs: number | null;
}

/**
 * The match world in three.js (D058): ground, obstacles, bases, characters and projectiles, on
 * its own canvas behind the transparent Phaser canvas that keeps the HUD. The camera shows
 * exactly what the Phaser world camera shows (camera.ts), so input and HUD are unchanged.
 * Reads MatchState, never writes it.
 *
 * Shading: one key light from the top-left for everything, the characters' soft ramp shared by
 * the world, and a screen-space outline on depth jumps (cheaper than MSAA, measured in D058).
 * Obstacles are the real props (docs/12); ground and buildings are PLACEHOLDERS until roadmap
 * step 4.
 */
export class World3D {
  readonly canvas: HTMLCanvasElement;
  readonly stats: WorldStats = { fps: 0, frameMs: 0, calls: 0, triangles: 0, loadedMs: null };
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = createWorldCamera();
  private readonly target: THREE.WebGLRenderTarget;
  private readonly post = new THREE.Scene();
  private readonly postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly characters = new Map<PlayerId, CharacterView3D>();
  private readonly fx = new Fx3D();
  private readonly bases: BaseView3D[];
  private readonly shots: THREE.InstancedMesh;
  private readonly shotMatrix = new THREE.Matrix4();
  private readonly shotQuat = new THREE.Quaternion();
  private readonly shotPos = new THREE.Vector3();
  private readonly shotScale = new THREE.Vector3(1, 1, 1);
  private readonly ringScale = new THREE.Vector3(1, 1, 1);
  private readonly ringColor = new THREE.Color();
  private readonly up = new THREE.Vector3(0, 1, 0);
  /** Lobbed milk cans, and the ring on the ground where each one will land (the warning). */
  private readonly cans: THREE.InstancedMesh;
  private readonly landingRings: THREE.InstancedMesh;
  private readonly shellAxis = new THREE.Vector3();
  /** Shells in flight at the last frame: the ones gone since have landed (splash effect). */
  private readonly flyingShells = new Map<
    number,
    { x: number; y: number; r: number; team: TeamId }
  >();
  private readonly seenShells = new Set<number>();
  private readonly lastOwners: string[];
  private readonly materials = new Map<number, THREE.MeshToonMaterial>();
  /** Everything loaded asynchronously (models, props): the load time is measured on it. */
  private readonly loading: Promise<unknown>[] = [];
  private time = 0;
  private lastProductionTick = -1;
  private frames = 0;
  private frameMsSum = 0;
  private windowStart = performance.now();

  constructor(
    private readonly parent: HTMLElement,
    private readonly state: MatchState,
    /** The painted ground (MapRenderer.paintGroundCanvas), laid on the ground plane. */
    groundCanvas: HTMLCanvasElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.canvas = this.renderer.domElement;
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "0",
    });
    parent.style.position = "relative";
    parent.prepend(this.canvas);
    // The Phaser canvas (HUD) must stack above this one.
    for (const c of parent.querySelectorAll("canvas")) {
      if (c !== this.canvas) Object.assign(c.style, { position: "relative", zIndex: "1" });
    }

    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(1, 1),
    });
    this.post.add(
      new THREE.Mesh(new THREE.PlaneGeometry(2, 2), outlinePass(this.target, this.camera)),
    );

    // The map's single light (lighting.ts): daylight, or the Canyon's end of day.
    const light = lightingFor(state.mapId);
    const key = new THREE.DirectionalLight(light.key, light.keyIntensity);
    key.position.set(...light.keyFrom);
    this.scene.add(
      key,
      new THREE.HemisphereLight(light.sky, light.groundFill, light.fillIntensity),
    );

    this.buildGround(groundCanvas);
    this.bases = state.layout.bases.map((b, i) => {
      const base = state.bases[i];
      if (!base) throw new Error(`No state for base "${b.id}"`);
      const view = new BaseView3D(b.position.x, b.position.y, base, (c) => this.material(c));
      this.scene.add(view.root);
      return view;
    });
    this.lastOwners = state.bases.map((b) => b.owner);
    this.loading.push(
      loadBuildings().then((models) => {
        const material = propMaterialCache();
        state.bases.forEach((base, i) => {
          const name = BUILDING_FOR[base.resourceId];
          const geometry = name ? models.get(name) : undefined;
          const spot = name ? FLAG_SPOT[name] : undefined;
          if (geometry && spot) {
            this.bases[i]?.useModel(new THREE.Mesh(geometry, material(0xffffff)), spot);
            const sails = name === "windmill" ? models.get("windmill_sails") : undefined;
            if (sails)
              this.bases[i]?.useSails(new THREE.Mesh(sails, material(0xffffff)), SAILS_HUB);
          }
        });
      }),
    );

    this.shots = new THREE.InstancedMesh(
      featherGeometry(),
      this.material(PROJECTILE_COLOR),
      MAX_PROJECTILES,
    );
    this.shots.count = 0;
    this.shots.frustumCulled = false;
    this.cans = new THREE.InstancedMesh(milkCanGeometry(), this.material(CAN_COLOR), MAX_SHELLS);
    this.cans.count = 0;
    this.cans.frustumCulled = false;
    this.landingRings = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
      MAX_SHELLS,
    );
    this.landingRings.count = 0;
    this.landingRings.frustumCulled = false;
    this.scene.add(this.shots, this.cans, this.landingRings, this.fx.root);

    const start = performance.now();
    for (const p of state.players) {
      const view = new CharacterView3D(p, this.fx);
      this.characters.set(p.id, view);
      this.scene.add(view.root);
    }
    for (const c of this.characters.values()) this.loading.push(c.ready);
    void Promise.all(this.loading).then(() => {
      this.stats.loadedMs = Math.round(performance.now() - start);
    });
    this.resize();
    if (import.meta.env.DEV) (window as unknown as { __world3d: World3D }).__world3d = this;
  }

  /** Same ramp as the characters: the world and the cast share one light model. */
  private material(color: number): THREE.MeshToonMaterial {
    let m = this.materials.get(color);
    if (!m) {
      m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP });
      this.materials.set(color, m);
    }
    return m;
  }

  /** The painted ground (same canvas art as the 2D view: yards, slabs, tufts), unlit. */
  private buildGround(groundCanvas: HTMLCanvasElement): void {
    const { width, height, obstacles } = this.state.layout;
    const biome = biomeFor(this.state.mapId);
    this.renderer.setClearColor(biome.border);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      // Unlit: the ground keeps its value under every light (docs/12 §2: the Canyon's sunset
      // must not turn it muddy red, where team red would get lost).
      new THREE.MeshBasicMaterial({ map: groundTexture(groundCanvas, this.renderer) }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(width / 2, 0, height / 2);
    this.scene.add(ground);
    // Obstacle props (art/world/props/build.py), loaded with the characters.
    const material = propMaterialCache();
    this.loading.push(
      loadProps().then((props) => {
        const meshes = obstacles.flatMap((o) => obstacleProps(o, props, biome, material));
        // Static: merged into one mesh per material (dozens of wall segments = 1 draw call).
        for (const mesh of mergeByMaterial(meshes)) this.scene.add(mesh);
      }),
    );
  }

  capturePrevious(): void {
    for (const c of this.characters.values()) c.capturePrevious();
  }

  resize(): void {
    const w = this.parent.clientWidth || window.innerWidth;
    const h = this.parent.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target.setSize(size.x, size.y);
  }

  /** `view`: the Phaser world camera's worldView. `dt`: seconds since the last frame. */
  render(alpha: number, view: ViewRect, dt: number): void {
    const t0 = performance.now();
    const state = this.state;
    this.time += dt;
    fitWorldCamera(this.camera, view);

    this.noticeCaptures();
    this.noticeProduction();
    for (const c of this.characters.values()) c.update(state, alpha, this.time, dt);
    state.bases.forEach((b, i) => this.bases[i]?.update(b, this.time));
    for (const base of this.bases) {
      let hiding = false;
      for (const p of state.players) {
        if (isAlive(p) && base.hides(p.position.x, p.position.y)) hiding = true;
      }
      base.fade(hiding, dt);
    }
    this.updateShots(alpha);
    this.updateShells(alpha);
    this.fx.update(this.time, this.camera);

    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.render(this.scene, this.camera);
    this.stats.calls = r.info.render.calls;
    this.stats.triangles = r.info.render.triangles;
    r.setRenderTarget(null);
    r.render(this.post, this.postCamera);

    this.frameMsSum += performance.now() - t0;
    this.frames++;
    const now = performance.now();
    if (now - this.windowStart >= 1000) {
      this.stats.fps = Math.round((this.frames * 1000) / (now - this.windowStart));
      this.stats.frameMs = +(this.frameMsSum / this.frames).toFixed(2);
      this.frames = 0;
      this.frameMsSum = 0;
      this.windowStart = now;
    }
  }

  /** Projectiles: one instanced draw, oriented along their flight, extrapolated by alpha. */
  private updateShots(alpha: number): void {
    const step = 1 / GAME_CONFIG.simulation.ticksPerSecond;
    let n = 0;
    for (const s of this.state.projectiles) {
      if (n >= MAX_PROJECTILES) break;
      const speed = Math.hypot(s.velocity.x, s.velocity.y) || 1;
      this.shotPos.set(
        s.position.x + s.velocity.x * step * (alpha - 1),
        0.9,
        s.position.y + s.velocity.y * step * (alpha - 1),
      );
      this.shotQuat.setFromUnitVectors(
        this.up,
        new THREE.Vector3(s.velocity.x / speed, 0, s.velocity.y / speed),
      );
      this.shotMatrix.compose(this.shotPos, this.shotQuat, this.shotScale);
      this.shots.setMatrixAt(n++, this.shotMatrix);
    }
    this.shots.count = n;
    this.shots.instanceMatrix.needsUpdate = true;
  }

  /**
   * Lobbed shells: each can flies on a parabola from the thrower to its landing spot, tumbling;
   * a ring on the ground shows where it will land, shrinking as it falls. A shell gone since the
   * last frame has landed: splash ring, flash and dust there.
   */
  private updateShells(alpha: number): void {
    const now = this.state.tick - 1 + alpha;
    this.seenShells.clear();
    let n = 0;
    for (const s of this.state.shells) {
      if (n >= MAX_SHELLS) break;
      this.seenShells.add(s.id);
      if (!this.flyingShells.has(s.id)) {
        this.flyingShells.set(s.id, { x: s.to.x, y: s.to.y, r: s.splashRadius, team: s.teamId });
      }
      const t = Math.min(1, Math.max(0, (now - s.launchTick) / (s.landTick - s.launchTick)));
      const dx = s.to.x - s.from.x;
      const dy = s.to.y - s.from.y;
      const apex = SHELL_APEX + SHELL_APEX_PER_UNIT * Math.hypot(dx, dy);
      this.shotPos.set(
        s.from.x + dx * t,
        0.9 * (1 - t) + 0.25 * t + 4 * apex * t * (1 - t),
        s.from.y + dy * t,
      );
      // Tumbles end over end around the axis across its flight.
      this.shellAxis.set(-dy, 0, dx).normalize();
      if (this.shellAxis.lengthSq() === 0) this.shellAxis.set(1, 0, 0);
      this.shotQuat.setFromAxisAngle(this.shellAxis, t * Math.PI * 2.5);
      this.shotMatrix.compose(this.shotPos, this.shotQuat, this.shotScale);
      this.cans.setMatrixAt(n, this.shotMatrix);

      const r = s.splashRadius * (1.25 - 0.25 * t);
      this.shotPos.set(s.to.x, 0.06, s.to.y);
      this.shotQuat.identity();
      this.shotMatrix.compose(this.shotPos, this.shotQuat, this.ringScale.set(r, 1, r));
      this.landingRings.setMatrixAt(n, this.shotMatrix);
      // The thrower's team colour: an enemy ring means "get out".
      this.landingRings.setColorAt(n, this.ringColor.setHex(THEME.teams[s.teamId].primary));
      n++;
    }
    this.cans.count = n;
    this.landingRings.count = n;
    this.cans.instanceMatrix.needsUpdate = true;
    this.landingRings.instanceMatrix.needsUpdate = true;
    if (this.landingRings.instanceColor) this.landingRings.instanceColor.needsUpdate = true;

    for (const [id, landed] of this.flyingShells) {
      if (this.seenShells.has(id)) continue;
      this.flyingShells.delete(id);
      const color = THEME.teams[landed.team].primary;
      this.fx.shockwave(landed.x, landed.y, landed.r, color, this.time);
      this.fx.impact(landed.x, 0.4, landed.y, color, this.time);
      this.fx.dust(landed.x, landed.y, this.time, 6);
    }
  }

  /** A production event: each owned base sends up its resource badge, one after another. */
  private noticeProduction(): void {
    const event = this.state.lastProduction;
    if (!event || event.tick === this.lastProductionTick) return;
    this.lastProductionTick = event.tick;
    let delay = 0;
    this.state.bases.forEach((base, i) => {
      const at = this.state.layout.bases[i]?.position;
      if (base.owner === "neutral" || !at) return;
      this.fx.rise(at.x, at.y - 1.4, resourceBadgeTexture(base.resourceId), delay, this.time);
      delay += 0.08;
    });
  }

  /** A base just turned to a team: confetti, and its players standing in the zone cheer. */
  private noticeCaptures(): void {
    const radius = GAME_CONFIG.capture.radius;
    this.state.bases.forEach((base, i) => {
      if (base.owner === this.lastOwners[i]) return;
      this.lastOwners[i] = base.owner;
      const at = this.state.layout.bases[i]?.position;
      if (base.owner === "neutral" || !at) return;
      const flag = this.bases[i]?.flagPosition();
      if (flag) {
        this.fx.confetti(flag.x, flag.y, flag.z, THEME.teams[base.owner].primary, this.time);
      }
      for (const p of this.state.players) {
        if (p.teamId !== base.owner || !isAlive(p)) continue;
        if (Math.hypot(p.position.x - at.x, p.position.y - at.y) > radius) continue;
        this.characters.get(p.id)?.cheer(this.time);
      }
    });
  }

  destroy(): void {
    this.target.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}

/**
 * Lorgnon's shot: a flat feather vane, long axis along +y (the flight direction after
 * rotation).
 */
/** A small milk churn: body, shoulder, neck and lid, standing on its base (Marguerite's shell). */
function milkCanGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.2, 0.22, 0.34, 14).translate(0, 0.17, 0);
  const shoulder = new THREE.CylinderGeometry(0.11, 0.2, 0.1, 14).translate(0, 0.39, 0);
  const neck = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12).translate(0, 0.48, 0);
  const lid = new THREE.CylinderGeometry(0.13, 0.13, 0.04, 12).translate(0, 0.54, 0);
  // Centered on its middle, so it tumbles around itself.
  return (mergeGeometries([body, shoulder, neck, lid]) ?? body)
    .translate(0, -0.28, 0)
    .scale(1.4, 1.4, 1.4);
}

function featherGeometry(): THREE.BufferGeometry {
  // Flat in x: the flight rotation turns the geometry's x vertical, so the vane faces the sky
  // (and the camera) instead of showing its edge.
  const vane = new THREE.SphereGeometry(0.16, 10, 6);
  vane.scale(0.25, 2.1, 0.85);
  return vane;
}

function groundTexture(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Seen at a grazing angle: anisotropic filtering keeps the far ground sharp.
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

/** Bakes each mesh's transform into its geometry and merges the meshes sharing a material. */
function mergeByMaterial(objects: readonly THREE.Object3D[]): THREE.Mesh[] {
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const o of objects) {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) continue;
    mesh.updateMatrix();
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    const material = mesh.material as THREE.Material;
    groups.set(material, [...(groups.get(material) ?? []), geometry]);
  }
  return [...groups].map(([material, geometries]) => {
    const merged = mergeGeometries(geometries);
    if (!merged) throw new Error("Could not merge obstacle geometries");
    return new THREE.Mesh(merged, material);
  });
}

/** Depth-jump outline (same rule as the viewer's Stage3D), for an orthographic camera. */
export function outlinePass(
  target: THREE.WebGLRenderTarget,
  camera: THREE.OrthographicCamera,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: target.texture },
      tDepth: { value: target.depthTexture },
      span: { value: camera.far - camera.near },
    },
    vertexShader: `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float span;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tColor, vUv);
  // Orthographic depth is linear: depth * span is a distance in world units.
  float dc = texture2D(tDepth, vUv).x * span;
  vec2 px = 1.5 / vec2(textureSize(tDepth, 0));
  float jump = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    jump = max(jump, texture2D(tDepth, vUv + vec2(cos(a), sin(a)) * px).x * span - dc);
  }
  c.rgb *= mix(1.0, 0.55, smoothstep(0.08, 0.2, jump));
  gl_FragColor = c;
  #include <colorspace_fragment>
}`,
    depthTest: false,
    depthWrite: false,
  });
}
