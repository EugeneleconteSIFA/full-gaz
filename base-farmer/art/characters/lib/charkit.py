"""Chibi character builder: everything validated on Gaston, as a reusable kit.

A character script fills a `Spec` (personality, canon, palette, volumes, accessories) and calls
`build(spec)`. The kit provides what every character shares (character-3d skill):
  - skeleton with the shared bone names (the game animates every character the same way),
  - skin: head + body + arms (shoulder ball, Popeye forearm, pinched wrist, mitten fist with
    three meatball fingers and a thumb) + legs (marked ankle, flat sole, three toe beans),
  - Pixar eyes (sphere, carved amber iris, limbal ring, crescent, big pupil, head-fixed
    glints), thin shell lids with a lash line, brows on their own bones,
  - mouth: swappable decals (grin / smirk / frown / o / shout) for snouts and muzzles, or a
    two-part beak (upper on the head, lower on the jaw) for birds,
  - garment shells, rigid accessories, crisp decals, review sheet, checks, glTF export.

Game coordinates: y up, +z front, feet at y = 0, units = r. +x is the character's left (".L").
"""

import math
import os
from dataclasses import dataclass, field as dfield

import bpy
import numpy as np
from mathutils import Matrix

import blendkit as bk
from sdfkit import Prim, _rot, capsule, ellipsoid, field, grid_points, mesh_sdf, mesh_volume, paint, rcylinder, smin

SIDES = ((1, "L"), (-1, "R"))
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))


@dataclass
class Spec:
    id: str
    brief: str
    # --- canon (game units) ---
    head_c: tuple = (0.0, 2.2, 0.02)
    head_r: tuple = (0.9, 0.74, 0.8)
    body_c: tuple = (0.0, 0.98, 0.0)
    body_r: tuple = (0.7, 0.56, 0.58)
    shoulder: tuple = (0.6, 1.3, 0.0)  # +x side; mirrored
    fist: tuple = (0.94, 0.6, 0.3)
    hip: tuple = (0.3, 0.55, 0.0)
    foot: tuple = (0.34, 0.12, 0.2)
    foot_r: tuple = (0.26, 0.12, 0.3)
    arm_r: float = 0.15
    leg_r: float = 0.2
    # --- face ---
    eye_y: float = 2.12
    eye_x: float = 0.32
    eye_r: float = 0.18
    iris: int = 0xC98A2A
    iris_light: int = 0xFFD27A
    limbal: int = 0x4A2A08
    brow_color: int = 0x4A2A14
    brow_angry: float = 0.32  # built-in tilt of the brows (inner end lower), radians
    mouth: str = "decal"  # "decal" (snout / muzzle) or "beak"
    mouth_y: float = 1.8
    mouth_w: float = 0.3  # half width
    jaw_pivot_z: float = None  # beaks: hinge at the beak base (default: deep in the head)
    # --- palette ---
    skin: int = 0xEE9440
    face: int = 0xFFF4E2  # muzzle / facial disc: the lightest large area
    paw: int = 0xB0703C
    feet: int = None  # default: paw
    hand: str = "mitten"  # "mitten" (mammals), "wing" (birds: paddle + feather fingers), "hoof" (cattle)
    foot_style: str = "paw"  # "paw" (toe beans), "bird" (3 long toes + a back toe, claws), "hoof"
    lid_l: int = None  # left / right upper lid colour (default: skin)
    lid_r: int = None
    # --- extras supplied by the character script ---
    extra_skin: list = dfield(default_factory=list)  # Prim list added to the skin
    extra_paint: list = dfield(default_factory=list)  # (fn, hex, soft, wobble) regions
    extra_bones: list = dfield(default_factory=list)
    garments: list = dfield(default_factory=list)  # dicts: follows-filter, thickness, region, colors
    rigid: list = dfield(default_factory=list)  # dicts: name, fn, lo, hi, voxel, colors, bone, tris, ao
    decals: list = dfield(default_factory=list)  # dicts: name, region, offset, color (on the head)
    beak: dict = None  # {"upper": fn, "lower": fn, "color": hex, "inside": hex}
    tri_budget: int = 300000
    # --- finish (gloss 0..1, game shader specular; see blendkit.make_mesh) ---
    skin_gloss: object = 0.12  # number or fn(P): snouts and beaks shine more than fur
    eye_gloss: float = 0.0  # v3 eyes: no shader specular on the ball (one painted glint is enough)
    brow_r: float = 0.05  # brow stroke thickness (thicker = more expressive)
    # --- shape language (v2, docs/10): defaults keep the original look ---
    head_blend: float = 0.18  # head-body fusion radius; small = a head sunk on the shoulders, crisp
    body_box: float = 0.0  # 0 = ellipsoid torso, 1 = rounded box (tense, massive sides)
    head_box: float = 0.0  # same for the skull (flatter top and cheeks: room for a hat)
    hand_scale: float = 1.0  # big hands read from the game camera (heroes, not small animals)
    brow_lift: tuple = (0.0, 0.0)  # (left, right) brow height offsets: asymmetry = attitude


