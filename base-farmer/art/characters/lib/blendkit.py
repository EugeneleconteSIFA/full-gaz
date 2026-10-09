"""Blender side of the character pipeline: mesh objects with colours/normals/weights, armature,
rigid parts parented to bones, checks, review renders and glTF export.

Game coordinates (y up, +z front) are converted to Blender (z up, -y front) by `to_b`; the glTF
exporter converts back, so the .glb is in game coordinates.
"""

import math
import os

import bpy
import numpy as np
from mathutils import Matrix, Vector

from sdfkit import gradient, sdf_ao, skin_weights


def to_b(p):
    p = np.asarray(p, dtype=np.float32)
    return np.stack([p[..., 0], -p[..., 2], p[..., 1]], -1)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def from_b(p):
    p = np.asarray(p, dtype=np.float32)
    return np.stack([p[..., 0], p[..., 2], -p[..., 1]], -1)


def make_mesh(name, pts, faces, fn, colors, ao=True, tris=None, gloss=0.0):
    """Creates a mesh object from an SDF isosurface, decimated to `tris` triangles first; then
    every attribute is computed from the field at the final vertices: normals (smooth, from the
    gradient), vertex colours (RGB, `colors(P)`) and ambient occlusion (alpha).
    `gloss` (0..1, a number or `gloss(P)`) is the surface finish: it goes in the U of a UV map
    named "Gloss" (TEXCOORD_0 in glTF), read by the game's shader for specular highlights (eyes,
    snouts, metal). No texture, no extra material.
    Returns (object, final vertex positions in game coordinates)."""
    import time

    t0 = time.time()
    me = bpy.data.meshes.new(name)
    me.from_pydata(to_b(pts).tolist(), [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    current = sum(len(p.vertices) - 2 for p in me.polygons)
    if tris and current > tris:
        # Even quads everywhere (no sliver triangles to streak shading and colours): a voxel
        # remesh whose voxel size is chosen from the surface area to land on the budget.
        area = sum(p.area for p in me.polygons)
        bpy.context.view_layer.objects.active = ob
        vox = ob.modifiers.new("vox", "REMESH")
        vox.mode = "VOXEL"
        vox.voxel_size = math.sqrt(3 * area / tris)  # measured: ~3 tris per voxel² of area
        bpy.ops.object.modifier_apply(modifier=vox.name)
        me = ob.data
        print(f"MESH {name}: {current} -> {sum(len(p.vertices) - 2 for p in me.polygons)} tris")
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    pts = from_b(co.reshape(-1, 3))
    # Snap every vertex back onto the exact surface (Newton steps along the gradient).
    for _ in range(3):
        pts = pts - fn(pts)[:, None] * gradient(fn, pts)
    me.vertices.foreach_set("co", to_b(pts).ravel())
    faces = [tuple(p.vertices) for p in me.polygons]
    N = gradient(fn, pts)
    # Make the winding agree with the field (OpenVDB may output it inside out).
    # Vote over ALL faces (the first ones may be inner cut faces of a decal slab).
    centres = np.array([pts[list(f)].mean(axis=0) for f in faces])
    fnorm = np.array([np.asarray(p.normal) for p in me.polygons])
    if np.sign((fnorm * to_b(gradient(fn, centres))).sum(axis=-1)).sum() < 0:
        me.flip_normals()
    me.normals_split_custom_set_from_vertices(to_b(N).tolist())
    occ = sdf_ao(fn, pts, N) if ao else np.ones(len(pts), np.float32)
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    rgba = np.concatenate([colors(pts), occ[:, None]], -1).astype(np.float32)
    attr.data.foreach_set("color", rgba.ravel())
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    print(f"TIME {name}: {time.time() - t0:.1f}s ({len(faces)} faces in)", flush=True)
    # Finish per vertex, written per loop into the "Gloss" UV map (u = gloss, v = 0).
    g = gloss(pts) if callable(gloss) else np.full(len(pts), float(gloss), np.float32)
    g = np.clip(np.asarray(g, np.float32), 0.0, 1.0)
    uv = me.uv_layers.new(name="Gloss")
    loop_vertex = np.empty(len(me.loops), dtype=np.int32)
    me.loops.foreach_get("vertex_index", loop_vertex)
    uvs = np.zeros((len(me.loops), 2), np.float32)
    uvs[:, 0] = g[loop_vertex]
    uv.data.foreach_set("uv", uvs.ravel())
    for p in me.polygons:
        p.use_smooth = True
    mat = bpy.data.materials.get("char") or bpy.data.materials.new("char")
    me.materials.append(mat)
    return ob, pts


def make_armature(bones):
    """bones: list of (name, head, tail, parent) in game coordinates."""
    arm = bpy.data.armatures.new("rig")
    ob = bpy.data.objects.new("rig", arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    for name, head, tail, parent in bones:
        b = arm.edit_bones.new(name)
        b.head = Vector(to_b(head).tolist())
        b.tail = Vector(to_b(tail).tolist())
        if parent:
            b.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def skin(ob, arm, prims, pts, bone_names):
    """Distance-based weights (≤ 4 bones per vertex) + Armature modifier."""
    order, top = skin_weights(prims, pts, bone_names)
    groups = {b: ob.vertex_groups.new(name=b) for b in bone_names}
    for v in range(len(pts)):
        for slot in range(order.shape[1]):
            w = float(top[v, slot])
            if w > 1e-4:
                groups[bone_names[order[v, slot]]].add([v], w, "REPLACE")
    ob.parent = arm
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = arm


def parent_to_bone(ob, arm, bone):
    """Rigid part: follows one bone without deforming (hat, eyes, teeth, pitchfork)."""
    ob.parent = arm
    ob.parent_type = "BONE"
    ob.parent_bone = bone
    b = arm.data.bones[bone]
    ob.matrix_parent_inverse = (
        arm.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))
    ).inverted()


def add_shape_keys(ob, pts, shapes, mask_name="_MOUTH"):
    """Blendshapes from SDF variants: every vertex of the neutral mesh is projected onto the
    variant surface (Newton steps), so the topology is shared. Vertices that sink inward (the
    inside of an opening mouth) get a 0..1 mask, used by the shader to darken them."""
    from sdfkit import gradient

    ob.shape_key_add(name="Basis", from_mix=False)
    mask = np.zeros(len(pts), dtype=np.float32)
    N0 = gradient(shapes[next(iter(shapes))], pts)  # any variant: same outside the mouth
    for name, fn in shapes.items():
        P = pts.copy()
        for _ in range(8):
            d = fn(P)
            P = P - np.clip(d, -0.06, 0.06)[:, None] * gradient(fn, P)
        key = ob.shape_key_add(name=name, from_mix=False)
        key.data.foreach_set("co", to_b(P).ravel())
        inward = -((P - pts) * N0).sum(-1)
        mask = np.maximum(mask, np.clip((inward - 0.01) / 0.03, 0, 1))
        print(f"SHAPE {name}: {int((np.linalg.norm(P - pts, axis=-1) > 0.005).sum())} vertices move")
    attr = ob.data.attributes.new(mask_name, "FLOAT", "POINT")
    attr.data.foreach_set("value", mask)


def tri_count(objs):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)


def render_sheet(out_dir, height, size=900):
    """Front / side / back / top orthographic renders (Workbench, vertex colours) for review."""
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "VERTEX"
    scene.display.shading.show_cavity = True
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.film_transparent = True
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = height * 1.25
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    mid = height / 2
    d = 20
    views = {
        "front": ((0, -d, mid), (math.pi / 2, 0, 0)),
        "side": ((d, 0, mid), (math.pi / 2, 0, math.pi / 2)),
        "back": ((0, d, mid), (math.pi / 2, 0, math.pi)),
        "game": ((0, -d * 0.7, mid + d * 0.72), (math.radians(44), 0, 0)),
    }
    os.makedirs(out_dir, exist_ok=True)
    for name, (loc, rot) in views.items():
        cam.location = loc
        cam.rotation_euler = rot
        scene.render.filepath = os.path.join(out_dir, f"{name}.png")
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_skins=True,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_normals=True,
        export_animations=False,
        export_def_bones=False,
        export_morph=True,
        export_morph_normal=True,
        export_attributes=True,
    )
