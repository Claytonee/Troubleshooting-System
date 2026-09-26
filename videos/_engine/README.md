# OE explainer engine

Turns an episode spec (`videos/_episodes/<slug>.mjs`) into a finished MP4, on the look the owner approved
on 2026-09-26. HyperFrames (HeyGen, Apache-2.0) does the composition, preview and render; this engine does
what makes the series one series: one shared stage language, the camera, the flows, the voice pacing, the
logo and the checks. Decision and reasoning: `docs/engineering/security-program/DECISIONS.md` D36–D37.

```bash
node videos/_engine/make.mjs <slug>                 # everything
node videos/_engine/make.mjs <slug> --only=build,assemble,check,snap   # after a timeline edit
```

## What it needs (once per machine)

- Node 22+, Chrome, and FFmpeg: `OE_FFMPEG_DIR` (default `~/tools/ffmpeg-n8.1-latest-win64-gpl-8.1/bin`).
- Python 3.12 with `kokoro-onnx soundfile faster-whisper`: `OE_VIDEO_PYTHON` (default
  `~/tools/kokoro-venv/Scripts/python.exe`). A `uv venv --python 3.12` works.
- The HyperFrames skills (`npx hyperframes skills update faceless-explainer`): the engine calls its
  `captions.mjs` and `assemble-index.mjs`, and the bundled SFX library.

## The pieces

| File | What it owns |
|---|---|
| `lib/devices.mjs` | the device library: original SVG in one line language; ports, status lights, screen states |
| `lib/devices2.mjs` | close-up-ready devices (v2, D38): desktop + tower NIC, switch with RJ45 ports and UPLINK, router with status icons, LAN 1–4 and WAN, provider modem, web server |
| `lib/stage.mjs` | the world drawing: placed devices, links that draw/break/mend, labels, check chips; flows on one global clock |
| `lib/frame.mjs` | one frame composition: camera wrappers, logo and slate fixed to the screen, the timeline helpers, the lesson card, the anchored zoom |
| `lib/geometry.mjs`, `lib/palette.mjs` | curves, arc-length sampling; the colours by role |
| `lib/hardware-layer.mjs` | a Three.js composition laid over the frames: the canvas, the overlay SVG, the screen furniture, and the clock setter that makes it a pure function of time |
| `lib/school-network.mjs` | the school's network as a graph — devices, ports, connections, and the order a person checks them. The film, the world sheet and (later) any troubleshooting scene read this one definition |
| `three/` + `shared/three-oe3d.js` | the 3D runtime, bundled (three.js + stage, world, cables, the signal tracer, the camera rig, collision-aware labels). No CDN at render time |
| `hardware-3d/` | the hardware itself: Blender sources → GLB → meshopt, with a provenance row and an `asset.json` per asset |
| `tools/world-sheet.mjs` | proves the 3D world before a film is built on it: nine views of the real runtime in headless Chrome, tiled into one sheet, with `--probe=<view>,x,y` to ask what a pixel is showing |
| `shared/` | frame.md, caption skin, fonts (OFL), the official logo, the video direction every storyboard inherits |
| `tools/words.py` | word timings (faster-whisper) for captions |
| `make.mjs` | the pipeline, step by step |

## Rules the engine keeps so episodes cannot break them

- **One stage per episode**: every frame redraws it in the same place, so cuts are invisible.
- **Flows on the global clock**: a packet in flight at a cut continues in the next frame.
- **Voice composed phrase by phrase** (shared cache in `.cache/tts`, not committed): pauses are designed and
  every phrase's start is known, so each reveal and each sound lands on its word.
- **The official logo, never redrawn**: the engine refuses to run if the file stops having its 21 paths.
- **Checks gate the run**: any lint or check error stops it; snapshots are taken at each frame's middle and on
  both sides of every cut, and are looked at before a render is delivered.
- **Loudness**: -16 LUFS integrated, -1.5 dBTP, measured and applied in two passes.

## Writing an episode

Copy `videos/_episodes/how-a-school-connects.mjs`. A spec has `frames` (each: the phrases with their
pauses, the storyboard fields, and a `timeline(x)` returning the frame's GSAP body), `stage(x)` (build the
world), `flows(x)` (packets / current, global time) and `sfx(x)` (cues by phrase). In a timeline, `x.c(i)`
is the start of this frame's phrase `i`, `x.w('word')` a word's start, `x.G(f,t)` global time.

### …or a 3D-first episode (D40)

Copy `videos/_episodes/how-a-school-connects-world.mjs`. There, the picture is **one Three.js layer running
the whole film** and the frames beneath carry nothing (`blankFrames: true` — text hidden under an opaque
layer is still text to the contrast check). The spec computes every key time from the narration and injects
it as `S`; the scene file is a pure function of `t` that drives the world. Shape:

```js
layers: (x) => [{ id: 'world', start: 0, dur: x.total, html: hardwareLayer({ …, models: MODELS,
  scene: `var S = ${JSON.stringify(keys(x))}, NET = ${JSON.stringify(net)};\n${SCENE}` }) }]
```

Run `node videos/_engine/tools/world-sheet.mjs` before writing any film code: it renders the world's key
views, and a fault in a model, an anchor, the cable routing, the lighting or the camera grammar shows up
there in a minute instead of after a fifteen-minute render.
