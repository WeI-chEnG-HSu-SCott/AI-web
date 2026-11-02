import bpy
import math
import os

OUT = r"D:\project\AI-web\blender_corner_scene"
os.makedirs(OUT, exist_ok=True)

# Clear default scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.materials, bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
    pass

# Render
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 900
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 70
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = os.path.join(OUT, 'corner_scene_preview.png')
scene.render.film_transparent = False
scene.world.color = (0.055, 0.07, 0.09)
scene.view_settings.look = 'AgX - Medium High Contrast'

def mat(name, color, metallic=0.0, roughness=0.5, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if 'Transmission Weight' in bsdf.inputs:
        bsdf.inputs['Transmission Weight'].default_value = transmission
    return m

concrete = mat('Polished warm gray concrete', (0.24, 0.25, 0.24), 0.0, 0.28)
white = mat('Warm white paint', (0.82, 0.81, 0.75), 0.0, 0.62)
navy = mat('Deep navy curtain', (0.006, 0.018, 0.055), 0.0, 0.78)
dark = mat('Ceiling vent black', (0.012, 0.013, 0.014), 0.05, 0.38)
metal = mat('Window aluminum', (0.38, 0.42, 0.43), 0.55, 0.25)
glass = mat('Soft blue glass', (0.28, 0.52, 0.68), 0.0, 0.08, 0.18)
glass.diffuse_color = (0.28, 0.52, 0.68, 0.25)

def cube(name, loc, scale, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material: o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new('Soft edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
    return o

def cylinder(name, loc, radius, depth, material, vertices=48, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    if material: o.data.materials.append(material)
    return o

# Architectural shell: 8m x 6m open corner
cube('Concrete floor', (0, 0, -0.10), (4.7, 3.5, 0.10), concrete, 0.03)
cube('Back white wall', (-4.55, 0, 2.0), (0.12, 3.5, 2.0), white)
cube('Left white wall', (0, -3.35, 2.0), (4.7, 0.12, 2.0), white)
cube('White ceiling', (0, 0, 4.05), (4.7, 3.5, 0.10), white)

# Dark partition at the inner window end
cube('Gray panel wall', (1.10, 2.85, 2.0), (0.48, 0.10, 2.0), dark)
for z in (0.65, 1.30, 1.95, 2.60, 3.25):
    cube('Panel joint', (1.10, 2.735, z), (0.48, 0.012, 0.016), metal)

# Floor-to-ceiling window along right side, with mullions
window_y = 3.28
for x in (1.55, 2.85, 4.15):
    cube('Window frame vertical', (x, window_y, 2.0), (0.045, 0.045, 2.0), metal)
cube('Window frame lower', (2.85, window_y, 0.10), (1.35, 0.045, 0.045), metal)
cube('Window frame upper', (2.85, window_y, 3.96), (1.35, 0.045, 0.045), metal)
for x in (2.18, 3.50):
    cube('Glass pane', (x, 3.255, 2.0), (0.60, 0.018, 1.92), glass)

# Exterior light card beyond glass
sky_mat = mat('Exterior daylight', (0.65, 0.82, 0.93), 0.0, 1.0)
cube('Exterior daylight', (2.85, 3.65, 2.1), (1.8, 0.03, 2.5), sky_mat)

# Ceiling perimeter drop / window pelmet
cube('Window ceiling pelmet', (2.85, 3.08, 3.78), (1.85, 0.28, 0.18), white, 0.02)

# Curtain collection, wavy folded vertical strips along window wall
curtain_col = bpy.data.collections.new('Curtain folds')
scene.collection.children.link(curtain_col)
for i in range(28):
    if 9 < i < 19:  # open bay in the drapery for the tall window
        continue
    x = 1.24 + i * 0.125
    # Build narrow cylindrical folds clipped visually as curtain front.
    cylinder('Curtain fold %02d' % i, (x, 3.11 + 0.055 * math.sin(i*1.7), 1.94), 0.095, 3.72, navy, 16)
    o = bpy.context.object
    # Move from scene root to collection
    for c in list(o.users_collection): c.objects.unlink(o)
    curtain_col.objects.link(o)
    o.scale.y = 0.48

# A second wide curtain at far right edge, partly covering the glass
for i in range(13):
    x = 4.10 + i * 0.095
    cylinder('Right curtain fold %02d' % i, (x, 3.10 + 0.05*math.sin(i*1.3), 1.94), 0.10, 3.72, navy, 16)
    o = bpy.context.object
    o.scale.y = 0.5

# Ceiling service details: recessed cans, sprinkler heads, vents
for x,y in [(-3.6,-1.9),(-1.2,-0.8),(0.7,0.2)]:
    cylinder('Recessed light trim', (x,y,3.935), 0.16, 0.025, dark, 48)
    cylinder('Recessed light diffuser', (x,y,3.92), 0.105, 0.035, white, 48)

for x,y in [(-3.8,0.35),(-2.5,0.65),(-0.5,0.45),(0.3,1.15)]:
    cylinder('Sprinkler ring', (x,y,3.91), 0.045, 0.045, metal, 20)
    cylinder('Sprinkler stem', (x,y,3.85), 0.017, 0.10, dark, 16)

# Long linear HVAC slot in ceiling
cube('Linear ceiling slot', (-1.75, -0.15, 3.91), (1.25, 0.035, 0.035), dark)
# Circular diffuser ring stack
for r,z in [(0.22,3.915),(0.16,3.89),(0.095,3.865)]:
    cylinder('Circular HVAC diffuser', (-1.2,1.0,z), r, 0.018, metal, 64)

# Small ceiling mounted sensor
cylinder('Ceiling sensor', (0.45,-1.55,3.88), 0.06, 0.08, dark, 32)

# Soft daylight, a warm fill and ceiling spots
bpy.ops.object.light_add(type='AREA', location=(3.0, 2.7, 2.2))
key = bpy.context.object
key.name = 'Window daylight'
key.data.energy = 1200
key.data.shape = 'RECTANGLE'
key.data.size = 3.0
key.data.size_y = 3.4
key.data.color = (0.75, 0.88, 1.0)
key.rotation_euler = (math.radians(77), 0, math.radians(180))

bpy.ops.object.light_add(type='AREA', location=(-2.3, -1.5, 3.7))
fill = bpy.context.object
fill.name = 'Warm ceiling fill'
fill.data.energy = 500
fill.data.shape = 'DISK'
fill.data.size = 2.5
fill.data.color = (1.0, 0.91, 0.74)
fill.rotation_euler = (0,0,0)

for x,y in [(-3.6,-1.9),(-1.2,-0.8),(0.7,0.2)]:
    bpy.ops.object.light_add(type='POINT', location=(x,y,3.75))
    spot = bpy.context.object
    spot.name = 'Ceiling downlight'
    spot.data.energy = 125
    spot.data.color = (1.0, 0.91, 0.74)
    spot.data.shadow_soft_size = 0.18

# Camera resembling reference: vertical interior view toward window corner
bpy.ops.object.camera_add(location=(-4.10, -2.85, 2.25))
cam = bpy.context.object
cam.name = 'Reference view camera'
scene.camera = cam
cam.data.lens = 20
cam.data.sensor_width = 32

def look_at(obj, target):
    direction = mathutils.Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

import mathutils
look_at(cam, (1.35, 2.15, 2.0))

# Save blend and preview render
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'corner_environment.blend'))
bpy.ops.render.render(write_still=True)
print('Saved Blender scene and rendered preview to', OUT)
