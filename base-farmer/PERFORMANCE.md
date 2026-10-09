# Performance

`05_PERFORMANCE_RULES.md` asks for budgets measured on the first playable build. These are those measurements (Milestone 10). Re-run them with `npm run perf` (headless) and the browser snippet below.

## Headless (Node, `npm run perf`)

A full match of two Difficile bots, timed separately:

| Map          | Match setup | Bot navigation (once) | Simulation per tick | 2 bots per tick |
| ------------ | ----------- | --------------------- | ------------------- | --------------- |
| Prairie      | 21.5 ms     | 52.8 ms               | 2.9 µs              | 6.5 µs          |
| Canyon       | 5.9 ms      | 32.4 ms               | 2.1 µs              | 5.0 µs          |
| Quatre-Coins | 10.9 ms     | 45.0 ms               | 2.3 µs              | 8.4 µs          |

- **Per tick:** simulation plus bots take about 10 µs, under 0.1% of a 16.7 ms frame. The 60 Hz fixed tick is far from being a cost.
- **One-off at start:** match setup (layout variant and its validation) and bot navigation (one distance field per base) run once per match. On a slow phone this is expected to be a short pause at match start (~0.1–0.3 s); acceptable for now, and could be spread over the countdown later if needed.

## Browser (desktop, WebGL, DPR 2)

Frames stepped by hand on Canyon against a Difficile bot (the Browser pane was hidden, so frames could not run at the display's real rhythm):

|                                            | Value                                       |
| ------------------------------------------ | ------------------------------------------- |
| Frame (simulation + bots + render), median | 2.8 ms                                      |
| Frame, 95th percentile                     | 7.2 ms                                      |
| Game objects                               | 19 (match) + 55 (UI)                        |
| Bundle                                     | 1.21 MB, 323 KB gzipped (almost all Phaser) |

- **Spikes:** about one every 75 frames (130–220 ms). They come from the GPU queue filling up when frames are pushed back to back with no display sync; they disappear when rendering is off and do not line up with any game event (shot, capture, text change). This needs to be re-checked with real `requestAnimationFrame` frames on a visible page and on a real phone before drawing conclusions.
- **Text updates:** one `Text.setText` costs ~1 ms (re-rasterization and upload), which is why the HUD only rewrites text when the shown value changes.

## Tilted brawler view (D050, D051)

The new art first measured **15.4 ms** median per frame on Quatre-Coins. Cause: Phaser `Graphics` objects re-tessellate every shape every frame: the dashed zone rings and hazard stripes cost ~6.5 ms and the scattered decor ~4 ms. Fix: everything static or rarely changing is drawn once into a `RenderTexture` (`src/rendering/cachedGraphics.ts`):

- the map's decor, border and wall slices;
- rocks, the hedge and the board edge;
- the bases' ground marks and flags, redrawn only when the base changes.

After the fix: **3.0 ms** median, **0** live Graphics in the match scene.

The 95th percentile is 15 ms in the same hand-stepped hidden-pane run, probably texture redraws while a base is being captured. Check with real frames on a phone.

## Painted ground and Canvas art (game-art skill)

The ground is now one Canvas 2D texture per match (`src/rendering/groundArt.ts`) instead of a tile sprite plus a decor render texture; rocks and wall slices are Canvas textures too.

- Frame on Quatre-Coins (hand-stepped, desktop): **2.0 ms** median, 6.5 ms 95th percentile (was 3.0 ms).
- Painting the ground of Quatre-Coins once at match start: **~200 ms** on desktop, of which ~90 ms is the GPU upload of the 3840×2304 texture. Small details are drawn as stamps (a few variants copied with `drawImage`): drawing each blade with its own gradient cost ~220 ms alone. On a phone, expect 2–4× more: check it, and lower `MAX_SCALE` in groundArt.ts to 1.5 if the match start stutters.

## Combat feedback (CombatFx)

Impact flash, ring, sparks, damage numbers, muzzle bursts and dust come from a fixed pool (64 sprites + 8 texts) animated by hand: no object is created or destroyed during a fight. Hand-stepped Prairie with a hit every 20 frames on both players: **3.6 ms** median, 7.6 ms 95th percentile per frame (camera now closer, 11 units on the short side). Damage numbers call `setText` once per hit only.

## Loading (3D roadmap step 8, 2026-10-09)

Budget: the first screen within **10 s on 4G** (about 10 Mbit/s, so roughly 1.2 MB/s with latency).

| Asset | Before | After |
|---|---|---|
| All models (`public/models`) | 22.2 MB | 8.3 MB |
| One character, match version | about 400 KB | about 175 KB |
| One character, showcase version (viewer only) | 3.6 to 6.5 MB | 1.3 to 2.4 MB |
| Props, buildings, icons | 887 KB | 467 KB |
| JS bundle | 2,056 KB (556 KB gzipped) | unchanged |

- Compression: gltfpack with meshopt (`npm run models:pack`, `art/pack_models.mjs`), decoded by `MeshoptDecoder` (`src/rendering/three/loader.ts`). Flags `-cc -kn -km -kv -noq`: no quantization, because it corrupted the per-part gloss UVs and dropped the mouth decals. Draco was not used: it needs a WASM decoder and does not keep separate meshes better.
- Raw Blender exports live in `art/out/models/`; only packed files are served.
- First match path: bundle (556 KB) + icons, props, buildings and four match characters (about 1.2 MB, down from 2.5 MB) ≈ 1.8 MB, so about **2 to 3 s on 4G**. The showcase models load only when the selection viewer opens them, in the background.
- An HTML loading screen (`index.html`, `#loader`) shows from the first bytes, in the interface's look, until the first Phaser frame.

## Rules applied in code

- **Gameplay:** no per-frame allocation in the simulation loop. Commands, input state, vectors and projectile arrays are reused; projectiles are compacted in place.
- **HUD:** text and graphics are rebuilt only when the displayed value changes (timer second, wallet amounts, upgrade levels, base owners). The upgrade bar and the next-production line used to rebuild a string every frame; fixed in Milestone 10.
- **Bots:** strategy runs every 0.25–0.6 s, steering at 20 Hz; only movement intent is applied every tick.
- **Rendering:** static map and obstacles are drawn once; projectiles come from a pool.

## Not done yet

- Measuring on a mid-range phone with real frames (the main open question).
- Sharp rendering on high-density screens: the canvas renders at CSS resolution (DPR 1), which is cheap but slightly blurry on Retina and phones.
- Trimming the Phaser bundle (custom build) — only worth it if load time becomes a problem.

### Browser snippet

In the dev console of a running match (`window.__game` exists in dev builds):

```js
const g = window.__game;
let t = performance.now();
const times = [];
for (let i = 0; i < 1200; i++) {
  const a = performance.now();
  t += 1000 / 60;
  g.step(t, 1000 / 60);
  times.push(performance.now() - a);
}
times.sort((a, b) => a - b);
[times[600], times[1140]];
```
