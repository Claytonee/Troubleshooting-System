"""Prove the studio library does what it claims, headless.

    blender -b --factory-startup --python videos/_studio/tools/studio_selftest.py

It builds an asset that is deliberately wrong in five specific ways and asserts the
validator finds each one, then builds a clean asset and asserts it passes — a validator
that never fails is as useless as no validator. Then it applies each render stage and
reads the settings back.

Exit code 1 on any failure, so it can gate a commit.
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
from oe_studio import config, render, validate   # noqa: E402

PASS, FAIL = [], []


def ok(name, cond, detail=''):
    (PASS if cond else FAIL).append(name)
    print(f'  {"PASS" if cond else "FAIL"}  {name}' + (f' — {detail}' if detail and not cond else ''), flush=True)


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def mat(name, metallic=0.0, roughness=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    return m


# ─────────────────────────────────────────────────────────── a broken asset
print('\n1. The validator finds what is wrong')
scene = fresh()
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
bad = bpy.context.object
bad.name = 'prop_broken'
bad.scale = (2.0, 1.0, 1.0)                       # (a) unapplied scale
bad.data.materials.append(mat('half_metal', metallic=0.5))   # (c) metallic 0.5
bad.data.materials.append(None)                   # an empty slot...
for p in bad.data.polygons:
    p.material_index = 1                          # (b) ...that every face points at
# (d) an n-gon
import bmesh                                      # noqa: E402
bm = bmesh.new()
bm.from_mesh(bad.data)
bmesh.ops.create_circle(bm, cap_ends=True, segments=7, radius=0.2)   # a 7-sided cap = an n-gon
bm.to_mesh(bad.data)
bm.free()
scene.unit_settings.scale_length = 0.01           # (e) centimetres

found = validate.audit(scene, asset_class='hero')
codes = {f['code'] for f in found}
print(validate.report(found))
ok('catches an unapplied scale', 'transform.scale' in codes)
ok('catches faces on an empty material slot', 'material.orphan_faces' in codes)
ok('catches a half-metallic material', 'material.metallic' in codes)
ok('catches n-gons', 'mesh.ngons' in codes)
ok('catches a scene that is not in metres', 'units.scale' in codes)
ok('an unapplied scale is an error, not a warning',
   any(f['code'] == 'transform.scale' and f['level'] == validate.ERROR for f in found))
ok('the gate rejects it', len(validate.problems(found)) > 0)

# ─────────────────────────────────────────────────────────── a clean asset
print('\n2. …and passes an asset that is right')
scene = fresh()
bpy.ops.mesh.primitive_cube_add(size=0.2, location=(0, 0, 0.1))
good = bpy.context.object
good.name = 'prop_clean'
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
good.data.materials.append(mat('plastic_charcoal', metallic=0.0, roughness=0.42))
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project()
bpy.ops.object.mode_set(mode='OBJECT')

clean = validate.audit(scene, asset_class='hero')
print(validate.report(clean))
ok('a clean asset raises no errors', not validate.problems(clean),
   str([f['code'] for f in validate.problems(clean)]))
ok('its origin is at the base, so placing it is setting z=0',
   'origin.base' not in {f['code'] for f in clean})

# ─────────────────────────────────────────────────────────── an empty file
print('\n2b. …and refuses an empty file')
empty = validate.audit(fresh(), asset_class='hero')
ok('an empty scene is rejected, not vacuously accepted',
   'scene.empty' in {f['code'] for f in empty} and bool(validate.problems(empty)))

# ─────────────────────────────────────────────────────────── render stages
print('\n3. Render stages apply, and read back')
scene = bpy.context.scene
for stage in ('preview', 'review', 'final'):
    got = render.configure(scene, stage=stage)
    s = config.STAGES[stage]
    ok(f'{stage}: engine + scale', got['percentage'] == s['scale'],
       f'{got["percentage"]} != {s["scale"]}')
    ok(f'{stage}: AgX', scene.view_settings.view_transform == 'AgX')
    ok(f'{stage}: {config.FPS} fps', scene.render.fps == config.FPS)
ok('only the final stage writes multilayer EXR with passes',
   scene.render.image_settings.file_format == 'OPEN_EXR_MULTILAYER'
   and scene.render.image_settings.media_type == 'MULTI_LAYER_IMAGE'
   and scene.view_layers[0].use_pass_cryptomatte_object)
render.configure(scene, stage='preview')
ok('a preview writes PNG, not EXR', scene.render.image_settings.file_format == 'PNG')
ok('the look is Punchy, not the default',
   'punchy' in (scene.view_settings.look or '').lower(), scene.view_settings.look)

# ─────────────────────────────────────────────────────────── the cost estimate
print('\n4. The cost is knowable before the render starts')
est = render.estimate_seconds('final', 60)
print(f'  60 s of film at "final": {est["frames"]} frames, '
      f'~{est["seconds_per_frame"]} s each, ~{est["total_hours"]} h')
ok('60 s at final is 1,800 frames at 30 fps', est['frames'] == 1800)
ok('…and it is honest that this machine cannot do it in a day', est['total_hours'] > 24)

print(f'\n{"=" * 52}\n  {len(PASS)} passed, {len(FAIL)} failed')
if FAIL:
    for f in FAIL:
        print(f'  - {f}')
sys.exit(1 if FAIL else 0)
