"""
OE hardware library — generic desktop computer: monitor + tower (category A).

    blender -b --factory-startup --python build_desktop_generic.py

Two assets in one file set (a scene places them independently):
  monitor.glb  bezel, stand, and a SCREEN mesh (named `screen`, UV 0..1) that a scene paints (No internet /
               a page) — the picture is data, not geometry.
  tower.glb    front: power button + light. REAR I/O panel: the network port (RJ45 with the two lights built
               into the jack, link + activity, as real motherboard ports have), USB, the PSU and its fan.
               The network port is on the back, where it really is: a film turns the camera to it.
Anchors: monitor — anchor_screen; tower — anchor_port_eth (facing rear), anchor_led_link, anchor_led_act,
anchor_led_power.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oe_kit as K
import bpy, bmesh
from mathutils import Vector

# ── monitor ────────────────────────────────────────────────────────────────────
K.reset(); P = K.palette()
root = bpy.data.objects.new('generic_monitor', None); bpy.context.scene.collection.objects.link(root)
root['oe_asset'] = 'generic-monitor'
SW, SH = 0.52, 0.30            # outer bezel 22" class
BZ = 0.012                     # bezel
CZ = 0.13                      # bottom of the panel above the desk
panel = K.box('monitor_panel', SW, 0.022, SH, (0, 0, CZ + SH / 2), P['body_dark'], root)
K.bevel(panel, 0.004)
# the screen: a flat quad with UVs, slightly proud of the bezel's front
bm = bmesh.new()
x0, x1, z0, z1, y = -SW / 2 + BZ, SW / 2 - BZ, CZ + BZ + 0.004, CZ + SH - BZ, -0.0112
vs = [bm.verts.new(p) for p in ((x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1))]
f = bm.faces.new(vs)
f.normal_update()
if f.normal.y > 0: bmesh.ops.reverse_faces(bm, faces=[f])
# UVs from the vertex's own position, AFTER any reversal. Assigned in loop order they follow the winding,
# so reversing the face to make it look forward printed the screen back to front (world sheet, D40).
uv = bm.loops.layers.uv.new('UVMap')
for loop in f.loops:
    co = loop.vert.co
    loop[uv].uv = ((co.x - x0) / (x1 - x0), (z1 - co.z) / (z1 - z0))
K.from_bm('screen', bm, P['screen'], root)
K.empty('anchor_screen', (0, y - 0.001, (z0 + z1) / 2), root)
K.legend('OE', 0, CZ + 0.006, 0.006, P['print'], -0.0111, root)
# stand
K.box('stand_neck', 0.05, 0.03, CZ + 0.05, (0, 0.03, (CZ + 0.05) / 2), P['body_dark'], root)
base = K.box('stand_base', 0.22, 0.16, 0.012, (0, 0.03, 0.006), P['body_dark'], root); K.bevel(base, 0.004)
K.export(os.path.join(K.LIB, 'computers', 'monitor', 'generic-monitor', 'monitor.glb'), 'monitor')

# ── tower ─────────────────────────────────────────────────────────────────────
K.reset(); P = K.palette()
root = bpy.data.objects.new('generic_tower', None); bpy.context.scene.collection.objects.link(root)
root['oe_asset'] = 'generic-tower'
TW, TH, TD = 0.18, 0.38, 0.40
FRONT, REAR = -TD / 2, TD / 2
tower = K.box('tower_body', TW, TD, TH, (0, 0, TH / 2), P['body_dark'], root)
K.bevel(tower, 0.005)
# rear I/O: the network port with its two jack lights, two USB, the PSU bay and fan
ETH_X, ETH_Z = -0.035, 0.30
K.cut(tower, K.rj45_cutter(ETH_X, ETH_Z, REAR, direction=1))
for i in range(2):
    K.cut(tower, K.box('usb', 0.0132, 0.03, 0.0056, (ETH_X + 0.028, REAR, ETH_Z - 0.006 + i * 0.012)))
K.cut(tower, K.box('io_recess', 0.06, 0.003, 0.14, (-0.02, REAR, 0.27)))
tower.data.materials.append(P['cavity'])
K.assign_cavity(tower, REAR, 1, direction=1)
K.smooth(tower)
K.jack_contacts('eth', ETH_X, ETH_Z, REAR, P['gold'], root, direction=1)
K.empty('anchor_port_eth', (ETH_X, REAR, ETH_Z), root, 'rear')
K.led('link', ETH_X - 0.0045, ETH_Z + 0.0060, 0.0011, REAR, root, 'rear')
K.led('act', ETH_X + 0.0045, ETH_Z + 0.0060, 0.0011, REAR, root, 'rear')
K.legend('LAN', ETH_X, ETH_Z + 0.0115, 0.004, P['print'], REAR, root, facing='rear')
# PSU with fan grille (rings)
K.box('psu_plate', 0.15, 0.002, 0.086, (0, REAR + 0.001, 0.07), P['metal'], root)
for r in (0.012, 0.022, 0.032):
    K.cyl(f'fan_ring_{r}', r, 0.0024, (0.02, REAR + 0.0015, 0.07), 'Y', P['rubber'], root, seg=40)
    K.cyl(f'fan_ring_in_{r}', r - 0.0025, 0.0028, (0.02, REAR + 0.0015, 0.07), 'Y', P['metal'], root, seg=40)
K.cyl('power_inlet', 0.009, 0.004, (-0.05, REAR + 0.002, 0.07), 'Y', P['rubber'], root, seg=6)
# front: power button + light, drive bay line
K.cyl('power_button', 0.009, 0.003, (0, FRONT - 0.0012, 0.33), 'Y', P['metal'], root)
K.led('power', 0.022, 0.33, 0.0018, FRONT, root)
K.box('bay_line', 0.14, 0.001, 0.0012, (0, FRONT - 0.0004, 0.28), P['rubber'], root)
for fx in (-0.07, 0.07):
    for fy in (-0.17, 0.17):
        K.cyl('foot', 0.008, 0.004, (fx, fy, -0.002), 'Z', P['rubber'], root)
K.export(os.path.join(K.LIB, 'computers', 'desktop', 'generic-tower', 'tower.glb'), 'tower')
