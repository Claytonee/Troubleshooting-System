# OE cinematic studio (Blender 5.x)

The Blender half of the explainer system: characters, environments, physical objects and
path-traced shots. The other half — the editorial timeline, captions, brand furniture,
audio mix, loudness and the final MP4 — stays in `videos/_engine` (HyperFrames), which
remains the master. **Blender never produces a finished film here; it produces shots.**

Built to the Master Production Blueprint the owner adopted on 2026-09-26, with the
differences in §"Where the blueprint and this machine disagree" below. Decisions: D41.

## Run it

```bash
# prove the library still works (23 checks, ~40 s)
blender -b --factory-startup --python videos/_studio/tools/studio_selftest.py

# audit an asset against the Premium 3D Asset Standard
blender -b path/to/asset.blend --python videos/_studio/tools/validate_asset.py -- --class hero
```

`blender` is `~/tools/blender-5.2.2-windows-x64/blender.exe` on this machine (under the
`clayt` profile, not on PATH).

```python
import sys; sys.path.append('videos/_studio/lib')
from oe_studio import config, render, validate

render.configure(scene, stage='review')        # one call, every setting the series shares
print(render.estimate_seconds('final', 60))    # what it will cost, before it is started
findings = validate.audit(scene, asset_class='hero')
if validate.problems(findings):                # errors stop the asset; warnings are read
    print(validate.report(findings))
```

## Layout

The blueprint's `/STUDIO_PROJECT_ROOT/` is mapped into the repository's existing `videos/`
rather than made a second root, so one clone holds the whole series.

| Blueprint | Here |
|---|---|
| `00_PREPROD/` | `videos/<film>/` — `BRIEF.md`, `SCRIPT.md`, `STORYBOARD.md`, `boards/` |
| `01_ASSET_LIBRARY/` | `videos/_studio/{characters,props,sets,hdri,kits}/` — and hardware stays in `videos/_engine/hardware-3d/`, which is already to standard |
| `02_PRODUCTION/SEQ_nnn/SH_nnn/` | `videos/<film>/blend/SEQ_nnn_NAME/SH_nnn.blend` |
| `03_COMPOSITING/` | in the shot file — the Blender compositor, driven by `oe_studio` |
| `04_AUDIO/` | `videos/_engine` owns the mix; sources in `videos/<film>/assets/audio/` |
| `05_EXPORTS/` | `videos/<film>/renders/` |

**Naming.** `SEQ_<nnn>_<NAME>` / `SH_<nnn>` / `v<nnn>`, zero-padded, never renamed once the
animatic locks. Objects: `prop_<name>[_<variant>]`, `chr_<name>`, `set_<name>`,
`cam_SH_<nnn>`, `lgt_<role>_<name>`. Hardware keeps the existing anchor scheme
(`anchor_port_*`, `anchor_led_*`).

## Where the blueprint and this machine disagree

Each row was measured here, not assumed. The measurement wins: a studio standard that is
wrong on the hardware it runs on is worse than no standard.

| Blueprint says | Measured here | What the library does |
|---|---|---|
| "Preview: **Eevee Next**, 30 FPS realtime review" | EEVEE headless costs **91.1 s a frame** at 960×540 — *slower than Cycles* (84.2 s), because there is no working GPU path. Cycles reports **zero** compute devices: no OptiX, CUDA, HIP or oneAPI. | `preview` uses the **OpenGL/Workbench** render instead. Blocking and timing do not need a path tracer. |
| "Final: Cycles, **256 samples**" | `render.estimate_seconds('final', 60)` → **1,800 frames, ~1,347 s each, ~674 hours**. Twenty-eight days for one minute. | `final` keeps 256 samples, and `config.FINAL_IS_LOCAL = False` says out loud that it is a rented-GPU stage (~$0.30–0.60/hr; a few dollars a minute). |
| Multilayer EXR via `file_format = 'OPEN_EXR_MULTILAYER'` | Blender 5.x hides that value behind `image_settings.media_type`; while the media type is `IMAGE` the enum does not contain it and the assignment **throws**. | `render.configure` sets `media_type = 'MULTI_LAYER_IMAGE'` and lets the format follow, with a 4.x fallback. |
| "Sound mixed to **−14 LUFS**" | The series is already mastered at **−16 LUFS / −1.5 dBTP** (D36) and the film in the Resource Library is at −16. | `config.LOUDNESS_LUFS = -16.0`. Changing it means re-mastering every existing film — a decision, not a default. |
| Frame rate unstated | The delivered 1080p**60** master was 39.9 MB for 72.5 s; the same frames at **30 fps**, quality-targeted, came out at 14.5 MB with no visible loss at 36.6 s. | `config.FPS = 30`, and a delivery budget of 14 MB a minute (D41). |
| "AgX … Punchy" | Agreed, and adopted. | `config.VIEW_TRANSFORM = 'AgX'`, `LOOK = 'AgX - Punchy'`. **But** the three.js runtime is still `NeutralToneMapping`, so a Blender shot and a runtime shot do not match yet. That is one line in `_engine/three/src/index.js` and it belongs to the engine's owner. |
| "Audio2Face — FREE" | Real and open-sourced (Sept 2025), but it ships Unreal and Maya integrations, not Blender, and wants an NVIDIA GPU. There is none here. | Not in the stack. Rhubarb Lip Sync is the working free option. |
| "DeepMotion / Plask — FREE TIER" | Free tiers are limited and their commercial terms need reading per-product. Of the free motion sources, **CMU is unrestricted**, Mixamo permits commercial use but forbids redistributing the files, and **AMASS, the GVHMR/WHAM weights and Cascadeur's free tier are non-commercial** — banned for OE. | Locomotion from CMU; Mixamo working files stay out of git. |

## What exists today

- `lib/oe_studio/config.py` — every studio constant, each with the measurement or the
  decision behind it.
- `lib/oe_studio/render.py` — `configure(scene, stage)` for the three stages, and
  `estimate_seconds()` so a render's cost is known before it starts.
- `lib/oe_studio/validate.py` — the Premium 3D Asset Standard as executable checks: units,
  transforms, origin, n-gons, non-manifold edges, loose geometry, UVs, triangle budget,
  faces on empty material slots, non-Principled and half-metallic materials, texture size.
- `tools/studio_selftest.py` — 23 checks. It builds an asset that is wrong in five
  specific ways and asserts each one is caught, then builds a clean one and asserts it
  passes: **a validator that never fails is as useless as no validator.** It is how the
  `OPEN_EXR_MULTILAYER` breakage above was found.
- `tools/validate_asset.py` — the gate, for one `.blend`.

## What does not exist yet

Camera and lighting rig kits, the Geometry Nodes systems (cables, desk scatter, wear), the
shot builder, the render driver and the rented-GPU lifecycle, and every character. Those
begin at Gate 2 (art direction), which needs the owner: how the teacher and the school are
portrayed is not a decision this library can make.
