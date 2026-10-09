"""Pépin (scout) — build script (Blender 4.5, headless).

    ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/scout/build.py

Brief (character-3d skill §1): « petit coq blanc pilote, insolent et pressé, déjà sur la base
avant toi » — a bantam with aviator goggles who never stops talking.
Personality: insolent, hyper, frimeur; default expression "insolent".
Hook: the red comb + a big dark sickle tail (rooster silhouette from every angle).

Art direction = Gaston's (Disney / Pixar / Supercell). References looked at: Rocky (Chicken
Run, Aardman) and 3D Pixar-style roosters. What they all do:
  - the BEAK IS A MOUTH: big, wide, the commissure is a smile curve, it opens on a dark inside
    with a tongue (like Gaston's grin);
  - the TAIL is the hook: a big dense fan of long curved sickle feathers, dark iridescent;
  - feathers are CLEAN MASSES (neck hackle cape, chest), scalloped edges, never spikes;
  - big eyes close together right above the beak, dark readable brows.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))

import numpy as np  # noqa: E402

from charkit import Spec, build, held_frame, torus_z  # noqa: E402
from sdfkit import Prim, capsule, ellipsoid, paint, rbox, smin  # noqa: E402

# Palette v2 (Supercell pass): dominant bright white, secondary saturated orange (beak, legs)
# and golden cape, accents: a vivid red comb (the hook, small area) and teal goggle lenses.
WHITE = 0xFFFBF2
CREAM_SHADE = 0xE9DAC0
WING_TIP = 0xF29B30  # warm wing tips: a secondary colour on the white
ORANGE = 0xFF8A10
ORANGE_DARK = 0xE0620A
RED = 0xF02A3C
HACKLE = 0xFFC23A  # golden neck cape
TAIL_DARK = 0x135E5C  # iridescent teal-black
TAIL_TIP = 0x36B49A
LEATHER = 0x8A4A22
LENS = 0x6EE2F6
WOOD = 0x9C6B3C
STEEL = 0x8A96A6
MOUTH = 0x5A1E1E
TONGUE = 0xE7787F

HC = np.array((0.0, 2.12, 0.02))


def flat(axis, a, b, r1, r2, k=2.2):
    """Capsule flattened along one axis (feathers are blades, not tubes)."""
    cap = capsule(a, b, r1, r2)

    def f(P):
        Q = P.copy()
        Q[..., axis] = a[axis] + (P[..., axis] - a[axis]) * k
        return cap(Q) / k * 1.6

    return f


spec = Spec(
    id="scout",
    brief="petit coq blanc pilote, insolent et pressé",
    head_c=tuple(HC),
    head_r=(0.86, 0.8, 0.82),
    body_c=(0.0, 0.92, 0.06),
    body_r=(0.52, 0.5, 0.5),
    shoulder=(0.44, 1.16, 0.06),
    fist=(0.74, 0.66, 0.34),
    hip=(0.2, 0.52, 0.0),
    foot=(0.24, 0.06, 0.2),
    foot_r=(0.2, 0.06, 0.28),
    arm_r=0.11,
    leg_r=0.08,
    eye_y=2.24,  # above the beak, close together
    eye_x=0.3,
    eye_r=0.27,  # big Pixar eyes
    iris=0xF08A24,
    iris_light=0xFFD08A,
    limbal=0x5A2A06,
    brow_color=0x2E211A,  # dark: brows must read on white
    brow_angry=0.22,
    brow_r=0.07,
    brow_lift=(0.09, -0.01),  # one brow cocked: cheeky
    mouth="beak",
    mouth_y=1.9,
    mouth_w=0.24,
    jaw_pivot_z=0.55,
    skin=WHITE,
    face=WHITE,
    paw=WING_TIP,
    feet=ORANGE_DARK,
    hand="wing",
    foot_style="bird",
)

# --- Head: small cheek mass the beak grows from; a clean forehead quiff ---
spec.extra_skin += [
    Prim(ellipsoid(tuple(HC + (0, -0.16, 0.2)), (0.5, 0.42, 0.48)), "head", 0.22),
    Prim(capsule((0, 2.8, 0.36), (0.0, 3.0, 0.62), 0.11, 0.03), "head", 0.06),  # quiff
]
# --- Body: leaning forward, chest out ---
spec.extra_skin += [Prim(ellipsoid((0, 1.0, 0.24), (0.42, 0.42, 0.4), (0.2, 0, 0)), "spine", 0.15)]
for s in (-1, 1):  # feather "pants"
    spec.extra_skin.append(Prim(ellipsoid((s * 0.21, 0.5, 0.02), (0.2, 0.2, 0.2)), "hips", 0.08))
spec.extra_bones.append(("tail", (0, 0.95, -0.38), (0, 1.3, -0.75), "hips"))
spec.extra_skin.append(Prim(ellipsoid((0.0, 0.98, -0.42), (0.22, 0.22, 0.17)), "tail", 0.1))  # tail base

spec.extra_paint += [
    (lambda P: (P[..., 1] - 0.95) * 0.5 + 0.08, CREAM_SHADE, 0.12, 0),
    (lambda P: P[..., 1] - 0.34, ORANGE, 0.015, 0),
    (lambda P: np.maximum(P[..., 1] - 0.34, np.abs(np.mod(P[..., 1], 0.07) - 0.035) - 0.008), ORANGE_DARK, 0.004, 0),
]

# --- Beak = mouth. The commissure is a smile curve y = 1.9 + 0.09 (x/0.25)^2: the upper half
# keeps what is above it, the lower half what is below, so closed they meet exactly on the
# smile line; open, the dark inside and the tongue show between them. ---


def smile_line(P):
    return 1.9 + 0.09 * (P[..., 0] / 0.25) ** 2


def beak_upper(P):
    d = ellipsoid((0, 1.99, 0.72), (0.27, 0.15, 0.22))(P)
    d = smin(d, capsule((0, 1.98, 0.78), (0, 1.9, 1.18), 0.15, 0.035)(P), 0.07)  # long, hooked tip
    return np.maximum(d, smile_line(P) - P[..., 1])


def beak_lower(P):
    d = ellipsoid((0, 1.86, 0.72), (0.24, 0.11, 0.2))(P)
    d = smin(d, capsule((0, 1.86, 0.78), (0, 1.86, 1.06), 0.11, 0.03)(P), 0.06)
    return np.maximum(d, P[..., 1] - smile_line(P))


spec.rigid += [
    {"name": "beak_inside", "fn": ellipsoid((0, 1.9, 0.8), (0.24, 0.08, 0.26)),
     "lo": (-0.3, 1.78, 0.5), "hi": (0.3, 2.02, 1.12), "voxel": 0.004, "colors": MOUTH, "bone": "head",
     "tris": 3000, "ao": False},
    {"name": "beak_tongue", "fn": ellipsoid((0, 1.875, 0.86), (0.12, 0.035, 0.15)),
     "lo": (-0.2, 1.8, 0.65), "hi": (0.2, 1.95, 1.05), "voxel": 0.003, "colors": TONGUE, "bone": "jaw",
     "tris": 2000, "ao": False},
]
spec.beak = {
    "upper": beak_upper, "upper_box": ((-0.34, 1.82, 0.45), (0.34, 2.18, 1.25)),
    "lower": beak_lower, "lower_box": ((-0.32, 1.7, 0.45), (0.32, 2.0, 1.12)),
    "colors": lambda P: paint(P, ORANGE, [(lambda Q: 0.66 - Q[..., 2], ORANGE_DARK, 0.04, 0)]),
    "colors_lower": ORANGE_DARK,
}

# --- Comb (5 back-swept lobes) and heart wattle ---
# Bigger, the hook: it must read first from the game camera (v2).
LOBES = [(0.4, 0.25, 0.15), (0.2, 0.37, 0.18), (0.0, 0.43, 0.2), (-0.2, 0.37, 0.18), (-0.4, 0.27, 0.15)]


def comb(P):
    d = rbox((0, 2.9, 0.0), (0.05, 0.07, 0.42), 0.04)(P)
    for z, h, r in LOBES:
        d = smin(d, capsule((0, 2.9, z), (0, 2.9 + h * 0.95, z - 0.14), r * 0.9, r * 0.55)(P), 0.05)
    return np.maximum(d, np.abs(P[..., 0]) - 0.085)


spec.rigid += [
    {"name": "comb", "fn": comb, "lo": (-0.22, 2.8, -0.75), "hi": (0.22, 3.6, 0.65), "voxel": 0.006,
     "colors": lambda P: paint(P, RED, [(lambda Q: 2.96 - Q[..., 1], 0xB0121E, 0.05, 0)]), "bone": "head", "tris": 7000,
     "gloss": 0.3},
    {"name": "wattle", "fn": lambda P: smin(ellipsoid((0.06, 1.7, 0.78), (0.07, 0.11, 0.05))(P),
                                             ellipsoid((-0.06, 1.7, 0.78), (0.07, 0.11, 0.05))(P), 0.04),
     "lo": (-0.2, 1.5, 0.62), "hi": (0.2, 1.86, 0.9), "voxel": 0.005, "colors": RED, "bone": "jaw", "tris": 3000},
]

# --- Neck hackle cape: ONE clean golden mass draped on the shoulders, scalloped edge ---


def hackle(P):
    # One cape; its lower edge is a regular scallop (a wave around the neck), not dangling balls.
    ang = np.arctan2(P[..., 0], P[..., 2] + 0.02)
    edge = 1.2 + 0.06 * np.cos(ang * 9)
    shell = ellipsoid((0, 1.4, -0.02), (0.62, 0.34, 0.58))(P)
    d = np.maximum(shell, edge - P[..., 1])
    d = np.maximum(d, P[..., 2] - 0.42)  # open throat in front
    return np.maximum(d, -ellipsoid((0, 1.42, 0.02), (0.46, 0.42, 0.44))(P))


spec.rigid.append({"name": "hackle", "fn": hackle, "lo": (-0.8, 0.95, -0.75), "hi": (0.8, 1.75, 0.7),
                   "voxel": 0.007, "colors": lambda P: paint(P, HACKLE, [(lambda Q: Q[..., 1] - 1.22, 0xD99428, 0.06, 0)]),
                   "bone": "spine", "tris": 8000})

# --- Tail (the hook): a big fan of seven long sickle feathers, dark iridescent, light tips ---
TAIL = []
for k, ang in enumerate(np.linspace(-0.7, 0.7, 7)):
    # Each sickle feather has its own root (spread across the rump), rises almost vertically,
    # arcs back, then droops: a lush rooster tail, not a fork.
    ln = 1.3 - abs(ang) * 0.45
    sx = math.sin(ang)
    root = (sx * 0.22, 0.98, -0.4)
    up = (sx * (0.22 + ln * 0.25), 0.98 + ln * 0.7, -0.4 - ln * 0.18)
    over = (sx * (0.22 + ln * 0.45), 0.98 + ln * 0.88, -0.4 - ln * 0.6)
    tip = (sx * (0.22 + ln * 0.6), 0.98 + ln * 0.6, -0.4 - ln * 0.95)
    TAIL.append((root, up, over, tip))


def plume(P):
    d = None
    for root, up, over, tip in TAIL:
        blade = smin(capsule(root, up, 0.1, 0.09)(P), capsule(up, over, 0.09, 0.07)(P), 0.04)
        blade = smin(blade, capsule(over, tip, 0.07, 0.03)(P), 0.03)
        d = blade if d is None else smin(d, blade, 0.015)
    return d


def plume_colors(P):
    reach = np.linalg.norm(P - np.array((0.0, 1.0, -0.42), np.float32), axis=-1)
    return paint(P, TAIL_DARK, [(lambda _: 1.05 - reach, TAIL_TIP, 0.15, 0)])


pts = np.array([p for blade in TAIL for p in blade])
spec.rigid.append({"name": "tail_plume", "fn": plume, "lo": tuple(pts.min(0) - 0.2), "hi": tuple(pts.max(0) + 0.2),
                   "voxel": 0.008, "colors": plume_colors, "bone": "tail", "tris": 12000})

# --- Goggles on the forehead, strap hugging the skull ---


def goggles(P):
    d = None
    for s in (-1, 1):
        c = np.array((s * 0.27, 2.66, 0.62), np.float32)
        g = np.minimum(torus_z(0, 0.18, 0.055)(P - c), ellipsoid(tuple(c), (0.17, 0.17, 0.04))(P))
        d = g if d is None else smin(d, g, 0.02)
    strap = np.maximum((np.abs(np.hypot(P[..., 0] / 0.68, (P[..., 2] - 0.02) / 0.65) - 1) * 0.66) - 0.028,
                       np.abs(P[..., 1] - 2.66) - 0.06)
    return smin(d, strap, 0.02)


def goggles_colors(P):
    lens = np.minimum(ellipsoid((0.27, 2.66, 0.62), (0.17, 0.17, 0.04))(P), ellipsoid((-0.27, 2.66, 0.62), (0.17, 0.17, 0.04))(P))
    return paint(P, LEATHER, [(lambda _: lens - 0.004, LENS, 0.004, 0)])


def goggles_gloss(P):
    # Glass lenses shine, the leather strap stays matte.
    lens = np.minimum(ellipsoid((0.27, 2.66, 0.62), (0.18, 0.18, 0.06))(P), ellipsoid((-0.27, 2.66, 0.62), (0.18, 0.18, 0.06))(P))
    return np.where(lens < 0, 0.6, 0.15)


spec.rigid.append({"name": "goggles", "fn": goggles, "lo": (-1.0, 2.5, -1.0), "hi": (1.0, 2.8, 0.8),
                   "voxel": 0.006, "colors": goggles_colors, "bone": "head", "tris": 9000, "gloss": goggles_gloss})

# --- Tool: a small rake held in the left wing ---
to_local, box, _ = held_frame(spec.fist, (0.0, 0.35, 1.0))


def rake(P):
    Q = to_local(P)
    d = capsule((0, 0, -0.5), (0, 0, 1.1), 0.06, 0.05)(Q)
    d = smin(d, rbox((0, 0, 1.16), (0.3, 0.04, 0.05), 0.02)(Q), 0.03)
    for i in range(5):
        x = -0.24 + i * 0.12
        d = np.minimum(d, capsule((x, -0.02, 1.18), (x, -0.16, 1.24), 0.025, 0.014)(Q))
    return d


lo, hi = box(-0.6, 1.4, 0.45, -0.3, 0.2)
spec.rigid.append({"name": "rake", "fn": rake, "lo": lo, "hi": hi, "voxel": 0.007,
                   "colors": lambda P: paint(P, WOOD, [(lambda _: 1.11 - to_local(P)[..., 2], STEEL, 0.01, 0)]),
                   "bone": "hand.L", "tris": 6000})

build(spec)
