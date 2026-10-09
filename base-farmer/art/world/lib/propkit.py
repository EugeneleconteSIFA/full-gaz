"""Props kit: world objects (obstacles, buildings) built like the characters (docs/12).

Same SDF kit (art/characters/lib/sdfkit.py) and Blender side (blendkit.py): isosurface, voxel
remesh to the budget, vertex colours (RGB) + baked occlusion (alpha), smooth normals. No rig.

Units are WORLD units (a character is 2.2 tall), y up, +z toward the viewer, the object standing
on y = 0 and centred on x = z = 0. Several props go in one .glb, one named node each; the game
instantiates them by name.
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "characters", "lib"))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

import blendkit as bk  # noqa: E402
from sdfkit import mesh_sdf  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))


def torus_y(c, R, r):
    """Ring lying flat (axis = y), centre c."""
    c = np.asarray(c, dtype=np.float32)

    def f(P):
        Q = P - c
        return np.hypot(np.hypot(Q[..., 0], Q[..., 2]) - R, Q[..., 1]) - r

    return f


def prism_x(profile, half_x, round_=0.03):
    """Convex polygon in the (z, y) plane, given counter-clockwise, extruded along x
    (roofs, gables). Rounded by `round_`."""
    pts = [np.asarray(p, dtype=np.float32) for p in profile]
    edges = []
    for a, b in zip(pts, pts[1:] + pts[:1]):
        t = b - a
        n = np.array([t[1], -t[0]], np.float32)
        n /= np.linalg.norm(n)
        edges.append((a, n))

    def f(P):
        zy = np.stack([P[..., 2], P[..., 1]], -1)
        d2 = np.max(np.stack([(zy - a) @ n for a, n in edges], -1), -1) + round_
        dx = np.abs(P[..., 0]) - half_x + round_
        d = np.stack([d2, dx], -1)
        return np.linalg.norm(np.maximum(d, 0), axis=-1) + np.minimum(d.max(-1), 0) - round_

    return f


def angle_bands(n, soft, offset=0.0):
    """SDF-like field negative on every other angular band around the y axis (staves)."""

    def f(P):
        a = np.arctan2(P[..., 2], P[..., 0]) + offset
        return np.sin(a * n) * soft

    return f


def decimate(o, target):
    n = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if n <= target:
        return
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = target / n
    bpy.ops.object.modifier_apply(modifier=mod.name)


class Prop:
    """One named prop made of parts; each part = (fn, lo, hi, voxel, colors, tris)."""

    def __init__(self, name, budget):
        self.name, self.budget, self.parts = name, budget, []

    def part(self, fn, lo, hi, colors, tris, voxel=0.012, ao=True):
        self.parts.append((fn, lo, hi, voxel, colors, tris, ao))
        return self


def build(props, out_glb, sheet_dir, sheet_height=2.4):
    """Meshes every prop, checks budgets, joins each prop's parts into one node, exports."""
    bk.reset_scene()
    report = []
    for prop in props:
        objs = []
        for i, (fn, lo, hi, voxel, colors, tris, ao) in enumerate(prop.parts):
            pts, faces = mesh_sdf(fn, lo, hi, voxel)
            # Full-resolution isosurface first (attributes from the field), then an edge-collapse
            # decimation to the part's budget: it keeps thin parts and creases, unlike the
            # characters' voxel remesh (which breaks hoops and grooves at prop budgets).
            o, _ = bk.make_mesh(f"{prop.name}_{i}", pts, faces, fn, colors, ao, None)
            decimate(o, tris)
            objs.append(o)
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        node = bpy.context.view_layer.objects.active
        node.name = prop.name
        n = bk.tri_count([node])
        report.append((prop.name, n, prop.budget))
        assert n <= prop.budget, f"{prop.name}: {n} triangles > budget {prop.budget}"
    for name, n, budget in report:
        print(f"CHECK {name} tris={n} budget={budget}", flush=True)
    # One review sheet per prop (front / side / back / game camera), the others hidden.
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    for prop in props:
        for o in meshes:
            o.hide_render = o.name != prop.name
        bk.render_sheet(os.path.join(sheet_dir, prop.name), sheet_height, size=500)
    for o in meshes:
        o.hide_render = False
    bk.export_glb(out_glb)
    print("WROTE", out_glb, os.path.getsize(out_glb) // 1024, "KB", flush=True)


def ring_lo_hi(radius, height, margin=0.08):
    return (-radius - margin, -margin, -radius - margin), (radius + margin, height + margin, radius + margin)


__all__ = ["Prop", "build", "torus_y", "angle_bands", "prism_x", "ring_lo_hi", "ROOT", "math"]
