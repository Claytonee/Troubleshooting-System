"""
OE hardware library — the Internet endpoint (an abstraction, deliberately not hardware).

    blender -b --factory-startup --python build_internet_endpoint.py

The internet has no box to show, so it is drawn as what it is to a learner: somewhere far away that answers.
A matte globe of meridians and parallels on a slim base — the same materials as the hardware, no glow, no
"cyber" particles — so it sits in the same world. The provider line plugs into anchor_port_in.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oe_kit as K
import bpy

K.reset(); P = K.palette()
root = bpy.data.objects.new('internet_endpoint', None); bpy.context.scene.collection.objects.link(root)
root['oe_asset'] = 'internet-endpoint'
R, CZ = 0.105, 0.155
ring_m = K.mat('globe_metal', (0.55, 0.58, 0.64), 0.4, 0.6)

def ring(name, radius, z, rot):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.0022, major_segments=96, minor_segments=10,
                                     location=(0, 0, z), rotation=rot)
    o = bpy.context.active_object; o.name = name; o.data.materials.append(ring_m); o.parent = root
    return o

for i in range(6):                       # meridians
    ring(f'meridian_{i}', R, CZ, (math.pi / 2, 0, i * math.pi / 6))
for lat in (-60, -30, 0, 30, 60):        # parallels
    ring(f'parallel_{lat}', R * math.cos(math.radians(lat)), CZ + R * math.sin(math.radians(lat)), (0, 0, 0))
core = K.cyl('core', 0.0035, 2 * R, (0, 0, CZ), 'Z', ring_m, root, seg=16)
K.cyl('neck', 0.012, CZ - R, (0, 0, (CZ - R) / 2), 'Z', P['body_dark'], root, seg=32)
base = K.cyl('base', 0.07, 0.012, (0, 0, 0.006), 'Z', P['body_dark'], root, seg=64)
K.bevel(base, 0.003)
K.empty('anchor_port_in', (-0.07, 0, 0.006), root, 'left')
K.empty('anchor_centre', (0, 0, CZ), root)
K.export(os.path.join(K.LIB, 'networking', 'internet', 'internet-endpoint', 'internet.glb'), 'internet')