def bones_for(s: Spec):
    hx, hy, hz = s.head_c
    sx, sy, sz = s.shoulder
    fx, fy, fz = s.fist
    px, py, pz = s.hip
    elbow = (sx + (fx - sx) * 0.6 + 0.04, sy + (fy - sy) * 0.5, sz + (fz - sz) * 0.4)
    wrist = (fx - 0.02, fy + 0.13, fz - 0.07)
    ankle = (s.foot[0] - 0.01, 0.2, 0.04)
    neck_y = s.body_c[1] + s.body_r[1] * 0.85
    bones = [
        ("root", (0, 0, 0), (0, 0.3, 0), None),
        ("hips", (0, py, 0), (0, s.body_c[1] - 0.1, 0), "root"),
        ("spine", (0, s.body_c[1] - 0.1, 0), (0, neck_y, 0), "hips"),
        ("head", (0, neck_y, hz), (0, hy + 0.1, hz), "spine"),
        ("jaw", (0, s.mouth_y + 0.06, s.jaw_pivot_z if s.jaw_pivot_z is not None else hz + 0.1),
         (0, s.mouth_y - 0.08, hz + 0.75), "head"),
        ("wrinkle", (0, s.eye_y + 0.08, hz + 0.84), (0, s.eye_y + 0.08, hz + 0.98), "head"),
    ]
    ez = eye_centre_z(s)
    for sgn, n in SIDES:
        bones += [
            (f"corner.{n}", (sgn * s.mouth_w, s.mouth_y + 0.1, hz + 0.62), (sgn * s.mouth_w, s.mouth_y + 0.1, hz + 0.76), "head"),
            (f"flew.{n}", (sgn * s.mouth_w * 0.8, s.mouth_y + 0.08, hz + 0.72), (sgn * s.mouth_w * 0.8, s.mouth_y + 0.08, hz + 0.86), "head"),
            (f"brow.{n}", (sgn * s.eye_x, s.eye_y + 0.3, ez + 0.14), (sgn * s.eye_x, s.eye_y + 0.3, ez + 0.28), "head"),
            (f"lid.{n}", (sgn * s.eye_x, s.eye_y, ez), (sgn * s.eye_x, s.eye_y, ez + 0.14), "head"),
            (f"lidlow.{n}", (sgn * s.eye_x, s.eye_y, ez), (sgn * s.eye_x, s.eye_y, ez + 0.14), "head"),
            (f"eye.{n}", (sgn * s.eye_x, s.eye_y, ez), (sgn * s.eye_x, s.eye_y, ez + 0.14), "head"),
            (f"upperarm.{n}", (sgn * sx, sy, sz), (sgn * elbow[0], elbow[1], elbow[2]), "spine"),
            (f"forearm.{n}", (sgn * elbow[0], elbow[1], elbow[2]), (sgn * wrist[0], wrist[1], wrist[2]), f"upperarm.{n}"),
            (f"hand.{n}", (sgn * wrist[0], wrist[1], wrist[2]), (sgn * fx, fy - 0.12, fz + 0.06), f"forearm.{n}"),
            (f"thigh.{n}", (sgn * px, py, pz), (sgn * ankle[0], ankle[1], ankle[2]), "hips"),
            (f"foot.{n}", (sgn * ankle[0], ankle[1], ankle[2]), (sgn * s.foot[0], 0.08, s.foot[2] + 0.2), f"thigh.{n}"),
        ]
    bones += s.extra_bones
    return bones, elbow, wrist, ankle


def eye_centre_z(s: Spec):
    """Eye ball centre: on the head surface, ~45 % of the ball standing proud."""
    hx, hy, hz = s.head_c
    rx, ry, rz = s.head_r
    nx, ny = s.eye_x / rx, (s.eye_y - hy) / ry
    surf = hz + rz * math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
    return surf - s.eye_r * 0.15


