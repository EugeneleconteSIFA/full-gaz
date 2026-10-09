import * as THREE from "three";

/**
 * Every effect of the match world, in 3D (roadmap step 6): hits, dust, ability bursts, captures,
 * production, knock-outs. Funny, never violent (docs/11 decisions): feathers off Pépin, a "pouf"
 * of smoke with stars on a knock-out, confetti on a capture.
 *
 * A fixed pool of meshes, each with its own material (colour and fade are per particle): nothing
 * is created or destroyed during a fight. Effects are readable in 0.2 s at phone size.
 */

type Kind =
  | "feather"
  | "puff"
  | "star"
  | "spark"
  | "flash"
  | "dust"
  | "ring"
  | "confetti"
  | "streak"
  | "icon";

interface Particle {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  kind: Kind;
  active: boolean;
  start: number;
  life: number;
  readonly origin: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  spin: number;
  phase: number;
  size: number;
}

const POOL = 160;

function starShape(points: number, outer: number, inner: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return shape;
}

/** Lies flat on the ground (rings): rotated once, then only scaled. */
function flatGeometry(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.rotateX(-Math.PI / 2);
  return g;
}

export class Fx3D {
  readonly root = new THREE.Group();
  private readonly particles: Particle[] = [];
  private next = 0;
  private readonly geometries: Record<Kind, THREE.BufferGeometry>;

