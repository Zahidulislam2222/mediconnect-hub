"""Original clinic/home previsualization, NOT finished realistic character artwork.

Blender background process only. Maintained render/camera/palette/output data is in scene.json.
Only the newly started process's scene is cleared; existing .blend sources remain untouched.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
CFG = json.loads((ROOT / "scene.json").read_text(encoding="utf-8"))
OUTPUT = (ROOT / CFG["output"]).resolve()
PUBLIC = (ROOT / CFG["publicOutput"]).resolve()
OUTPUT.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
MATERIALS = {}
for name, spec in CFG["materials"].items():
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = spec["color"]
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = spec["color"]
    node.inputs["Roughness"].default_value = spec["roughness"]
    node.inputs["Metallic"].default_value = spec.get("metallic", 0)
    node.inputs["Emission Color"].default_value = spec["color"]
    node.inputs["Emission Strength"].default_value = spec.get("emission", 0)
    MATERIALS[name] = mat


def finish(obj, name, material):
    obj.name = name
    obj.data.materials.append(MATERIALS[material])
    return obj


def box(name, xyz, dims, mat, bevel=0.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    obj = finish(bpy.context.object, name, mat)
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new("Soft edges", "BEVEL")
    mod.width, mod.segments = bevel, 3
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def cylinder(name, xyz, radius, depth, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=depth, location=xyz)
    return finish(bpy.context.object, name, mat)


def sphere(name, xyz, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=xyz)
    obj = finish(bpy.context.object, name, mat)
    obj.scale = scale
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def plant(x, y):
    cylinder("Stone planter", (x, y, .35), .3, .7, "plaster")
    cylinder("Trunk", (x, y, 1.1), .025, 1.5, "oak")
    for i in range(9):
        angle = i * 2.4
        leaf = sphere("Leaf", (x + .28 * math.cos(angle), y + .28 * math.sin(angle), 1.1 + .10*i), (.13, .43, .04), "leaf")
        leaf.rotation_euler = (.3, .5, angle)


def seated_person(x, y, mat, facing):
    # Explicit clay stand-ins for actor placement, not marketed as realistic people.
    box("Chair", (x, y, .48), (.72, .68, .17), "linen")
    box("Chair back", (x, y-.28*facing, .85), (.74, .12, .65), "linen")
    for dx in [-.26, .26]:
        cylinder("Chair support", (x+dx, y, .23), .035, .46, "metal")
    sphere("Actor torso blockout", (x, y, .98), (.24, .17, .39), mat)
    sphere("Actor head blockout", (x, y+.03*facing, 1.53), (.135, .14, .19), "skin")
    for dx in [-.13, .13]:
        sphere("Seated leg blockout", (x+dx, y+.22*facing, .55), (.10, .35, .11), "ink")
        cylinder("Lower leg blockout", (x+dx, y+.47*facing, .29), .075, .50, "ink")
        sphere("Listening hand blockout", (x+dx*1.4, y+.37*facing, 1.04), (.07, .15, .06), "skin")


box("Continuous ground", (0, 4, -.15), (15, 29, .3), "floor")
box("Clinic rear left", (-3.25, 5, 1.7), (3.5, .20, 3.4), "plaster")
box("Clinic rear right", (3.25, 5, 1.7), (3.5, .20, 3.4), "plaster")
box("Portal lintel", (0, 5, 3.18), (3.1, .28, .5), "ink")
for x in [-1.53, 1.53]:
    box("Display portal upright", (x, 5, 1.55), (.12, .3, 3.1), "ink")
    box("Portal light seam", (x*.96, 4.83, 1.55), (.035, .025, 2.9), "light", .01)
box("Clinic side", (-5, 0, 1.7), (.2, 10, 3.4), "plaster")
for i in range(28):
    box("Acoustic oak slat", (-4.84, -3+i*.28, 1.7), (.06, .055, 3.1), "oak", .01)
box("Welcome island", (2.6, -2.4, .58), (2, .8, 1.16), "plaster", .18)
box("Island recessed line", (2.6, -2.82, .67), (1.5, .015, .035), "light", .01)
cylinder("Shared consultation table", (-.8, 1.8, .95), .85, .10, "oak")
cylinder("Table pedestal", (-.8, 1.8, .48), .15, .9, "ink")
seated_person(-.8, 2.9, "plaster", -1)
seated_person(-.8, .55, "teal", 1)
box("Consultation tablet", (-.3, 1.8, 1.08), (.5, .3, .045), "ink", .02)
for x, y in [(-4, 3.8), (4, 3.9), (-3.8, -3.5), (3.8, 12)]:
    plant(x, y)
box("Home rug", (0, 10, .015), (5, 5, .025), "linen", .1)
box("Home back wall", (0, 13, 1.7), (10, .18, 3.4), "plaster")
box("Home side", (5, 10, 1.7), (.18, 6, 3.4), "oak")
box("Sofa seat", (0, 11.4, .43), (2.8, .95, .42), "teal", .2)
box("Sofa back", (0, 11.8, .89), (2.8, .22, .8), "teal", .15)
for x in [-1.4, 1.4]:
    box("Sofa arm", (x, 11.35, .68), (.2, .95, .65), "teal", .1)
cylinder("Home coffee table", (0, 9.5, .55), .7, .07, "oak")
cylinder("Coffee table base", (0, 9.5, .27), .24, .52, "ink")
box("Laptop base", (0, 9.5, .62), (.55, .4, .035), "metal", .015)
box("Laptop display", (0, 9.67, .83), (.55, .025, .4), "ink", .015)
box("Laptop screen", (0, 9.65, .83), (.5, .01, .35), "light", .01)
for z in [.7, 1.6, 2.5]:
    box("Home shelf", (-2.9, 12.5, z), (2.3, .4, .08), "oak")
    for i in range(6):
        box("Book", (-3.7+i*.25, 12.5, z+.23), (.13, .25, .38), "teal" if i%2 else "linen", .01)

scene = bpy.context.scene
scene.render.engine = CFG["render"]["engine"]
scene.cycles.samples = CFG["render"]["samples"]
scene.cycles.use_denoising = True
scene.render.resolution_x = CFG["render"]["width"]
scene.render.resolution_y = CFG["render"]["height"]
scene.render.resolution_percentage = 100
scene.render.fps = CFG["render"]["fps"]
scene.frame_end = CFG["render"]["frames"]
scene.world.color = (.15, .15, .15)
for spec in CFG["lights"]:
    data = bpy.data.lights.new(spec["name"], "AREA")
    data.energy, data.size, data.color = spec["energy"], spec["size"], spec["color"]
    obj = bpy.data.objects.new(spec["name"], data)
    bpy.context.collection.objects.link(obj)
    obj.location = spec["position"]
    obj.rotation_euler = (Vector(spec["target"])-obj.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.camera_add()
camera = bpy.context.object
scene.camera = camera
camera.data.lens = CFG["camera"]["lens"]
for key in CFG["camera"]["keys"]:
    camera.location = key["position"]
    camera.rotation_euler = (Vector(key["target"])-camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.keyframe_insert(data_path="location", frame=key["frame"])
    camera.keyframe_insert(data_path="rotation_euler", frame=key["frame"])
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / (CFG["name"] + ".blend")))
bpy.ops.export_scene.gltf(filepath=str(PUBLIC / (CFG["name"] + ".glb")), export_format="GLB", export_apply=True, export_animations=False, export_cameras=False)
scene.render.image_settings.file_format = "PNG"
for frame in CFG["render"]["reviewFrames"]:
    scene.frame_set(frame)
    scene.render.filepath = str(OUTPUT / (CFG["name"] + "-" + str(frame) + ".png"))
    bpy.ops.render.render(write_still=True)
print("CONNECTED_CARE_BLOCKOUT_COMPLETE")