def skin_prims(s: Spec, elbow, wrist, ankle):
    prims = [
        Prim(boxy(s.body_c, s.body_r, s.body_box), "spine"),
        Prim(boxy(s.head_c, s.head_r, s.head_box), "head", s.head_blend),
    ]
    prims += list(s.extra_skin)
    ez = eye_centre_z(s)
    for sgn, n in SIDES:
        sx, sy, sz = s.shoulder
        fx, fy, fz = s.fist
        mid = ((elbow[0] + wrist[0]) / 2, (elbow[1] + wrist[1]) / 2, (elbow[2] + wrist[2]) / 2)
        prims += [
            # Brow ridge and a socket under it (the eye ball sits in it).
            Prim(ellipsoid((sgn * s.eye_x, s.eye_y + 0.28, ez + 0.06), (0.24, 0.07, 0.14), (0, 0, sgn * s.brow_angry)), "head", 0.1),
            Prim(ellipsoid((sgn * s.eye_x, s.eye_y, ez + s.eye_r + 0.03), (s.eye_r + 0.01, s.eye_r + 0.03, 0.17)), None, 0.03, sub=True),
        ]
        if s.hand != "wing":
            prims += [
            # Arm: shoulder ball, upper arm, Popeye forearm, pinched wrist.
                Prim(ellipsoid((sgn * (sx - 0.02), sy, sz), (s.arm_r * 1.25,) * 3), f"upperarm.{n}", 0.07),
                Prim(capsule((sgn * sx, sy - 0.02, sz), (sgn * elbow[0], elbow[1], elbow[2]), s.arm_r, s.arm_r * 0.93), f"upperarm.{n}", 0.07),
                Prim(capsule((sgn * elbow[0], elbow[1], elbow[2]), (sgn * mid[0], mid[1], mid[2]), s.arm_r * 0.93, s.arm_r * 1.13), f"forearm.{n}", 0.04),
                Prim(capsule((sgn * mid[0], mid[1], mid[2]), (sgn * wrist[0], wrist[1], wrist[2]), s.arm_r * 1.13, s.arm_r * 0.7), f"forearm.{n}", 0.03),
            ]
        else:
            # The whole arm is a WING: a flat feathered blade from the shoulder along the body
            # side (flattened across x), a jagged trailing edge of secondary feathers, and the
            # feather fingers at the end (below). Same bones: the wing animates like an arm.
            prims += wing_prims(sgn, n, s.shoulder, elbow, wrist)
        if s.hand == "wing":
            # Wing tip as a hand: four long flat primary feathers fanned down and forward
            # around the handle (a wing, not a mitten); grey tips are painted by `paw`.
            prims.append(Prim(flat_capsule((sgn * (fx - 0.04), fy + 0.12, fz - 0.04), (sgn * fx, fy, fz + 0.08), 0.13, 0.11, 1.8), f"hand.{n}", 0.05))
            for k, (dz, ln) in enumerate(((-0.12, 0.3), (0.0, 0.36), (0.12, 0.34), (0.22, 0.26))):
                a = (sgn * fx, fy + 0.02, fz + dz)
                e = (sgn * (fx + 0.04), fy - ln, fz + dz + 0.08 + k * 0.03)
                prims.append(Prim(flat_capsule(a, e, 0.075, 0.025, 2.4), f"hand.{n}", 0.025))
        elif s.hand == "hoof":
            # Hoof hand: the arm ends on a clean round stump; the hoof itself is a separate
            # crisp rigid part (hoof_parts), no painted paw region (painted edges blur).
            prims.append(Prim(ellipsoid((sgn * fx, fy + 0.06, fz), (s.arm_r * 1.15,) * 3), f"hand.{n}", 0.05))
        else:
            # Mitten fist: palm, thumb (thin base, fat tip), three meatball fingers; all scaled
            # around the fist centre by hand_scale.
            k = s.hand_scale
            F = np.array((sgn * fx, fy, fz), np.float32)

            def at(dx, dy, dz, F=F, k=k):
                return tuple(F + np.array((dx, dy, dz), np.float32) * k)

            prims += [
                Prim(ellipsoid(tuple(F), (0.24 * k, 0.2 * k, 0.22 * k)), f"hand.{n}", 0.05 * k),
                Prim(capsule(at(sgn * -0.16, -0.04, 0.06), at(sgn * -0.09, 0.07, 0.18), 0.07 * k, 0.085 * k), f"hand.{n}", 0.03 * k),
            ]
            for dx, ln, curl in ((-0.1, 0.14, 0.0), (0.0, 0.16, 0.0), (0.1, 0.14, 0.03)):
                prims.append(Prim(capsule(at(sgn * (0.01 + dx), 0.08, 0.14), at(sgn * (0.01 + dx), 0.08 - ln, 0.17 - curl), 0.092 * k, 0.08 * k), f"hand.{n}", 0.02 * k))
        px, py, pz = s.hip
        prims += [
            Prim(capsule((sgn * px, py, pz), (sgn * ankle[0], ankle[1], ankle[2]), s.leg_r, s.leg_r * 0.7), f"thigh.{n}", 0.1),
        ]
        if s.foot_style == "hoof":
            pass  # the leg capsule ends inside the rigid hoof (hoof_parts)
        elif s.foot_style == "bird":
            # Bird foot: a small pad, three long toes fanned ~32° (middle longest), a back toe.
            ax, az = sgn * s.foot[0], s.foot[2] - 0.12
            prims.append(Prim(lambda P, c=(ax, 0.05, az): np.maximum(ellipsoid(c, (0.1, 0.06, 0.1))(P), -P[..., 1]), f"foot.{n}", 0.04))
            prims.append(Prim(capsule((sgn * ankle[0], ankle[1], ankle[2]), (ax, 0.07, az), s.leg_r * 0.75, s.leg_r * 0.7), f"foot.{n}", 0.03))
            for ang, ln in ((-0.56, 0.26), (0.0, 0.32), (0.56, 0.26), (3.14, 0.14)):
                tip = (ax + math.sin(ang) * ln, 0.035, az + math.cos(ang) * ln)
                prims.append(Prim(lambda P, a=(ax, 0.05, az), b=tip: np.maximum(capsule(a, b, 0.05, 0.032)(P), -P[..., 1]), f"foot.{n}", 0.03))
        else:
            prims += [
                Prim(lambda P, c=(sgn * s.foot[0], s.foot[1], s.foot[2]), r=s.foot_r: np.maximum(ellipsoid(c, r)(P), -P[..., 1]), f"foot.{n}", 0.06),
                Prim(lambda P, c=(sgn * s.foot[0], s.foot[1] - 0.02, s.foot[2] - s.foot_r[2] * 0.66): np.maximum(ellipsoid(c, (0.19, 0.1, 0.16))(P), -P[..., 1]), f"foot.{n}", 0.04),
            ]
            for dx, dz in ((-0.13, 0.0), (0.0, 0.03), (0.13, 0.0)):
                c = (sgn * s.foot[0] + dx * s.foot_r[0] / 0.26, s.foot[1] - 0.03, s.foot[2] + s.foot_r[2] * 0.8 + dz)
                prims.append(Prim(lambda P, c=c: np.maximum(ellipsoid(c, (0.085, 0.08, 0.09))(P), -P[..., 1]), f"foot.{n}", 0.02))
    return prims


