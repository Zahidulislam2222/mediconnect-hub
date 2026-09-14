"""Original illustrative care pavilion. Run with Blender --background --python.

Geometry below is authored artwork, not a clinical equipment specification.
Render, path, palette and camera settings have one owner: scene.json.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
CFG = json.loads((ROOT / "scene.json").read_text())
OUTPUT = (ROOT / CFG["output"]).resolve()
PUBLIC = (ROOT / CFG["publicOutput"]).resolve()
OUTPUT.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
MATERIALS = {}
for name, settings in CFG["materials"].items():
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = settings["color"]
    node = material.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = settings["color"]
    node.inputs["Roughness"].default_value = settings["roughness"]
    node.inputs["Metallic"].default_value = settings.get("metallic", 0)
    if "emission" in settings:
        node.inputs["Emission Color"].default_value = settings["color"]
        node.inputs["Emission Strength"].default_value = settings["emission"]
    MATERIALS[name] = material


def finish(obj, name, material):
    obj.name = name
    obj.data.materials.append(MATERIALS[material])
    return obj


def block(name, location, dimensions, material, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = finish(bpy.context.object, name, material)
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new("Soft architectural edges", "BEVEL")
    mod.width = bevel
    mod.segments = 3
    obj.modifiers.new("Surface normals", "WEIGHTED_NORMAL")
    return obj


def cylinder(name, location, radius, depth, material):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth, location=location)
    obj = finish(bpy.context.object, name, material)
    mod = obj.modifiers.new("Edge finish", "BEVEL")
    mod.width = min(depth / 5, 0.05)
    mod.segments = 3
    obj.modifiers.new("Surface normals", "WEIGHTED_NORMAL")
    return obj


def curve(name, points, radius, material):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, xyz in zip(spline.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(MATERIALS[material])
    return obj


def chair(x, y, rotation=0):
    seat = block("Upholstered seat", (x, y, 0.82), (0.75, 0.73, 0.22), "linen", 0.1)
    seat.rotation_euler.z = rotation
    back = block("Upholstered back", (x, y + 0.29, 1.14), (0.76, 0.14, 0.6), "linen", 0.08)
    back.rotation_euler.z = rotation
    for dx in [-0.25, 0.25]:
        for dy in [-0.24, 0.24]:
            cylinder("Chair leg", (x + dx, y + dy, 0.51), 0.032, 0.5, "metal")


def plant(x, y):
    cylinder("Planter", (x, y, 0.66), 0.24, 0.7, "stone")
    cylinder("Stem", (x, y, 1.4), 0.035, 1.1, "leaf")
    for i in range(7):
        angle = i * 2.4
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8,
            location=(x + math.cos(angle) * 0.25, y + math.sin(angle) * 0.25, 1.27 + i * 0.08))
        obj = finish(bpy.context.object, "Sculptural foliage", "leaf")
        obj.scale = (0.14, 0.39, 0.065)
        obj.rotation_euler = (0.3, 0.4, angle)


block("Monolithic care plinth", (0, 0, 0), (12.6, 5, 0.5), "ink", 0.3)
block("Continuous path", (0, -1.7, 0.275), (11.9, 0.085, 0.055), "light", 0.02)
for index, pod in enumerate(CFG["pods"]):
    x, y = pod["x"], pod["y"]
    block(pod["name"] + " floor", (x, y, 0.29), (3.75, 3.55, 0.12), "porcelain", 0.16)
    block(pod["name"] + " rear wall", (x, y + 1.63, 1.6), (3.75, 0.12, 2.65), "porcelain", 0.06)
    # Open facades let a visitor inspect all three care stations.
    for dx in [-1.77, 1.77]:
        block("Pavilion upright", (x + dx, y + 1.3, 1.8), (0.09, 0.16, 3), "metal", 0.02)
    block("Floating roof", (x, y + 0.4, 3.32), (3.95, 3.0, 0.16), "porcelain", 0.07)
    block("Ceiling light", (x, y + 0.15, 3.21), (2.85, 0.07, 0.03), "light", 0.012)
    for k in range(13):
        block("Acoustic wall rib", (x - 1.5 + k * 0.25, y + 1.53, 1.67), (0.045, 0.08, 2.1), "stone", 0.01)
    plant(x + 1.2, y + 0.8)
    if index == 0:
        block("Welcome desk", (x - 0.35, y + 0.1, 0.94), (1.65, 0.72, 1.2), "porcelain", 0.18)
        block("Desk inlay", (x - 0.35, y - 0.268, 0.91), (1.1, 0.02, 0.04), "light", 0.01)
        block("Check-in screen", (x - 0.3, y + 0.1, 1.64), (0.62, 0.08, 0.38), "ink", 0.04)
    elif index == 1:
        cylinder("Consultation table", (x, y, 1.1), 0.68, 0.09, "porcelain")
        cylinder("Table pedestal", (x, y, 0.71), 0.09, 0.7, "metal")
        chair(x - 1, y - 0.3)
        chair(x + 0.95, y - 0.3)
        block("Telehealth display", (x - 0.3, y + 0.12, 1.52), (0.78, 0.08, 0.58), "ink", 0.035)
        block("Display light", (x - 0.3, y + 0.073, 1.52), (0.66, 0.015, 0.43), "blue", 0.025)
    else:
        for level in range(3):
            block("Record shelf", (x - 0.45, y + 1, 0.85 + level * 0.5), (1.65, 0.5, 0.05), "porcelain", 0.02)
            for book in range(5):
                block("Illustrative archive", (x - 1 + book * 0.22, y + 1, 1.03 + level * 0.5), (0.12, 0.3, 0.32), "blue" if book % 2 else "linen", 0.012)
        chair(x - 0.45, y - 0.55)

scene = bpy.context.scene
scene.render.engine = CFG["render"]["engine"]
scene.cycles.samples = CFG["render"]["samples"]
scene.cycles.use_denoising = True
scene.render.resolution_x = CFG["render"]["width"]
scene.render.resolution_y = CFG["render"]["height"]
scene.render.resolution_percentage = 100
scene.render.fps = CFG["render"]["fps"]
scene.frame_end = CFG["render"]["frames"]
scene.world.color = (0.05, 0.05, 0.05)
scene.render.film_transparent = False
block("Backdrop", (0, 0, -0.46), (200, 200, 0.3), "ink", 0)
for name, position, energy, size, color in [
    ("Soft key", (0, -5, 12), 2200, 9, (0.8, 0.9, 1)),
    ("Warm rim", (2, 5, 7), 2700, 7, (1, 0.76, 0.48)),
    ("Blue fill", (-7, -2, 4), 1200, 6, (0.32, 0.69, 1)),
]:
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.shape, data.size, data.color = energy, "DISK", size, color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((0, 0, 0)) - obj.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.camera_add()
camera = bpy.context.object
scene.camera = camera
camera.data.lens = CFG["camera"]["lens"]
for frame, position in [(1, CFG["camera"]["start"]), (scene.frame_end, CFG["camera"]["end"])]:
    camera.location = position
    camera.rotation_euler = (Vector(CFG["camera"]["target"]) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.keyframe_insert(data_path="location", frame=frame)
    camera.keyframe_insert(data_path="rotation_euler", frame=frame)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / (CFG["name"] + ".blend")))
# Export geometry only: web lighting and camera are owned by the browser viewer.
bpy.ops.object.select_all(action="DESELECT")
for obj in scene.objects:
    if obj.type == "MESH" and obj.name != "Backdrop":
        obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(PUBLIC / (CFG["name"] + ".glb")),
    export_format="GLB", use_selection=True, export_apply=True, export_animations=False)
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(OUTPUT / (CFG["name"] + ".png"))
bpy.ops.render.render(write_still=True)
print("CARE_WORLD_RENDER_COMPLETE")
