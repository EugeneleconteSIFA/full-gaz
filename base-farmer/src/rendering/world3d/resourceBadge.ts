import type Phaser from "phaser";
import * as THREE from "three";
import type { ResourceId } from "../../core/types";
import { drawResourceBadge } from "../resourceIcon";
import { resourceIconCanvas } from "../ui/resourceIcons";

/**
 * The resource badge of a base (the HUD's icon in its dark disc) as a flat decal on the 3D
 * ground, in front of the building: which resource a base pays reads at a glance, as in the 2D
 * view. The icon code draws on a Phaser Graphics; `CanvasGraphics` plays that part on a canvas.
 */

const PX = 128;
/** Badge radius on the ground, world units. */
export const BADGE_RADIUS = 0.55;

const cache = new Map<ResourceId, THREE.Texture>();

export function resourceBadgeTexture(id: ResourceId): THREE.Texture {
  let texture = cache.get(id);
  if (!texture) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context for the resource badge");
    const icon = resourceIconCanvas(id);
    if (icon) {
      // Dark disc with a light rim, the 3D icon on it (docs/13).
      const r = PX / 2 - 4;
      ctx.fillStyle = "#181c26";
      ctx.beginPath();
      ctx.arc(PX / 2, PX / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      const s = r * 1.55;
      ctx.drawImage(icon, PX / 2 - s / 2, PX / 2 - s / 2 - 2, s, s);
    } else {
      // Fallback: the flat icon. drawResourceBadge's disc is 1.75 x size.
      const size = (PX / 2 - 6) / 1.75;
      drawResourceBadge(
        new CanvasGraphics(ctx) as unknown as Phaser.GameObjects.Graphics,
        id,
        PX / 2,
        PX / 2,
        size,
      );
    }
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    cache.set(id, texture);
  }
  return texture;
}

/** The subset of Phaser.GameObjects.Graphics the icon code uses, drawn on a 2D canvas. */
class CanvasGraphics {
  private fillCss = "#000";
  private strokeCss = "#000";

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  fillStyle(color: number, alpha = 1): this {
    this.fillCss = css(color, alpha);
    return this;
  }

  lineStyle(width: number, color: number, alpha = 1): this {
    this.ctx.lineWidth = width;
    this.ctx.lineJoin = "round";
    this.strokeCss = css(color, alpha);
    return this;
  }

  fillCircle(x: number, y: number, r: number): this {
    this.circle(x, y, r);
    this.fill();
    return this;
  }

  strokeCircle(x: number, y: number, r: number): this {
    this.circle(x, y, r);
    this.stroke();
    return this;
  }

  fillPoints(points: readonly { x: number; y: number }[], close = true): this {
    this.poly(points, close);
    this.fill();
    return this;
  }

  strokePoints(points: readonly { x: number; y: number }[], close = false): this {
    this.poly(points, close);
    this.stroke();
    return this;
  }

  fillRoundedRect(x: number, y: number, w: number, h: number, r = 8): this {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
    this.fill();
    return this;
  }

  strokeRoundedRect(x: number, y: number, w: number, h: number, r = 8): this {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
    this.stroke();
    return this;
  }

  private circle(x: number, y: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
  }

  private poly(points: readonly { x: number; y: number }[], close: boolean): void {
    this.ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? this.ctx.moveTo(p.x, p.y) : this.ctx.lineTo(p.x, p.y)));
    if (close) this.ctx.closePath();
  }

  private fill(): void {
    this.ctx.fillStyle = this.fillCss;
    this.ctx.fill();
  }

  private stroke(): void {
    this.ctx.strokeStyle = this.strokeCss;
    this.ctx.stroke();
  }
}

function css(color: number, alpha: number): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}