def boxy(c, r, k):
    """Ellipsoid (k = 0) blended toward a rounded box of the same half-sizes (k = 1): tense,
    flatter sides with rounded edges, for massive torsos and broad heads."""
    ell = ellipsoid(c, r)
    if k <= 0:
        return ell
    from sdfkit import rbox

    box = rbox(c, r, min(r) * 0.42)
    return lambda P: ell(P) * (1 - k) + box(P) * k


def flat_capsule(a, b, r1, r2, flat=2.2):
    """Capsule flattened across x (a wing blade lying along the body side)."""
    cap = capsule(a, b, r1, r2)

    def f(P):
        Q = P.copy()
        Q[..., 0] = a[0] + (P[..., 0] - a[0]) * flat
        return cap(Q) / flat * 1.6

    return f


def wing_prims(sgn, n, shoulder, elbow, wrist):
    sx, sy, sz = shoulder
    S = (sgn * sx, sy, sz)
    E = (sgn * elbow[0], elbow[1], elbow[2])
    W = (sgn * wrist[0], wrist[1], wrist[2])
    prims = [
        Prim(flat_capsule(S, E, 0.2, 0.17), f"upperarm.{n}", 0.09),
        Prim(flat_capsule(E, W, 0.17, 0.12), f"forearm.{n}", 0.05),
    ]
    # Secondary feathers: a scalloped back edge of ROUNDED lobes (Supercell: clean masses,
    # never spikes).
    for k, (t, ln) in enumerate(((0.25, 0.18), (0.55, 0.2), (0.85, 0.16))):
        root = (S[0] + (E[0] - S[0]) * t, S[1] + (E[1] - S[1]) * t - 0.02, S[2] + (E[2] - S[2]) * t - 0.12)
        tip = (root[0] + sgn * 0.03, root[1] - ln, root[2] - 0.08)
        prims.append(Prim(flat_capsule(root, tip, 0.11, 0.08), f"upperarm.{n}" if t < 0.6 else f"forearm.{n}", 0.05))
    return prims


