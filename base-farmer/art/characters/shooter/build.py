"""Lorgnon (shooter) — build script (Blender 4.5, headless).

    ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/shooter/build.py

Brief (character-3d skill §1): « hibou érudit à monocle, tireur pédant qui arrose de très loin
avec sa lance en cuivre » — he never misses, and he wants you to know it.
Personality: hautain, posé, précis; default expression "hautain" (one eye squinting behind the
monocle, brows raised in disdain, beak shut).
Hook: the ear tufts + the gold monocle (top-down: two tufts and a glint).
Shape: tall rounded RECTANGLE (stable, composed): straight sides, big facial disc, huge eyes.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))

import numpy as np  # noqa: E402

from charkit import SIDES, Spec, build, held_frame, torus_z  # noqa: E402
from sdfkit import Prim, capsule, ellipsoid, paint, rcylinder, smin  # noqa: E402

# Palette v2 (Supercell pass): dominant warm chestnut, secondary cream facial disc and belly,
# accents: gold monocle, red bow tie, copper and brass hose.
BROWN = 0xA8653A
BROWN_DARK = 0x5A3118
DISC = 0xFFEFD0  # facial disc: the lightest large area
BELLY = 0xF4DDB0
CHEVRON = 0xB6773F
BEAK = 0xF5B43A
FEET = 0xF7A52A
GOLD = 0xFFC83A
GLASS = 0xBFE6F2
BOWTIE = 0xD82C48
COPPER = 0xE3742A
BRASS = 0xFFC24A

spec = Spec(
    id="shooter",
    brief="hibou érudit à monocle, tireur pédant",
    head_c=(0.0, 2.2, 0.0),
    head_r=(0.94, 0.76, 0.8),
    body_c=(0.0, 1.0, 0.0),
    body_r=(0.7, 0.66, 0.58),  # tall: the straightest silhouette of the roster
    body_box=0.55,  # v2: a rounded RECTANGLE (his shape), flat tense sides
    head_box=0.4,
    head_blend=0.12,
    shoulder=(0.62, 1.3, 0.0),
    fist=(0.9, 0.68, 0.32),
    hip=(0.26, 0.5, 0.0),
    foot=(0.3, 0.08, 0.18),
    foot_r=(0.22, 0.08, 0.28),
    arm_r=0.14,
    leg_r=0.13,
    eye_y=2.18,
    eye_x=0.36,
    eye_r=0.22,  # owls: the biggest eyes
    iris=0xF29B1E,
    iris_light=0xFFD98A,
    limbal=0x5A3006,
    brow_color=BROWN_DARK,
    brow_angry=-0.12,  # brows lifted at the inner end: haughty, not angry
    brow_r=0.075,
    brow_lift=(0.1, -0.04),  # left brow high (disdain), right one down on the monocle
    mouth="beak",
    mouth_y=1.92,
    mouth_w=0.2,
    skin=BROWN,
    face=DISC,
    paw=BROWN_DARK,  # wing tips
    feet=FEET,
    hand="wing",  # birds: the whole arm is a wing ending in feather fingers
    foot_style="bird",
)

# --- Facial disc (two lobes around the eyes), ear tufts, belly with chevrons ---
spec.extra_skin += [Prim(ellipsoid((0, 2.12, 0.42), (0.86, 0.6, 0.45)), "head", 0.14)]  # flat face
for s, n in SIDES:
    # Ear tufts (v2): longer, flared out, a crisp tapering point: his silhouette's corners.
    spec.extra_skin.append(Prim(capsule((s * 0.52, 2.76, -0.04), (s * 0.82, 3.36, -0.14), 0.16, 0.025), f"ear.{n}", 0.06))
    spec.extra_bones.append((f"ear.{n}", (s * 0.52, 2.76, -0.04), (s * 0.82, 3.36, -0.14), "head"))
spec.extra_bones.append(("tail", (0, 0.7, -0.5), (0, 0.5, -0.75), "hips"))
spec.extra_skin.append(Prim(capsule((0, 0.72, -0.5), (0, 0.52, -0.78), 0.14, 0.06), "tail", 0.06))

disc = lambda P: np.minimum(ellipsoid((0.36, 2.16, 0.6), (0.38, 0.38, 0.5))(P),  # noqa: E731
                            ellipsoid((-0.36, 2.16, 0.6), (0.38, 0.38, 0.5))(P))
chevrons = lambda P: np.maximum(  # noqa: E731
    np.abs(np.mod(P[..., 1] - 0.15 * np.abs(P[..., 0]), 0.16) - 0.08) - 0.018,
    ellipsoid((0, 1.0, 0.3), (0.5, 0.5, 0.4))(P),
)
spec.extra_paint += [
    (ellipsoid((0, 1.0, 0.35), (0.52, 0.55, 0.4)), BELLY, 0.04, 0),
    (chevrons, CHEVRON, 0.004, 0),
    (disc, DISC, 0.02, 0.01),
    (lambda P: P[..., 1] - 0.36, FEET, 0.02, 0),
]

# --- Beak: small, hooked down ---


def beak_upper(P):
    return smin(ellipsoid((0, 2.0, 0.78), (0.13, 0.11, 0.16))(P), capsule((0, 2.0, 0.86), (0, 1.86, 0.98), 0.07, 0.02)(P), 0.04)


def beak_lower(P):
    return ellipsoid((0, 1.88, 0.76), (0.1, 0.06, 0.12))(P)


spec.beak = {
    "upper": beak_upper, "upper_box": ((-0.25, 1.75, 0.55), (0.25, 2.15, 1.05)),
    "lower": beak_lower, "lower_box": ((-0.2, 1.78, 0.6), (0.2, 1.98, 0.92)),
    "colors": BEAK, "colors_lower": 0xB8962E,
}

# --- Hook: gold monocle on the right eye with its chain; bow tie ---
eye_front = np.array((-0.36, 2.18, 0.0))
from charkit import eye_centre_z  # noqa: E402

eye_front[2] = eye_centre_z(spec) + spec.eye_r + 0.03


def monocle(P):
    Q = P - eye_front.astype(np.float32)
    ring = torus_z(0, 0.28, 0.045)(Q)  # bigger, thicker: readable from the game camera
    chain = capsule(tuple(eye_front + (-0.18, -0.16, -0.02)), (-0.42, 1.35, 0.5), 0.016)(P)
    return smin(ring, chain, 0.02)


spec.rigid += [
    {"name": "monocle", "fn": monocle, "lo": (-0.8, 1.25, 0.25), "hi": (0.0, 2.55, 1.0),
     "voxel": 0.005, "colors": GOLD, "bone": "head", "tris": 6000, "ao": False, "gloss": 0.85},
    {"name": "bowtie", "fn": lambda P: smin(np.minimum(
        ellipsoid((0.16, 1.42, 0.5), (0.16, 0.1, 0.06), (0, 0, 0.3))(P),
        ellipsoid((-0.16, 1.42, 0.5), (0.16, 0.1, 0.06), (0, 0, -0.3))(P)),
        ellipsoid((0, 1.42, 0.53), (0.06, 0.06, 0.05))(P), 0.02),
     "lo": (-0.4, 1.25, 0.35), "hi": (0.4, 1.6, 0.65), "voxel": 0.005, "colors": BOWTIE, "bone": "spine", "tris": 3000},
]

# --- Weapon: copper watering lance with a brass nozzle, held in the left wing-fist ---
to_local, box, _ = held_frame((0.9, 0.68, 0.32), (0.0, 0.15, 1.0))


def lance(P):
    Q = to_local(P)
    d = capsule((0, 0, -0.45), (0, 0, 1.3), 0.075, 0.065)(Q)
    d = smin(d, capsule((0, 0, 1.3), (0, 0, 1.55), 0.09, 0.13)(Q), 0.04)  # flared brass nozzle
    d = smin(d, capsule((0, -0.02, -0.45), (0, -0.3, -0.75), 0.06, 0.05)(Q), 0.03)  # hose stub
    return d


def lance_colors(P):
    Q = to_local(P)
    return paint(P, COPPER, [(lambda _: 1.28 - Q[..., 2], BRASS, 0.01, 0), (lambda _: Q[..., 2] + 0.45, 0x3A6A3A, 0.01, 0)])


lo, hi = box(-0.85, 1.7, 0.3, -0.45, 0.25)
spec.rigid.append({"name": "lance", "fn": lance, "lo": lo, "hi": hi, "voxel": 0.007, "colors": lance_colors,
                   "bone": "hand.L", "tris": 6000, "gloss": 0.8})

build(spec)
