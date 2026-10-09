"""Match version of a character: the showcase model, decimated to the match budget.

    blender -b -P art/characters/lib/make_match.py -- <id> [budget] [mouth]

Reads art/out/models/<id>.glb (built by art/characters/<id>/build.py), writes
art/out/models/<id>.match.glb. Same skeleton, bone names, vertex colours (alpha = baked AO) and
mouth decals: the match uses the same loader and animation as the viewer.
(art/out/models/ holds the raw exports; `npm run models:pack` compresses them into
public/models/, which the game downloads.)

In the match a character is ~100 px tall on a phone and never changes expression (roadmap
decision, docs/11), so only the signature mouth is kept and every other mouth decal is dropped.
Small parts (eyes, glints, lids) keep a floor of triangles so they stay round.
"""

import os
import sys

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if not args:
    raise SystemExit("usage: blender -b -P make_match.py -- <id> [budget]")
CHAR_ID = args[0]
BUDGET = int(args[1]) if len(args) > 1 else 12000
# Mouth kept in the match: the one of the character's signature expression (characterArt.ts MODEL_ART,
# mapped to a mouth in gltfCharacter.ts): placide -> smile, teigneux -> smirk. Birds have a beak.
MATCH_MOUTH = args[2] if len(args) > 2 else "smirk"
# A part never goes below this many triangles (an eye must stay a sphere).
FLOOR = 60

src = os.path.join(ROOT, "art", "out", "models", f"{CHAR_ID}.glb")
out = os.path.join(ROOT, "art", "out", "models", f"{CHAR_ID}.match.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


meshes = [o for o in bpy.data.objects if o.type == "MESH"]
# Drop the mouth decals the match never shows. Birds (beaks) have none.
mouths = {o.name.split("_")[1] for o in meshes if o.name.startswith("mouth_")}
keep = MATCH_MOUTH if MATCH_MOUTH in mouths else next(iter(sorted(mouths)), None)
for o in list(meshes):
    if o.name.startswith("mouth_") and o.name.split("_")[1] != keep:
        bpy.data.objects.remove(o)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]

before = sum(tris(o) for o in meshes)
ratio = min(1.0, BUDGET / max(1, before))
for o in meshes:
    n = tris(o)
    target = max(FLOOR, n * ratio)
    r = min(1.0, target / max(1, n))
    if r >= 0.999:
        continue
    mod = o.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = r
    # Armature first: decimate must act on the rest shape, under the skin.
    while o.modifiers[0].name != "decimate":
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_move_up(modifier="decimate")
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="decimate")

after = sum(tris(o) for o in bpy.data.objects if o.type == "MESH")
print(f"CHECK {CHAR_ID} match tris {before} -> {after} (budget {BUDGET})", flush=True)
assert after <= BUDGET * 1.15, f"over budget: {after}"

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_yup=True,
    export_skins=True,
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=False,
    export_normals=True,
    export_animations=False,
    export_def_bones=False,
    export_morph=False,
    export_attributes=True,
    export_materials="NONE",
)
print("WROTE", out, os.path.getsize(out) // 1024, "KB", flush=True)