def lid_shape(c, r, rot, lower=False):
    # Thicker shell (v3): the upper lid frames the eye and carries the expression.
    radius, thick = 1.06 * r, 0.17 * r

    def f(P):
        Q = _rot(P, c, rot)
        shell = np.abs(np.linalg.norm(Q, axis=-1) - radius - thick / 2) - thick / 2
        return np.maximum(shell, Q[..., 1] if lower else -Q[..., 1])

    def lash(P):
        return np.abs(_rot(P, c, rot)[..., 1]) - 0.024  # a bold lash line

    return f, lash


def build(s: Spec):
    out_glb = os.path.join(ROOT, "art", "out", "models", f"{s.id}.glb")
    out_sheet = os.path.join(ROOT, "art", "characters", s.id, "sheet")
    bones, elbow, wrist, ankle = bones_for(s)
    names = [b[0] for b in bones]
    prims = skin_prims(s, elbow, wrist, ankle)
    skin_fn = lambda P: field(prims, P)  # noqa: E731
    ez = eye_centre_z(s)

    def skin_colors(P):
        regions = list(s.extra_paint)
        for sgn, n in SIDES:
            if s.hand == "hoof":
                continue
            regions += [
                (ellipsoid((sgn * s.fist[0], s.fist[1], s.fist[2] + 0.04), (0.31, 0.28, 0.32)), s.paw, 0.04, 0),
                (ellipsoid((sgn * s.foot[0], s.foot[1], s.foot[2] + 0.02), (s.foot_r[0] + 0.05, 0.17, s.foot_r[2] + 0.12)), s.feet or s.paw, 0.03, 0),
            ]
        return paint(P, s.skin, regions)

    bk.reset_scene()
    arm = bk.make_armature(bones)
    made = []

    pts, faces = mesh_sdf(skin_fn, (-1.6, -0.06, -1.2), (1.6, 3.3, 1.4), 0.015)
    ob, pts = bk.make_mesh("skin", pts, faces, skin_fn, skin_colors, tris=60000, gloss=s.skin_gloss)
    bk.skin(ob, arm, prims, pts, names)
    made.append(ob)

    from blendkit import from_b  # noqa: F401
    from sdfkit import gradient

    def rigid(name, fn, lo, hi, voxel, colors, bone, ao=True, tris=2500, gloss=0.25):
        p, f = mesh_sdf(fn, lo, hi, voxel)
        if not f:
            print(f"WARN empty part {name}")
            return None
        cols = colors if callable(colors) else (lambda P, c=colors: paint(P, c, []))
        o, _ = bk.make_mesh(name, p, f, fn, cols, ao, tris, gloss)
        bk.parent_to_bone(o, arm, bone)
        made.append(o)
        return o

    # Garments (same skeleton; cloth shell over chosen body volumes).
    for g in s.garments:
        follows = [p for p in prims if g["follows"](p)]
        fn = lambda P, fl=follows, g=g: g["shape"](field(fl, P) - g["thickness"], P)  # noqa: E731
        p, f = mesh_sdf(fn, g["lo"], g["hi"], 0.012)
        o, p = bk.make_mesh(g["name"], p, f, fn, g["colors"], tris=g.get("tris", 14000), gloss=g.get("gloss", 0.04))
        bk.skin(o, arm, follows, p, names)
        made.append(o)

    # --- Eyes (cartoon v3, docs/10): a ball with an almost FLAT iris (a deep cupped iris read
    # as an eye behind glass), a thick dark limbal ring, a big pupil, a small low crescent, ONE
    # discreet head-fixed glint (the second one and the shader specular made them glassy).
    for sgn, n in SIDES:
        c = np.array((sgn * s.eye_x, s.eye_y, ez))
        fwd = np.array((sgn * math.sin(0.14), 0, math.cos(0.14)))
        R, A, DEPTH = s.eye_r, s.eye_r * 0.6, s.eye_r * 0.025
        RD = (A * A + DEPTH * DEPTH) / (2 * DEPTH)
        ball = ellipsoid(tuple(c), (R, R, R))
        dish = ellipsoid(tuple(c + fwd * (R - DEPTH + RD)), (RD, RD, RD))
        eye_fn = lambda P, b=ball, d=dish: np.maximum(b(P), -d(P))  # noqa: E731
        cos_iris = math.cos(math.asin(A / R))
        cos_pupil = math.cos(math.asin(R * 0.34 / R))

        def eye_colors(P, c=c, fwd=fwd, cos_iris=cos_iris, cos_pupil=cos_pupil, R=R):
            V = P - c
            k = (V @ fwd) / np.maximum(np.linalg.norm(V, axis=-1), 1e-6)
            return paint(P, 0xF4EFE4, [
                (lambda Q: c[1] + R * 0.4 - Q[..., 1], 0xCFC6B6, 0.03, 0),
                (lambda Q: (cos_iris - k) * R, s.iris, 0.002, 0),
                (lambda Q: np.maximum((cos_iris + 0.05 - k) * R, Q[..., 1] - (c[1] - R * 0.4)), s.iris_light, 0.004, 0),
                (lambda Q: np.abs(k - cos_iris - 0.012) * R - 0.009, s.limbal, 0.001, 0),
                (lambda Q: (cos_pupil - k) * R, 0x1B1720, 0.0015, 0),
            ])

        rigid(f"eye.{n}", eye_fn, tuple(c - R - 0.04), tuple(c + R + 0.04), 0.004, eye_colors, f"eye.{n}", ao=False, tris=7000, gloss=s.eye_gloss)
        front = c + fwd * R
        rigid(f"glint.{n}", ellipsoid(tuple(front + (-R * 0.24, R * 0.3, 0.01)), (R * 0.12, R * 0.1, 0.008)),
              tuple(front - 0.1), tuple(front + 0.1), 0.003, 0xFFFFFF, "head", ao=False, tris=800, gloss=0.0)
        lid_col = (s.lid_l if sgn > 0 else s.lid_r) or s.skin
        lf, lash = lid_shape(tuple(c), R, (-2.0, sgn * 0.21, sgn * 0.17))
        rigid(f"lidmesh.{n}", lf, tuple(c - R - 0.06), tuple(c + R + 0.06), 0.004,
              lambda P, l=lash, lc=lid_col: paint(P, lc, [(l, s.brow_color, 0.003, 0)]), f"lid.{n}", ao=False, tris=5000)
        lw, _ = lid_shape(tuple(c), R, (2.0, sgn * 0.21, 0), lower=True)
        rigid(f"lowlidmesh.{n}", lw, tuple(c - R - 0.06), tuple(c + R + 0.06), 0.004, lid_col, f"lidlow.{n}", ao=False, tris=4000, gloss=0.15)
        # Brow: a fat tapered stroke on the ridge, inner end lower.
        y0 = s.eye_y + 0.27 + (s.brow_lift[0] if sgn > 0 else s.brow_lift[1])
        bp = [(sgn * (s.eye_x - 0.18), y0 - 0.04, ez + 0.2), (sgn * s.eye_x, y0 + 0.04, ez + 0.22), (sgn * (s.eye_x + 0.17), y0 + 0.05, ez + 0.12)]
        br = s.brow_r
        brow_fn = lambda P, bp=bp, br=br: np.minimum(capsule(bp[0], bp[1], br)(P), capsule(bp[1], bp[2], br, br * 0.7)(P))  # noqa: E731
        rigid(f"browmesh.{n}", brow_fn, tuple(np.min(bp, 0) - 0.1), tuple(np.max(bp, 0) + 0.1), 0.005, s.brow_color, f"brow.{n}", ao=False, gloss=0.05)

    # --- Mouth ---
    if s.mouth == "beak" and s.beak:
        rigid("beak_upper", s.beak["upper"], *s.beak["upper_box"], 0.004, s.beak["colors"], "head", tris=6000, gloss=0.5)
        rigid("beak_lower", s.beak["lower"], *s.beak["lower_box"], 0.004, s.beak["colors_lower"], "jaw", tris=5000, gloss=0.5)
    else:
        mouth_decals(s, skin_fn, arm, made)

    # Character rigid parts and decals.
    for r in list(s.rigid) + hoof_parts(s, ankle):
        o = rigid(r["name"], r["fn"], r["lo"], r["hi"], r.get("voxel", 0.008), r["colors"], r["bone"], r.get("ao", True), r.get("tris", 4000), r.get("gloss", 0.25))
        if o is not None and "tilt" in r:
            pivot = Matrix.Translation(bk.to_b(r["tilt"][0]).tolist())
            o.matrix_world = pivot @ Matrix.Rotation(r["tilt"][1], 4, "X") @ pivot.inverted() @ o.matrix_world

    tris = bk.tri_count(made)
    zs = np.array([v.co.z for v in bpy.data.objects["skin"].data.vertices])
    height = float(zs.max())
    chin = s.head_c[1] - s.head_r[1]
    print(f"CHECK {s.id} height={height:.2f} head_ratio={(height - chin) / height:.2f} tris={tris}", flush=True)
    assert tris <= s.tri_budget, f"too many triangles: {tris}"
    bk.render_sheet(out_sheet, 3.6)
    bk.export_glb(out_glb)
    print("WROTE", out_glb, flush=True)


