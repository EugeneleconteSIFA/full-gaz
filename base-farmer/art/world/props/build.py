"""Obstacle props (docs/12): barrel, crate, rock, fence and wall segments.

    ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/world/props/build.py

Writes art/out/models/props.glb (one node per prop) and review sheets in art/world/props/sheet/.
Sizes follow the collision shapes of src/data/maps.ts:
  - barrel: circle r = 0.45; crate: square half 0.6 (exact size, used as is);
  - rock: unit radius, scaled to each rock's radius;
  - fence_seg / wall_seg: 1 unit long on x, 1 unit deep on z, tiled along each wall's long side
    and scaled to its thickness.
Rock and wall are painted in greys: the game tints them with the map's biome colours, so one
model serves every map. Barrel, crate and fence carry their own colours.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))

import numpy as np  # noqa: E402

from propkit import ROOT, Prop, build, ring_lo_hi, torus_y  # noqa: E402
from sdfkit import ellipsoid, paint, rbox, rcylinder, smin  # noqa: E402

WOOD = 0xB4793F
WOOD_DARK = 0x8E5A2C
WOOD_LIGHT = 0xD9A267
IRON = 0xAEB6C4  # metal: lighter and colder than the wood, matte (docs/12 §5)
IRON_DARK = 0x7D8594
GREY = 0xDADADA
GREY_DARK = 0xA9A9A9
GREY_LIGHT = 0xF4F4F4


def y_above(h):
    return lambda P: h - P[..., 1]


# --- Barrel: grooved staves, two iron hoops, a darker recessed lid, one chipped rim (the single
# wear). Separate parts so each colour stays crisp (vertex colours cannot carry fine patterns at
# this triangle budget).
H, R = 1.1, 0.42


def bulge(y):
    t = (y / H - 0.5) * 2
    return R * (1.0 + 0.09 * (1 - t * t))


def barrel_body(P):
    side = np.hypot(P[..., 0], P[..., 2]) - bulge(P[..., 1])
    cap = np.abs(P[..., 1] - H / 2) - H / 2
    rim = 0.05
    d = np.minimum(np.maximum(side, cap), 0) + np.hypot(np.maximum(side + rim, 0), np.maximum(cap + rim, 0)) - rim
    # Stave grooves: shallow vertical cuts, 10 around.
    a = np.arctan2(P[..., 2], P[..., 0])
    groove = np.abs(np.sin(a * 5)) * 0.5  # 0 on the joints
    d = d + np.maximum(0, 0.018 - groove * 0.4)
    lid = rcylinder((0, H + 0.02, 0), R * 0.84, 0.07, 0.02)(P)
    chip = ellipsoid((-R * 0.72, H, R * 0.62), (0.14, 0.1, 0.14))(P)
    return np.maximum(np.maximum(d, -lid), -chip)


def hoops(P):
    # Flat iron bands standing proud of the staves.
    r = np.hypot(P[..., 0], P[..., 2])
    bands = []
    for y0 in (0.22, H - 0.22):
        d = np.stack([np.abs(r - bulge(y0) - 0.012) - 0.03, np.abs(P[..., 1] - y0) - 0.055], -1)
        bands.append(np.linalg.norm(np.maximum(d + 0.015, 0), axis=-1) + np.minimum(d.max(-1) + 0.015, 0) - 0.015)
    return np.minimum(*bands)


barrel = (
    Prop("barrel", 3000)
    .part(barrel_body, *ring_lo_hi(R * 1.15, H), lambda P: paint(P, WOOD, [(y_above(H - 0.04), WOOD_LIGHT, 0.03, 0)]), tris=1700, voxel=0.008)
    .part(hoops, *ring_lo_hi(R * 1.25, H), lambda P: paint(P, IRON, []), tris=900, voxel=0.006)
    .part(rcylinder((0, H - 0.03, 0), R * 0.8, 0.03, 0.015), *ring_lo_hi(R, H), lambda P: paint(P, WOOD_DARK, []), tris=250, ao=False)
)

# --- Crate: dark core panels, a light frame on every edge, a diagonal brace on each side.
C = 0.6
F = 0.09  # frame bar half thickness


def crate_frame(P):
    """The box shell minus three through-prisms: only the 12 edge bars remain."""
    q = np.abs(P - np.array([0, C, 0], np.float32))
    outer = rbox((0, C, 0), (C, C, C), 0.05)(P)
    inner = C - 2 * F
    cuts = [np.maximum(q[..., a] - inner, q[..., b] - inner) for a, b in ((1, 2), (0, 2), (0, 1))]
    return np.maximum(outer, -np.minimum.reduce(cuts))


def crate_braces(P):
    """One diagonal plank on each vertical face, proud of the dark panel."""
    x, y, z = P[..., 0], P[..., 1] - C, P[..., 2]
    out = []
    for u, w in ((x, z), (z, x)):
        band = np.abs(u - y) / np.sqrt(2) - 0.075
        out.append(np.maximum.reduce([band, np.abs(w) - (C - 0.012), (C - 0.075) - np.abs(w), np.abs(u) - (C - F), np.abs(y) - (C - F)]))
    return np.minimum(*out)


crate = (
    Prop("crate", 2500)
    .part(rbox((0, C, 0), (C - 0.05, C - 0.05, C - 0.05), 0.04), (-C, -0.05, -C), (C, 2 * C, C), lambda P: paint(P, WOOD_DARK, []), tris=300)
    .part(crate_frame, (-C - 0.05, -0.05, -C - 0.05), (C + 0.05, 2 * C + 0.05, C + 0.05), lambda P: paint(P, WOOD_LIGHT, []), tris=1300, voxel=0.008)
    .part(crate_braces, (-C, 0, -C), (C, 2 * C, C), lambda P: paint(P, WOOD, []), tris=600, voxel=0.008)
)

# --- Rock: chunky faceted blocks fused with a small blend (Supercell rocks: planes + bevels,
# not a pebble); unit radius, light top.


def rock_fn(P):
    a = rbox((0.0, 0.42, 0.0), (0.72, 0.42, 0.66), 0.16, rot=(0.0, 0.5, 0.08))(P)
    b = rbox((0.3, 0.78, -0.12), (0.42, 0.36, 0.38), 0.12, rot=(0.15, -0.4, -0.2))(P)
    c = rbox((-0.45, 0.28, 0.35), (0.38, 0.28, 0.34), 0.1, rot=(-0.1, 0.9, 0.1))(P)
    d = smin(smin(a, b, 0.08), c, 0.08)
    return np.maximum(d, -P[..., 1])


rock = Prop("rock", 1800).part(
    rock_fn,
    (-1.15, -0.05, -1.15),
    (1.15, 1.35, 1.15),
    lambda P: paint(P, GREY, [
        (lambda Q: 0.3 - Q[..., 1], GREY_DARK, 0.12, 0),
        (lambda Q: Q[..., 1] - 1.0, GREY_LIGHT, 0.06, 0),
    ]),
    tris=1500,
    voxel=0.012,
)

# --- Fence segment: one sturdy post at the left end, two thick rails (tiled; the game adds a
# closing post).
FH = 0.9


def fence_rails(P):
    top = rbox((0, FH - 0.2, 0), (0.5, 0.075, 0.05), 0.03)(P)
    low = rbox((0, FH * 0.36, 0), (0.5, 0.075, 0.05), 0.03)(P)
    return np.minimum(top, low)


fence = (
    Prop("fence_seg", 1200)
    .part(rbox((-0.5, FH / 2, 0), (0.09, FH / 2, 0.09), 0.035), (-0.65, -0.05, -0.15), (-0.35, FH + 0.05, 0.15), lambda P: paint(P, WOOD_DARK, [(y_above(FH - 0.05), WOOD_LIGHT, 0.02, 0)]), tris=400, voxel=0.007)
    .part(fence_rails, (-0.55, 0.15, -0.1), (0.55, FH - 0.05, 0.1), lambda P: paint(P, WOOD, []), tris=600, voxel=0.007)
)

post = Prop("fence_post", 500).part(
    rbox((0, FH / 2, 0), (0.09, FH / 2, 0.09), 0.035),
    (-0.15, -0.05, -0.15),
    (0.15, FH + 0.05, 0.15),
    lambda P: paint(P, WOOD_DARK, [(y_above(FH - 0.05), WOOD_LIGHT, 0.02, 0)]),
    tris=400,
    voxel=0.007,
)

# --- Wall segment: dry stone wall of rounded blocks in staggered rows, with a cap (greys,
# tinted per biome).
WH = 1.0


def wall_blocks(P):
    blocks = []
    for row, y in enumerate((0.15, 0.45, 0.75)):
        shift = 0.25 if row % 2 else 0.0
        for x in (-0.5, 0.0, 0.5):
            cx = x + shift
            blocks.append(rbox((cx, y, 0), (0.215, 0.12, 0.44), 0.07)(P))
    d = np.minimum.reduce(blocks)
    return np.maximum(d, np.abs(P[..., 0]) - 0.5)  # cut to the segment length (tiles join)


wall = (
    Prop("wall_seg", 2500)
    .part(wall_blocks, (-0.55, -0.05, -0.5), (0.55, 0.92, 0.5), lambda P: paint(P, GREY, []), tris=1500, voxel=0.01)
    .part(rbox((0, WH - 0.05, 0), (0.5, 0.08, 0.49), 0.06), (-0.55, 0.8, -0.55), (0.55, WH + 0.1, 0.55), lambda P: paint(P, GREY_LIGHT, []), tris=500)
)

build(
    [barrel, crate, rock, fence, post, wall],
    os.path.join(ROOT, "art", "out", "models", "props.glb"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "sheet"),
)
