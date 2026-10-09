import * as THREE from "three";
import { GAME_CONFIG } from "../../config/gameConfig";
import type { BaseState } from "../../core/MatchState";
import type { BaseOwner } from "../../core/types";
import { THEME } from "../theme";
import { flat } from "./CharacterView3D";
import { BADGE_RADIUS, resourceBadgeTexture } from "./resourceBadge";

const RADIUS = GAME_CONFIG.capture.radius;
/** The building stands at the back of its zone, so whoever captures stays in front of it. */
const BUILDING_BACK = RADIUS * 0.55;

/** Where the flag pole stands on each building model (its top), relative to the building. */
export const FLAG_SPOT: Readonly<Record<string, readonly [number, number, number]>> = {
  barn: [0, 2.95, 0.2],
  sawmill: [0, 2.7, 0],
  quarry: [0.85, 3.0, -0.55],
  forge: [-0.6, 1.85, -0.3],
  windmill: [0, 3.5, 0],
};
/** Sails spin while the base is owned, radians per second (as the 2D rotor). */
const SAILS_SPIN = 1.6;
const POLE = 1.1;

/**
 * One base: its building (art/world/buildings/build.py; a placeholder block until the model is
 * loaded, and for the resource whose building is not modelled yet), a pole on top whose flag
 * carries the owner, and on
 * the ground the zone, its ring, the capture progress arc and a pulsing ring while contested.
 * Ownership never relies on color alone: the flag is round for team A, a diamond for team B.
 */
export class BaseView3D {
  readonly root = new THREE.Group();
  private readonly zone: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly progress: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly contested: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly flags: Record<BaseOwner, THREE.Mesh>;
  private readonly building: THREE.Group;
  private buildingMaterial: THREE.Material | null = null;
  private sails: THREE.Mesh | null = null;
  private lastTime = 0;
  /** Pole and flags: moved onto the building's top once its model is in. */
  private readonly mast = new THREE.Group();
  private shownOwner: BaseOwner | null = null;
  private shownProgress = -1;

