"""
OE hardware library — generic 5-port router (Category A: original, unbranded training hardware).

Authored procedurally so it is reproducible, reviewable in git, and licensed as our own work:
    blender -b --factory-startup --python build_router_generic.py

Layout is the 2D engine's router (videos/_engine/lib/devices2.mjs `router2`) made physical, so the
2D → 3D transition can be a silhouette match: every feature sits where the drawing puts it, at
U metres per drawing unit. The class of device is real — compact routers with ports AND status
lights on the front panel (e.g. small-office/ISP routers); nothing here copies a specific product.

Conventions (docs: hardware-3d/README.md):
  - metres, Z up in Blender (exported Y up), origin at the centre of the base, front faces -Y
    (three.js +Z);
  - every teachable feature has a named anchor empty: anchor_port_<id>, anchor_led_<id>;
  - every LED is its own mesh with its own material (led_<id>), so a scene can drive it;
  - materials are plain Principled BSDF → glTF metallic-roughness; no textures needed.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONT = os.path.join(ROOT, '..', 'shared', 'fonts', 'DMMono-Medium.ttf')
OUT = os.path.join(ROOT, 'networking', 'routers', 'generic-router-5port', 'router.glb')

U = 0.00053            # metres per 2D drawing unit: an RJ45 opening (22 u) = 11.7 mm, as in the real jack
W, H, D = 300 * U, 104 * U, 0.118   # 159 x 55 x 118 mm
FRONT = -D / 2

def u(x): return x * U

# ── scene ─────────────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

def mat(name, rgb, rough=0.5, metal=0.0, alpha=1.0, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 0.0
    return m

M = {
    'body': mat('router_body', (0.040, 0.043, 0.050), 0.62),
    'panel': mat('router_panel_gloss', (0.018, 0.020, 0.025), 0.22),
    'cavity': mat('port_cavity', (0.008, 0.008, 0.010), 0.85),
    'gold': mat('contact_gold', (1.0, 0.766, 0.336), 0.28, 1.0),
    'print': mat('print_light', (0.74, 0.76, 0.80), 0.55),
    'print_blue': mat('print_wan_blue', (0.18, 0.40, 0.95), 0.5),
    'rubber': mat('rubber_foot', (0.02, 0.02, 0.02), 0.9),
    'metal': mat('dc_jack_metal', (0.6, 0.6, 0.62), 0.35, 1.0),
}

def obj_from_bm(name, bm, material=None, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    if material: ob.data.materials.append(material)
    if parent: ob.parent = parent
    return ob

def box(name, sx, sy, sz, loc, material=None, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz)) + Vector(loc)
    return obj_from_bm(name, bm, material, parent)

def cyl(name, r, depth, loc, axis='Y', material=None, parent=None, seg=32):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=depth)
    rot = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]
    from mathutils import Euler
    m = Euler(rot).to_matrix()
    for v in bm.verts: v.co = m @ v.co + Vector(loc)
    return obj_from_bm(name, bm, material, parent)

def apply_bool(target, cutter, op='DIFFERENCE'):
    mod = target.modifiers.new('b', 'BOOLEAN')
    mod.object = cutter; mod.operation = op; mod.solver = 'EXACT'
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

def empty(name, loc, parent):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.004
    e.location = loc
    e.parent = parent
    scene.collection.objects.link(e)
    return e

root = bpy.data.objects.new('generic_router_5port', None)
scene.collection.objects.link(root)
root['oe_asset'] = 'generic-router-5port'

# ── body: a rounded box, the front's upper band a gloss panel ──────────────────
body = box('router_body', W, D, H, (0, 0, H / 2), M['body'], root)
bev = body.modifiers.new('bevel', 'BEVEL'); bev.width = 0.004; bev.segments = 5; bev.limit_method = 'ANGLE'
bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier='bevel')

# RJ45 openings: the jack profile (main cavity + latch notch at the bottom), 16 mm deep
def rj45_cutter(cx, cz, w=22, h=18, depth=0.016):
    main_h = h * 0.72
    a = box('cut_main', u(w), depth * 2, u(main_h), (u(cx), FRONT, u(cz + h / 2 - main_h / 2)))
    n = box('cut_notch', u(w * 0.56), depth * 2, u(h * 0.30), (u(cx), FRONT, u(cz - h / 2 + h * 0.14)))
    mod = a.modifiers.new('j', 'BOOLEAN'); mod.object = n; mod.operation = 'UNION'; mod.solver = 'EXACT'
    bpy.context.view_layer.objects.active = a; bpy.ops.object.modifier_apply(modifier='j')
    bpy.data.objects.remove(n, do_unlink=True)
    return a

PORTS = {f'lan{i + 1}': -104 + i * 30 for i in range(4)}
PORTS['wan'] = 104
PORT_Z = 18   # drawing units from the base to the opening's centre
for pid, px in PORTS.items():
    apply_bool(body, rj45_cutter(px, PORT_Z))

# ventilation slots on the top, and the rear DC jack + reset pinhole
for row in range(2):
    for i in range(14):
        x = -0.052 + i * 0.008
        apply_bool(body, box('vent', 0.0022, 0.022, 0.006, (x, -0.012 + row * 0.03, H)))
apply_bool(body, cyl('dc_hole', 0.0042, 0.02, (0.045, D / 2, 0.018), 'Y'))
apply_bool(body, cyl('reset_hole', 0.0011, 0.02, (0.022, D / 2, 0.018), 'Y'))

# material index 1 (gloss panel) on front faces above the divider, index 2 (cavity) inside the ports
body.data.materials.append(M['panel']); body.data.materials.append(M['cavity'])
DIV = u(58)
for p in body.data.polygons:
    c = p.center
    if p.normal.y < -0.999 and c.z > DIV and abs(c.y - FRONT) < 0.00005:   # the flat panel only: gloss on the bevel read as a light-bar
        p.material_index = 1
    elif FRONT + 0.0008 < c.y < FRONT + 0.02 and c.z < u(PORT_Z + 10) and abs(c.x) < W / 2 - 0.003:
        p.material_index = 2
    elif (p.normal.y > 0.9 and FRONT + 0.001 < c.y < FRONT + 0.02):
        p.material_index = 2
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))

# jack internals: 8 gold spring contacts at the top of each cavity, near the back
for pid, px in PORTS.items():
    for k in range(8):
        x = u(px) + (k - 3.5) * 0.00102
        c = box(f'{pid}_contact_{k}', 0.00034, 0.007, 0.00034, (x, FRONT + 0.012, u(PORT_Z + 5.2)), M['gold'], root)
        c.rotation_euler = (math.radians(-28), 0, 0)
    empty(f'anchor_port_{pid}', (u(px), FRONT, u(PORT_Z)), root)

# rear DC jack pin + rubber feet
cyl('dc_pin', 0.0012, 0.01, (0.045, D / 2 - 0.006, 0.018), 'Y', M['metal'], root)
for fx in (-0.06, 0.06):
    for fy in (-0.042, 0.042):
        cyl('foot', 0.006, 0.0016, (fx, fy, -0.0008), 'Z', M['rubber'], root)

# ── LEDs: light pipes, each its own mesh and material ──────────────────────────
def led(lid, x, z, r):
    m = mat(f'led_{lid}', (0.06, 0.065, 0.07), 0.3, emit=(0, 0, 0))
    o = cyl(f'led_{lid}', u(r), 0.0012, (u(x), FRONT - 0.0004, u(z)), 'Y', m, root, seg=24)
    empty(f'anchor_led_{lid}', (u(x), FRONT - 0.001, u(z)), root)
    return o

for lid, x in (('power', -60), ('internet', -20), ('wifi', 20), ('lan', 60)):
    led(lid, x, 76, 3.4)
for pid, px in PORTS.items():
    led(pid, px - 7 if pid != 'wan' else 95, 42, 2.8 if pid != 'wan' else 3.2)

# ── printed legends (DM Mono, the engine's micro-label face) ───────────────────
font = bpy.data.fonts.load(FONT) if os.path.exists(FONT) else None
def legend(text, x, z, size, material, align='CENTER'):
    cu = bpy.data.curves.new(f'txt_{text}', 'FONT')
    cu.body = text; cu.size = size; cu.align_x = align; cu.align_y = 'CENTER'; cu.extrude = 0.00005
    if font: cu.font = font
    o = bpy.data.objects.new(f'legend_{text}', cu)
    scene.collection.objects.link(o)
    o.location = (x, FRONT - 0.00006, z); o.rotation_euler = (math.pi / 2, 0, 0)
    o.data.materials.append(material)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o.parent = root
    return o

for t, x in (('POWER', -60), ('INTERNET', -20), ('WI-FI', 20), ('LAN', 60)):
    legend(t, u(x), u(63.5), u(6.8), M['print'])
for i in range(4):
    legend(str(i + 1), u(-104 + i * 30 + 6), u(41.6), u(7.6), M['print'])
legend('LAN', u(-126), u(16), u(7.6), M['print'])
legend('WAN', u(110), u(41.4), u(8.4), M['print_blue'])

# WAN surround, printed: a thin rounded outline
def outline(name, x0, z0, x1, z1, t, material):
    """A printed rectangle: four thin bars, 60 µm proud of the face."""
    bm = bmesh.new()
    for (ax, az, bx, bz) in ((x0, z0, x1, z0 + t), (x0, z1 - t, x1, z1), (x0, z0, x0 + t, z1), (x1 - t, z0, x1, z1)):
        for v in bmesh.ops.create_cube(bm, size=1.0)['verts']:
            v.co = Vector(((ax + bx) / 2 + v.co.x * (bx - ax), FRONT - 0.00003 + v.co.y * 0.00006, (az + bz) / 2 + v.co.z * (bz - az)))
    return obj_from_bm(name, bm, material, root)
outline('wan_surround', u(84), u(7), u(124), u(51), 0.00035, M['print_blue'])

# status icons: printed strokes (power, globe, Wi-Fi, LAN)
def stroke(name, pts, width, material, closed=False):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = width / 2; cu.bevel_resolution = 1
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, (x, z) in enumerate(pts): sp.points[i].co = (x, FRONT - 0.00008, z, 1)
    sp.use_cyclic_u = closed
    o = bpy.data.objects.new(name, cu); scene.collection.objects.link(o)
    o.data.materials.append(material)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o.parent = root   # a round stroke 0.16 mm proud reads as print; never scale it (that pulls it into the body)
    return o

def arc(cx, cz, r, a0, a1, n=28, sz=1.0):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cz + sz * r * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]

IZ, SW = u(90), 0.00032
stroke('icon_power_ring', arc(u(-60), IZ, u(4.2), 120, 420), SW, M['print'])
stroke('icon_power_bar', [(u(-60), IZ + u(5.5)), (u(-60), IZ + u(1))], SW, M['print'])
stroke('icon_globe_o', arc(u(-20), IZ, u(4.6), 0, 360), SW, M['print'], True)
stroke('icon_globe_m', [(u(-20) + u(2) * math.cos(math.radians(a)), IZ + u(4.6) * math.sin(math.radians(a))) for a in range(0, 361, 12)], SW * 0.8, M['print'], True)
stroke('icon_globe_e', [(u(-24.6), IZ), (u(-15.4), IZ)], SW * 0.8, M['print'])
stroke('icon_wifi_1', arc(u(20), IZ - u(3), u(6), 45, 135), SW, M['print'])
stroke('icon_wifi_2', arc(u(20), IZ - u(3), u(3.4), 45, 135), SW, M['print'])
cyl('icon_wifi_dot', u(1), 0.0001, (u(20), FRONT - 0.00006, IZ - u(2.4)), 'Y', M['print'], root, seg=12)
stroke('icon_lan_a', [(u(55), IZ - u(1)), (u(59), IZ - u(1)), (u(59), IZ + u(3)), (u(55), IZ + u(3))], SW * 0.8, M['print'], True)
stroke('icon_lan_b', [(u(61), IZ - u(1)), (u(65), IZ - u(1)), (u(65), IZ + u(3)), (u(61), IZ + u(3))], SW * 0.8, M['print'], True)
stroke('icon_lan_c', [(u(57), IZ - u(1)), (u(57), IZ - u(3)), (u(63), IZ - u(3)), (u(63), IZ - u(1))], SW * 0.8, M['print'])

# ── export ─────────────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True, export_extras=True, export_cameras=False, export_lights=False)

deps = bpy.context.evaluated_depsgraph_get(); tris = 0
for o in scene.objects:
    if o.type == 'MESH':
        me = o.evaluated_get(deps).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles); o.evaluated_get(deps).to_mesh_clear()
print(f'OE3D exported router: {OUT}  objects={len(scene.objects)}  triangles={tris}')
