"""The Premium 3D Asset Standard, as code.

A standard nobody can run is a standard nobody keeps. This is the acceptance gate from
the Master Production Blueprint §6, executable:

    blender -b asset.blend --python videos/_studio/tools/validate_asset.py -- --class hero

Every check returns a finding, never an exception, so one bad object does not hide the
rest. `problems()` is the gate: empty means the asset is accepted.
"""
import math

import bmesh
import bpy

from . import config

ERROR, WARN = 'error', 'warn'


def _finding(level, code, message, obj=None):
    return dict(level=level, code=code, message=message, object=(obj.name if obj else None))


# ── scene-level ───────────────────────────────────────────────────────────────

def check_units(scene):
    """Metres, 1:1. A file authored in centimetres imports at 100x and nobody notices
    until it is beside something that was right."""
    u = scene.unit_settings
    out = []
    if u.system != 'METRIC':
        out.append(_finding(ERROR, 'units.system', f'unit system is {u.system}, expected METRIC'))
    if abs(u.scale_length - config.UNIT_SCALE) > 1e-6:
        out.append(_finding(ERROR, 'units.scale', f'scale_length is {u.scale_length}, expected {config.UNIT_SCALE}'))
    return out


# ── object-level ──────────────────────────────────────────────────────────────

def check_transforms(obj, source='blend'):
    """source='blend' for an authoring file, 'gltf' for something imported from glTF.

    A glTF node legitimately carries its own translation/rotation/scale — that is how the
    format stores a hierarchy — so an imported asset arrives with unapplied scale through
    no fault of its author. Auditing a delivered `.web.glb` as if it were an authoring
    file reports the exporter as a defect in the model. Checked against the real hardware
    library, which produced 87 such "errors" and deserved none of them.
    """
    out = []
    sx, sy, sz = obj.scale
    if any(abs(s - 1.0) > 1e-4 for s in (sx, sy, sz)):
        out.append(_finding(WARN if source == 'gltf' else ERROR, 'transform.scale',
                            f'scale is ({sx:.3f}, {sy:.3f}, {sz:.3f})'
                            + ('; normal for a glTF node' if source == 'gltf' else '; apply it'), obj))
    if any(s < 0 for s in (sx, sy, sz)):
        out.append(_finding(ERROR, 'transform.negative',
                            'negative scale inverts normals downstream', obj))
    if source != 'gltf' and any(abs(r) > 1e-4 for r in obj.rotation_euler):
        out.append(_finding(WARN, 'transform.rotation',
                            'rotation is not applied; a library asset should sit at rest', obj))
    return out


def check_origin(obj, expect='base'):
    """A device's origin sits where it meets the world, so placing it is setting z=0.

    expect: 'base' (centre of the footprint) or 'any' to skip.
    """
    if expect == 'any' or obj.type != 'MESH':
        return []
    zs = [(obj.matrix_world @ v.co).z for v in obj.data.vertices]
    if not zs:
        return []
    if min(zs) < -0.002:
        return [_finding(WARN, 'origin.base',
                         f'geometry reaches {min(zs) * 1000:.1f} mm below the origin; '
                         f'the origin should be where the asset meets the world', obj)]
    return []


def check_mesh(obj, tri_budget):
    if obj.type != 'MESH':
        return []
    out = []
    bm = bmesh.new()
    try:
        bm.from_mesh(obj.data)
        tris = sum(max(0, len(f.verts) - 2) for f in bm.faces)
        ngons = sum(1 for f in bm.faces if len(f.verts) > 4)
        non_manifold = sum(1 for e in bm.edges if not e.is_manifold and not e.is_boundary)
        loose_verts = sum(1 for v in bm.verts if not v.link_edges)
        if tris > tri_budget:
            out.append(_finding(WARN, 'mesh.triangles',
                                f'{tris:,} triangles over a budget of {tri_budget:,}', obj))
        if ngons:
            out.append(_finding(WARN, 'mesh.ngons',
                                f'{ngons} n-gon(s); they shade unpredictably and break subdivision', obj))
        if non_manifold:
            out.append(_finding(ERROR, 'mesh.non_manifold',
                                f'{non_manifold} non-manifold edge(s)', obj))
        if loose_verts:
            out.append(_finding(WARN, 'mesh.loose',
                                f'{loose_verts} loose vertex/vertices', obj))
        # Only ask for UVs if something actually samples them. The hardware library is
        # deliberately textureless — 490 KB of GLB, all detail in geometry and shader
        # values — and demanding UVs of it would be the validator inventing a defect.
        textured = any(
            slot.material and slot.material.node_tree
            and any(n.type == 'TEX_IMAGE' for n in slot.material.node_tree.nodes)
            for slot in obj.material_slots
        )
        if textured and not obj.data.uv_layers:
            out.append(_finding(ERROR, 'mesh.uv', 'has image textures but no UV layer', obj))
    finally:
        bm.free()
    return out


