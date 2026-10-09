import type Phaser from "phaser";
import { blob, type Pt } from "./artKit";
import { bakeCanvas, contactShadow, css, grain, pathOf, shadeVolume } from "./canvasBake";

/**
 * Farm props drawn with Canvas 2D (smooth, lit volumes). Standing props are drawn from the front,
 * feet at the bottom center (origin { x: 0.5, y: PROP_FEET }). Not placed on maps yet: they are
 * the reference set for the game-art skill (`artLab(["prop_barrel", ...])`).
 */
export const PROP_FEET = 0.85;
export const PROP_KEYS = ["prop_barrel", "prop_crate", "prop_wheat", "prop_paver"] as const;

const WOOD = { light: 0xe0a86a, mid: 0xb07a43, dark: 0x6e4224, outline: 0x4a2c17 };

export function ensurePropTextures(scene: Phaser.Scene, sizePx = 40): void {
  const s = sizePx;
  const feet = s * (PROP_FEET - 0.5);

  bakeCanvas(scene, "prop_barrel", s, s, (ctx) => {
    contactShadow(ctx, s * 0.05, feet, s * 0.9);
    const w = s * 0.36;
    const top = feet - s * 0.62;
    // Bulging staves: a rounded silhouette, lit as one cylinder-ish volume.
    const body: Pt[] = blob([
      [-w * 0.85, top + s * 0.06],
      [0, top],
      [w * 0.85, top + s * 0.06],
      [w, feet - s * 0.3],
      [w * 0.85, feet - s * 0.02],
      [0, feet + s * 0.02],
      [-w * 0.85, feet - s * 0.02],
      [-w, feet - s * 0.3],
    ]);
    shadeVolume(ctx, body, 0, feet - s * 0.3, w * 1.1, {
      ...WOOD,
      outlinePx: 0,
      rim: 0.35,
      gloss: 0.15,
    });
    // Iron hoops follow the bulge, lid ellipse seen from slightly above.
    ctx.lineWidth = s * 0.05;
    ctx.strokeStyle = css(0x4d525c);
    for (const t of [0.16, 0.84]) {
      ctx.beginPath();
      ctx.ellipse(0, top + (feet - top) * t, w * 0.95, s * 0.05, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, top + s * 0.04, w * 0.8, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fillStyle = css(WOOD.mid);
    ctx.fill();
  });

  bakeCanvas(scene, "prop_crate", s, s, (ctx) => {
    contactShadow(ctx, s * 0.05, feet, s * 0.95);
    const w = s * 0.4;
    const h = s * 0.5;
    const topH = s * 0.16;
    // Front face (lit from the top left: gradient left-light to right-dark) and top face (brightest).
    const front: Pt[] = [
      { x: -w, y: feet - h },
      { x: w, y: feet - h },
      { x: w, y: feet },
      { x: -w, y: feet },
    ];
    const top: Pt[] = [
      { x: -w, y: feet - h },
      { x: -w + s * 0.08, y: feet - h - topH },
      { x: w + s * 0.08, y: feet - h - topH },
      { x: w, y: feet - h },
    ];
    const lg = ctx.createLinearGradient(-w, 0, w, 0);
    lg.addColorStop(0, css(WOOD.light));
    lg.addColorStop(1, css(WOOD.mid));
    pathOf(ctx, front);
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.save();
    pathOf(ctx, front);
    ctx.clip();
    grain(ctx, -w, feet - h, w * 2, h, s * 0.12, 0.12, 3);
    // Ambient occlusion where the crate meets the ground.
    const ao = ctx.createLinearGradient(0, feet - s * 0.12, 0, feet);
    ao.addColorStop(0, "rgba(0,0,0,0)");
    ao.addColorStop(1, "rgba(30,15,5,0.35)");
    ctx.fillStyle = ao;
    ctx.fillRect(-w, feet - s * 0.12, w * 2, s * 0.12);
    ctx.restore();
    pathOf(ctx, top);
    ctx.fillStyle = css(0xf0c48a);
    ctx.fill();
    // Planks: border frame and a diagonal brace, darker than the face.
    ctx.lineWidth = s * 0.06;
    ctx.strokeStyle = css(WOOD.dark, 0.7);
    ctx.strokeRect(-w + s * 0.04, feet - h + s * 0.04, w * 2 - s * 0.08, h - s * 0.08);
    ctx.beginPath();
    ctx.moveTo(-w + s * 0.06, feet - s * 0.06);
    ctx.lineTo(w - s * 0.06, feet - h + s * 0.06);
    ctx.stroke();
    // Top edge catches the light: a thin highlight instead of a contour.
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(-w, feet - h - 1, w * 2, 2);
  });

  bakeCanvas(scene, "prop_wheat", s, s, (ctx) => {
    // Tall wheat tuft (the Brawl Stars "bush"): many blade tips, warm gradient, dark base.
    contactShadow(ctx, 0, feet, s * 1.0, 0.35);
    const blades = 9;
    for (let i = 0; i < blades; i++) {
      const t = i / (blades - 1);
      const x = (t - 0.5) * s * 0.7;
      const hgt = s * (0.5 + 0.18 * Math.sin(i * 2.3) + 0.12 * (1 - Math.abs(t - 0.5) * 2));
      const lean = (t - 0.5) * s * 0.18;
      const bw = s * 0.11;
      const g = ctx.createLinearGradient(0, feet - hgt, 0, feet);
      g.addColorStop(0, css(0xffe08a));
      g.addColorStop(0.5, css(0xf2b33d));
      g.addColorStop(1, css(0xb86a1c));
      ctx.beginPath();
      ctx.moveTo(x - bw, feet);
      ctx.quadraticCurveTo(x - bw * 0.6 + lean * 0.5, feet - hgt * 0.6, x + lean, feet - hgt);
      ctx.quadraticCurveTo(x + bw * 0.6 + lean * 0.5, feet - hgt * 0.6, x + bw, feet);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }
  });

  bakeCanvas(scene, "prop_paver", s, s, (ctx) => {
    // Flat ground stone (seen from above; the ground layer squashes it). No outline: decor only.
    const pts: Pt[] = blob(
      [
        [-s * 0.3, -s * 0.22],
        [s * 0.05, -s * 0.3],
        [s * 0.32, -s * 0.12],
        [s * 0.28, s * 0.2],
        [-s * 0.05, s * 0.3],
        [-s * 0.33, s * 0.1],
      ],
      3,
    );
    pathOf(ctx, pts);
    ctx.fillStyle = "rgba(90,50,30,0.25)";
    ctx.fill();
    ctx.save();
    ctx.translate(-s * 0.02, -s * 0.03);
    const g = ctx.createLinearGradient(-s * 0.3, -s * 0.3, s * 0.3, s * 0.3);
    g.addColorStop(0, css(0xe9b48a));
    g.addColorStop(1, css(0xc98a5e));
    pathOf(ctx, pts);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  });
}
