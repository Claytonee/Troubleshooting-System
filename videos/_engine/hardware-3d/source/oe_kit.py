"""
OE hardware kit — the shared vocabulary every device script builds with, so the library looks like ONE
art direction: the same plastics, the same jack, the same light pipe, the same printed legends.

Conventions (hardware-3d/README.md): metres, Z up in Blender (Y up in glTF), origin at the centre of the
base, the device's FRONT faces -Y (three.js +Z). Anchors are empties named anchor_<id>. A port anchor sits
at the centre of the opening on the face, and is ROTATED so that Blender -Y (three.js local +Z) is its
outward normal: a scene reads the port's direction from the anchor, never from a guess.
"""
import bpy, bmesh, math, os
from mathutils import Vector, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.dirname(HERE)
FONT_MONO = os.path.join(LIB, '..', 'shared', 'fonts', 'DMMono-Medium.ttf')
FONT_SANS = os.path.join(LIB, '..', 'shared', 'fonts', 'DMSans-Variable.ttf')


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _MATS.clear()   # a reset removes every material: the cache must not hand back a dead one
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    return s


_MATS = {}
def mat(name, rgb, rough=0.5, metal=0.0, alpha=1.0, emit=False):
    """A Principled material (→ glTF metallic-roughness). Shared by name, except LEDs (emit=True: own copy)."""
    if name in _MATS and not emit: return _MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    if emit:
        b.inputs['Emission Color'].default_value = (0, 0, 0, 1); b.inputs['Emission Strength'].default_value = 0.0
    _MATS[name] = m
    return m


def palette():
    """The library's plastics and metals. One set, so devices from different scripts sit together."""
    return {
        'body_dark': mat('plastic_charcoal', (0.040, 0.043, 0.050), 0.62),
        'body_light': mat('plastic_light_grey', (0.46, 0.47, 0.49), 0.55),
        'panel': mat('panel_gloss', (0.018, 0.020, 0.025), 0.22),
        'cavity': mat('port_cavity', (0.008, 0.008, 0.010), 0.85),
        'gold': mat('contact_gold', (1.0, 0.766, 0.336), 0.28, 1.0),
        'print': mat('print_light', (0.74, 0.76, 0.80), 0.55),
        'print_dark': mat('print_dark', (0.10, 0.11, 0.13), 0.6),
        'print_blue': mat('print_wan_blue', (0.18, 0.40, 0.95), 0.5),
        'rubber': mat('rubber_black', (0.02, 0.02, 0.02), 0.9),
        'metal': mat('metal_brushed', (0.62, 0.63, 0.65), 0.35, 1.0),
        'screen': mat('screen', (0.02, 0.02, 0.025), 0.3),
        'glass': mat('screen_glass', (0.01, 0.01, 0.012), 0.08),
    }


def link(ob, material=None, parent=None):
    bpy.context.scene.collection.objects.link(ob)
    if material is not None: ob.data.materials.append(material)
    if parent is not None: ob.parent = parent
    return ob


def from_bm(name, bm, material=None, parent=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(bpy.data.objects.new(name, me), material, parent)


def box(name, sx, sy, sz, loc, material=None, parent=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz)) + Vector(loc)
    return from_bm(name, bm, material, parent)


def cyl(name, r, depth, loc, axis='Y', material=None, parent=None, seg=32, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    m = Euler({'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]).to_matrix()
    for v in bm.verts: v.co = m @ v.co + Vector(loc)
    return from_bm(name, bm, material, parent)


def bevel(ob, width, segments=5):
    mod = ob.modifiers.new('bevel', 'BEVEL'); mod.width = width; mod.segments = segments; mod.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier='bevel')
    return ob


def cut(target, cutter, op='DIFFERENCE'):
    mod = target.modifiers.new('b', 'BOOLEAN'); mod.object = cutter; mod.operation = op; mod.solver = 'EXACT'
    bpy.context.view_layer.objects.active = target; bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    # A cutter carries no material, so the faces the boolean opens can end up with a material index past the
    # target's slots — which glTF exports as the DEFAULT material: white, fully metallic. That is what made the
    # tower's rear I/O panel a bright white slab, brighter than anything in the film (world sheet, D40).
    for p in target.data.polygons:
        if p.material_index >= len(target.data.materials):
            p.material_index = 0


def smooth(ob, angle=35):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))


def empty(name, loc, parent, facing='front'):
    """An anchor. facing: 'front' (-Y, three.js +Z), 'rear' (+Y), 'up' (+Z), 'right' (+X), 'left' (-X)."""
    e = bpy.data.objects.new(name, None); e.empty_display_size = 0.004; e.location = loc
    e.rotation_euler = {'front': (0, 0, 0), 'rear': (0, 0, math.pi), 'right': (0, 0, math.pi / 2),
                        'left': (0, 0, -math.pi / 2), 'up': (-math.pi / 2, 0, 0)}[facing]
    e.parent = parent; bpy.context.scene.collection.objects.link(e)
    e['facing'] = facing
    return e


