import * as THREE from "three";
import { isAlive, type MatchState, type PlayerState } from "../../core/MatchState";
import { animateGltf, loadCharacter, type GltfRig } from "../three/gltfCharacter";
import { artFor, modelFor } from "../characterArt";
import { getCharacter } from "../../data/registry";
import { THEME } from "../theme";
import { CHARACTER_HEIGHT, CHARACTER_LEAN } from "./camera";
import type { Fx3D } from "./Fx3D";

const HIT_FLASH_S = 0.12;
/** Keeps facing the aim this long after an attack or an ability, seconds. */
const FACE_AIM_S = 0.6;
/** Turn speed toward the facing target, 1/s (exponential approach). */
const TURN_RATE = 18;
const RESPAWN_POP_S = 0.35;
/** A captured base is celebrated this long (the signature victory pose), seconds. */
const CHEER_S = 1.8;

/**
 * One player in the 3D world: the light match model (make_match.py), its team ring and contact
 * shadow on the ground, and the guard bubble. Reads PlayerState, never writes it.
 * The face keeps the character's signature expression (no expressions in the match: docs/11).
 */
export class CharacterView3D {
  readonly root = new THREE.Group();
  private rig: GltfRig | null = null;
  private readonly leaner = new THREE.Group();
  private readonly guard: THREE.Mesh;
  private readonly prev = { x: 0, y: 0 };
  private phase = 0;
  private yaw = 0;
  private targetYaw = 0;
  private lastAttackTick: number;
  private lastAbilityTick: number;
  private abilityAtS = -Infinity;
  private lastHp: number;
  private attackAtS = -Infinity;
  private hitAtS = -Infinity;
  private respawnAtS = -Infinity;
  private cheerAtS = -Infinity;
  private wasAlive: boolean;
  readonly ready: Promise<void>;

