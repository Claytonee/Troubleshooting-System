"""
OE hardware library — generic RJ45 (8P8C) patch-cable plug (Category A: original).

    blender -b --factory-startup --python build_rj45_plug.py

Built to the router's jack (build_router_generic.py): body 11.6 x 6.5 mm, latch tab underneath
(the jack's notch is at the bottom), gold contacts on top, the eight conductors visible through
the clear body in T568B order, a strain-relief boot. The cable itself is NOT in the asset: a
scene draws it as a tube from `anchor_cable`, so it can follow any layout.

Origin = the SEAT POINT: the plane of the port's face when the plug is fully home. The tip is
13.5 mm ahead of it along +Y (three.js -Z), so a scene places the plug at the port anchor and
backs it out along the port axis to show it loose.
"""
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'connectors', 'rj45', 'generic-rj45-plug', 'rj45-plug.glb')

mm = 0.001
TIP, BACK, BOOT_END = 13.5 * mm, -7.5 * mm, -22.0 * mm
BW, BH = 11.6 * mm, 6.5 * mm
BZ = 1.34 * mm            # body centre above the port centre (the jack's main cavity sits above its notch)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def mat(name, rgb, rough=0.5, metal=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m

M = {
    'clear': mat('plug_clear_pc', (0.86, 0.90, 0.94), 0.12, alpha=0.34),
    'gold': mat('plug_contact_gold', (1.0, 0.766, 0.336), 0.25, 1.0),
    'boot': mat('plug_boot', (0.07, 0.24, 0.62), 0.55),
    'jacket': mat('cable_jacket', (0.07, 0.24, 0.62), 0.5),
}
# T568B: white-orange, orange, white-green, blue, white-blue, green, white-brown, brown
WIRES = [(0.92, 0.80, 0.70), (0.90, 0.36, 0.05), (0.80, 0.90, 0.80), (0.06, 0.22, 0.80),
         (0.80, 0.84, 0.95), (0.05, 0.55, 0.16), (0.88, 0.82, 0.76), (0.36, 0.19, 0.08)]

root = bpy.data.objects.new('generic_rj45_plug', None); scene.collection.objects.link(root)
root['oe_asset'] = 'generic-rj45-plug'

def link(ob, material):
    scene.collection.objects.link(ob); ob.data.materials.append(material); ob.parent = root; return ob

def box(name, x0, x1, y0, y1, z0, z1, material):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(bpy.data.objects.new(name, me), material)

def loft(name, rings, material, n=24):
    """rings: [(y, rx, rz, cz, squareness)] — superellipse sections bridged into a closed tube."""
    bm = bmesh.new(); prev = None; first = last = None
    for (y, rx, rz, cz, sq) in rings:
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n; c, s = math.cos(a), math.sin(a)
            p = 2 / sq
            x = rx * math.copysign(abs(c) ** p, c); z = cz + rz * math.copysign(abs(s) ** p, s)
            ring.append(bm.verts.new((x, y, z)))
        if prev:
            for k in range(n): bm.faces.new((prev[k], prev[(k + 1) % n], ring[(k + 1) % n], ring[k]))
        else: first = ring
        prev = ring; last = ring
    bm.faces.new(first[::-1]); bm.faces.new(last)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me), material)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

# clear body, with the tip's lower edge chamfered
body = box('plug_body', -BW / 2, BW / 2, BACK, TIP, BZ - BH / 2, BZ + BH / 2, M['clear'])
bm = bmesh.new(); bm.from_mesh(body.data)
edge = [e for e in bm.edges if all(abs(v.co.y - TIP) < 1e-6 and v.co.z < BZ for v in e.verts)]
bmesh.ops.bevel(bm, geom=edge, offset=1.2 * mm, segments=1, affect='EDGES')
bm.to_mesh(body.data); bm.free()

# gold contacts on top, set into the body near the tip
for k in range(8):
    x = (k - 3.5) * 1.02 * mm
    box(f'plug_contact_{k}', x - 0.18 * mm, x + 0.18 * mm, TIP - 7.2 * mm, TIP - 0.9 * mm, BZ + BH / 2 - 0.9 * mm, BZ + BH / 2 + 0.05 * mm, M['gold'])
    # the conductor behind it, seen through the clear body
    w = mat(f'wire_{k}', WIRES[k], 0.45)
    box(f'plug_wire_{k}', x - 0.42 * mm, x + 0.42 * mm, BACK + 0.6 * mm, TIP - 1.8 * mm, BZ + 0.9 * mm, BZ + 1.75 * mm, w)

# the jacket enters the back of the body
loft('plug_jacket_stub', [(BACK + 0.2 * mm, 3.1 * mm, 2.4 * mm, BZ - 0.2 * mm, 2.0), (BACK + 5.5 * mm, 3.0 * mm, 2.2 * mm, BZ, 2.0)], M['jacket'])

# the latch tab: its own object, hinged at the tip end, so a scene can press it as the plug seats
lat = box('plug_latch', -3.0 * mm, 3.0 * mm, -12.0 * mm, 0, -0.45 * mm, 0.45 * mm, M['clear'])
lat.location = (0, TIP - 3.0 * mm, BZ - BH / 2 - 0.35 * mm)
lat.rotation_euler = (math.radians(13), 0, 0)      # resting angle; pressing = rotating toward 0
hook = box('plug_latch_hook', -3.0 * mm, 3.0 * mm, -4.2 * mm, -3.2 * mm, -1.25 * mm, -0.45 * mm, M['clear'])
hook.parent = lat

# strain-relief boot: squared where it meets the body, round where the cable leaves
loft('plug_boot', [
    (BACK - 0.0 * mm, 6.3 * mm, 3.9 * mm, BZ - 0.2 * mm, 3.4),
    (BACK - 3.0 * mm, 5.6 * mm, 3.6 * mm, BZ - 0.4 * mm, 3.0),
    (BACK - 9.0 * mm, 4.2 * mm, 3.4 * mm, BZ - 0.6 * mm, 2.4),
    (BOOT_END, 3.3 * mm, 3.3 * mm, BZ - 0.7 * mm, 2.0)], M['boot'])

for name, loc in (('anchor_cable', (0, BOOT_END, BZ - 0.7 * mm)), ('anchor_tip', (0, TIP, BZ)), ('anchor_seat', (0, 0, 0))):
    e = bpy.data.objects.new(name, None); e.empty_display_size = 0.002; e.location = loc; e.parent = root
    scene.collection.objects.link(e)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True, export_extras=True, export_cameras=False, export_lights=False)

deps = bpy.context.evaluated_depsgraph_get(); tris = 0
for o in scene.objects:
    if o.type == 'MESH':
        me = o.evaluated_get(deps).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles); o.evaluated_get(deps).to_mesh_clear()
print(f'OE3D exported plug: {OUT}  objects={len(scene.objects)}  triangles={tris}')