# ── the RJ45 jack: one profile for every device (the plug asset is built to it) ────────────────────────────
JACK_W, JACK_H, JACK_DEPTH = 0.01166, 0.00954, 0.016


def rj45_cutter(cx, cz, face_y, direction=-1):
    """Cutter for an RJ45 opening centred at (cx, cz) on the face at y=face_y; direction -1 = front face."""
    main_h = JACK_H * 0.72
    a = box('cut_main', JACK_W, JACK_DEPTH * 2, main_h, (cx, face_y, cz + JACK_H / 2 - main_h / 2))
    n = box('cut_notch', JACK_W * 0.56, JACK_DEPTH * 2, JACK_H * 0.30, (cx, face_y, cz - JACK_H / 2 + JACK_H * 0.14))
    mod = a.modifiers.new('j', 'BOOLEAN'); mod.object = n; mod.operation = 'UNION'; mod.solver = 'EXACT'
    bpy.context.view_layer.objects.active = a; bpy.ops.object.modifier_apply(modifier='j')
    bpy.data.objects.remove(n, do_unlink=True)
    return a


def jack_contacts(pid, cx, cz, face_y, gold, parent, direction=-1):
    """Eight spring contacts at the top of the cavity, towards its back."""
    for k in range(8):
        x = cx + (k - 3.5) * 0.00102
        c = box(f'{pid}_contact_{k}', 0.00034, 0.007, 0.00034, (x, face_y - direction * 0.012, cz + 0.0028), gold, parent)
        c.rotation_euler = (math.radians(-28 * -direction), 0, 0)


def assign_cavity(ob, face_y, cavity_index, direction=-1, zmax=None):
    """Faces inside the port openings get the cavity material."""
    for p in ob.data.polygons:
        c = p.center
        inside = (face_y + 0.0008 < c.y < face_y + 0.02) if direction == -1 else (face_y - 0.02 < c.y < face_y - 0.0008)
        if inside and (zmax is None or c.z < zmax): p.material_index = cavity_index


def led(p_id, x, z, r, face_y, parent, facing='front'):
    """A light pipe (own mesh, own material led_<id>) and its anchor, proud of the face by 0.4 mm."""
    m = mat(f'led_{p_id}', (0.06, 0.065, 0.07), 0.3, emit=True)
    dy = -0.0004 if facing == 'front' else 0.0004
    o = cyl(f'led_{p_id}', r, 0.0012, (x, face_y + dy, z), 'Y', m, parent, seg=24)
    empty(f'anchor_led_{p_id}', (x, face_y + dy * 2.5, z), parent, facing)
    return o


def legend(text, x, z, size, material, face_y, parent, font=None, facing='front', align='CENTER'):
    """Printed text on a face (DM Mono by default), 50 µm proud."""
    cu = bpy.data.curves.new(f'txt_{text}', 'FONT')
    cu.body = text; cu.size = size; cu.align_x = align; cu.align_y = 'CENTER'; cu.extrude = 0.00005
    f = font or FONT_MONO
    if os.path.exists(f): cu.font = bpy.data.fonts.load(f, check_existing=True)
    o = bpy.data.objects.new(f'legend_{text}', cu); bpy.context.scene.collection.objects.link(o)
    if facing == 'front': o.location = (x, face_y - 0.00006, z); o.rotation_euler = (math.pi / 2, 0, 0)
    else: o.location = (x, face_y + 0.00006, z); o.rotation_euler = (math.pi / 2, 0, math.pi)
    o.data.materials.append(material)
    bpy.context.view_layer.objects.active = o; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o.parent = parent
    return o


def no_orphan_faces():
    """
    Every face must point at a real material. A face left on an empty slot exports as a glTF primitive with no
    material, and three.js draws that with its default: WHITE, fully metallic — which is how the tower's rear
    I/O panel became the brightest thing in the film (world sheet, D40). Booleans are where they come from.
    """
    for ob in bpy.context.scene.objects:
        if ob.type != 'MESH' or not ob.data.materials:
            continue
        for p in ob.data.polygons:
            if p.material_index >= len(ob.data.materials) or ob.data.materials[p.material_index] is None:
                p.material_index = 0


def export(path, root_name):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    no_orphan_faces()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_extras=True, export_cameras=False, export_lights=False)
    deps = bpy.context.evaluated_depsgraph_get(); tris = 0
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            me = o.evaluated_get(deps).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles); o.evaluated_get(deps).to_mesh_clear()
    print(f'OE3D exported {root_name}: {path}  objects={len(bpy.context.scene.objects)}  triangles={tris}')