  constructor(x: number, y: number, base: BaseState, material: (color: number) => THREE.Material) {
    this.root.position.set(x, 0, y);
    this.zone = flat(
      new THREE.CircleGeometry(RADIUS, 48),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, depthWrite: false }),
      0.01,
    ) as typeof this.zone;
    this.ring = flat(
      new THREE.RingGeometry(RADIUS - 0.12, RADIUS, 64),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false }),
      0.012,
    ) as typeof this.ring;
    this.progress = flat(
      new THREE.RingGeometry(RADIUS - 0.3, RADIUS - 0.12, 64, 1, 0, 0.01),
      new THREE.MeshBasicMaterial({ depthWrite: false }),
      0.014,
    ) as typeof this.progress;
    this.contested = flat(
      new THREE.RingGeometry(RADIUS, RADIUS + 0.18, 64),
      new THREE.MeshBasicMaterial({
        color: THEME.base.contested,
        transparent: true,
        depthWrite: false,
      }),
      0.016,
    ) as typeof this.contested;

    const building = new THREE.Group();
    building.position.z = -BUILDING_BACK;
    this.building = building;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.6, 1.4),
      material(THEME.resources[base.resourceId]),
    );
    block.position.y = 0.8;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.9, 4), material(0x8a5a3c));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 2.05;
    building.add(block, roof);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, POLE, 8),
      material(0xf4eee0),
    );
    pole.position.y = POLE / 2;
    this.mast.add(pole);
    this.mast.position.set(0.9, 2.5, -BUILDING_BACK);
    this.flags = {
      neutral: this.flag(material(THEME.teams.neutral.primary), "ring"),
      teamA: this.flag(material(THEME.teams.teamA.primary), "circle"),
      teamB: this.flag(material(THEME.teams.teamB.primary), "diamond"),
    };
    // Resource badge on the ground, in front of the building (as in the 2D view).
    const badge = flat(
      new THREE.CircleGeometry(BADGE_RADIUS, 32),
      new THREE.MeshBasicMaterial({
        map: resourceBadgeTexture(base.resourceId),
        transparent: true,
        depthWrite: false,
      }),
      0.018,
    );
    badge.position.z = RADIUS * THEME.base.resourceIconOffset;
    this.root.add(this.zone, this.ring, this.progress, this.contested, badge, building, this.mast);
  }

  private flag(material: THREE.Material, symbol: "ring" | "circle" | "diamond"): THREE.Mesh {
    const geometry =
      symbol === "diamond"
        ? new THREE.CircleGeometry(0.45, 4)
        : symbol === "circle"
          ? new THREE.CircleGeometry(0.4, 24)
          : new THREE.RingGeometry(0.22, 0.4, 24);
    const mesh = new THREE.Mesh(geometry, material);
    // The flag flies from the top of the pole, toward the right.
    mesh.position.set(0.42, POLE - 0.3, 0);
    mesh.visible = false;
    this.mast.add(mesh);
    return mesh;
  }

  /** Replaces the placeholder block by the building model; the flag moves to its top. */
  /** World position of the flag (where capture confetti pops out). */
  flagPosition(): THREE.Vector3 {
    this.root.updateMatrixWorld();
    return this.mast.localToWorld(new THREE.Vector3(0.4, POLE, 0));
  }

  /** Adds the windmill's sails at their hub; they turn while the base is owned. */
  useSails(sails: THREE.Mesh, hub: readonly [number, number, number]): void {
    sails.position.set(hub[0], hub[1], hub[2]);
    this.sails = sails;
    this.building.add(sails);
  }

  useModel(model: THREE.Mesh, flagSpot: readonly [number, number, number]): void {
    this.building.clear();
    // Own material copy: this building fades alone when someone walks behind it.
    const material = (model.material as THREE.Material).clone();
    material.transparent = true;
    model.material = material;
    this.buildingMaterial = material;
    this.building.add(model);
    this.mast.position.set(flagSpot[0], flagSpot[1], flagSpot[2] - BUILDING_BACK);
  }

  /**
   * True when a body at world (x, y) is hidden by this building: behind it (smaller y) and
   * within its width. The building then fades so nobody fights unseen (as in the 2D view).
   */
  hides(x: number, y: number): boolean {
    const bx = this.root.position.x;
    const by = this.root.position.z - BUILDING_BACK;
    return Math.abs(x - bx) < 1.7 && y < by + 0.4 && y > by - 2.8;
  }

  /** Eases the building's opacity toward faded (someone behind) or opaque. */
  fade(hiding: boolean, dt: number): void {
    const m = this.buildingMaterial;
    if (!m) return;
    const target = hiding ? 0.38 : 1;
    m.opacity += (target - m.opacity) * Math.min(1, dt * 12);
    // Opaque buildings stay in the opaque pass (cheaper, correct depth).
    m.transparent = m.opacity < 0.99;
    m.depthWrite = !m.transparent;
  }

  update(base: BaseState, time: number): void {
    if (base.owner !== this.shownOwner) {
      this.shownOwner = base.owner;
      const color = THEME.teams[base.owner].primary;
      this.zone.material.color.setHex(color);
      this.ring.material.color.setHex(color);
      for (const [owner, mesh] of Object.entries(this.flags)) mesh.visible = owner === base.owner;
    }
    const progress = base.captureTeam ? base.captureProgress : 0;
    if (Math.abs(progress - this.shownProgress) > 0.004) {
      this.shownProgress = progress;
      this.progress.visible = progress > 0;
      if (progress > 0 && base.captureTeam) {
        this.progress.geometry.dispose();
        // Clockwise from 12 o'clock, as seen from the camera.
        this.progress.geometry = new THREE.RingGeometry(
          RADIUS - 0.3,
          RADIUS - 0.12,
          64,
          1,
          Math.PI / 2 - progress * Math.PI * 2,
          progress * Math.PI * 2,
        );
        this.progress.material.color.setHex(THEME.teams[base.captureTeam].primary);
      }
    }
    if (this.sails && base.owner !== "neutral") {
      this.sails.rotation.z -= SAILS_SPIN * Math.max(0, Math.min(0.1, time - this.lastTime));
    }
    this.lastTime = time;
    this.contested.visible = base.contested;
    if (base.contested) this.contested.material.opacity = 0.55 + 0.45 * Math.sin(time * 12);
  }
}
