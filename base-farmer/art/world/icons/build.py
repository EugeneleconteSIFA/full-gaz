"""Resource icons as small 3D models (docs/13): vegetables (food), wood, stone, metal, flour.

    ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/world/icons/build.py

Writes art/out/models/icons.glb (one node per resource id) and review sheets in
art/world/icons/sheet/. The game renders each once to an image (rendering/ui/resourceIcons.ts)
used by the HUD, the upgrade costs and the badges on the ground: the same look as the cast
(rounded chunky volumes, baked occlusion, shared ramp). Each icon reads by its SILHOUETTE first
(docs/02: never colour alone): carrot, log, cut block, horseshoe, tied sack.
About 1 unit tall, standing on y = 0, facing +z.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))

import numpy as np  # noqa: E402

from propkit import ROOT, Prop, build, torus_y  # noqa: E402
from sdfkit import capsule, ellipsoid, paint, rbox, rcylinder, smin  # noqa: E402

CARROT = 0xF07A2A
CARROT_DARK = 0xC9561A
LEAF = 0x5DBB4A
LEAF_DARK = 0x3E8F36
BARK = 0x8E5A2C
WOOD_LIGHT = 0xE9C07F
WOOD_RING = 0xC99858
STONE = 0xB9B6AE
STONE_LIGHT = 0xDCD9D2
IRON = 0xB4BDCB
IRON_DARK = 0x6F7887
SACK = 0xF2E3C2
SACK_DARK = 0xC9A46A


def carrot_root(P):
    # Tilted cone-ish carrot: a capsule tapering to a point, leaning right.
    return capsule((-0.18, 0.62, 0), (0.22, 0.08, 0), 0.2, 0.04)(P)


def carrot_leaves(P):
    leaves = [capsule((-0.2, 0.7, 0), (-0.42 + 0.17 * k, 1.1 - 0.05 * abs(k - 1), 0.02 * k), 0.07, 0.05)(P) for k in range(3)]
    return np.minimum.reduce(leaves)


veg = (
    Prop("food", 2500)
    .part(carrot_root, (-0.5, -0.05, -0.3), (0.45, 0.9, 0.3), lambda P: paint(P, CARROT, [
        (lambda Q: np.abs(((Q[..., 1] + 0.04) % 0.14) - 0.07) - 0.012, CARROT_DARK, 0.01, 0),
    ]), tris=1200, voxel=0.008)
    .part(carrot_leaves, (-0.6, 0.55, -0.2), (0.0, 1.25, 0.2), lambda P: paint(P, LEAF, [(lambda Q: 0.8 - Q[..., 1], LEAF_DARK, 0.06, 0)]), tris=900, voxel=0.007)
)

# Log lying on its side, turned three-quarters: its length AND its end grain show.
LOG_TURN = 0.75


def turn(P):
    c, s_ = math.cos(LOG_TURN), math.sin(LOG_TURN)
    Q = P.copy()
    Q[..., 0], Q[..., 2] = c * P[..., 0] - s_ * P[..., 2], s_ * P[..., 0] + c * P[..., 2]
    return Q


LOG = dict(c=(0, 0.32, 0), r=0.32, h=0.42)


def log_body(P):
    return rcylinder(LOG["c"], LOG["r"], LOG["h"], 0.05, rot=(math.pi / 2, 0, 0.0))(turn(P))


def log_end(P):
    # Light end grain disc, slightly proud, with rings painted.
    return rcylinder((0, 0.32, LOG["h"] - 0.01), LOG["r"] * 0.86, 0.025, 0.015, rot=(math.pi / 2, 0, 0))(turn(P))


wood = (
    Prop("wood", 2500)
    .part(log_body, (-0.6, -0.05, -0.6), (0.6, 0.7, 0.6), lambda P: paint(P, BARK, []), tris=1200, voxel=0.01)
    .part(log_end, (-0.6, -0.02, -0.6), (0.6, 0.66, 0.6), lambda P: paint(P, WOOD_LIGHT, [
        (lambda Q: np.abs((np.hypot(turn(Q)[..., 0], Q[..., 1] - 0.32) % 0.09) - 0.045) - 0.01, WOOD_RING, 0.006, 0),
    ]), tris=900, voxel=0.006, ao=False)
)

# Stone: a chunky cut block with one chipped corner.


def stone_fn(P):
    block = rbox((0, 0.36, 0), (0.38, 0.32, 0.32), 0.08, rot=(0, 0.35, 0))(P)
    chip = ellipsoid((0.3, 0.68, 0.25), (0.16, 0.12, 0.16))(P)
    return np.maximum(block, -chip)


stone = Prop("stone", 1500).part(stone_fn, (-0.6, -0.05, -0.6), (0.6, 0.8, 0.6), lambda P: paint(P, STONE, [(lambda Q: Q[..., 1] - 0.62, STONE_LIGHT, 0.04, 0)]), tris=900, voxel=0.01)

# Metal: an iron horseshoe standing up, open side up (the lucky way) (a farm's metal).


def shoe_fn(P):
    c = np.array((0, 0.5, 0), np.float32)
    Q = P - c
    r = np.hypot(Q[..., 0], Q[..., 1])
    ring = np.hypot(r - 0.33, Q[..., 2]) - 0.1
    open_bottom = np.maximum(-Q[..., 1] - 0.05, np.abs(Q[..., 0]) - 0.2)
    arc = np.maximum(ring, -open_bottom)
    # Squared-off ends of the arms.
    ends = np.minimum(rbox((-0.33, 0.8, 0), (0.1, 0.08, 0.1), 0.04)(P), rbox((0.33, 0.8, 0), (0.1, 0.08, 0.1), 0.04)(P))
    return smin(arc, ends, 0.04)


metal = Prop("metal", 1800).part(shoe_fn, (-0.55, 0.05, -0.2), (0.55, 0.95, 0.2), lambda P: paint(P, IRON, [
    (lambda Q: np.abs(np.hypot(Q[..., 0], Q[..., 1] - 0.5) - 0.33) - 0.03 - (Q[..., 2] < 0.07) * 1.0, IRON_DARK, 0.01, 0),
]), tris=1200, voxel=0.008)

# Flour: a plump tied sack.


def sack_body(P):
    body = ellipsoid((0, 0.36, 0), (0.36, 0.36, 0.3))(P)
    base = rbox((0, 0.12, 0), (0.33, 0.12, 0.27), 0.1)(P)
    neck = capsule((0, 0.62, 0), (0, 0.8, 0), 0.13, 0.08)(P)
    return smin(smin(body, base, 0.1), neck, 0.08)


def sack_top(P):
    tie = torus_y((0, 0.74, 0), 0.11, 0.035)(P)
    flare = ellipsoid((0, 0.88, 0), (0.17, 0.07, 0.15))(P)
    return np.minimum(tie, flare)


flour = (
    Prop("power", 2500)
    .part(sack_body, (-0.45, -0.05, -0.4), (0.45, 0.9, 0.4), lambda P: paint(P, SACK, [(lambda Q: 0.1 - Q[..., 1], SACK_DARK, 0.06, 0)]), tris=1200, voxel=0.008)
    .part(sack_top, (-0.25, 0.65, -0.22), (0.25, 1.0, 0.22), lambda P: paint(P, SACK_DARK, []), tris=700, voxel=0.006)
)

build(
    [veg, wood, stone, metal, flour],
    os.path.join(ROOT, "art", "out", "models", "icons.glb"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "sheet"),
    sheet_height=1.4,
)
