"""SDF modelling kit for Blender (numpy + OpenVDB), shared by every character build script.

Coordinates are the GAME's: y up, +z = front, feet at y = 0, units = r. Conversion to
Blender (z up) happens only when data is written to Blender (`to_b`).

A character is a list of primitives. Each primitive is a numpy SDF (negative inside) with:
  - bone:  the bone it belongs to (drives the skin weights),
  - blend: smooth-union radius with everything before it (large = flesh join, small = seam),
  - sub:   carve instead of add (mouth, eye sockets).
"""

import math

import numpy as np
import openvdb as vdb

# --------------------------------------------------------------------------- shapes


def _rot(P, c, rot):
    """Local coordinates of points P around centre c, rotated by Euler angles (x, y, z)."""
    Q = P - np.asarray(c, dtype=np.float32)
    if rot is None:
        return Q
    rx, ry, rz = rot
    # Inverse rotation (world -> local): apply -z, then -y, then -x.
    for axis, a in (("z", -rz), ("y", -ry), ("x", -rx)):
        if a == 0:
            continue
        ca, sa = math.cos(a), math.sin(a)
        x, y, z = Q[..., 0].copy(), Q[..., 1].copy(), Q[..., 2].copy()
        if axis == "x":
            Q[..., 1], Q[..., 2] = ca * y - sa * z, sa * y + ca * z
        elif axis == "y":
            Q[..., 0], Q[..., 2] = ca * x + sa * z, -sa * x + ca * z
        else:
            Q[..., 0], Q[..., 1] = ca * x - sa * y, sa * x + ca * y
    return Q


def ellipsoid(c, r, rot=None):
    r = np.asarray(r, dtype=np.float32)

    def f(P):
        Q = _rot(P, c, rot)
        k0 = np.linalg.norm(Q / r, axis=-1)
        k1 = np.linalg.norm(Q / (r * r), axis=-1)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)

    return f


def capsule(a, b, r1, r2=None):
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    r2 = r1 if r2 is None else r2
    ba = b - a
    bb = float(np.dot(ba, ba))

    def f(P):
        pa = P - a
        h = np.clip((pa @ ba) / bb, 0.0, 1.0)
        d = np.linalg.norm(pa - h[..., None] * ba, axis=-1)
        return d - (r1 + (r2 - r1) * h)

    return f


def rbox(c, h, round_=0.03, rot=None):
    h = np.asarray(h, dtype=np.float32)

    def f(P):
        Q = np.abs(_rot(P, c, rot)) - h + round_
        out = np.linalg.norm(np.maximum(Q, 0.0), axis=-1)
        return out + np.minimum(Q.max(axis=-1), 0.0) - round_

    return f


def rcylinder(c, radius, half_h, round_=0.02, rot=None):
    """Rounded cylinder around the local y axis (hat brim, crown, discs)."""

    def f(P):
        Q = _rot(P, c, rot)
        d = np.stack(
            [np.hypot(Q[..., 0], Q[..., 2]) - radius + round_, np.abs(Q[..., 1]) - half_h + round_], -1
        )
        return np.minimum(np.maximum(d[..., 0], d[..., 1]), 0.0) + np.linalg.norm(
            np.maximum(d, 0.0), axis=-1
        ) - round_

    return f


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


class Prim:
    def __init__(self, shape, bone=None, blend=0.0, sub=False):
        self.shape, self.bone, self.blend, self.sub = shape, bone, blend, sub


def field(prims, P):
    d = None
    for p in prims:
        di = p.shape(P)
        if d is None:
            d = di
        elif p.sub:
            d = -smin(-d, di, p.blend)
        else:
            d = smin(d, di, p.blend)
    return d


# --------------------------------------------------------------------------- meshing


def mesh_sdf(fn, lo, hi, voxel, adaptivity=0.0):
    """Samples fn on a grid and returns (points, faces) of its zero isosurface (OpenVDB)."""
    lo = np.floor(np.asarray(lo) / voxel).astype(int)
    hi = np.ceil(np.asarray(hi) / voxel).astype(int)
    xs = np.arange(lo[0], hi[0] + 1) * voxel
    ys = np.arange(lo[1], hi[1] + 1) * voxel
    zs = np.arange(lo[2], hi[2] + 1) * voxel
    vol = np.empty((len(xs), len(ys), len(zs)), dtype=np.float32)
    # Slice by x to bound memory.
    Y, Z = np.meshgrid(ys, zs, indexing="ij")
    for i, x in enumerate(xs):
        P = np.stack([np.full_like(Y, x), Y, Z], -1).astype(np.float32)
        vol[i] = fn(P)
    grid = vdb.FloatGrid(background=float(3 * voxel))
    grid.copyFromArray(np.clip(vol, -3 * voxel, 3 * voxel), ijk=tuple(int(v) for v in lo), tolerance=0.0)
    grid.transform = vdb.createLinearTransform(voxelSize=voxel)
    grid.gridClass = vdb.GridClass.LEVEL_SET
    pts, tris, quads = grid.convertToPolygons(isovalue=0.0, adaptivity=adaptivity)
    faces = [tuple(int(i) for i in q) for q in quads] + [tuple(int(i) for i in t) for t in tris]
    return np.asarray(pts, dtype=np.float32), faces


