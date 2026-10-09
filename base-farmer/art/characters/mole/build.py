"""Ernest (burrower, hypothesis) — build script (Blender 4.5, headless).

    ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/mole/build.py

Brief (character-3d skill §1): « taupe myope et grincheuse, chef de chantier, qui surgit de
sous terre là où on ne l'attend pas » — he can't see you, he just knows you're there.
Personality: grincheux, bougon, têtu; default expression "grincheux" (knotted brows, frown).
Hook: the yellow miner helmet with its lamp + the huge pink shovel hands with claws (top-down:
a yellow dome and two pink paddles).
Shape: low wide PEAR: the heaviest bottom, short legs, a long snout ending in a pink star.
Gag: tiny myopic eyes made HUGE by thick bottle-bottom glasses (big eyes for the game camera).
References (snippets only): star-nosed mole designs dressed as modern mine workers; cartoon
moles with dark fur, a small pink nose and sharp extended claws.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))

import numpy as np  # noqa: E402

from charkit import SIDES, Spec, build, eye_centre_z  # noqa: E402
from sdfkit import Prim, capsule, ellipsoid, paint, rbox, rcylinder, smin  # noqa: E402

# Palette: dominant anthracite velvet, secondary safety orange vest, accents helmet yellow and
# pink (nose, hands, feet).
FUR = 0x55505E
FUR_LIGHT = 0x8A8494
PINK = 0xF79AAE
PINK_DARK = 0xD06A86
CLAW = 0xFFF0D8
VEST = 0xFF8A1E
REFLECT = 0xE6EEF2
HELMET = 0xFFCC2E
HELMET_DARK = 0xD99A12
LAMP = 0xFFF6C0
FRAME = 0x2A2024

spec = Spec(
    id="mole",
    brief="taupe myope et grincheuse, chef de chantier, qui surgit de sous terre",
    head_c=(0.0, 2.0, 0.06),
    head_r=(0.84, 0.7, 0.74),
    head_blend=0.16,
    body_c=(0.0, 0.86, 0.0),
    body_r=(0.92, 0.68, 0.72),  # pear: the heaviest bottom
    body_box=0.2,
    shoulder=(0.72, 1.24, 0.06),
    fist=(1.12, 0.74, 0.44),
    hand_scale=1.55,  # shovel hands: his weapon
    hip=(0.38, 0.4, 0.0),
    foot=(0.42, 0.12, 0.2),
    foot_r=(0.28, 0.12, 0.34),
    arm_r=0.18,
    leg_r=0.2,
    eye_y=2.14,
    eye_x=0.3,
    eye_r=0.19,
    iris=0x3A2A22,  # nearly black: a mole's bead eyes, magnified
    iris_light=0x8A6A52,
    limbal=0x140C08,
    brow_color=0x2A2630,
    brow_r=0.08,  # thick grumpy brows
    brow_angry=0.35,
    brow_lift=(0.0, 0.03),
    mouth="decal",
    mouth_y=1.6,
    mouth_w=0.22,
    skin=FUR,
    face=FUR_LIGHT,
    paw=PINK,
    feet=PINK,
    skin_gloss=lambda P: 0.12 + 0.4 * (ellipsoid((0, 1.86, 1.12), (0.3, 0.3, 0.12))(P) < 0),
)

# --- Snout: a long tapering trunk ending in a pink STAR nose (the star-nosed mole) ---
NOSE = (0, 1.84, 1.1)
spec.extra_skin += [
    Prim(capsule((0, 1.9, 0.56), (0, 1.84, 1.0), 0.24, 0.15), "head", 0.12),
    Prim(ellipsoid(NOSE, (0.14, 0.12, 0.08)), "head", 0.03),
]
for k in range(10):
    a = k / 10 * 2 * math.pi + math.pi / 10
    tip = (math.cos(a) * 0.22, NOSE[1] + math.sin(a) * 0.2, NOSE[2] + 0.02)
    spec.extra_skin.append(Prim(capsule((math.cos(a) * 0.08, NOSE[1] + math.sin(a) * 0.07, NOSE[2]), tip, 0.045, 0.03), "head", 0.025))
spec.extra_paint += [
    (lambda P: 1.02 - P[..., 2], PINK, 0.01, 0),  # everything past the trunk is pink
    (ellipsoid((0, 1.92, 0.5), (0.5, 0.36, 0.4)), FUR_LIGHT, 0.04, 0),  # lighter face/muzzle
    (ellipsoid((0, 0.9, 0.5), (0.55, 0.5, 0.35)), FUR_LIGHT, 0.04, 0),  # lighter belly
]
spec.extra_paint.append((lambda P: 1.02 - P[..., 2], PINK, 0.01, 0))  # nose wins over the face tint
for s_ in (-1, 1):  # whole shovel hands pink (the default paw region is sized for normal hands)
    spec.extra_paint.append((ellipsoid((s_ * spec.fist[0], spec.fist[1], spec.fist[2] + 0.04), (0.46, 0.42, 0.48)), PINK, 0.03, 0))

# --- Ears: none visible (moles): small fur tufts at the sides instead ---
spec.extra_bones.append(("tail", (0, 0.7, -0.66), (0, 0.6, -0.9), "hips"))
spec.extra_skin.append(Prim(capsule((0, 0.72, -0.64), (0, 0.6, -0.9), 0.07, 0.04), "tail", 0.03))
spec.extra_paint.append((ellipsoid((0, 0.62, -0.88), (0.1, 0.12, 0.12)), PINK, 0.01, 0))

# --- Safety vest: a cloth shell on the torso, open at the front, two reflective bands ---


def vest_shape(cloth, P):
    region = rbox((0, 1.0, 0), (1.0, 0.5, 1.0), 0.05)(P)
    opening = np.maximum(np.abs(P[..., 0]) - 0.14, -P[..., 2])  # open front (negative inside the gap)
    return np.maximum.reduce([cloth, region, -opening])


spec.garments.append({
    "name": "vest",
    "follows": lambda p: p.bone == "spine",
    "thickness": 0.045,
    "shape": vest_shape,
    "lo": (-1.1, 0.4, -0.95), "hi": (1.1, 1.6, 0.95),
    "colors": lambda P: paint(P, VEST, [(lambda Q: np.abs(Q[..., 1] - 0.82) - 0.05, REFLECT, 0.004, 0),
                                        (lambda Q: np.abs(Q[..., 1] - 1.12) - 0.05, REFLECT, 0.004, 0)]),
})

# --- Hook: yellow miner helmet with a front lamp ---


def helmet(P):
    dome = np.maximum(ellipsoid((0, 2.44, 0.0), (0.86, 0.7, 0.82))(P), 2.44 - P[..., 1])
    brim = rcylinder((0, 2.46, 0.08), 0.92, 0.035, 0.03)(P)
    ridge = np.maximum(capsule((0, 2.7, -0.76), (0, 3.15, 0.0), 0.07)(P), 2.44 - P[..., 1])
    lamp = rcylinder((0, 2.74, 0.8), 0.16, 0.1, 0.04, rot=(math.pi / 2 - 0.2, 0, 0))(P)
    return smin(smin(smin(dome, brim, 0.03), ridge, 0.03), lamp, 0.04)


def helmet_colors(P):
    lens = ellipsoid((0, 2.77, 0.92), (0.13, 0.13, 0.06))
    return paint(P, HELMET, [(lambda Q: 2.5 - Q[..., 1], HELMET_DARK, 0.01, 0), (lens, LAMP, 0.005, 0)])


spec.rigid.append({"name": "helmet", "fn": helmet, "lo": (-1.1, 2.38, -1.0), "hi": (1.1, 3.25, 1.1), "voxel": 0.007,
                   "colors": helmet_colors, "bone": "head", "tris": 7000, "gloss": 0.75})

# --- Bottle-bottom glasses: thick round frames that magnify his eyes ---
ez = eye_centre_z(spec)
GZ = ez + spec.eye_r + 0.04


def glasses(P):
    d = np.full(P.shape[:-1], 9.0, np.float32)
    for s in (-1, 1):
        Q = P - np.array((s * spec.eye_x, spec.eye_y, GZ), np.float32)
        d = np.minimum(d, np.hypot(np.hypot(Q[..., 0], Q[..., 1]) - 0.25, Q[..., 2] * 0.6) - 0.04)
        d = np.minimum(d, capsule((s * (spec.eye_x + 0.25), spec.eye_y, GZ - 0.02), (s * 0.78, spec.eye_y + 0.06, 0.1), 0.03)(P))
    return np.minimum(d, capsule((-0.06, spec.eye_y + 0.03, GZ + 0.02), (0.06, spec.eye_y + 0.03, GZ + 0.02), 0.035)(P))


spec.rigid.append({"name": "glasses", "fn": glasses, "lo": (-0.85, 1.8, 0.0), "hi": (0.85, 2.45, 1.05), "voxel": 0.004,
                   "colors": FRAME, "bone": "head", "tris": 5000, "ao": False, "gloss": 0.6})

# --- Whiskers: three per side off the trunk ---


def whiskers(P):
    d = np.full(P.shape[:-1], 9.0, np.float32)
    for s in (-1, 1):
        for dy in (-0.06, 0.0, 0.06):
            d = np.minimum(d, capsule((s * 0.14, 1.82 + dy, 0.94), (s * 0.5, 1.8 + dy * 2.2, 0.98), 0.012, 0.006)(P))
    return d


spec.rigid.append({"name": "whiskers", "fn": whiskers, "lo": (-0.6, 1.6, 0.85), "hi": (0.6, 2.0, 1.05), "voxel": 0.003,
                   "colors": 0xEDE6F2, "bone": "head", "tris": 2000, "ao": False})

# --- Shovel claws: four long cream claws on each hand ---


def claws_for(sgn):
    fx, fy, fz = spec.fist
    k = spec.hand_scale

    def fn(P):
        d = np.full(P.shape[:-1], 9.0, np.float32)
        for dx in (-0.12, -0.04, 0.04, 0.12):
            a = (sgn * fx + sgn * dx * k, fy - 0.1 * k, fz + 0.12 * k)
            b = (sgn * fx + sgn * dx * k * 1.15, fy - 0.3 * k, fz + 0.3 * k)
            d = np.minimum(d, capsule(a, b, 0.05, 0.012)(P))
        return d

    lo = (sgn * fx - 0.45 * k, fy - 0.45 * k, fz - 0.05)
    hi = (sgn * fx + 0.45 * k, fy, fz + 0.5 * k)
    return fn, tuple(np.minimum(lo, hi)), tuple(np.maximum(lo, hi))


for sgn, n in SIDES:
    fn, lo, hi = claws_for(sgn)
    spec.rigid.append({"name": f"claws.{n}", "fn": fn, "lo": lo, "hi": hi, "voxel": 0.004,
                       "colors": CLAW, "bone": f"hand.{n}", "tris": 3000, "gloss": 0.5})

build(spec)