def mouth_decals(s: Spec, skin_fn, arm, made):
    """Swappable mouth decals (grin / smirk / frown / o / shout) on the snout or muzzle."""
    my, mw = s.mouth_y, s.mouth_w
    k = mw / 0.3
    DV = 0.0035
    GP, GLO = grid_points((-mw - 0.12, my - 0.28, s.head_c[2] + 0.3), (mw + 0.12, my + 0.22, s.head_c[2] + 1.1), DV)
    GSK = skin_fn(GP.reshape(-1, 3)).reshape(GP.shape[:-1])
    LIP, MOUTH, TONGUE, TOOTH = 0x2B2224, 0x5A1E1E, 0xE7787F, 0xF4EEDC

    def decal(name, region, offset, color):
        vol = np.maximum.reduce([GSK - offset, -(GSK + 0.03), region(GP)])
        p, f = mesh_volume(vol, GLO, DV, adaptivity=0.7)
        if not f:
            print(f"WARN empty decal {name}")
            return
        fn = lambda P: np.maximum.reduce([skin_fn(P) - offset, -(skin_fn(P) + 0.03), region(P)])  # noqa: E731
        o, _ = bk.make_mesh(name, p, f, fn, lambda P, c=color: paint(P, c, []), False, None, 0.45)
        bk.parent_to_bone(o, arm, "head")
        made.append(o)

    def ell2(cx, cy, rx, ry):
        return lambda P: (np.hypot((P[..., 0] - cx) / rx, (P[..., 1] - cy) / ry) - 1) * min(rx, ry)

    def u(P):
        return (P[..., 0] / mw) ** 2

    top = my + 0.065 * k
    bot = my - 0.14 * k
    grin = lambda P: np.maximum.reduce([bot + 0.21 * k * u(P) - P[..., 1], P[..., 1] - (top + 0.07 * k * u(P)), np.abs(P[..., 0]) - mw * 1.03])  # noqa: E731

    def line(curve):
        return lambda P: np.maximum(np.abs(P[..., 1] - curve(P[..., 0])) - 0.013, np.abs(P[..., 0]) - mw * 0.93)

    def layered(shape, region, teeth=None, tongue=None, low=None):
        decal(f"mouth_{shape}_lip", lambda P: region(P) - 0.014, 0.004, LIP)
        decal(f"mouth_{shape}_in", region, 0.008, MOUTH)
        if tongue is not None:
            decal(f"mouth_{shape}_tongue", lambda P: np.maximum(region(P) + 0.01, tongue(P)), 0.012, TONGUE)
        if teeth is not None:
            decal(f"mouth_{shape}_teeth", lambda P: np.maximum(region(P) + 0.006, teeth(P)), 0.012, TOOTH)
        if low is not None:
            decal(f"mouth_{shape}_lowteeth", lambda P: np.maximum(region(P) + 0.004, low(P)), 0.013, TOOTH)

    layered("grin", grin,
            teeth=lambda P: (top + 0.07 * k * u(P) - 0.06 * k) - P[..., 1],
            tongue=ell2(0, bot + 0.04 * k, 0.16 * k, 0.07 * k),
            low=lambda P: P[..., 1] - (bot + 0.21 * k * u(P) + 0.035 * k))
    decal("mouth_smirk_lip", line(lambda x: my + 0.05 * k * (x / mw) ** 2 + 0.035 * k * x / mw), 0.005, LIP)
    decal("mouth_frown_lip", line(lambda x: my + 0.02 - 0.06 * k * (x / mw) ** 2), 0.005, LIP)
    decal("mouth_smile_lip", line(lambda x: my - 0.01 + 0.07 * k * (x / mw) ** 2), 0.005, LIP)  # closed smile
    layered("o", ell2(0, my - 0.04 * k, 0.11 * k, 0.13 * k), tongue=ell2(0, my - 0.14 * k, 0.09 * k, 0.05 * k))
    box = lambda P: np.hypot(np.maximum(np.abs(P[..., 0]) - 0.15 * k, 0), np.maximum(np.abs(P[..., 1] - (my - 0.06 * k)) - 0.06 * k, 0)) - 0.07 * k  # noqa: E731
    layered("shout", box, teeth=lambda P: (my + 0.07 * k - 0.045) - P[..., 1], tongue=ell2(0, my - 0.17 * k, 0.15 * k, 0.07 * k),
            low=lambda P: P[..., 1] - (my - 0.155 * k))


