import type Phaser from "phaser";
import { UI } from "./ui/uiKit";
import { BAKE_SCALE } from "./bake";
import { bakeCanvas } from "./canvasBake";
import { LAYER } from "./projection";
import { THEME } from "./theme";

/**
 * Combat feedback (game-art skill §3.7): impact flash + ring + sparks, damage numbers, muzzle
 * bursts, dust puffs. Every sprite comes from a fixed pool and is animated by hand in update():
 * nothing is created or destroyed during a fight, and nothing allocates per frame.
 */

type Kind = "flash" | "ring" | "spark" | "dust" | "muzzle";

interface Particle {
  readonly image: Phaser.GameObjects.Image;
  kind: Kind;
  startMs: number;
  lifeMs: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  active: boolean;
}

interface Popup {
  readonly text: Phaser.GameObjects.Text;
  startMs: number;
  x: number;
  y: number;
  active: boolean;
}

const POOL = 64;
const POPUPS = 8;

export class CombatFx {
  private readonly particles: Particle[] = [];
  private readonly popups: Popup[] = [];
  private next = 0;
  private nextPopup = 0;

  constructor(scene: Phaser.Scene) {
    ensureFxTextures(scene);
    for (let i = 0; i < POOL; i++) {
      const image = scene.add
        .image(0, 0, "fx_spark")
        .setVisible(false)
        .setDepth(LAYER.overlay - 1);
      this.particles.push({
        image,
        kind: "spark",
        startMs: 0,
        lifeMs: 1,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        scale: 1,
        active: false,
      });
    }
    const style = THEME.fx;
    for (let i = 0; i < POPUPS; i++) {
      const text = scene.add
        .text(0, 0, "", {
          fontFamily: UI.displayFont,
          fontSize: `${style.damageFontPx}px`,
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setStroke("#1b1f2a", 5)
        .setDepth(LAYER.overlay + 1)
        .setVisible(false);
      this.popups.push({ text, startMs: 0, x: 0, y: 0, active: false });
    }
  }

  private spawn(
    kind: Kind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    lifeMs: number,
    scale: number,
    tint: number,
    now: number,
  ): void {
    const p = this.particles[this.next] as Particle;
    this.next = (this.next + 1) % POOL;
    p.kind = kind;
    p.startMs = now;
    p.lifeMs = lifeMs;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.scale = scale;
    p.active = true;
    p.image
      .setTexture(`fx_${kind === "muzzle" ? "flash" : kind}`)
      .setTint(tint)
      .setVisible(true)
      .setPosition(x, y)
      // Final-size scale right away: never one frame at the texture's raw (baked) size.
      .setScale((scale * 0.6) / BAKE_SCALE)
      .setAlpha(1);
  }

  /** A hit: white flash, an expanding ring and sparks in the attacker's color. */
  impact(x: number, y: number, color: number, now: number): void {
    const style = THEME.fx;
    this.spawn("flash", x, y, 0, 0, style.flashMs, 1.1, 0xffffff, now);
    this.spawn("ring", x, y, 0, 0, style.ringMs, 1, color, now);
    for (let i = 0; i < style.sparks; i++) {
      const a = (i / style.sparks) * Math.PI * 2 + now * 0.001;
      const speed = 90 + ((i * 37) % 60);
      this.spawn(
        "spark",
        x,
        y,
        Math.cos(a) * speed,
        Math.sin(a) * speed * 0.8 - 30,
        style.sparkMs,
        0.9,
        color,
        now,
      );
    }
  }

  /** Ground ring expanding to `radiusPx` (an ability's area). */
  shockwave(x: number, y: number, color: number, radiusPx: number, now: number): void {
    // The ring texture is 24 px in radius and grows to 1.7x its scale (see update()).
    this.spawn("ring", x, y, 0, 0, THEME.fx.ringMs * 1.6, radiusPx / (24 * 1.7), color, now);
  }

  /** Bright burst at the weapon when a shot leaves. */
  muzzle(x: number, y: number, color: number, now: number): void {
    this.spawn("muzzle", x, y, 0, 0, THEME.fx.muzzleMs, 0.7, color, now);
  }

  /** Dust kicked up at the feet (melee swing, landing). */
  dust(x: number, y: number, now: number): void {
    for (const dir of [-1, 1]) {
      this.spawn("dust", x + dir * 6, y, dir * 40, -12, THEME.fx.dustMs, 0.8, 0xf3e6cf, now);
    }
  }

  /** Floating damage number above the target. */
  damage(x: number, y: number, amount: number, color: string, now: number): void {
    const p = this.popups[this.nextPopup] as Popup;
    this.nextPopup = (this.nextPopup + 1) % POPUPS;
    p.startMs = now;
    p.x = x;
    p.y = y;
    p.active = true;
    p.text
      .setText(String(Math.round(amount)))
      .setColor(color)
      .setVisible(true)
      .setPosition(x, y)
      .setAlpha(1);
  }

  update(now: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      // If the clock ever steps back, restart the effect instead of extrapolating backward.
      if (now < p.startMs) p.startMs = now;
      const t = (now - p.startMs) / p.lifeMs;
      if (t >= 1) {
        p.active = false;
        p.image.setVisible(false);
        continue;
      }
      const secs = (now - p.startMs) / 1000;
      const k = p.scale / BAKE_SCALE;
      switch (p.kind) {
        case "flash":
        case "muzzle":
          p.image.setScale(k * (0.6 + t * 0.9)).setAlpha(1 - t);
          break;
        case "ring":
          p.image.setScale(k * (0.3 + t * 1.4), k * (0.3 + t * 1.4) * 0.72).setAlpha(1 - t);
          break;
        case "spark":
          p.image
            .setPosition(p.x + p.vx * secs, p.y + p.vy * secs + 220 * secs * secs)
            .setScale(k * (1 - t * 0.7))
            .setAlpha(1 - t * t);
          break;
        case "dust":
          p.image
            .setPosition(p.x + p.vx * secs, p.y + p.vy * secs)
            .setScale(k * (0.6 + t))
            .setAlpha(0.7 * (1 - t));
          break;
      }
    }
    const style = THEME.fx;
    for (const p of this.popups) {
      if (!p.active) continue;
      if (now < p.startMs) p.startMs = now;
      const t = (now - p.startMs) / style.damageMs;
      if (t >= 1) {
        p.active = false;
        p.text.setVisible(false);
        continue;
      }
      // Pop up fast with a little overshoot, hang, then fade.
      const rise = t < 0.25 ? (t / 0.25) * 26 : 26 + (t - 0.25) * 10;
      const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : t < 0.3 ? 1.2 - ((t - 0.15) / 0.15) * 0.2 : 1;
      p.text
        .setPosition(p.x, p.y - rise)
        .setScale(pop)
        .setAlpha(t > 0.7 ? (1 - t) / 0.3 : 1);
    }
  }
}

function ensureFxTextures(scene: Phaser.Scene): void {
  // White textures, tinted per use.
  bakeCanvas(scene, "fx_flash", 40, 40, (ctx) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, 40, 40);
    // Four-point star on top: reads as a "hit".
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 === 0 ? 18 : 5;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  });
  bakeCanvas(scene, "fx_ring", 60, 60, (ctx) => {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();
  });
  bakeCanvas(scene, "fx_spark", 12, 12, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(2, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-2, 0);
    ctx.closePath();
    ctx.fill();
  });
  bakeCanvas(scene, "fx_dust", 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(-2, -2, 0, 0, 0, 11);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
  });
}
