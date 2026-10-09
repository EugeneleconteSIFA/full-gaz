"""Gaston (fighter) — build script (Blender 4.5, headless), on the shared kit since v3.

    ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/gaston/build.py

Brief (character-3d skill §1): « bouledogue de ferme teigneux qui charge à la fourche ».
Personality: teigneux, bagarreur, au fond joyeux; default expression "teigneux".
Hook: the big straw hat, held clear of the head (reads from the top-down camera).
Shape (v3, docs/10 hero shape language): COMPACT and SQUAT, a bruiser. A wide head sunk on a
barrel chest, a MASSIVE muzzle with an underbite and two lower fangs, heavy frowning brows,
strong jowls, short thick arms with big paws, short legs.

Until v2 Gaston had his own script (eyes, lids and mouths built by hand). v3 moves him to
charkit like the others: the shared eyes, lids, brows, mouth decals, gloss and checks. His
design is kept: muzzle pads and flews, underbite jaw and fangs, rose ears, brown eye patch,
denim overalls with straps and brass buttons, tilted straw hat with a red band, pitchfork.
Writes art/out/models/gaston.glb (the model id stays "gaston").
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))

import numpy as np  # noqa: E402

from charkit import SIDES, Spec, build, held_frame, torus_z  # noqa: E402
from sdfkit import Prim, capsule, ellipsoid, paint, rbox, rcylinder, smin  # noqa: E402

# Palette v3 (Supercell pass): dominant saturated orange fur, secondary cream muzzle and denim,
# accents: dark brown eye patch, straw-gold hat with a red band, brass buttons, steel fork.
FUR = 0xF2862A
FUR_DARK = 0x9A4C1C  # ears
PATCH = 0x5A2C12
CREAM = 0xFFF1DA  # muzzle: the lightest large area
PAW = 0xC0682A
NOSE = 0x2A1E24
DENIM = 0x56719E  # desaturated, so it never reads as the blue team
DENIM_DARK = 0x33487A
BRASS = 0xFFC24A
STRAW = 0xFFD877
STRAW_DARK = 0xD9A93E
BAND = 0xD83A4E
WOOD = 0xA9692E
LEATHER = 0x6B3A20
STEEL = 0x8794A8
STEEL_EDGE = 0xDCE4EE
TOOTH = 0xFFF6E2

spec = Spec(
    id="gaston",
    brief="bouledogue de ferme teigneux qui charge à la fourche",
    head_c=(0.0, 2.12, 0.06),
    head_r=(0.98, 0.76, 0.84),  # wide skull
    head_box=0.2,
    head_blend=0.1,  # sunk on the barrel chest
    body_c=(0.0, 0.96, 0.04),
    body_r=(0.8, 0.58, 0.64),
    body_box=0.3,
    shoulder=(0.7, 1.24, 0.06),
    fist=(1.08, 0.62, 0.36),
    hand_scale=1.35,
    hip=(0.34, 0.48, 0.02),
    foot=(0.4, 0.12, 0.22),
    foot_r=(0.31, 0.12, 0.34),
    arm_r=0.18,
    leg_r=0.22,
    eye_y=2.08,
    eye_x=0.34,
    eye_r=0.18,
    iris=0xE8961E,  # amber
    iris_light=0xFFD27A,
    limbal=0x4A2A08,
    brow_color=0x3E2210,
    brow_angry=0.38,  # frowning: inner ends low
    brow_r=0.085,
    brow_lift=(0.0, 0.04),  # the right brow a hair higher: a scowl, not a mask
    mouth="decal",
    mouth_y=1.72,
    mouth_w=0.32,
    skin=FUR,
    face=CREAM,
    paw=PAW,
    lid_l=PATCH,  # the left eye sits in the brown patch
    skin_gloss=0.1,
)

# --- Body: barrel chest and heavy hips (a bruiser's mass) ---
spec.extra_skin += [
    Prim(ellipsoid((0, 0.72, 0.06), (0.7, 0.42, 0.56)), "hips", 0.2),
    Prim(ellipsoid((0, 1.14, 0.24), (0.64, 0.4, 0.46)), "spine", 0.18),
]
# --- Muzzle (MASSIVE): two pads split by a philtrum, flews over the jaw, jowls; an underbite
# jaw pushed out past the upper lip, with a chin ---
for s, n in SIDES:
    spec.extra_skin += [
        Prim(ellipsoid((s * 0.5, 1.8, 0.46), (0.44, 0.36, 0.38)), "head", 0.16),  # strong jowls
        Prim(ellipsoid((s * 0.22, 1.92, 0.68), (0.3, 0.2, 0.28)), "head", 0.12),  # muzzle pad
        Prim(ellipsoid((s * 0.3, 1.8, 0.64), (0.19, 0.13, 0.24)), f"flew.{n}", 0.1),  # flew
        # Bulldog "rose" ears: short flaps folded sideways, just under the hat brim.
        Prim(ellipsoid((s * 0.92, 2.56, -0.04), (0.28, 0.09, 0.23), (0, 0, -s * 0.3)), f"ear.{n}", 0.08),
    ]
    spec.extra_bones.append((f"ear.{n}", (s * 0.78, 2.6, -0.04), (s * 1.08, 2.5, -0.04), "head"))
spec.extra_skin += [
    Prim(capsule((0, 1.94, 0.96), (0, 1.83, 0.93), 0.026), None, 0.02, sub=True),  # philtrum
    Prim(rbox((0, 1.64, 0.6), (0.4, 0.1, 0.32), 0.1, (-0.12, 0, 0)), "jaw", 0.1),  # underbite jaw
    Prim(ellipsoid((0, 1.56, 0.56), (0.32, 0.12, 0.28)), "jaw", 0.06),  # chin
]
spec.extra_bones.append(("tail", (0, 0.72, -0.58), (0, 0.95, -0.84), "hips"))
spec.extra_skin.append(Prim(capsule((0, 0.72, -0.58), (0, 0.95, -0.84), 0.11, 0.07), "tail", 0.06))

# Patch around the left eye (+x), wobbly edge; cream muzzle; dark ears.
patch_region = ellipsoid((0.38, 2.18, 0.6), (0.36, 0.33, 0.45))
spec.extra_paint += [
    (ellipsoid((0, 1.8, 0.7), (0.66, 0.42, 0.52)), CREAM, 0.07, 0),
    (patch_region, PATCH, 0.012, 0.03),
]
for s, n in SIDES:
    spec.extra_paint.append((ellipsoid((s * 0.96, 2.56, -0.04), (0.27, 0.15, 0.28), (0, 0, -s * 0.3)), FUR_DARK, 0.03, 0))

# --- Nose: a wide bevelled block, narrower at the bottom, glossy (wet) ---


def nose_fn(P):
    Q = P.copy()
    Q[..., 0] = Q[..., 0] * (1 + 0.9 * np.clip(2.0 - Q[..., 1], 0, 0.3))
    d = rbox((0, 2.0, 0.94), (0.24, 0.11, 0.12), 0.08)(Q)
    for s in (-1, 1):
        d = -smin(-d, ellipsoid((s * 0.1, 1.95, 1.05), (0.06, 0.033, 0.05), (0, 0, s * 0.5))(P), 0.015)
    return d


# --- Fangs: two lower canines rising over the upper lip (underbite), leaning out ---


def fangs(P):
    d = None
    for s in (-1, 1):
        root = (s * 0.2, 1.7, 0.86)
        tip = (s * 0.23, 1.86, 0.88)
        f = capsule(root, tip, 0.05, 0.012)(P)
        d = f if d is None else np.minimum(d, f)
    return d


spec.rigid += [
    {"name": "nose", "fn": nose_fn, "lo": (-0.34, 1.84, 0.74), "hi": (0.34, 2.18, 1.12), "voxel": 0.005,
     "colors": lambda P: paint(P, NOSE, [(lambda Q: (2.08 - Q[..., 1]) * -1, 0x4A4A58, 0.03, 0)]),
     "bone": "wrinkle", "tris": 3000, "gloss": 0.5},
    {"name": "fangs", "fn": fangs, "lo": (-0.33, 1.62, 0.76), "hi": (0.33, 1.94, 0.98), "voxel": 0.004,
     "colors": TOOTH, "bone": "jaw", "tris": 2000, "ao": False, "gloss": 0.35},
]

# --- Overalls: a denim shell over the trunk and thighs, bib, straps over the shoulders ---
STRAPS = []
for s in (-1, 1):
    path = [(s * 0.28, 1.4, 0.62), (s * 0.36, 1.58, 0.14), (s * 0.3, 1.4, -0.54), (0, 1.1, -0.66), (-s * 0.32, 0.88, -0.64)]
    STRAPS += [capsule(a, b, 0.05) for a, b in zip(path, path[1:])]


def overalls_shape(cloth, P):
    region = np.minimum(
        rbox((0, 0.7, 0), (1.5, 0.42, 1.5), 0.0)(P),  # trousers: waist to mid-thigh
        rbox((0, 1.2, 0.46), (0.42, 0.3, 0.42), 0.06)(P),  # bib
    )
    d = np.maximum(cloth, region)
    d = -smin(-d, capsule((0, 0.72, -0.58), (0, 0.95, -0.84), 0.15)(P), 0.02)  # tail hole
    for st in STRAPS:
        d = smin(d, st(P), 0.015)
    return d


def overalls_colors(P):
    strap_d = np.min(np.stack([st(P) for st in STRAPS], -1), -1)
    return paint(P, DENIM, [(lambda Q, d=strap_d: d - 0.01, DENIM_DARK, 0.004, 0)])


spec.garments.append({
    "name": "overalls",
    "follows": lambda p: (p.bone or "") in ("spine", "hips") or (p.bone or "").startswith("thigh"),
    "thickness": 0.045,
    "shape": overalls_shape,
    "lo": (-1.1, 0.2, -1.0), "hi": (1.1, 1.75, 1.1),
    "colors": overalls_colors,
})
for s, n in SIDES:
    spec.rigid.append({"name": f"button.{n}", "fn": ellipsoid((s * 0.28, 1.4, 0.68), (0.06, 0.06, 0.035)),
                       "lo": (s * 0.28 - 0.1, 1.3, 0.6), "hi": (s * 0.28 + 0.1, 1.5, 0.76), "voxel": 0.005,
                       "colors": BRASS, "bone": "spine", "tris": 800, "gloss": 0.8})

# --- Hook: the straw hat, WIDE and lifted clear of the skull (a sagging brim, a crown, a red
# band), tilted back 8°: it must read first from the game camera ---
HAT_Y = 2.94


def brim(P):
    Q = P.copy()
    rad = np.hypot(Q[..., 0], Q[..., 2] - 0.04) / 1.3
    Q[..., 1] = Q[..., 1] + 0.16 * rad * rad  # the rim sags
    return rcylinder((0, HAT_Y, 0.04), 1.3, 0.065, 0.06)(Q)


def hat_fn(P):
    crown = ellipsoid((0, HAT_Y + 0.14, 0.04), (0.66, 0.44, 0.66))(P)
    return smin(brim(P), np.maximum(crown, HAT_Y - 0.02 - P[..., 1]), 0.06)


def hat_colors(P):
    # Woven straw: faint concentric rings on the brim, darker underside.
    ring = np.abs((np.hypot(P[..., 0], P[..., 2] - 0.04) % 0.16) - 0.08) - 0.012
    return paint(P, STRAW, [(lambda Q: ring, STRAW_DARK, 0.01, 0), (lambda Q: HAT_Y - 0.02 - Q[..., 1], STRAW_DARK, 0.03, 0)])


HAT_TILT = ((0, HAT_Y, 0), math.radians(-8))
spec.rigid += [
    {"name": "hat", "fn": hat_fn, "lo": (-1.42, HAT_Y - 0.35, -1.38), "hi": (1.42, HAT_Y + 0.62, 1.46), "voxel": 0.01,
     "colors": hat_colors, "bone": "head", "tris": 7000, "gloss": 0.08, "tilt": HAT_TILT},
    {"name": "hatband", "fn": rcylinder((0, HAT_Y + 0.11, 0.04), 0.7, 0.09, 0.03),
     "lo": (-0.8, HAT_Y - 0.05, -0.76), "hi": (0.8, HAT_Y + 0.27, 0.84), "voxel": 0.006,
     "colors": BAND, "bone": "head", "tris": 5000, "gloss": 0.2, "tilt": HAT_TILT},
]

# --- Weapon: the pitchfork in the left fist (silhouette first: thick wood, chunky metal head,
# three tines curving up, a chipped yoke) ---
to_local, box, _ = held_frame(spec.fist, (0.0, 0.6, 2.45))


def fork_wood(Q):
    return np.minimum(capsule((0, 0, -0.95), (0, 0, 1.3), 0.1, 0.08)(Q), ellipsoid((0, 0, -1.0), (0.13, 0.13, 0.1))(Q))


def fork_wraps(Q):
    return np.min(np.stack([torus_z(z, 0.103, 0.028)(Q) for z in (-0.16, -0.04, 0.08)], -1), -1)


def fork_metal(Q):
    W = Q.copy()
    W[..., 1] = W[..., 1] - 0.6 * W[..., 0] ** 2  # yoke ends bend up
    yoke = rbox((0, 0.02, 1.58), (0.4, 0.065, 0.08), 0.05)(W)
    yoke = -smin(-yoke, ellipsoid((0.39, 0.1, 1.63), (0.05, 0.05, 0.05))(Q), 0.01)  # the chip
    d = np.minimum(yoke, capsule((0, 0, 1.26), (0, 0, 1.5), 0.095, 0.135)(Q))  # collar
    for x0, length in ((-0.32, 0.76), (0.0, 0.86), (0.32, 0.7)):
        splay = np.sign(x0) * 0.14
        p0, p1, p2 = (x0, 0.0, 1.62), (x0 + splay * 0.5, 0.07, 1.62 + length * 0.55), (x0 + splay, 0.1, 1.62 + length)
        F = Q.copy()
        F[..., 1] = F[..., 1] / 0.75  # flattened tines
        d = np.minimum(d, np.minimum(capsule(p0, p1, 0.08, 0.055)(F), capsule(p1, p2, 0.055, 0.035)(F)) * 0.75)
    return d


def fork_fn(P):
    Q = to_local(P)
    return np.minimum(np.minimum(fork_wood(Q), fork_wraps(Q)), fork_metal(Q))


def fork_colors(P):
    Q = to_local(P)
    return paint(P, WOOD, [(lambda _: fork_wraps(Q) - 0.004, LEATHER, 0.004, 0),
                           (lambda _: fork_metal(Q) - 0.004, STEEL, 0.004, 0),
                           (lambda _: np.maximum(fork_metal(Q) - 0.004, 2.0 - Q[..., 2]), STEEL_EDGE, 0.05, 0)])


def fork_gloss(P):
    return np.where(fork_metal(to_local(P)) < 0.01, 0.7, 0.12)


lo, hi = box(-1.15, 2.6, 0.6, -0.3, 0.35)
spec.rigid.append({"name": "fork", "fn": fork_fn, "lo": lo, "hi": hi, "voxel": 0.008, "colors": fork_colors,
                   "bone": "hand.L", "tris": 9000, "gloss": fork_gloss})

build(spec)