  constructor() {
    const feather = new THREE.CapsuleGeometry(0.06, 0.22, 2, 6);
    feather.scale(1, 1, 0.35);
    const streak = new THREE.CapsuleGeometry(0.22, 1, 2, 8);
    streak.rotateZ(Math.PI / 2);
    streak.scale(1, 1, 0.3);
    this.geometries = {
      feather,
      puff: new THREE.SphereGeometry(0.3, 12, 8),
      star: new THREE.ShapeGeometry(starShape(5, 0.2, 0.09)),
      spark: new THREE.ShapeGeometry(starShape(4, 0.16, 0.04)),
      flash: new THREE.ShapeGeometry(starShape(8, 0.55, 0.22)),
      dust: new THREE.SphereGeometry(0.18, 10, 6),
      ring: flatGeometry(new THREE.RingGeometry(0.86, 1, 48)),
      confetti: new THREE.PlaneGeometry(0.16, 0.1),
      streak,
      icon: new THREE.PlaneGeometry(0.9, 0.9),
    };
    for (let i = 0; i < POOL; i++) {
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.geometries.puff, material);
      mesh.visible = false;
      this.root.add(mesh);
      this.particles.push({
        mesh,
        material,
        kind: "puff",
        active: false,
        start: 0,
        life: 1,
        origin: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        spin: 0,
        phase: 0,
        size: 1,
      });
    }
  }

  private spawn(kind: Kind, time: number, life: number, color: number): Particle {
    const p = this.particles[this.next] as Particle;
    this.next = (this.next + 1) % POOL;
    p.kind = kind;
    p.active = true;
    p.start = time;
    p.life = life;
    p.size = 1;
    p.spin = 0;
    p.phase = 0;
    p.velocity.set(0, 0, 0);
    p.mesh.geometry = this.geometries[kind];
    p.material.map = null;
    p.material.color.setHex(color);
    p.material.opacity = 1;
    p.material.needsUpdate = true;
    p.mesh.rotation.set(0, 0, 0);
    p.mesh.visible = true;
    return p;
  }

  // --- Combat ---------------------------------------------------------------------------------

  /** A hit: a white star flash and sparks in the attacker's team colour. */
  impact(x: number, y: number, z: number, color: number, time: number): void {
    const f = this.spawn("flash", time, 0.16, 0xffffff);
    f.origin.set(x, y, z);
    for (let i = 0; i < 7; i++) {
      const p = this.spawn("spark", time, 0.35, color);
      const a = (i / 7) * Math.PI * 2 + time * 3;
      p.origin.set(x, y, z);
      p.velocity.set(Math.cos(a) * 3.2, 1.5 + Math.sin(a) * 2.2, Math.sin(a) * 1.2);
      p.spin = 12;
    }
  }

  /** Dust kicked up at the feet (swings, landings). */
  dust(x: number, z: number, time: number, count = 4): void {
    for (let i = 0; i < count; i++) {
      const p = this.spawn("dust", time, 0.45, 0xf1e6cf);
      const a = (i / count) * Math.PI * 2 + time;
      p.origin.set(x, 0.15, z);
      p.velocity.set(Math.cos(a) * 1.3, 0.5, Math.sin(a) * 1.3);
    }
  }

  /** A ring expanding on the ground to `radius`: the reach of an area ability. */
  shockwave(x: number, z: number, radius: number, color: number, time: number): void {
    const p = this.spawn("ring", time, 0.4, color);
    p.origin.set(x, 0.04, z);
    p.size = radius;
    const w = this.spawn("ring", time, 0.3, 0xffffff);
    w.origin.set(x, 0.05, z);
    w.size = radius * 0.8;
  }

  /** Speed streaks left behind by a leap, from (x0, z0) to (x1, z1). */
  streak(x0: number, z0: number, x1: number, z1: number, color: number, time: number): void {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    if (length < 0.2) return;
    for (let i = 0; i < 3; i++) {
      const p = this.spawn("streak", time, 0.3 + i * 0.05, i === 1 ? 0xffffff : color);
      p.origin.set(x0 + dx * 0.5, 0.5 + i * 0.4, z0 + dz * 0.5);
      p.size = length;
      p.phase = -Math.atan2(dz, dx);
    }
  }

  /** Lorgnon's volley: a puff of loose feathers at the hose. */
  volley(x: number, y: number, z: number, time: number): void {
    for (let i = 0; i < 5; i++) {
      const p = this.spawn("feather", time, 0.6, 0xfff4dc);
      const a = (i / 5) * Math.PI * 2;
      p.origin.set(x, y, z);
      p.velocity.set(Math.cos(a) * 1.4, 1.2, Math.sin(a) * 1.4);
      p.spin = 9;
      p.phase = i;
    }
  }

  // --- Character gags -------------------------------------------------------------------------

  /** A handful of feathers bursting from the body and fluttering down (Pépin hit). */
  feathers(x: number, y: number, z: number, time: number): void {
    for (let i = 0; i < 6; i++) {
      const p = this.spawn("feather", time, 1.1, 0xffffff);
      const a = (i / 6) * Math.PI * 2 + time;
      p.origin.set(x, y, z);
      p.velocity.set(Math.cos(a) * 1.6, 1.8 + (i % 3) * 0.5, Math.sin(a) * 1.6);
      p.spin = (i % 2 ? 1 : -1) * (5 + i);
      p.phase = i;
    }
  }

  /** Knock-out: a ring of smoke puffs and three stars circling where the head was. */
  knockOut(x: number, headY: number, z: number, time: number): void {
    for (let i = 0; i < 7; i++) {
      const p = this.spawn("puff", time, 0.55, 0xf3ece0);
      const a = (i / 7) * Math.PI * 2;
      p.origin.set(x, headY * 0.5, z);
      p.velocity.set(Math.cos(a) * 1.4, 0.6, Math.sin(a) * 1.4);
    }
    for (let i = 0; i < 3; i++) {
      const p = this.spawn("star", time, 1.0, 0xffd34d);
      p.origin.set(x, headY, z);
      p.phase = (i / 3) * Math.PI * 2;
    }
  }

  // --- Bases ------------------------------------------------------------------------------------

  /** A base taken: confetti in the team colour (and white) popping out of the flag. */
  confetti(x: number, y: number, z: number, color: number, time: number): void {
    for (let i = 0; i < 18; i++) {
      const p = this.spawn("confetti", time, 1.2, i % 3 === 0 ? 0xffffff : color);
      const a = (i / 18) * Math.PI * 2;
      p.origin.set(x, y, z);
      p.velocity.set(Math.cos(a) * (1.2 + (i % 4) * 0.4), 2.8 + (i % 5) * 0.4, Math.sin(a) * 1.4);
      p.spin = 6 + (i % 7);
      p.phase = i;
    }
    const ring = this.spawn("ring", time, 0.5, color);
    ring.origin.set(x, 0.05, z);
    ring.size = 2.5;
  }

  /** Production: the resource's badge rising out of a base that paid. */
  rise(x: number, z: number, texture: THREE.Texture, delay: number, time: number): void {
    const p = this.spawn("icon", time + delay, 1.3, 0xffffff);
    p.material.map = texture;
    p.material.needsUpdate = true;
    p.origin.set(x, 1.2, z);
    p.mesh.visible = false; // until its delay has passed
  }

  update(time: number, camera: THREE.Camera): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      const s = time - p.start;
      if (s < 0) continue; // delayed (production icons)
      const t = s / p.life;
      const m = p.mesh;
      const mat = p.material;
      if (t >= 1) {
        p.active = false;
        m.visible = false;
        continue;
      }
      m.visible = true;
      switch (p.kind) {
        case "feather": {
          const fall = Math.min(s, 0.25);
          m.position.set(
            p.origin.x + p.velocity.x * fall + Math.sin(s * 7 + p.phase) * 0.18 * s,
            Math.max(0.05, p.origin.y + p.velocity.y * fall - 0.9 * Math.max(0, s - 0.25)),
            p.origin.z + p.velocity.z * fall,
          );
          m.rotation.set(Math.sin(s * 6 + p.phase) * 0.8, s * p.spin, 0.6);
          m.scale.setScalar(1);
          mat.opacity = t > 0.7 ? (1 - t) / 0.3 : 1;
          break;
        }
        case "puff":
        case "dust":
          m.position.copy(p.origin).addScaledVector(p.velocity, s * 0.6);
          m.scale.setScalar(0.6 + t * (p.kind === "puff" ? 1.6 : 1.2));
          mat.opacity = (p.kind === "puff" ? 0.9 : 0.75) * (1 - t);
          break;
        case "star": {
          const a = p.phase + s * 7;
          m.position.set(
            p.origin.x + Math.cos(a) * 0.45,
            p.origin.y + 0.1 * Math.sin(s * 9),
            p.origin.z + Math.sin(a) * 0.45,
          );
          m.quaternion.copy(camera.quaternion);
          m.scale.setScalar(t < 0.15 ? t / 0.15 : 1);
          mat.opacity = t > 0.75 ? (1 - t) / 0.25 : 1;
          break;
        }
        case "spark":
          m.position.set(
            p.origin.x + p.velocity.x * s,
            p.origin.y + p.velocity.y * s - 6 * s * s,
            p.origin.z + p.velocity.z * s,
          );
          m.quaternion.copy(camera.quaternion);
          m.rotateZ(s * p.spin);
          m.scale.setScalar(1 - t * 0.6);
          mat.opacity = 1 - t * t;
          break;
        case "flash":
          m.position.copy(p.origin);
          m.quaternion.copy(camera.quaternion);
          m.scale.setScalar(0.5 + t * 0.9);
          mat.opacity = 1 - t;
          break;
        case "ring":
          m.position.copy(p.origin);
          m.scale.setScalar(p.size * (0.25 + 0.75 * (1 - (1 - t) * (1 - t))));
          mat.opacity = 0.9 * (1 - t);
          break;
        case "confetti":
          m.position.set(
            p.origin.x + p.velocity.x * s + Math.sin(s * 8 + p.phase) * 0.12,
            Math.max(0.03, p.origin.y + p.velocity.y * s - 4.5 * s * s),
            p.origin.z + p.velocity.z * s,
          );
          m.rotation.set(s * p.spin, s * p.spin * 0.7, p.phase);
          mat.opacity = t > 0.75 ? (1 - t) / 0.25 : 1;
          break;
        case "streak":
          m.position.copy(p.origin);
          m.rotation.set(0, p.phase, 0);
          m.scale.set(p.size * (1 - t * 0.5), 1, 1);
          mat.opacity = 0.6 * (1 - t);
          break;
        case "icon": {
          // Pops in, rises above the building, fades.
          m.position.set(p.origin.x, p.origin.y + 2.2 * (1 - (1 - t) * (1 - t)), p.origin.z);
          m.quaternion.copy(camera.quaternion);
          const pop =
            t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : t < 0.3 ? 1.2 - ((t - 0.15) / 0.15) * 0.2 : 1;
          m.scale.setScalar(pop);
          mat.opacity = t > 0.7 ? (1 - t) / 0.3 : 1;
          break;
        }
      }
    }
  }
}