def check_orphan_faces(obj):
    """A face pointing at an empty material slot renders default white.

    This is not theoretical: it is exactly what the world sheet caught in the hardware
    library, where a boolean had left faces on a slot nothing filled.
    """
    if obj.type != 'MESH':
        return []
    slots = obj.material_slots
    out = []
    empty = {i for i, s in enumerate(slots) if s.material is None}
    if not slots:
        return [_finding(ERROR, 'material.none', 'no material slot at all — renders default grey', obj)]
    if empty:
        used = {p.material_index for p in obj.data.polygons}
        hit = sorted(empty & used)
        if hit:
            out.append(_finding(ERROR, 'material.orphan_faces',
                                f'faces point at empty material slot(s) {hit} — they render default white', obj))
    return out


def check_materials(obj):
    out = []
    for slot in obj.material_slots:
        m = slot.material
        if not m or not m.node_tree:
            continue
        principled = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not principled:
            out.append(_finding(WARN, 'material.not_principled',
                                f'"{m.name}" is not a Principled BSDF; it will not survive glTF export', obj))
            continue
        metallic = principled.inputs['Metallic']
        rough = principled.inputs['Roughness']
        if not metallic.is_linked and 0.02 < metallic.default_value < 0.98:
            out.append(_finding(WARN, 'material.metallic',
                                f'"{m.name}" metallic is {metallic.default_value:.2f}; real surfaces are 0 or 1',
                                obj))
        if not rough.is_linked and rough.default_value in (0.0, 1.0):
            out.append(_finding(WARN, 'material.roughness',
                                f'"{m.name}" roughness is exactly {rough.default_value:.0f}; '
                                f'no real surface is perfectly uniform', obj))
    return out


def check_textures():
    out = []
    for img in bpy.data.images:
        if not img.has_data or img.size[0] == 0:
            continue
        if max(img.size) > config.TEXTURE_MAX * 2:
            out.append(_finding(ERROR, 'texture.oversize',
                                f'"{img.name}" is {img.size[0]}x{img.size[1]}; the ceiling is '
                                f'{config.TEXTURE_MAX * 2} and only for a hero surface'))
        elif max(img.size) > config.TEXTURE_MAX:
            out.append(_finding(WARN, 'texture.large',
                                f'"{img.name}" is {img.size[0]}x{img.size[1]}; 1K–2K unless it fills the frame'))
    return out


# ── the gate ──────────────────────────────────────────────────────────────────

def audit(scene=None, asset_class='midground', origin='base', source='blend'):
    """Every finding for every mesh in the scene."""
    scene = scene or bpy.context.scene
    budget = config.TRI_BUDGET.get(asset_class, config.TRI_BUDGET['midground'])
    out = list(check_units(scene)) + list(check_textures())
    meshes = [o for o in scene.objects if o.type == 'MESH']
    if not meshes:
        # A gate that accepts an empty file is not a gate. This is not hypothetical: a
        # failed import leaves exactly this, and every other check then passes vacuously.
        out.append(_finding(ERROR, 'scene.empty', 'no mesh in the scene — nothing was checked'))
        return out
    for obj in meshes:
        out += check_transforms(obj, source)
        out += check_origin(obj, origin)
        out += check_mesh(obj, budget)
        out += check_orphan_faces(obj)
        out += check_materials(obj)
    return out


def problems(findings):
    """What fails the gate. Warnings are read by a person; errors stop the asset."""
    return [f for f in findings if f['level'] == ERROR]


def report(findings):
    lines = []
    for f in findings:
        where = f' [{f["object"]}]' if f['object'] else ''
        lines.append(f'  {f["level"].upper():5} {f["code"]:26}{where} {f["message"]}')
    if not lines:
        return '  all checks passed'
    return '\n'.join(lines)
