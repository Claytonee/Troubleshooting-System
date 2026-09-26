# OE hardware library (3D)

Real, reusable hardware for the explainer films. Since D40 it is not a half of anything: a film is built
**inside** this library, and 2D is kept for what is information rather than an object — labels, status,
titles, captions.

> **If it physically exists, model it. If it communicates information, overlay it. If it represents data
> flow, illuminate the path.**

The library is addressed only through named anchors, so the same asset serves the system view, the teaching
view and the repair close-up: what changes between them is the camera, never the style.

**What it holds today** (7 assets, ~490 KB of `.web.glb`, all category A, all ours):

| Asset | For |
|---|---|
| `networking/routers/generic-router-5port` | the school's gateway: LAN 1–4, WAN, status lights |
| `networking/switches/generic-switch-8port` | what joins the school's computers |
| `networking/modems/generic-provider-modem` | the provider's box — light grey, visibly not the school's |
| `networking/internet/internet-endpoint` | the internet, as an abstraction that still belongs to the world |
| `computers/desktop/generic-tower` | the computer, and its network port where it really is: the back |
| `computers/monitor/generic-monitor` | the symptom: a `screen` mesh a scene paints at runtime |
| `connectors/rj45/generic-rj45-plug` | the plug that is, or is not, pushed home |

## Layout

```
hardware-3d/
  README.md            this file: architecture, conventions, LED states, pipeline
  RESEARCH.md          where professional models come from, and the licensing rules
  PROVENANCE.md        one row per asset in the library, external or ours
  source/              reproducible authoring scripts (Blender, headless)
  networking/  routers/ switches/ access-points/ modems/ firewalls/ patch-panels/
  power/       ups/ chargers/ power-adapters/ power-strips/ wall-sockets/
  connectors/  rj45/ ethernet/ fiber/ usb/ power-connectors/
  computers/   desktop/ laptop/ monitor/ keyboard/ mouse/
  peripherals/ printer/ projector/ scanner/
  infrastructure/ rack/ server/ pdu/
```

Only folders with an asset exist. The starter set (RESEARCH.md § Starter set) fills them in order of what
the fault history says breaks.

Each asset is a folder:

| File | What |
|---|---|
| `asset.json` | the record: id, category, units, size, triangles, anchors, moving parts, behaviour, **provenance** |
| `<name>.glb` | the export (from Blender), kept for re-processing |
| `<name>.web.glb` | what scenes load: deduplicated, welded, meshopt-compressed |

## Two categories

- **A — generic training hardware.** Original or licence-cleared, unbranded. Teaches the *kind* of device.
  Behaviour is the generic convention below, and is labelled as generic.
- **B — OE's deployed hardware (digital twins).** When schools use a known model, the learner should see that
  model. A twin's `asset.json` adds `manufacturer`, `model`, `views` (front/rear), the real port list, buttons,
  and **the manufacturer's own meaning for every light**, with its source. A twin never inherits the generic
  LED table.

## Conventions every asset keeps

- **Metres**, real size. **Y up** (glTF). Origin where the asset meets the world (a device: centre of its
  base; a connector: its seat point). **Front faces +Z.**
- **Anchors** are named empties: `anchor_port_<id>`, `anchor_led_<id>`, `anchor_<name>`. Scenes address the
  hardware only through them, so a better model can replace a worse one without touching a film.
- **Every light is its own mesh and material** (`led_<id>`), so a scene can drive it.
- **Moving parts are separate objects** with their pivot at the hinge (`plug_latch`).
- **Materials are PBR** (glTF metallic-roughness). Textures only when geometry cannot carry the detail,
  1K–2K, never 8K. Printed legends are geometry or a 2K decal, never baked into a colour map at 8K.
- **No forced branding.** Hardware keeps believable colours; OE's colours belong to callouts, highlights,
  labels and transitions.

## LED states (generic — category A only)

`OE3D.LED` in `videos/_engine/three/src/index.js`. Colours follow common network-equipment convention.

| State | Look | Means (generic) |
|---|---|---|
| `OFF` | unlit | no power |
| `POWER_ON` | green, steady | the device (or radio) is powered and running |
| `LINK_DOWN` | unlit (port light) | no cable, or nothing answering at the other end |
| `LINK_UP` | green, steady (port light) | a working cable connects both ends |
| `ACTIVITY` | green, flickering | link up and frames passing — a fixed pattern keyed on time, never random |
| `WARNING` | amber | connecting or degraded (e.g. the INTERNET light while the router obtains an address) |
| `FAULT` | red | no service on that function (e.g. INTERNET with the WAN side down) |

Rules: a port light changes only when its cable does; POWER stays on while the device is powered;
**nothing blinks for decoration**. Real devices differ — some show amber for link at a lower speed, some
show INTERNET as orange or off rather than red — so a category-B twin states its own table.

## Pipeline

```
source            external model (licence cleared, PROVENANCE row first)  |  our own Blender script
   ↓
Blender (headless) import → clean: remove hidden/unseen geometry, merge by distance, fix normals,
                   apply transforms, real scale in metres, origin + orientation to the conventions,
                   rename objects to the anchor scheme, separate LEDs and moving parts, rebuild
                   materials as Principled PBR, strip trademarks where the licence allows edits
   ↓               export GLB (+Y up, apply modifiers, extras on)
glTF-Transform     inspect (triangles, materials, bounds) → dedup → weld → [simplify for LOD1/LOD2
                   when a scene needs them] → [texture resize/WebP] → meshopt   ⇒  <name>.web.glb
   ↓
OE3D (three.js)    HardwareStage: studio light (room reflections + key + rim + fill), soft ground shadow,
                   camera rig, anchors, LED states, generated cables, projected callouts
   ↓
HyperFrames        a layer composition over the 2D frames (lib/hardware-layer.mjs), driven by its own
                   GSAP timeline through a clock setter → deterministic frames → 1920×1080 60 fps
```

Rebuild everything here:

```bash
blender -b --factory-startup --python videos/_engine/hardware-3d/source/build_router_generic.py
blender -b --factory-startup --python videos/_engine/hardware-3d/source/build_rj45_plug.py
cd videos/_engine/three && npm install && npm run build      # → videos/_engine/shared/three-oe3d.js
```

Blender 5.2.2 (portable, checksum-verified) is at `~/tools/blender-5.2.2-windows-x64/`.

## The hybrid rules (2D ⇄ 3D)

1. **Hand over by silhouette, not by cut.** The 2D camera arrives at a framing where the drawn device's face
   and the 3D device's face coincide (a long lens, straight on). The 3D layer fades in over it; only then
   does the 3D camera move and reveal depth. Going back mirrors it exactly.
2. **One ground, one furniture.** The 3D layer carries the same slate, logo and top scrim as the frames, and
   the drawing's grid continues as the floor.
3. **The drawing keeps the system; the object keeps the hands-on moment.** Topology, the fault domain and the
   request/response proof stay 2D.
4. **Restrained camera.** Orbit, dolly, focus — never so fast that the learner loses which side is which.
5. **Callouts follow anchors**, are few, and never cover the part they name.
