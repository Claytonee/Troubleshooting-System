"""
OE hardware library — generic provider modem / CPE (category A).

    blender -b --factory-startup --python build_modem_generic.py

The provider's box at the school: light grey (it is visibly not the school's own equipment). Front:
POWER · LINK (the provider line is synchronised) · INTERNET (the provider's service is up) · LAN (a device
is connected on the Ethernet side), then the LAN port (to the router's WAN) and the LINE port (to the
provider). LINK and INTERNET describe the UPSTREAM side; LAN describes the cable to the router. That split
is what lets a film separate "physical link down" from "provider outage".
Anchors: anchor_port_lan, anchor_port_line, anchor_led_power/link/internet/lan.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oe_kit as K

OUT = os.path.join(K.LIB, 'networking', 'modems', 'generic-provider-modem', 'modem.glb')
W, H, D = 0.150, 0.040, 0.110
FRONT = -D / 2

K.reset(); P = K.palette()
import bpy
root = bpy.data.objects.new('generic_provider_modem', None); bpy.context.scene.collection.objects.link(root)
root['oe_asset'] = 'generic-provider-modem'

body = K.box('modem_body', W, D, H, (0, 0, H / 2), P['body_light'], root)
K.bevel(body, 0.006, 6)
LAN_X, LINE_X, PORT_Z = -0.030, 0.034, 0.012
K.cut(body, K.rj45_cutter(LAN_X, PORT_Z, FRONT))
# the provider LINE: a smaller RJ11-size socket (generic: DSL/fibre CPEs differ; the film only needs "the line")
K.cut(body, K.box('cut_line', 0.0092, 0.03, 0.0065, (LINE_X, FRONT, PORT_Z)))
for i in range(8):
    K.cut(body, K.box('vent', 0.0024, 0.05, 0.006, (-0.035 + i * 0.01, 0.01, H)))
body.data.materials.append(P['cavity'])
K.assign_cavity(body, FRONT, 1, zmax=PORT_Z + 0.006)
K.smooth(body)

K.jack_contacts('lan', LAN_X, PORT_Z, FRONT, P['gold'], root)
K.empty('anchor_port_lan', (LAN_X, FRONT, PORT_Z), root)
K.empty('anchor_port_line', (LINE_X, FRONT, PORT_Z), root)
K.legend('LAN', LAN_X, PORT_Z + 0.0105, 0.0034, P['print_dark'], FRONT, root)
K.legend('LINE', LINE_X, PORT_Z + 0.0105, 0.0034, P['print_dark'], FRONT, root)
K.led('lan', LAN_X + 0.0115, PORT_Z + 0.0105, 0.0013, FRONT, root)

for lid, x, t in (('power', -0.045, 'POWER'), ('link', -0.015, 'LINK'), ('internet', 0.015, 'INTERNET'), ('status', 0.045, '')):
    if lid == 'status': continue
    K.led(lid, x, 0.0325, 0.0016, FRONT, root)
    K.legend(t, x, 0.0272, 0.0026, P['print_dark'], FRONT, root)
K.legend('PROVIDER', 0.046, 0.0325, 0.0034, P['print_dark'], FRONT, root)

for fx in (-0.055, 0.055):
    for fy in (-0.04, 0.04):
        K.cyl('foot', 0.005, 0.0014, (fx, fy, -0.0007), 'Z', P['rubber'], root)

K.export(OUT, 'modem')