def held_frame(origin, forward):
    """Local frame of a tool held in a fist: x right, y up, z along the handle (0 at the fist).
    Returns (to_local, corners_box(zmin, zmax, half_w, ylo, yhi) -> (lo, hi))."""
    o = np.asarray(origin, dtype=np.float32)
    f = np.asarray(forward, dtype=np.float32)
    f = f / np.linalg.norm(f)
    r = np.array((1.0, 0.0, 0.0), dtype=np.float32)
    u = np.cross(f, r)

    def to_local(P):
        Q = P - o
        return np.stack([Q @ r, Q @ u, Q @ f], -1).astype(np.float32)

    def box(z0, z1, hw, y0, y1):
        pts = [o + f * z + r * x + u * y for z in (z0, z1) for x in (-hw, hw) for y in (y0, y1)]
        return tuple(np.min(pts, 0)), tuple(np.max(pts, 0))

    return to_local, box, u


def torus_z(z, R, r):
    return lambda Q: np.hypot(np.hypot(Q[..., 0], Q[..., 1]) - R, Q[..., 2] - z) - r


def hoof_parts(s: Spec, ankle):
    """Hooves (hand / foot_style "hoof"): crisp dark rigid parts with a front cleft, so the
    colour edge is a real edge (painting them on the skin gave a blurred mitten)."""
    parts = []

    def hoof(c, r, h, bone, name, flat):
        c = np.asarray(c, np.float32)

        def fn(P, c=c):
            d = rcylinder(tuple(c), r, h, min(0.06, h * 0.5))(P)
            d = np.maximum(d, -ellipsoid(tuple(c + (0, h, 0)), (r * 0.8, h * 0.4, r * 0.8))(P))  # cup at the top
            cleft = np.maximum(np.abs(P[..., 0] - c[0]) - 0.018, c[2] + r * 0.25 - P[..., 2])
            d = np.maximum(d, -np.maximum(cleft, P[..., 1] - (c[1] + h * 0.6)))
            return np.maximum(d, -P[..., 1]) if flat else d

        lo = tuple(c - (r + 0.05, h + 0.05, r + 0.05))
        hi = tuple(c + (r + 0.05, h + 0.05, r + 0.05))
        parts.append({"name": name, "fn": fn, "lo": lo, "hi": hi, "voxel": 0.005,
                      "colors": s.paw, "bone": bone, "tris": 3000, "gloss": 0.55})

    for sgn, n in SIDES:
        if s.hand == "hoof":
            fx, fy, fz = s.fist
            hoof((sgn * fx, fy - 0.1, fz), 0.2 * s.hand_scale, 0.13, f"hand.{n}", f"hoof_hand.{n}", False)
        if s.foot_style == "hoof":
            hoof((sgn * s.foot[0], 0.14, s.foot[2] - 0.05), s.foot_r[0] * 0.95, 0.14, f"foot.{n}", f"hoof_foot.{n}", True)
    return parts
