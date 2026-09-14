"""Actual Blender planar screen compositing. Run in a fresh background process.

Source movie is read-only. Corner data/config owns all operational tuning. Outputs are new.
The transparent interface preserves the original moving doctor; no reconstructed room/camera.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parent
CFG = json.loads((ROOT / "composite.json").read_text(encoding="utf-8"))
SOURCE = (ROOT / CFG["source"]).resolve()
OUTPUT = (ROOT / CFG["output"]).resolve()
if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != CFG["sourceSha256"]:
    raise RuntimeError("Source film changed; refuse to use stale screen coordinates")
parser = argparse.ArgumentParser()
parser.add_argument("--all", action="store_true")
parser.add_argument("--probe", type=int)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
OUTPUT.mkdir(parents=True, exist_ok=True)
frames_dir = OUTPUT / "composited-frames"
frames_dir.mkdir(exist_ok=True)
scene = bpy.context.scene
scene.render.engine = CFG["renderEngine"]
scene.render.resolution_x = CFG["width"]
scene.render.resolution_y = CFG["height"]
scene.render.resolution_percentage = 100
scene.render.fps = CFG["fps"]
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.frame_start = 1
scene.frame_end = CFG["frames"]
# The existing default camera avoids rendering unrelated geometry; compositor has no Render Layers.
tree = bpy.data.node_groups.new("MediConnect - tracked screen replacement", "CompositorNodeTree")
scene.compositing_node_group = tree
tree.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
nodes, links = tree.nodes, tree.links
movie = nodes.new("CompositorNodeMovieClip")
movie.clip = bpy.data.movieclips.load(str(SOURCE))
movie.label = "Read-only original Seedance film"
movie.location = (-600, 220)
interface = nodes.new("CompositorNodeImage")
interface.image = bpy.data.images.load(str(OUTPUT / "screen-interface.png"))
interface.image.pack()
interface.location = (-600, -100)
pin = nodes.new("CompositorNodeCornerPin")
pin.label = "Manually tracked wall-display active area"
pin.location = (-340, -80)
links.new(interface.outputs["Image"], pin.inputs["Image"])
soft = nodes.new("CompositorNodeBlur")
soft.label = "Match photographed screen softness"
soft.location = (-140, -80)
soft.inputs["Size"].default_value = (CFG["interface"]["softnessPx"], CFG["interface"]["softnessPx"])
links.new(pin.outputs["Image"], soft.inputs["Image"])
over = nodes.new("CompositorNodeAlphaOver")
over.location = (0, 220)
over.inputs["Factor"].default_value = CFG["interface"]["opacity"]
links.new(movie.outputs["Image"], over.inputs["Background"])
links.new(soft.outputs["Image"], over.inputs["Foreground"])
out = nodes.new("NodeGroupOutput")
out.location = (250, 220)
links.new(over.outputs["Image"], out.inputs["Image"])

def key_at(frame):
    keys = CFG["tracking"]["keyframes"]
    left = max((key for key in keys if key["frame"] <= frame), key=lambda key:key["frame"], default=keys[0])
    right = min((key for key in keys if key["frame"] >= frame), key=lambda key:key["frame"], default=keys[-1])
    ratio = (frame-left["frame"])/(right["frame"]-left["frame"]) if right["frame"]!=left["frame"] else 0
    return {name:left[name]+ratio*(right[name]-left[name]) for name in left if name!="frame"}

tracks = []
for frame in range(CFG["frames"]):
    key = key_at(frame)
    r, width = key["right"], CFG["tracking"]["virtualWidth"]
    corners = {"Upper Left":(r-width,key["top"]-width*key["topSlope"]),"Upper Right":(r,key["top"]),"Lower Left":(r-width,key["bottom"]-width*key["bottomSlope"]),"Lower Right":(r,key["bottom"])}
    for name,(x,y) in corners.items():
        pin.inputs[name].default_value = (x/CFG["width"],1-y/CFG["height"])
        pin.inputs[name].keyframe_insert("default_value", frame=frame+1)
    over.inputs["Factor"].default_value = CFG["interface"]["opacity"] if frame>=CFG["tracking"]["firstFrame"] else 0
    over.inputs["Factor"].keyframe_insert("default_value", frame=frame+1)
    tracks.append({"frame":frame,"corners":corners})
scene.frame_set((args.probe if args.probe is not None else CFG["reviewFrames"][-1])+1)
blend = OUTPUT / f'{CFG["name"]}.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
(OUTPUT / "corner-track.json").write_text(json.dumps(tracks,indent=2),encoding="utf-8")
selected = [args.probe] if args.probe is not None else range(CFG["tracking"]["firstFrame"],CFG["frames"]) if args.all else CFG["reviewFrames"]
for frame in selected:
    scene.frame_set(frame+1)
    scene.render.filepath = str(frames_dir / f"frame-{frame:04d}.png")
    bpy.ops.render.render(write_still=True)
    print("COMPOSITED_FRAME", frame, flush=True)
print("BLENDER_COMPOSITE_COMPLETE", len(selected))
if args.all:
    (OUTPUT / "render-manifest.json").write_text(json.dumps({
        "blender":bpy.app.version_string,"sourceSha256":CFG["sourceSha256"],
        "configSha256":hashlib.sha256((ROOT/"composite.json").read_bytes()).hexdigest(),
        "interfaceSha256":hashlib.sha256((OUTPUT/"screen-interface.png").read_bytes()).hexdigest(),
        "frames":{str(frame):hashlib.sha256((frames_dir/f"frame-{frame:04d}.png").read_bytes()).hexdigest() for frame in selected},
        "method":CFG["tracking"]["method"]
    },indent=2),encoding="utf-8")
