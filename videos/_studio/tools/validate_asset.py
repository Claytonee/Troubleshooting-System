"""The asset acceptance gate, for one .blend.

    blender -b asset.blend --python videos/_studio/tools/validate_asset.py -- --class hero

    --class hero|midground|background   triangle budget (default midground)
    --origin base|any                   where the origin must sit (default base)
    --strict                            warnings fail too

Exit code 1 if the asset is rejected, so it can gate a commit or a build.
"""
import argparse
import os
import sys

import bpy

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
from oe_studio import validate   # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser(prog='validate_asset')
ap.add_argument('--class', dest='cls', default='midground',
                choices=['hero', 'midground', 'background'])
ap.add_argument('--origin', default='base', choices=['base', 'any'])
ap.add_argument('--source', default='blend', choices=['blend', 'gltf'],
                help='gltf: an imported .glb, where node transforms are the format, not a defect')
ap.add_argument('--strict', action='store_true')
args = ap.parse_args(argv)

findings = validate.audit(bpy.context.scene, asset_class=args.cls, origin=args.origin, source=args.source)
errors = validate.problems(findings)
warns = [f for f in findings if f['level'] == validate.WARN]

name = os.path.basename(bpy.data.filepath) or '<unsaved>'
print(f'\nPremium 3D Asset Standard v1 — {name} ({args.cls})')
print(validate.report(findings))
print(f'\n  {len(errors)} error(s), {len(warns)} warning(s) — '
      f'{"REJECTED" if errors or (args.strict and warns) else "ACCEPTED"}')

sys.exit(1 if errors or (args.strict and warns) else 0)