  constructor(
    private readonly player: PlayerState,
    private readonly fx: Fx3D,
  ) {
    const team = THEME.teams[player.teamId].primary;
    const shadow = flat(
      new THREE.CircleGeometry(0.62, 28),
      new THREE.MeshBasicMaterial({
        color: 0,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
      0.015,
    );
    // Team ring: a circle for team A, a diamond for team B (never color alone: docs/02).
    const ringGeo =
      THEME.teams[player.teamId].symbol === "diamond"
        ? new THREE.RingGeometry(0.62, 0.76, 4, 1, Math.PI / 4)
        : new THREE.RingGeometry(0.56, 0.68, 36);
    const ring = flat(ringGeo, new THREE.MeshBasicMaterial({ color: team }), 0.02);
    this.guard = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 24, 16),
      new THREE.MeshBasicMaterial({
        color: team,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.guard.scale.set(1, 1.25, 1);
    this.guard.position.y = CHARACTER_HEIGHT * 0.45;
    this.guard.visible = false;
    this.leaner.rotation.x = CHARACTER_LEAN;
    this.leaner.add(this.guard);
    this.root.add(shadow, ring, this.leaner);

    this.prev.x = player.position.x;
    this.prev.y = player.position.y;
    this.lastAttackTick = player.attackReadyTick;
    this.lastAbilityTick = player.abilityReadyTick;
    this.lastHp = player.hp;
    this.wasAlive = isAlive(player);
    this.ready = loadCharacter(modelFor(player.characterId), "match").then((rig) => {
      const box = new THREE.Box3().setFromObject(rig.root);
      rig.root.scale.setScalar(CHARACTER_HEIGHT / Math.max(0.01, box.max.y - box.min.y));
      this.leaner.add(rig.root);
      this.rig = rig;
    });
  }

  capturePrevious(): void {
    this.prev.x = this.player.position.x;
    this.prev.y = this.player.position.y;
  }

  /** `time`: seconds since the world started; `dt`: seconds since the last frame. */
  update(state: MatchState, alpha: number, time: number, dt: number): void {
    const p = this.player;
    const alive = isAlive(p);
    if (alive && !this.wasAlive) this.respawnAtS = time;
    if (!alive && this.wasAlive) {
      const at = this.root.position;
      this.fx.knockOut(at.x, CHARACTER_HEIGHT, at.z, time);
    }
    this.wasAlive = alive;
    this.root.visible = alive;
    if (!alive) return;

    const x = this.prev.x + (p.position.x - this.prev.x) * alpha;
    const y = this.prev.y + (p.position.y - this.prev.y) * alpha;
    this.root.position.set(x, 0, y);

    const pop = Math.min(1, (time - this.respawnAtS) / RESPAWN_POP_S);
    this.root.scale.setScalar(pop < 1 ? easeOutBack(pop) : 1);
    this.guard.visible = state.tick < p.guardUntilTick;
    if (this.guard.visible) this.guard.scale.y = 1.25 + 0.04 * Math.sin(time * 12);

    const team = THEME.teams[p.teamId].primary;
    if (p.attackReadyTick > this.lastAttackTick) {
      this.attackAtS = time;
      if (p.stats.attackKind === "melee") this.fx.dust(x, y, time, 3);
    }
    this.lastAttackTick = p.attackReadyTick;
    if (p.abilityReadyTick > this.lastAbilityTick) {
      this.abilityAtS = time;
      this.abilityBurst(x, y, team, time);
    }
    this.lastAbilityTick = p.abilityReadyTick;
    if (p.hp < this.lastHp) {
      this.hitAtS = time;
      // Sparks in the attacker's colour, at chest height (the only enemy team: 1v1 / 2 teams).
      const enemy = THEME.teams[p.teamId === "teamA" ? "teamB" : "teamA"].primary;
      this.fx.impact(x, CHARACTER_HEIGHT * 0.5, y + 0.3, enemy, time);
      // Pépin loses feathers on every hit (roadmap step 6 decision).
      if (p.characterId === "scout") this.fx.feathers(x, CHARACTER_HEIGHT * 0.5, y, time);
    }
    this.lastHp = p.hp;

    const rig = this.rig;
    if (!rig) return;
    // Model faces +z; world aim (x, y) maps to (x, z).
    // Facing (Brawl Stars): toward where the character walks; toward the aim while it attacks or
    // uses its ability (and a moment after), and when standing still. Turned smoothly.
    const speed = Math.hypot(p.velocity?.x ?? 0, p.velocity?.y ?? 0);
    const fighting =
      time - this.attackAtS < FACE_AIM_S ||
      time - this.abilityAtS < FACE_AIM_S ||
      state.tick < p.guardUntilTick;
    const walking = speed > p.stats.moveSpeed * 0.2;
    const celebrating = time - this.cheerAtS < CHEER_S;
    // Celebrating a capture: turned toward the camera (yaw 0 faces the viewer), unless fighting.
    if (celebrating && !fighting) this.targetYaw = 0;
    else if (fighting || !walking) this.targetYaw = Math.atan2(p.aim.x, p.aim.y);
    else this.targetYaw = Math.atan2(p.velocity?.x ?? 0, p.velocity?.y ?? 0);
    // Shortest way round, eased (about 0.1 s for a half turn).
    let delta = this.targetYaw - this.yaw;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.yaw += delta * Math.min(1, dt * TURN_RATE);
    rig.root.rotation.y = this.yaw;
    const run = Math.min(1, speed / Math.max(0.01, p.stats.moveSpeed));
    this.phase += dt * (6 + 6 * run) * run;
    const cheering = celebrating;
    animateGltf(rig, {
      run,
      phase: this.phase,
      attackT: time - this.attackAtS,
      style: artFor(p.characterId).attackStyle,
      ability: this.abilityMotion(state, time),
      time,
      dt,
      expression: cheering ? "joyeux" : artFor(p.characterId).signature,
      victoryT: cheering ? time - this.cheerAtS : Infinity,
    });
    const flash = time - this.hitAtS < HIT_FLASH_S;
    rig.material.emissive.setHex(flash ? 0xffffff : 0x000000);
    rig.material.emissiveIntensity = flash ? 0.6 : 0;
  }

  /** The burst that tells an ability was used (its pose is played by the animation). */
  private abilityBurst(x: number, y: number, team: number, time: number): void {
    const ability = getCharacter(this.player.characterId).ability;
    switch (ability.kind) {
      case "guard":
        this.fx.shockwave(x, y, 1.3, team, time);
        break;
      case "dash":
        // From where the leap started (last tick) to where it landed.
        this.fx.streak(this.prev.x, this.prev.y, x, y, team, time);
        this.fx.dust(this.prev.x, this.prev.y, time);
        this.fx.dust(x, y, time);
        break;
      case "volley":
        this.fx.volley(
          x + this.player.aim.x * 0.8,
          CHARACTER_HEIGHT * 0.5,
          y + this.player.aim.y * 0.8,
          time,
        );
        break;
      case "spin":
        this.fx.shockwave(x, y, this.player.stats.attackRange * ability.rangeFactor, team, time);
        this.fx.dust(x, y, time, 6);
        break;
      case "bombard":
        // The landing is shown by the shell itself (World3D); here, the heave.
        this.fx.dust(x, y, time, 5);
        break;
    }
  }

  /** The ability being played, if any: the guard for its whole duration, others briefly. */
  private abilityMotion(state: MatchState, time: number) {
    const kind = getCharacter(this.player.characterId).ability.kind;
    const t = time - this.abilityAtS;
    if (kind === "guard") return state.tick < this.player.guardUntilTick ? { kind, t } : null;
    return t < 0.5 ? { kind, t } : null;
  }

  /** A base the player stands in was just taken by their team: a short victory hop. */
  cheer(time: number): void {
    this.cheerAtS = time;
  }
}

/** A flat ground decal: lying on the ground at height `y`. */
export function flat(geometry: THREE.BufferGeometry, material: THREE.Material, y: number) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

function easeOutBack(t: number): number {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}
