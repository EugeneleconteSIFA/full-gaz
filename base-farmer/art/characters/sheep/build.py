"""Bernadette (support, hypothesis) — build script (Blender 4.5, headless).

    ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/sheep/build.py

Brief (character-3d skill §1): « mamie brebis tricoteuse, douce en apparence, redoutable avec
ses pelotes » — she slows you down, then she tucks her friends in.
Personality: malicieuse, douce, rusée; default expression "malicieux" (one eye squinting, a
lopsided smile).
Hook: the wool CLOUD + a raspberry yarn-ball bun pierced by two knitting needles (top-down:
a pink dot with two sticks on a white cloud).
Shape: CLOUD (lumpy, round): clustered puffy wool clumps, a small dark face mask.
References (snippets only): stylized game sheep: clustered puffy wool clumps (toy-like), a
dark face mask, oversized glossy eyes, floppy ears, slim dark legs and dark hooves.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))

import numpy as np  # noqa: E402

from charkit import SIDES, Spec, build, eye_centre_z  # noqa: E402
from sdfkit import Prim, capsule, ellipsoid, paint, smin  # noqa: E402

# Palette: dominant cream wool, secondary grey-brown face, accent raspberry yarn, gold glasses.
WOOL = 0xFFF6E4
FACE = 0x6E5A50
MUZZLE = 0xA48A7C
LEGS = 0x4A3C38
HOOF = 0x2E2628
YARN = 0xE0457A
YARN_DARK = 0xA8285A
WOOD = 0xE2B57A
WOOD_KNOB = 0xFF8FB0
GOLD = 0xFFC83A

spec = Spec(
    id="sheep",
    brief="mamie brebis tricoteuse, redoutable avec ses pelotes",
    head_c=(0.0, 2.2, 0.08),
    head_r=(0.78, 0.74, 0.74),
    head_blend=0.14,
    body_c=(0.0, 1.0, 0.0),
    body_r=(0.82, 0.66, 0.66),
    shoulder=(0.64, 1.3, 0.04),
    fist=(1.06, 0.74, 0.4),
    hand_scale=1.05,
    hip=(0.3, 0.42, 0.0),
    foot=(0.34, 0.12, 0.16),
    foot_r=(0.22, 0.12, 0.26),
    arm_r=0.15,
    leg_r=0.14,  # slim dark legs under the cloud
    eye_y=2.22,
    eye_x=0.3,
    eye_r=0.2,
    iris=0x5FA86A,  # soft green: kind (and a little sly)
    iris_light=0xCDEBB0,
    limbal=0x24452A,
    brow_color=0xF2E6D0,  # pale woolly brows on the dark face
    brow_r=0.065,
    brow_lift=(0.08, -0.02),  # one brow up: mischief
    brow_angry=-0.06,
    mouth="decal",
    mouth_y=1.82,
    mouth_w=0.22,
    skin=WOOL,
    face=MUZZLE,
    paw=HOOF,
    feet=HOOF,
    lid_l=FACE,
    lid_r=FACE,
    hand="hoof",
    foot_style="hoof",
    skin_gloss=lambda P: 0.08 + 0.25 * (ellipsoid((0, 1.86, 0.78), (0.3, 0.2, 0.15))(P) < 0),
)

# --- Face: a small rounded muzzle in front of the dark mask ---
spec.extra_skin.append(Prim(ellipsoid((0, 1.9, 0.62), (0.36, 0.28, 0.26)), "head", 0.12))
spec.extra_skin += [Prim(ellipsoid((s * 0.08, 1.98, 0.88), (0.035, 0.025, 0.03)), None, 0.01, sub=True) for s in (-1, 1)]
face_mask = ellipsoid((0, 2.08, 0.42), (0.6, 0.56, 0.5))
spec.extra_paint += [
    (face_mask, FACE, 0.015, 0),
    (ellipsoid((0, 1.88, 0.7), (0.34, 0.26, 0.24)), MUZZLE, 0.015, 0),
    (lambda P: P[..., 1] - 0.5, LEGS, 0.02, 0),  # slim dark legs below the cloud
]
for s, n in SIDES:
    spec.extra_paint.append((capsule((s * 0.92, 0.98, 0.32), (s * 1.06, 0.74, 0.4), 0.2), LEGS, 0.02, 0))  # dark forearms

# --- Ears: floppy, sideways, dark, poking out of the wool ---
for s, n in SIDES:
    spec.extra_skin.append(Prim(ellipsoid((s * 0.86, 2.2, 0.08), (0.3, 0.09, 0.15), (0, 0, s * -0.4)), f"ear.{n}", 0.05))
    spec.extra_bones.append((f"ear.{n}", (s * 0.6, 2.32, 0.08), (s * 1.12, 2.06, 0.08), "head"))
    spec.extra_paint.append((ellipsoid((s * 0.9, 2.18, 0.08), (0.3, 0.12, 0.18), (0, 0, s * -0.4)), FACE, 0.01, 0))

# --- The wool cloud: clustered puffy clumps on the body and as a cap on the head ---
rng = np.random.default_rng(7)


def clumps(c, r, n, size, keep, bone, blend):
    gold = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        y = 1 - 2 * (i + 0.5) / n
        rad = math.sqrt(1 - y * y)
        a = gold * i
        d = np.array((math.cos(a) * rad, y, math.sin(a) * rad))
        p = np.array(c) + d * np.array(r)
        if not keep(p, d):
            continue
        k = size * (0.85 + 0.3 * rng.random())
        spec.extra_skin.append(Prim(ellipsoid(tuple(p), (k, k, k)), bone, blend))


# Body: a fleece over the torso, open at the bottom (the legs come out of it).
# Fewer, bigger, softer clumps (Supercell: big readable shapes, not bubble wrap); the sides
# stay clear so the arms read.
clumps((0, 1.02, 0), (0.76, 0.64, 0.66), 34, 0.27, lambda p, d: d[1] > -0.7 and abs(d[0]) < 0.8, "spine", 0.07)
# Head cap: top, back and sides of the skull; the face mask stays bare.
clumps((0, 2.28, 0.0), (0.72, 0.66, 0.68), 28, 0.23,
       lambda p, d: d[1] > 0.45 or (d[2] < -0.1 and d[1] > -0.3), "head", 0.06)
# Woolly sleeves on the upper arms.
for s, n in SIDES:
    spec.extra_skin += [Prim(ellipsoid((s * 0.72, 1.18, 0.12), (0.22, 0.22, 0.22)), f"upperarm.{n}", 0.05),
                        Prim(ellipsoid((s * 0.82, 1.02, 0.2), (0.2, 0.2, 0.2)), f"upperarm.{n}", 0.05)]

# --- Tail: a little wool puff ---
spec.extra_bones.append(("tail", (0, 0.8, -0.68), (0, 0.7, -0.9), "hips"))
spec.extra_skin.append(Prim(ellipsoid((0, 0.82, -0.8), (0.18, 0.18, 0.16)), "tail", 0.05))

# --- Hook: raspberry yarn-ball bun with two knitting needles through it ---
BUN = np.array((0.05, 3.02, -0.06), np.float32)


def bun(P):
    return ellipsoid(tuple(BUN), (0.3, 0.28, 0.3))(P)


def bun_colors(P):
    Q = P - BUN
    # Wound strands: bands around two tilted axes (a yarn ball, not a plain sphere).
    s1 = np.abs(np.sin((Q[..., 1] * 0.8 + Q[..., 0] * 0.6) * 38)) - 0.55
    s2 = np.abs(np.sin((Q[..., 2] * 0.8 - Q[..., 1] * 0.6) * 38)) - 0.55
    return paint(P, YARN, [(lambda _: np.maximum(s1, Q[..., 0] - 0.0), YARN_DARK, 0.02, 0),
                           (lambda _: np.maximum(s2, -Q[..., 0]), YARN_DARK, 0.02, 0)])


def needles(P):
    d = np.full(P.shape[:-1], 9.0, np.float32)
    for a, b in (((-0.42, 2.82, -0.1), (0.5, 3.3, 0.02)), ((0.48, 2.84, -0.2), (-0.36, 3.32, 0.12))):
        d = np.minimum(d, capsule(a, b, 0.03)(P))
        d = np.minimum(d, ellipsoid(b, (0.065, 0.065, 0.065))(P))  # knob
    return d


def needle_colors(P):
    knobs = [(ellipsoid(b, (0.08, 0.08, 0.08)), WOOD_KNOB, 0.005, 0) for b in ((0.5, 3.3, 0.02), (-0.36, 3.32, 0.12))]
    return paint(P, WOOD, knobs)


spec.rigid += [
    {"name": "bun", "fn": bun, "lo": tuple(BUN - 0.36), "hi": tuple(BUN + 0.36), "voxel": 0.006,
     "colors": bun_colors, "bone": "head", "tris": 5000, "gloss": 0.05},
    {"name": "needles", "fn": needles, "lo": (-0.55, 2.7, -0.35), "hi": (0.65, 3.45, 0.25), "voxel": 0.005,
     "colors": needle_colors, "bone": "head", "tris": 4000, "gloss": 0.5},
]

# --- Half-moon reading glasses low on the eyes, with a thin chain ---
ez = eye_centre_z(spec)


def glasses(P):
    d = np.full(P.shape[:-1], 9.0, np.float32)
    for s in (-1, 1):
        c = np.array((s * spec.eye_x, spec.eye_y - 0.04, ez + spec.eye_r + 0.05), np.float32)
        Q = P - c
        ring = np.hypot(np.hypot(Q[..., 0], Q[..., 1]) - 0.2, Q[..., 2]) - 0.022
        d = np.minimum(d, np.maximum(ring, Q[..., 1] - 0.0))  # lower half only: half-moon
        d = np.minimum(d, capsule((s * (spec.eye_x + 0.2), spec.eye_y - 0.04, c[2]), (s * 0.66, spec.eye_y + 0.02, 0.3), 0.018)(P))
    bridge = capsule((-0.1, spec.eye_y - 0.04, ez + spec.eye_r + 0.06), (0.1, spec.eye_y - 0.04, ez + spec.eye_r + 0.06), 0.02)(P)
    return np.minimum(d, bridge)


spec.rigid.append({"name": "glasses", "fn": glasses, "lo": (-0.75, 1.95, 0.2), "hi": (0.75, 2.35, 1.05), "voxel": 0.004,
                   "colors": GOLD, "bone": "head", "tris": 4000, "ao": False, "gloss": 0.85})

build(spec)
