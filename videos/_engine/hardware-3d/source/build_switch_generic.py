"""
OE hardware library — generic 8-port desktop Ethernet switch (category A).

    blender -b --factory-startup --python build_switch_generic.py

Front: POWER light, ports 1–8 each with its link light above it. No port is labelled "uplink": a generic
unmanaged switch negotiates any port (auto MDI-X), so the router may use any of them.
Anchors: anchor_port_p1…p8, anchor_led_p1…p8, anchor_led_power.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oe_kit as K
from mathutils import Vector

OUT = os.path.join(K.LIB, 'networking', 'switches', 'generic-switch-8port', 'switch.glb')
W, H, D = 0.192, 0.034, 0.112
FRONT = -D / 2
PITCH = 0.0158
PORT_Z = 0.0115

K.reset(); P = K.palette()
import bpy
root = bpy.data.objects.new('generic_switch_8port', None); bpy.context.scene.collection.objects.link(root)
root['oe_asset'] = 'generic-switch-8port'

body = K.box('switch_body', W, D, H, (0, 0, H / 2), P['body_dark'], root)
K.bevel(body, 0.003)
px = lambda i: -W / 2 + 0.036 + i * PITCH
for i in range(8):
    K.cut(body, K.rj45_cutter(px(i), PORT_Z, FRONT))
for i in range(10):   # side vents
    K.cut(body, K.box('vent', 0.02, 0.0022, 0.012, (W / 2, -0.03 + i * 0.007, H * 0.55)))
body.data.materials.append(P['cavity'])
K.assign_cavity(body, FRONT, 1, zmax=PORT_Z + 0.006)
K.smooth(body)

for i in range(8):
    K.jack_contacts(f'p{i + 1}', px(i), PORT_Z, FRONT, P['gold'], root)
    K.empty(f'anchor_port_p{i + 1}', (px(i), FRONT, PORT_Z), root)
    K.led(f'p{i + 1}', px(i) - 0.0038, 0.0262, 0.0014, FRONT, root)
    K.legend(str(i + 1), px(i) + 0.0035, 0.0262, 0.0036, P['print'], FRONT, root)
K.led('power', -W / 2 + 0.014, 0.0262, 0.0016, FRONT, root)
K.legend('PWR', -W / 2 + 0.014, 0.0205, 0.0026, P['print'], FRONT, root)

# rear DC jack, rubber feet
K.cut(body, K.cyl('dc_hole', 0.0038, 0.02, (0.07, D / 2, 0.016), 'Y'))
for fx in (-0.075, 0.075):
    for fy in (-0.04, 0.04):
        K.cyl('foot', 0.005, 0.0014, (fx, fy, -0.0007), 'Z', P['rubber'], root)

K.export(OUT, 'switch')
