"""Marguerite (artillery, hypothesis) — build script (Blender 4.5, headless).

    ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/cow/build.py

Brief (character-3d skill §1): « fermière placide et costaude qui bombarde les bases ennemies
à coups de bidons de lait » — nothing rushes her, not even a war.
Personality: imperturbable, lente, sûre d'elle; default expression "placide" (heavy lids,
closed smile) with a daisy in the corner of the mouth.
Hook: short cream horns + a brown curly forelock + the brass cowbell (top-down: two horns).
Shape: BELL (heavy at the bottom): the widest hips of the roster, a smaller head.
References (snippets only, not model sheets): Maggie (Disney, Home on the Range 2004):
brown forelock, cowbell, long lashes, dark hooves; stylized game cows: one big light muzzle
with two dark nostrils, bold simplified spots, stubby legs with dark hooves.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))

import numpy as np  # noqa: E402

from charkit import SIDES, Spec, build  # noqa: E402
from sdfkit import Prim, capsule, ellipsoid, paint, rbox, rcylinder, smin  # noqa: E402

# Palette: dominant warm off-white, secondary bold near-black spots (the only black & white
# character: reads apart from everyone), accents pink muzzle, brass bell, cream horns.
WHITE = 0xFBF4E6
SPOT = 0x2E2A33
MUZZLE = 0xF6A9B4
MUZZLE_DARK = 0xC9607A
HOOF = 0x3B3240
HORN = 0xF2DDB0
HORN_TIP = 0xB89A6A
FORELOCK = 0x8A4A26
BRASS = 0xFFC24A
BRASS_DARK = 0xB57A1E
STRAP = 0xE0A42A
TIN = 0xDCE4EC
TIN_DARK = 0x8E9AAA
DAISY = 0xFFFDF5
DAISY_CORE = 0xFFC83A
STEM = 0x5FA23C

spec = Spec(
    id="cow",
    brief="fermière placide et costaude qui bombarde à coups de bidons de lait",
    # Bell shape: big low body, wide hips, a slightly smaller head sitting forward.
    head_c=(0.0, 2.2, 0.06),
    head_r=(0.9, 0.72, 0.78),
    head_box=0.2,
    head_blend=0.12,
    body_c=(0.0, 0.9, 0.0),
    body_r=(0.96, 0.7, 0.74),  # the widest, lowest body of the roster
    body_box=0.3,
    # Arms held clear of the big body (they fused into the flanks): shoulders out, fists wide.
    shoulder=(0.82, 1.32, 0.06),
    fist=(1.3, 0.76, 0.44),
    hand_scale=1.3,
    hip=(0.4, 0.42, 0.0),
    foot=(0.44, 0.12, 0.2),
    foot_r=(0.32, 0.12, 0.34),
    arm_r=0.19,
    leg_r=0.24,
    eye_y=2.32,
    eye_x=0.34,
    eye_r=0.2,
    iris=0x8A5A2E,  # warm hazel: gentle
    iris_light=0xE8B878,
    limbal=0x3A2210,
    brow_color=0x6A3A1E,
    brow_r=0.06,
    brow_lift=(0.06, 0.0),  # one brow up: unimpressed
    brow_angry=-0.04,  # soft, slightly sad-ish brows: placid, never angry
    mouth="decal",
    mouth_y=1.62,
    mouth_w=0.3,
    skin=WHITE,
    face=MUZZLE,
    paw=HOOF,
    feet=HOOF,
    hand="hoof",  # crisp rigid hooves (charkit.hoof_parts), no mitten
    foot_style="hoof",
    skin_gloss=lambda P: 0.1 + 0.35 * (ellipsoid((0, 1.76, 0.95), (0.55, 0.36, 0.25))(P) < 0),
)

# --- Muzzle: one big wide flat pad on the lower face (the cow's signature) ---
MUZ_C = (0, 1.76, 0.7)
spec.extra_skin += [
    Prim(ellipsoid(MUZ_C, (0.6, 0.38, 0.4)), "head", 0.12),
    Prim(ellipsoid((0.2, 1.86, 1.08), (0.07, 0.05, 0.05)), None, 0.015, sub=True),
    Prim(ellipsoid((-0.2, 1.86, 1.08), (0.07, 0.05, 0.05)), None, 0.015, sub=True),
]
muzzle_paint = ellipsoid((0, 1.74, 0.78), (0.64, 0.42, 0.42))
spec.extra_paint += [
    (muzzle_paint, MUZZLE, 0.01, 0),
    (ellipsoid((0.2, 1.86, 1.07), (0.09, 0.07, 0.06)), MUZZLE_DARK, 0.005, 0),
    (ellipsoid((-0.2, 1.86, 1.07), (0.09, 0.07, 0.06)), MUZZLE_DARK, 0.005, 0),
]

# --- Ears: floppy, sideways, under the horns; pink inside ---
for s, n in SIDES:
    spec.extra_skin.append(Prim(ellipsoid((s * 0.98, 2.42, -0.02), (0.32, 0.1, 0.17), (0, 0, s * -0.25)), f"ear.{n}", 0.06))
    spec.extra_bones.append((f"ear.{n}", (s * 0.72, 2.48, -0.02), (s * 1.26, 2.34, -0.02), "head"))
    spec.extra_paint.append((ellipsoid((s * 1.02, 2.43, 0.06), (0.24, 0.06, 0.1), (0, 0, s * -0.25)), MUZZLE, 0.01, 0))

# --- Bold spots (simplified graphic shapes, big): back, one flank, one shoulder, one ear ---
spots = [
    ((0.35, 1.1, -0.55), (0.45, 0.38, 0.35)),
    ((-0.62, 0.7, 0.2), (0.3, 0.3, 0.45)),
    ((-0.5, 1.45, -0.3), (0.32, 0.25, 0.3)),
    ((0.75, 0.55, 0.35), (0.2, 0.22, 0.25)),
    ((-1.05, 2.4, 0.0), (0.2, 0.15, 0.2)),  # left ear
    ((0.45, 2.55, -0.45), (0.38, 0.3, 0.35)),  # back of the head, right
    ((0.55, 1.0, 0.62), (0.26, 0.3, 0.2)),  # belly, front right: the front view reads "cow"
]
for c, r in spots:
    spec.extra_paint.insert(0, (ellipsoid(c, r), SPOT, 0.025, 0))  # soft edge: no jaggies

# --- Forelock: a brown curl tuft between the horns (Maggie) ---
for c, r in (((0, 2.9, 0.18), 0.15), ((0.17, 2.86, 0.3), 0.12), ((-0.16, 2.88, 0.26), 0.12), ((0.02, 2.82, 0.42), 0.11)):
    spec.extra_skin.append(Prim(ellipsoid(c, (r, r * 0.9, r)), "head", 0.04))  # round curls, not spikes
spec.extra_paint.append((ellipsoid((0, 2.94, 0.22), (0.32, 0.2, 0.32)), FORELOCK, 0.02, 0.01))

# --- Tail: a rope with a dark tuft ---
spec.extra_bones.append(("tail", (0, 0.8, -0.68), (0, 0.3, -1.0), "hips"))
tail = [(0, 0.82, -0.66), (0, 0.78, -0.86), (0.05, 0.6, -1.0), (0.08, 0.4, -1.04)]
for a, b in zip(tail, tail[1:]):
    spec.extra_skin.append(Prim(capsule(a, b, 0.055, 0.05), "tail", 0.02))
spec.extra_skin.append(Prim(ellipsoid((0.08, 0.3, -1.04), (0.1, 0.16, 0.1)), "tail", 0.04))
spec.extra_paint.append((ellipsoid((0.08, 0.3, -1.04), (0.13, 0.19, 0.13)), SPOT, 0.01, 0.01))

# --- Horns: short cream crescents, curving up and slightly forward (rigid, glossy) ---


def horns(P):
    d = np.full(P.shape[:-1], 9.0, np.float32)
    for s in (-1, 1):
        a, b, c = (s * 0.5, 2.7, -0.08), (s * 0.78, 2.9, -0.06), (s * 0.82, 3.12, 0.06)
        d = np.minimum(d, smin(capsule(a, b, 0.12, 0.09)(P), capsule(b, c, 0.09, 0.03)(P), 0.04))
    return d


spec.rigid.append({"name": "horns", "fn": horns, "lo": (-1.0, 2.5, -0.3), "hi": (1.0, 3.25, 0.25), "voxel": 0.006,
                   "colors": lambda P: paint(P, HORN, [(lambda Q: 3.0 - Q[..., 1], HORN_TIP, 0.03, 0)]),
                   "bone": "head", "tris": 4000, "gloss": 0.6})

# --- Cowbell: brass bell on a mustard strap, on the chest ---
BELL_C = np.array((0, 1.22, 0.82), np.float32)


def bell(P):
    Q = P - BELL_C
    body = rcylinder((0, -0.08, 0), 0.17, 0.14, 0.06)(Q)
    top = ellipsoid((0, 0.05, 0), (0.13, 0.1, 0.13))(Q)
    lip = rcylinder((0, -0.2, 0), 0.2, 0.03, 0.025)(Q)
    clap = ellipsoid((0, -0.25, 0.02), (0.05, 0.05, 0.05))(Q)
    strap = capsule((0, 0.12, -0.02), (0, 0.26, -0.12), 0.05)(Q)
    return np.minimum(smin(smin(body, top, 0.05), lip, 0.03), np.minimum(clap, strap))


spec.rigid.append({"name": "bell", "fn": bell, "lo": tuple(BELL_C - (0.3, 0.35, 0.3)), "hi": tuple(BELL_C + (0.3, 0.35, 0.3)),
                   "voxel": 0.005, "bone": "spine", "tris": 4000, "gloss": 0.85,
                   "colors": lambda P: paint(P, BRASS, [(lambda Q: (Q[..., 1] - BELL_C[1]) - 0.12, STRAP, 0.01, 0),
                                                        (lambda Q: -0.18 - (Q[..., 1] - BELL_C[1]), BRASS_DARK, 0.01, 0)])})

# --- The daisy in the corner of her mouth (her signature gag) ---
# The stem starts INSIDE the mouth (behind the lip line at the corner) and pokes out.
STEM_A, FLOWER = (0.1, 1.61, 0.88), np.array((0.6, 1.7, 1.14), np.float32)


def daisy(P):
    d = capsule(STEM_A, tuple(FLOWER), 0.018)(P)
    d = np.minimum(d, ellipsoid(tuple(FLOWER + (0, 0, 0.02)), (0.05, 0.05, 0.03))(P))
    for k in range(8):
        a = k / 8 * 2 * math.pi
        tip = FLOWER + (math.cos(a) * 0.13, math.sin(a) * 0.13, 0.0)
        d = np.minimum(d, capsule(tuple(FLOWER), tuple(tip), 0.03, 0.04)(P))
    return d


spec.rigid.append({"name": "daisy", "fn": daisy, "lo": (0.0, 1.5, 0.78), "hi": (0.85, 1.92, 1.3), "voxel": 0.004,
                   "bone": "head", "tris": 3000, "ao": False,
                   "colors": lambda P: paint(P, DAISY, [(ellipsoid(tuple(FLOWER), (0.07, 0.07, 0.07)), DAISY_CORE, 0.005, 0),
                                                        (capsule(STEM_A, tuple(FLOWER - (0.09, 0.03, 0)), 0.03), STEM, 0.005, 0)])})

# --- Backpack with a milk bottle sticking out (her ammo: she lobs bottles from it) ---
CANVAS = 0xB07A3E
CANVAS_DARK = 0x7A4E24
MILK = 0xFFFDF6
GLASS = 0xD6ECF2
CAP = 0xE8C040
PACK_C = (0, 1.1, -0.76)  # pressed against the back (no gap)


def backpack(P):
    d = rbox(PACK_C, (0.48, 0.44, 0.22), 0.12)(P)
    d = smin(d, rbox((0, 0.86, -0.98), (0.34, 0.15, 0.08), 0.06)(P), 0.03)  # front pocket
    for s_ in (-1, 1):
        a, b, c = (s_ * 0.28, 1.42, -0.76), (s_ * 0.4, 1.66, -0.2), (s_ * 0.44, 1.56, 0.42)
        d = np.minimum(d, np.minimum(capsule(a, b, 0.05)(P), capsule(b, c, 0.05)(P)))  # shoulder straps
    return d


def backpack_colors(P):
    flap = lambda Q: np.maximum(1.32 - Q[..., 1], -0.86 - Q[..., 2])  # noqa: E731
    return paint(P, CANVAS, [(flap, CANVAS_DARK, 0.01, 0)])


BOTTLE_C = np.array((0.16, 1.66, -0.8), np.float32)


def bottle(P):
    Q = P - BOTTLE_C
    d = rcylinder((0, 0, 0), 0.14, 0.24, 0.06)(Q)
    d = smin(d, ellipsoid((0, 0.25, 0), (0.11, 0.1, 0.11))(Q), 0.05)
    d = smin(d, rcylinder((0, 0.36, 0), 0.07, 0.07, 0.02)(Q), 0.03)
    return smin(d, rcylinder((0, 0.44, 0), 0.085, 0.03, 0.015)(Q), 0.01)


def bottle_colors(P):
    y = P[..., 1] - BOTTLE_C[1]
    # Milk in the bottom, empty glass above, a foil cap.
    return paint(P, MILK, [(lambda _: 0.12 - y, GLASS, 0.01, 0), (lambda _: 0.41 - y, CAP, 0.005, 0)])


spec.rigid += [
    {"name": "backpack", "fn": backpack, "lo": (-0.65, 0.65, -1.2), "hi": (0.65, 1.8, 0.55), "voxel": 0.008,
     "colors": backpack_colors, "bone": "spine", "tris": 7000, "gloss": 0.08},
    {"name": "bottle", "fn": bottle, "lo": tuple(BOTTLE_C - (0.2, 0.3, 0.2)), "hi": tuple(BOTTLE_C + (0.2, 0.52, 0.2)),
     "voxel": 0.005, "colors": bottle_colors, "bone": "spine", "tris": 4000, "gloss": 0.8},
]

build(spec)