def grid_points(lo, hi, voxel):
    """Sample positions of the grid mesh_sdf uses (for precomputing a shared field)."""
    lo = np.floor(np.asarray(lo) / voxel).astype(int)
    hi = np.ceil(np.asarray(hi) / voxel).astype(int)
    axes = [np.arange(a, b + 1) * voxel for a, b in zip(lo, hi)]
    return np.stack(np.meshgrid(*axes, indexing="ij"), -1).astype(np.float32), lo


def mesh_volume(vol, lo_idx, voxel, adaptivity=0.0):
    """Meshes an already sampled field (see grid_points)."""
    grid = vdb.FloatGrid(background=float(3 * voxel))
    grid.copyFromArray(np.clip(vol, -3 * voxel, 3 * voxel).astype(np.float32), ijk=tuple(int(v) for v in lo_idx), tolerance=0.0)
    grid.transform = vdb.createLinearTransform(voxelSize=voxel)
    grid.gridClass = vdb.GridClass.LEVEL_SET
    pts, tris, quads = grid.convertToPolygons(isovalue=0.0, adaptivity=adaptivity)
    faces = [tuple(int(i) for i in q) for q in quads] + [tuple(int(i) for i in t) for t in tris]
    return np.asarray(pts, dtype=np.float32), faces


def gradient(fn, P, e=0.004):
    g = np.stack(
        [
            fn(P + np.array([e, 0, 0], np.float32)) - fn(P - np.array([e, 0, 0], np.float32)),
            fn(P + np.array([0, e, 0], np.float32)) - fn(P - np.array([0, e, 0], np.float32)),
            fn(P + np.array([0, 0, e], np.float32)) - fn(P - np.array([0, 0, e], np.float32)),
        ],
        -1,
    )
    return g / np.maximum(np.linalg.norm(g, axis=-1, keepdims=True), 1e-9)


def sdf_ao(fn, P, N, steps=4, dist=0.09, strength=0.55):
    """Ambient occlusion from the field itself: darkens creases, armpits, under the chin."""
    occ = np.zeros(len(P), dtype=np.float32)
    w = 1.0
    for i in range(1, steps + 1):
        h = dist * i
        occ += w * np.maximum(0.0, h - fn(P + N * h))
        w *= 0.5
    return np.clip(1.0 - strength * occ / dist, 0.0, 1.0)


def skin_weights(prims, P, bone_names, sigma=0.045, max_bones=4):
    """Per-vertex bone weights from the distance to each bone's primitives (soft joints)."""
    bone_idx = {b: i for i, b in enumerate(bone_names)}
    W = np.zeros((len(P), len(bone_names)), dtype=np.float32)
    D = np.stack([p.shape(P) if not p.sub and p.bone else np.full(len(P), np.inf) for p in prims], -1)
    dmin = D.min(axis=-1, keepdims=True)
    for j, p in enumerate(prims):
        if p.sub or not p.bone:
            continue
        W[:, bone_idx[p.bone]] += np.exp(-(D[:, j] - dmin[:, 0]) / sigma)
    # Keep the strongest bones, renormalised.
    order = np.argsort(-W, axis=-1)[:, :max_bones]
    top = np.take_along_axis(W, order, axis=-1)
    top /= np.maximum(top.sum(axis=-1, keepdims=True), 1e-9)
    return order, top


def srgb(hex_):
    """Hex sRGB colour -> linear RGB (Blender colour attributes are linear)."""
    c = np.array([(hex_ >> 16) & 255, (hex_ >> 8) & 255, hex_ & 255], dtype=np.float32) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def paint(P, base, regions):
    """Vertex colours: base colour, then regions in order. region = (sdf_fn, hex, soft, wobble)."""
    C = np.tile(srgb(base), (len(P), 1))
    for fn, col, soft, wobble in regions:
        d = fn(P)
        if wobble:
            d = d + wobble * (np.sin(P[:, 0] * 13 + P[:, 1] * 7) + np.sin(P[:, 2] * 11 - P[:, 1] * 9)) * 0.5
        m = np.clip(0.5 - d / max(soft, 1e-4) * 0.5, 0.0, 1.0) if soft > 0 else (d < 0).astype(np.float32)
        C = C * (1 - m[:, None]) + srgb(col)[None, :] * m[:, None]
    return C
