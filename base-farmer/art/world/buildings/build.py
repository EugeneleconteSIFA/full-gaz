"""Base buildings (docs/12): barn (food), sawmill (wood), quarry (stone), forge (metal),
windmill (power = flour, D059) and its sails.

    ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/world/buildings/build.py

Writes art/out/models/buildings.glb (one node per building) and review sheets in
art/world/buildings/sheet/.

Each building stands at the back of its capture zone (zone radius 2.5): footprint within
x in [-1.4, 1.4], z in [-1.0, 1.0], centred on the origin, front toward +z (the viewer). Height
3–4.4 units: at most twice a character (2.2), so it never hides the fight.
The camera looks down at 35° from vertical: the ROOF is what players see most, so each building
is recognised by its roof line and one hook (docs/12 §4):
  barn = gambrel roof, sawmill = big saw blade, quarry = wooden crane, forge = tall chimney,
  windmill = turning sails.
No team blue or red anywhere: ownership is shown by the flag the game puts on top.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))

import numpy as np  # noqa: E402

from propkit import ROOT, Prop, build, prism_x  # noqa: E402
from sdfkit import capsule, ellipsoid, paint, rbox, rcylinder, smin  # noqa: E402

CREAM = 0xEFE3C6
CREAM_DARK = 0xD3C29C
WOOD = 0xB4793F
WOOD_DARK = 0x7E5129
WOOD_LIGHT = 0xD9A267
# Barn roof: muted mauve, echoing the food icon's pink (each building hints its resource) and
# never mistaken for the meadow's green.
ROOF_MAUVE = 0x9C6782
ROOF_MAUVE_LIGHT = 0xBE8DA6
SHINGLE = 0x8A5A3C
SHINGLE_LIGHT = 0xA87552
STONE = 0xB9B4AA
STONE_DARK = 0x8E897F
STONE_LIGHT = 0xD8D4CB
SLATE = 0x5C6574
SLATE_LIGHT = 0x7C8695
BRICK = 0xA4664E
BRICK_DARK = 0x7E4A38
IRON = 0xAEB6C4
IRON_DARK = 0x6E7684
GLOW = 0xFFB15C
HAY = 0xE8C766
SOOT = 0x3C3A3A


def above(h, soft=0.0):
    return lambda P: h - P[..., 1]


def box(lo, hi):
    return tuple(lo), tuple(hi)


# =============================================================================================
# Barn (food): cream walls, big mauve gambrel roof, double wooden door with a cross brace, a hay
# loft opening with hay spilling out.

BW, BD = 1.1, 0.8  # wall half width / half depth


def swap_xz(fn):
    """The gambrel faces the camera: ridge front-to-back, so the profile lives in (x, y)."""
    return lambda P: fn(P[..., [2, 1, 0]])


GABLE = [(BW, 1.6), (BW * 0.62, 2.3), (0.0, 2.75), (-BW * 0.62, 2.3), (-BW, 1.6), (-BW, 1.55), (BW, 1.55)]
GAMBREL = [(-1.27, 1.55), (1.27, 1.55), (0.78, 2.42), (0.0, 3.0), (-0.78, 2.42)]


def barn_walls(P):
    walls = rbox((0, 0.85, 0), (BW, 0.85, BD), 0.05)(P)
    gable = swap_xz(prism_x(GABLE, BD, 0.03))(P)
    return smin(walls, gable, 0.02)


def barn_roof(P):
    outer = swap_xz(prism_x(GAMBREL, BD + 0.16, 0.05))(P)
    inner = swap_xz(prism_x([(x * 0.84, (y - 1.55) * 0.84 + 1.43) for x, y in GAMBREL], BD + 0.4, 0.0))(P)
    return np.maximum(outer, -inner)


def barn_door(P):
    leaf = rbox((0, 0.62, BD + 0.03), (0.48, 0.62, 0.04), 0.02)(P)
    return leaf


def barn_trim(P):
    # Door frame and X brace, proud of the door.
    z = BD + 0.08
    frame = np.maximum(rbox((0, 0.64, z), (0.52, 0.66, 0.035), 0.02)(P), -rbox((0, 0.62, z), (0.42, 0.56, 0.2), 0.0)(P))
    x, y = P[..., 0], P[..., 1] - 0.62
    xb = np.maximum.reduce([np.minimum(np.abs(x * 1.1 - y), np.abs(x * 1.1 + y)) - 0.06, np.abs(x) - 0.44, np.abs(y) - 0.56, np.abs(P[..., 2] - z) - 0.03])
    mid = rbox((0, 0.62, z), (0.025, 0.58, 0.035), 0.01)(P)
    return np.minimum.reduce([frame, xb, mid])


def barn_loft(P):
    hole = rbox((0, 2.05, BD + 0.02), (0.24, 0.22, 0.05), 0.04)(P)
    return hole


def barn_hay(P):
    a = ellipsoid((0.0, 1.9, BD + 0.08), (0.22, 0.13, 0.1))(P)
    b = ellipsoid((0.12, 1.84, BD + 0.12), (0.12, 0.08, 0.08))(P)
    bale = rbox((-0.85, 0.22, BD + 0.45), (0.3, 0.22, 0.22), 0.06)(P)
    return np.minimum(smin(a, b, 0.05), bale)


barn = (
    Prop("barn", 6000)
    .part(barn_walls, *box((-1.3, -0.05, -1.0), (1.3, 2.5, 1.0)), lambda P: paint(P, CREAM, [(lambda Q: Q[..., 1] - 0.18, CREAM_DARK, 0.05, 0)][:0] + [(lambda Q: 0.16 - Q[..., 1], CREAM_DARK, 0.06, 0)]), tris=1200, voxel=0.015)
    .part(barn_roof, *box((-1.4, 1.35, -1.1), (1.4, 3.1, 1.1)), lambda P: paint(P, ROOF_MAUVE, [(lambda Q: Q[..., 1] - 2.95, ROOF_MAUVE_LIGHT, 0.05, 0)]), tris=1600, voxel=0.015)
    .part(barn_door, *box((-0.55, -0.05, BD - 0.05), (0.55, 1.3, BD + 0.1)), lambda P: paint(P, WOOD, []), tris=300)
    .part(barn_trim, *box((-0.6, -0.05, BD), (0.6, 1.35, BD + 0.15)), lambda P: paint(P, WOOD_LIGHT, []), tris=900, voxel=0.008)
    .part(barn_loft, *box((-0.35, 1.7, BD - 0.05), (0.35, 2.3, BD + 0.1)), lambda P: paint(P, WOOD_DARK, []), tris=200)
    .part(barn_hay, *box((-1.2, -0.05, BD - 0.1), (0.4, 2.0, BD + 0.75)), lambda P: paint(P, HAY, [(lambda Q: 0.1 - Q[..., 1], 0xC9A94E, 0.05, 0)]), tris=700, voxel=0.01)
)

# =============================================================================================
# Sawmill (wood): open plank shed on posts, brown shingle pitched roof, a big round saw blade on
# the right side, a stack of logs at the front left.

SAW_PITCH = [(-1.05, 1.95), (1.05, 1.95), (0.0, 2.75)]


def saw_roof(P):
    return prism_x(SAW_PITCH, 1.32, 0.05)(P)


def saw_frame(P):
    posts = [rbox((sx * 1.05, 1.0, sz * 0.75), (0.09, 1.0, 0.09), 0.03)(P) for sx in (-1, 1) for sz in (-1, 1)]
    back = rbox((0, 1.0, -0.78), (1.05, 1.0, 0.06), 0.03)(P)
    beam = rbox((0, 1.92, 0.75), (1.15, 0.08, 0.08), 0.03)(P)
    bench = rbox((-0.15, 0.55, 0.0), (0.75, 0.12, 0.42), 0.04)(P)
    stand = rbox((0.55, 0.2, 1.1), (0.4, 0.2, 0.14), 0.04)(P)
    return np.minimum.reduce(posts + [back, beam, bench, stand])


def saw_blade(P):
    # Vertical disc facing +z, on the right; teeth = scalloped rim.
    c = np.array((0.55, 0.95, 1.1), np.float32)
    Q = P - c
    r = np.hypot(Q[..., 0], Q[..., 1])
    a = np.arctan2(Q[..., 1], Q[..., 0])
    rim = 0.62 + 0.05 * np.abs(np.sin(a * 9))
    disc = np.maximum(r - rim, np.abs(Q[..., 2]) - 0.035)
    hub = rcylinder(tuple(c), 0.14, 0.08, 0.03, rot=(math.pi / 2, 0, 0))(P)
    return np.minimum(disc, hub)


def saw_logs(P):
    logs = []
    for i, (x, y, z) in enumerate(((-0.75, 0.2, 1.05), (-0.75, 0.2, 1.47), (-0.75, 0.55, 1.26))):
        logs.append(rcylinder((x, y, z), 0.2, 0.45, 0.05, rot=(0, 0, math.pi / 2))(P))
    return np.minimum.reduce(logs)


sawmill = (
    Prop("sawmill", 6000)
    .part(saw_frame, *box((-1.3, -0.05, -1.0), (1.3, 2.1, 1.35)), lambda P: paint(P, WOOD, [(above(0.12), WOOD_DARK, 0.05, 0)]), tris=1500, voxel=0.01)
    .part(saw_roof, *box((-1.45, 1.8, -1.2), (1.45, 2.85, 1.2)), lambda P: paint(P, SHINGLE, [(lambda Q: Q[..., 1] - 2.62, SHINGLE_LIGHT, 0.05, 0)]), tris=900, voxel=0.015)
    .part(saw_blade, *box((-0.2, 0.2, 0.95), (1.3, 1.7, 1.25)), lambda P: paint(P, IRON, [(lambda Q: np.hypot(Q[..., 0] - 0.55, Q[..., 1] - 0.95) - 0.18, IRON_DARK, 0.03, 0)]), tris=1300, voxel=0.008)
    .part(saw_logs, *box((-1.3, -0.05, 0.75), (-0.2, 0.8, 1.75)), lambda P: paint(P, WOOD_LIGHT, [(lambda Q: np.abs(Q[..., 0] + 0.75) - 0.38, WOOD, 0.02, 0)]), tris=1100, voxel=0.01)
)

# =============================================================================================
# Quarry (stone): a terrace of cut stone blocks and a wooden A-frame crane holding a block on a
# rope above them.


def quarry_blocks(P):
    blocks = [
        rbox((-0.55, 0.35, -0.3), (0.55, 0.35, 0.55), 0.08),
        rbox((0.55, 0.3, -0.35), (0.5, 0.3, 0.5), 0.08),
        rbox((-0.25, 0.95, -0.45), (0.45, 0.28, 0.4), 0.08),
        rbox((0.75, 0.22, 0.55), (0.35, 0.22, 0.3), 0.07, rot=(0, 0.4, 0)),
    ]
    return np.minimum.reduce([b(P) for b in blocks])


def quarry_crane(P):
    base = (0.85, 0.0, -0.55)
    legs = [capsule((0.45, 0.6, -0.75), (0.85, 3.0, -0.55), 0.09), capsule((1.25, 0.6, -0.75), (0.85, 3.0, -0.55), 0.09)]
    boom = capsule((0.85, 2.95, -0.55), (-0.35, 2.55, 0.15), 0.08)
    bar = capsule((0.6, 1.7, -0.68), (1.1, 1.7, -0.68), 0.06)
    del base
    return np.minimum.reduce([legs[0](P), legs[1](P), boom(P), bar(P)])


def quarry_rope(P):
    return capsule((-0.3, 2.5, 0.15), (-0.3, 1.75, 0.15), 0.03)(P)


def quarry_hanging(P):
    return rbox((-0.3, 1.55, 0.15), (0.24, 0.2, 0.22), 0.06)(P)


quarry = (
    Prop("quarry", 6000)
    .part(quarry_blocks, *box((-1.2, -0.05, -1.0), (1.3, 1.35, 1.0)), lambda P: paint(P, STONE, [(lambda Q: Q[..., 1] - 1.15, STONE_LIGHT, 0.06, 0), (above(0.12), STONE_DARK, 0.06, 0)]), tris=1600, voxel=0.012)
    .part(quarry_crane, *box((-0.6, 0.4, -1.0), (1.45, 3.15, 0.4)), lambda P: paint(P, WOOD, []), tris=1300, voxel=0.01)
    .part(quarry_rope, *box((-0.4, 1.6, 0.05), (-0.2, 2.65, 0.25)), lambda P: paint(P, HAY, []), tris=200, voxel=0.006)
    .part(quarry_hanging, *box((-0.65, 1.25, -0.2), (0.05, 1.85, 0.5)), lambda P: paint(P, STONE_LIGHT, []), tris=400)
)

# =============================================================================================
# Forge (metal): low stone smithy with a slate lean-to roof, a tall brick chimney with a soot
# cap, a warm glowing opening and an anvil in front.


def forge_walls(P):
    walls = rbox((-0.15, 0.75, -0.1), (1.0, 0.75, 0.75), 0.06)(P)
    opening = rbox((-0.25, 0.55, 0.7), (0.38, 0.42, 0.2), 0.06)(P)
    return np.maximum(walls, -opening)


def forge_roof(P):
    return prism_x([(-0.95, 1.95), (0.95, 1.45), (0.95, 1.37), (-0.95, 1.87)][::-1], 1.15, 0.04)(P - np.array([-0.15, 0, 0], np.float32))


def forge_chimney(P):
    stack = rbox((0.95, 1.85, -0.45), (0.3, 1.85, 0.3), 0.05)(P)
    return stack


def forge_cap(P):
    return rbox((0.95, 3.72, -0.45), (0.36, 0.1, 0.36), 0.05)(P)


def forge_glow(P):
    return rbox((-0.25, 0.55, 0.58), (0.36, 0.4, 0.04), 0.04)(P)


def forge_anvil(P):
    top = rbox((0.75, 0.62, 0.75), (0.32, 0.09, 0.15), 0.04)(P)
    horn = capsule((1.05, 0.64, 0.75), (1.3, 0.6, 0.75), 0.08, 0.02)(P)
    waist = rbox((0.75, 0.38, 0.75), (0.12, 0.18, 0.1), 0.03)(P)
    foot = rbox((0.75, 0.12, 0.75), (0.26, 0.12, 0.17), 0.04)(P)
    return np.minimum.reduce([smin(top, horn, 0.04), waist, foot])


forge = (
    Prop("forge", 6000)
    .part(forge_walls, *box((-1.25, -0.05, -0.95), (0.95, 1.6, 0.95)), lambda P: paint(P, STONE, [(above(0.15), STONE_DARK, 0.06, 0)]), tris=1100, voxel=0.015)
    .part(forge_roof, *box((-1.4, 1.2, -1.1), (1.1, 2.1, 1.1)), lambda P: paint(P, SLATE, [(lambda Q: Q[..., 1] - 1.85, SLATE_LIGHT, 0.04, 0)]), tris=700, voxel=0.015)
    .part(forge_chimney, *box((0.55, -0.05, -0.85), (1.35, 3.8, -0.05)), lambda P: paint(P, BRICK, [(lambda Q: np.abs(((Q[..., 1] + 0.1) % 0.3) - 0.15) - 0.13, BRICK_DARK, 0.02, 0)]), tris=900, voxel=0.012)
    .part(forge_cap, *box((0.5, 3.5, -0.9), (1.4, 3.9, 0.0)), lambda P: paint(P, SOOT, []), tris=300)
    .part(forge_glow, *box((-0.7, 0.05, 0.45), (0.2, 1.05, 0.7)), lambda P: paint(P, GLOW, []), tris=200, ao=False)
    .part(forge_anvil, *box((0.35, -0.05, 0.5), (1.45, 0.8, 1.0)), lambda P: paint(P, IRON_DARK, [(lambda Q: Q[..., 1] - 0.66, IRON, 0.02, 0)]), tris=900, voxel=0.008)
)

# =============================================================================================
# Windmill (power = flour, D059): a tapered plaster tower, a brown conical cap, a door with flour
# sacks; the four sails are a separate node ("windmill_sails", centred on the hub) that the game
# spins while the base is owned.

HUB = (0.0, 2.75, 0.78)


def mill_tower(P):
    y = P[..., 1]
    r = 0.95 - 0.22 * np.clip(y / 2.5, 0, 1)
    side = np.hypot(P[..., 0], P[..., 2]) - r
    cap = np.abs(y - 1.25) - 1.25
    d = np.minimum(np.maximum(side, cap), 0) + np.hypot(np.maximum(side + 0.05, 0), np.maximum(cap + 0.05, 0)) - 0.05
    door = rbox((0, 0.42, 0.9), (0.24, 0.42, 0.2), 0.08)(P)
    return np.maximum(d, -door)


def mill_cap(P):
    y = P[..., 1] - 2.45
    r = np.hypot(P[..., 0], P[..., 2])
    cone = np.maximum((r - 0.9 * (1 - y / 1.05)) * 0.8, -y)
    return np.maximum(cone, y - 1.05) - 0.04


def mill_trim(P):
    door = rbox((0, 0.42, 0.86), (0.2, 0.4, 0.05), 0.04)(P)
    hub = rcylinder((HUB[0], HUB[1], HUB[2] - 0.15), 0.14, 0.17, 0.04, rot=(math.pi / 2, 0, 0))(P)
    return np.minimum(door, hub)


def mill_sacks(P):
    a = ellipsoid((0.75, 0.28, 0.8), (0.26, 0.3, 0.22))(P)
    b = ellipsoid((1.08, 0.24, 0.62), (0.22, 0.26, 0.2))(P)
    return smin(a, b, 0.04)


windmill = (
    Prop("windmill", 6000)
    .part(mill_tower, *box((-1.05, -0.05, -1.05), (1.05, 2.55, 1.15)), lambda P: paint(P, CREAM, [(above(0.2), CREAM_DARK, 0.08, 0)]), tris=1400, voxel=0.015)
    .part(mill_cap, *box((-1.0, 2.35, -1.0), (1.0, 3.6, 1.0)), lambda P: paint(P, SHINGLE, [(lambda Q: Q[..., 1] - 3.25, SHINGLE_LIGHT, 0.06, 0)]), tris=800, voxel=0.015)
    .part(mill_trim, *box((-0.3, -0.05, 0.55), (0.3, 3.0, 0.95)), lambda P: paint(P, WOOD_DARK, []), tris=500, voxel=0.01)
    .part(mill_sacks, *box((0.4, -0.05, 0.3), (1.4, 0.6, 1.1)), lambda P: paint(P, 0xF2E3C2, [(lambda Q: Q[..., 1] - 0.45, 0xC9A46A, 0.03, 0)]), tris=600, voxel=0.01)
)


def sails_frame(P):
    """Four arms in the x-y plane, centred on the origin (the hub), facing +z."""
    arms = []
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        c, s_ = math.cos(a), math.sin(a)
        arms.append(capsule((0, 0, 0), (c * 1.35, s_ * 1.35, 0), 0.05)(P))
    return np.minimum.reduce(arms)


def sails_cloth(P):
    """A canvas panel along one side of each arm (a lattice would vanish at game size)."""
    panels = []
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        c, s_ = math.cos(a), math.sin(a)
        # Panel centre: halfway out, offset to the arm's side.
        cx, cy = c * 0.82 - s_ * 0.17, s_ * 0.82 + c * 0.17
        panels.append(rbox((cx, cy, -0.02), (0.5, 0.15, 0.02), 0.02, rot=(0, 0, a))(P))
    return np.minimum.reduce(panels)


sails = (
    Prop("windmill_sails", 2500)
    .part(sails_frame, (-1.45, -1.45, -0.1), (1.45, 1.45, 0.1), lambda P: paint(P, WOOD, []), tris=800, voxel=0.008)
    .part(sails_cloth, (-1.45, -1.45, -0.08), (1.45, 1.45, 0.05), lambda P: paint(P, CREAM, []), tris=900, voxel=0.008, ao=False)
)

build(
    [barn, sawmill, quarry, forge, windmill, sails],
    os.path.join(ROOT, "art", "out", "models", "buildings.glb"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "sheet"),
    sheet_height=4.2,
)
