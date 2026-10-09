"""Patatras (tank) — build script (Blender 4.5, headless).

    ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/tank/build.py

Brief (character-3d skill §1): « cochon cuistot placide et têtu qui encaisse tout sous sa
marmite et répond d'un coup de poêle » — Patatras is the sound of the pan.
Personality: placide, bon vivant, imperturbable; default expression "placide" (half-lidded,
soft closed smile), never angry for long.
Hook: the copper cooking-pot helmet (reads from the top-down camera).
Shape: ROUND everywhere (round = tank / friendly): widest body of the roster, short legs.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))

import numpy as np  # noqa: E402

from charkit import SIDES, Spec, build, held_frame, torus_z  # noqa: E402
from sdfkit import Prim, capsule, ellipsoid, paint, rbox, rcylinder, smin  # noqa: E402

# Palette v2 (docs/10 §6, Supercell pass): dominant saturated pink, secondary warm white apron,
# accent bright copper; values spread out so pink / snout / apron / copper read apart.
PINK = 0xF7869C
PINK_LIGHT = 0xFFC3CE  # snout disc: clearly the lightest large area of the face
PINK_DARK = 0xC2486A  # trotters, nostrils (raspberry)
BLUSH = 0xFF5C86
COPPER = 0xE3742A
COPPER_LIGHT = 0xFFB65A
COPPER_DARK = 0x9A4518  # the pot's band
APRON = 0xFFF7EA
APRON_STRIPE = 0xD9465A
IRON = 0x33333E
IRON_EDGE = 0xC5CCD8
WOOD = 0xA9692E

spec = Spec(
    id="tank",
    brief="cochon cuistot placide et têtu qui encaisse tout sous sa marmite",
    # v2 shape language (docs/10): a tank hero, not a small animal. A big, squarish head SUNK on
    # the shoulders (low, forward, tight head-body fusion), a massive box-ish torso leaning
    # forward, short thick arms held out from the body with big hands, short legs, wide feet.
    head_c=(0.0, 2.08, 0.1),
    head_r=(1.1, 0.8, 0.9),
    head_box=0.25,
    head_blend=0.08,
    body_c=(0.0, 0.92, 0.06),
    body_r=(0.9, 0.6, 0.7),  # the widest body of the roster
    body_box=0.45,
    shoulder=(0.82, 1.2, 0.08),
    fist=(1.26, 0.7, 0.42),
    hand_scale=1.45,
    hip=(0.38, 0.42, 0.02),
    foot=(0.44, 0.13, 0.22),
    foot_r=(0.36, 0.13, 0.38),
    arm_r=0.21,
    leg_r=0.25,
    eye_y=2.1,
    eye_x=0.36,
    eye_r=0.19,  # big enough to read under the heavy brows; the lids make them blasé
    iris=0x3F9BF0,  # clear blue: calm (a small accent of cool colour in all that pink)
    iris_light=0xC2E6FF,
    limbal=0x173A66,
    brow_color=0x6B2C3C,
    brow_r=0.085,  # thick brows: the blasé look is in the brows and the heavy lids
    brow_lift=(0.07, -0.01),  # one brow up: unimpressed, a little arrogant
    brow_angry=0.05,  # placid: almost flat brows
    mouth="decal",
    mouth_y=1.6,
    mouth_w=0.3,
    skin=PINK,
    face=PINK_LIGHT,
    paw=PINK_DARK,
    # The snout shines (wet), the skin stays matte.
    skin_gloss=lambda P: 0.1 + 0.4 * (ellipsoid((0, 1.84, 1.0), (0.38, 0.3, 0.16))(P) < 0),
)

# --- Snout (a flat disc on a short barrel), cheeks, ears, curly tail ---
spec.extra_skin += [
    # A big GRAPHIC snout: a short barrel ending in a crisp flat disc (a cylinder, not a soft
    # lump), the pig's signature, generous on purpose.
    Prim(ellipsoid((0, 1.84, 0.86), (0.38, 0.29, 0.22)), "head", 0.1),
    Prim(rcylinder((0, 1.84, 0.99), 0.35, 0.06, 0.035, rot=(math.pi / 2, 0, 0)), "head", 0.015),
    Prim(ellipsoid((0.115, 1.84, 1.06), (0.065, 0.095, 0.05)), None, 0.015, sub=True),
    Prim(ellipsoid((-0.115, 1.84, 1.06), (0.065, 0.095, 0.05)), None, 0.015, sub=True),
]
for s, n in SIDES:
    spec.extra_skin += [
        Prim(ellipsoid((s * 0.58, 1.76, 0.5), (0.4, 0.31, 0.34)), "head", 0.12),  # big jowls
        # Ears: big triangles flopping forward under the pot (they bob when he runs).
        Prim(ellipsoid((s * 0.78, 2.6, 0.22), (0.32, 0.08, 0.26), (0.6, 0, s * 0.55)), f"ear.{n}", 0.06),
    ]
    spec.extra_bones.append((f"ear.{n}", (s * 0.6, 2.66, 0.1), (s * 0.9, 2.56, 0.34), "head"))
spec.extra_bones.append(("tail", (0, 0.78, -0.62), (0, 0.9, -0.95), "hips"))
# Corkscrew tail: rooted on the back surface, then 1.5 turns of a spiral going out and up
# (thick enough to read from the game camera).

curl = [(0.0, 0.78, -0.6)]
for k in range(1, 13):
    a = k / 12 * 3 * math.pi
    curl.append((math.sin(a) * 0.1, 0.84 + k * 0.012 + math.cos(a) * 0.08 - 0.08, -0.72 - k * 0.022))
for a, b in zip(curl, curl[1:]):
    spec.extra_skin.append(Prim(capsule(a, b, 0.06, 0.055), "tail", 0.02))
spec.extra_paint += [
    (lambda P: rcylinder((0, 1.84, 1.0), 0.36, 0.09, 0.03, rot=(math.pi / 2, 0, 0))(P), PINK_LIGHT, 0.008, 0),
    (ellipsoid((0.115, 1.84, 1.05), (0.08, 0.11, 0.06)), PINK_DARK, 0.005, 0),
    (ellipsoid((-0.115, 1.84, 1.05), (0.08, 0.11, 0.06)), PINK_DARK, 0.005, 0),
    (ellipsoid((0.66, 1.74, 0.7), (0.2, 0.12, 0.14)), BLUSH, 0.05, 0),
    (ellipsoid((-0.66, 1.74, 0.7), (0.2, 0.12, 0.14)), BLUSH, 0.05, 0),
]

# --- Apron (cook): a cloth shell over the belly, striped hem, neck strap ---


def apron_shape(cloth, P):
    region = rbox((0, 0.8, 0.6), (0.7, 0.5, 0.5), 0.08)(P)
    return np.maximum(cloth, region)


spec.garments.append({
    "name": "apron",
    "follows": lambda p: p.bone == "spine" or (p.bone or "").startswith("hips"),
    "thickness": 0.04,
    "shape": apron_shape,
    "lo": (-1.0, 0.25, -0.2), "hi": (1.0, 1.5, 0.95),
    "colors": lambda P: paint(P, APRON, [(lambda Q: np.abs(Q[..., 1] - 0.42) - 0.035, APRON_STRIPE, 0.004, 0)]),
})

# --- Hook: copper cooking-pot helmet, with a lid knob and two little handles ---
# Wider than the head, low on the brow and a little askew: part of the silhouette, not a
# hat put on top. The hook must read from the game camera before anything else.
POT_TILT = (0.0, 0.0, 0.07)
POT_C = (0, 2.8, 0.06)


def pot_fn(P):
    from sdfkit import _rot

    Q = _rot(P, POT_C, POT_TILT)  # pot coordinates, centred on the pot, tilted
    d = rcylinder((0, 0, 0), 0.94, 0.27, 0.1)(Q)
    d = smin(d, rcylinder((0, -0.25, 0), 1.02, 0.045, 0.04)(Q), 0.03)  # rolled rim
    d = smin(d, ellipsoid((0, 0.36, 0), (0.17, 0.11, 0.17))(Q), 0.03)  # lid knob
    for s in (-1, 1):
        d = smin(d, capsule((s * 0.92, 0.08, 0), (s * 1.16, 0.1, 0), 0.08)(Q), 0.03)
    return d


def pot_colors(P):
    from sdfkit import gradient

    up = gradient(pot_fn, P)[:, 1]
    band = lambda Q: np.abs(Q[..., 1] - 2.76) - 0.05  # noqa: E731
    # Light copper only on the very top: the material's highlight does the shine (no flat pale lid).
    return paint(P, COPPER, [(lambda Q: 0.93 - up, COPPER_LIGHT, 0.04, 0), (band, COPPER_DARK, 0.01, 0)])


spec.rigid.append({"name": "pot", "fn": pot_fn, "lo": (-1.35, 2.38, -1.05), "hi": (1.35, 3.3, 1.15),
                   "voxel": 0.008, "colors": pot_colors, "bone": "head", "tris": 8000, "gloss": 0.85})

# --- Weapon: a cast-iron frying pan ("patatras!") held in the left fist ---
to_local, box, up_axis = held_frame((1.26, 0.7, 0.42), (0.05, 0.35, 1.0))


def pan_fn(P):
    Q = to_local(P)
    handle = capsule((0, 0, -0.35), (0, 0, 0.75), 0.075, 0.06)(Q)
    disc = rcylinder((0, 0, 1.35), 0.64, 0.075, 0.05)(Q)
    dish = rcylinder((0, 0.08, 1.35), 0.55, 0.075, 0.04)(Q)  # hollow on top
    pan = np.maximum(disc, -dish)
    return smin(smin(handle, pan, 0.05), capsule((0, 0, 0.7), (0, 0, 0.82), 0.07)(Q), 0.02)


def pan_colors(P):
    Q = to_local(P)
    handle = capsule((0, 0, -0.35), (0, 0, 0.72), 0.075, 0.06)(Q)
    rimband = np.abs(np.hypot(Q[..., 0], Q[..., 2] - 1.35) - 0.6) - 0.04
    return paint(P, IRON, [(lambda _: handle - 0.004, WOOD, 0.004, 0), (lambda _: rimband, IRON_EDGE, 0.01, 0)])


lo, hi = box(-0.45, 2.05, 0.72, -0.24, 0.24)
spec.rigid.append({"name": "pan", "fn": pan_fn, "lo": lo, "hi": hi, "voxel": 0.008, "colors": pan_colors,
                   "bone": "hand.L", "tris": 9000, "gloss": 0.55})

build(spec)
