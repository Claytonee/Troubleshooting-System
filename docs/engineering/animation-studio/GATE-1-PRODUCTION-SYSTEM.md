# Gate 1 — the cinematic animation production system

**Status: FROZEN by owner decision on 2026-09-26. Nothing here has been built.**
Written 2026-09-26 for the owner, as the research + architecture phase of the brief
"build an AI-directed cinematic technical-animation production system". It stops at Gate 1 (§17).

The proposal is deliberately frozen while `videos/how-a-school-connects-world` is completed as the first
internal quality benchmark. Gate 2 (character and art direction) must not begin until that 72-second film
passes its geometry, materials, physical-contact, network-accuracy, camera, lighting, temporal, audio,
branding and continuity gates with rendered evidence.

**The gate questions in §17 have since been decided by delegation — see DECISIONS.md D41.** In short: the
freeze stands; the series is bound by a delivery budget in megabytes rather than by ambition (measured:
two thirds of the delivered film is waste, not picture); films render at 30 fps; people arrive in
three sequenced steps beginning with hands, not with a cast; and no money and no installations are
authorised. What still needs the owner is the list of hardware OE actually deploys.

It builds **on top of** the explainer engine that already exists (`videos/_engine`, decisions D36–D40) and
does not re-litigate it. Where this document disagrees with the brief, it says so and says why.

---

## 1. RESEARCH FINDINGS

### 1.1 What was measured on this machine (not assumed)

Everything below was run here today, on Blender 5.2.2 LTS
(`C:\Users\clayt\tools\blender-5.2.2-windows-x64\blender.exe`, build hash `d13f752e3b9c`, 2026-09-15).

| Measurement | Result | How |
|---|---|---|
| Machine | Intel **i5-7200U**, 2 cores / 4 threads, Intel HD 620, 23.8 GB RAM, 113 GB free on C: | `Get-CimInstance` |
| Cycles GPU backends | **none** — OptiX, CUDA, HIP and oneAPI all return an empty device list | `cycles` prefs, headless |
| Cycles CPU render | **84.2 s/frame** — 960×540, 64 spp adaptive, OIDN denoise, 72.6k tris, 3 area lights, no textures | `scratchpad/bench.py` |
| EEVEE render, same frame | **91.1 s/frame** — *slower than Cycles* | same script |
| OE3D (three.js) real-time, same machine | **~1.06 s/frame** at 960×540 including CDP round-trip, **SwiftShader** (deliberately software, so a QA sheet looks the same on any machine) | `scratchpad/char-determinism.mjs` |
| The existing engine's own full render | **~24 min for 72.5 s at 1920×1080 60 fps** — 4,350 frames ⇒ **≈0.33 s/frame** — through HyperFrames' Chrome on **hardware WebGL** (HD 620) | measured by the engine's author, 2026-09-26 |
| Blender rig → GLB → OE3D, skinned + animated | **PASS** — 3 bones, 9 tracks, skin deforms; `mixer.setTime(t)` twice at t=0.55 gave **byte-identical** pixels; different t gave different pixels | `scratchpad/rig_export.py` + `char-determinism.mjs` |

**The three findings that decide the architecture:**

1. **There is no GPU here.** Cycles has no compute device at all. Every path-traced frame is rendered by two
   physical cores. Scaling the measured frame to 1920×1080 (4× the pixels) gives ≈5.6 min/frame **for a scene
   far simpler than any real shot** — no textures, no HDRI, no depth of field, no hair, no motion blur, 64
   samples. A real classroom frame with a character is realistically **15–40 min**. A 60-second pilot at 24 fps
   is 1,440 frames: **6 to 16 days of continuous rendering**, during which this laptop cannot be used.
2. **EEVEE is not the escape hatch.** Headless, it measured *slower* than Cycles — it is running on a software
   rasteriser, not on the HD 620. The usual advice "use EEVEE, it's real-time" is false on this hardware.
   (Caveat, stated honestly: this was measured headless only. A windowed EEVEE render on the HD 620 has not
   been tested and may differ. It will not differ by the order of magnitude that would change the conclusion.)
3. **The real-time path already on disk is ~250× cheaper per frame than Cycles here, and it can carry
   characters.** That is not a guess: a Blender-rigged, skinned, animated GLB was exported and played inside
   the existing OE3D runtime today, deterministically. This is the single most important finding in this
   document, because it means **most shots do not need a render farm at all**.

The probe's image is honest about its limits: the mesh is a 122-vertex auto-weighted blob, and it rendered
**pale and washed out** — the OE3D stage is lit and tone-mapped for charcoal plastic hardware, not for skin.
Character look-dev in that rig is real work (§7), not a switch to flip.

### 1.2 The ecosystem, verified September 2026

**Blender.** 5.2 LTS (14 July 2026, supported to July 2028) is the right line to stand on; it is what is
installed. Since 4.2 the relevant changes are: EEVEE's engine id is now `BLENDER_EEVEE` again (the `_NEXT`
suffix is gone — it broke our benchmark script and it will break any older automation), Vulkan is the default
backend from 5.1, colour management was rebuilt in 5.0 with wide-gamut/HDR and ACES 1.3/2.0 available,
Grease Pencil v3 replaced the old object type with **no forward compatibility**, Geometry Nodes gained bundles,
closures, SDF and volume-grid nodes, 5.2 added **online asset libraries** (register a remote library, download
on demand) and node-powered XPBD cloth and hair. Python is 3.13 in the 5.1+ line, which broke a wave of
add-ons — check every add-on against 5.2 specifically, not against "Blender 5".

**Production management.** Kitsu (CGWire) is genuinely free and GPL-3 self-hosted, with `gazu` as its Python
client, Blender Kitsu as the add-on and Watchtower as the visual tracker; Blender Studio runs Kitsu + Flamenco
+ Watchtower. **I do not recommend installing any of it yet** — see §2.6.

**Characters.** MPFB2 (GPLv3 code, CC0 bundled assets) is alive — 2.0.17 shipped 22 July 2026 — and is the only
free in-Blender human generator that is actively maintained. Rigify ships with Blender; CloudRig (Blender
Studio) is the production-grade generator behind Rain, Snow and Storm, whose rigs are **CC-BY** and downloadable.
Auto-Rig Pro is $25 Lite / $50 Full.

**Motion capture.** The licensing is the story, not the technology:

| Source | Licence reality | Verdict for OE |
|---|---|---|
| **CMU Graphics Lab mocap** | unrestricted, commercial use allowed | **Use.** The locomotion base. |
| **Mixamo** | still free, commercial use permitted, **redistribution of the animation files forbidden**; unmaintained since ~2019 | **Use, do not commit the FBX to this repo.** |
| **AMASS** | non-commercial research/education/art **only** | **Banned.** OE is a commercial organisation. |
| **GVHMR / WHAM** (video→SMPL) | model weights non-commercial research; SMPL/SMPL-X under their own MPI licence | **Banned for production.** |
| **Cascadeur free tier** | **non-commercial only** (Indie/Pro add FBX/USD) | **Banned at the free tier** — the commonest misconception about this tool. |
| **FreeMoCap / BlendArMocap / BlendCap** | open source; BlendArMocap is discontinued and unreliable on recent Blender | Evaluate BlendCap only if webcam capture is ever needed. |
| **Truebones / MoCap Online** | paid, per-product terms, some with AI restrictions | Only if a specific action cannot be hand-animated. |

**Facial animation.** NVIDIA open-sourced Audio2Face on 24 Sept 2025 (models, SDK, training stack) — real, but
it ships Unreal and Maya integrations, not Blender, and it wants an NVIDIA GPU. Rhubarb Lip Sync with the
`blender_rhubarb_lipsync_ng` add-on is the free, boring, works-today option and is enough for §7's face plan.

**Assets and materials.** Poly Haven and ambientCG remain **CC0**, no attribution, and Poly Haven has an Asset
Browser add-on. BlenderKit's free tier is usable. **Megascans is no longer free** — the free-for-everyone window
closed at the end of 2024, new Megascans stopped landing in Quixel Bridge at the start of 2026, and assets are
now priced on Fab. Any plan that assumed Megascans is out of date.

**Render capacity.** SheepIt is free but distributes your `.blend` and all its assets to anonymous volunteers —
acceptable for hardware, unacceptable the moment a film contains a real school's name or a recognisable person,
and unpredictable for a deadline. Rented GPU is the serious option: RTX 4090 on Vast.ai is tracked at
**$0.14/hr lowest, ~$0.29–0.59/hr typical, ~$0.42/hr median** (Sept 2026, down ~13% in 90 days).

**Finishing.** DaVinci Resolve's free edition includes Fusion, Color and Fairlight and exports up to 4K UHD at
60 fps; the Studio-only list is Neural-Engine features (Magic Mask, SuperScale, voice tools) and >4K/>60 fps.
Nothing in the free list blocks this work.

**Audio.** Freesound is ~734k sounds of which **~381k are CC0** (Sept 2026); Pixabay needs no attribution;
Zapsplat allows commercial use. Kokoro-82M TTS and faster-whisper word timings are already in the engine.

**AI video generation (Sora/Veo/Kling).** Read the state of the art and reject it for this work, on evidence,
not on principle: quality degrades after 20–25 s of continuous generation, **character consistency across
shots is unsolved industry-wide**, and **on-screen text and labels come out garbled** — in a film whose entire
job is to show a WAN port, a status light and a legible label, that last one alone is disqualifying. It stays
useful for mood boards and pitch frames, never for a delivered technical shot.

### 1.3 Where the brief's example sequence is technically wrong

The brief's illustrative flow ends "→ Support workflow → ICT technician". In **this** system that is not what
happens, and a film must not teach it:

- `errorController.create()` gives a teacher's report `assigned_to = null` and `escalation_level = 'school'`,
  and rings the **school administrator's** bell (`admin_notifications`, `type='error_reported'`). Only a
  *critical* report, or an explicit `POST /errors/:id/escalate`, hands it to the field engineer.
- The API and the database are **on the same host** (cPanel, MySQL on `localhost`). A shot flying a packet to a
  distant cloud data centre would be a lie about this architecture.
- The most interesting truth is one the brief did not know: if the school's uplink is dead, the report **does
  not travel at all** — it is queued in IndexedDB by `Offline.enqueue()` with its photos, and replayed by a
  backoff retry. "The report waits in the tablet until the line comes back" is both true and a better beat.

Any technical sequence is storyboarded from the code (`errorController`, `school-network.mjs`, `offline.js`)
and checked against it before it is animated. This is the same discipline as `verify-workflows.js`.

---

## 2. RECOMMENDED STACK

### 2.1 The visual language — recommendation: **premium stylized realism, hardware-true**

Compared honestly:

| Direction | What it buys | What it costs here | Verdict |
|---|---|---|---|
| Photorealism (people included) | nothing the audience needs | uncanny valley with one part-time operator, no GPU, no character artist; skin, eyes and hair are where it fails | **No** |
| Product-visualisation realism | believable hardware, which is the subject | already achieved by the existing library | **Yes, for objects** |
| Premium stylized 3D (characters) | acting reads, silhouettes read, cost is controllable, it ages well | needs a designed look, not a default | **Yes, for people** |
| Cinematic technical visualization | the system layer | already achieved (D40) | **Yes, for the system** |

**The rule: rooms and hardware are physically true; people are designed.** Characters are specific
(a Tanzanian secondary-school teacher, not a generic figure) with simplified features, strong silhouettes,
real clothing and restrained acting. They are lit by the same physically-motivated light as the room, so they
belong in it.

**And one discipline that buys most of the believability for a tenth of the cost: shoot the hands.** The
camera favours hands on the device, posture, the shoulder line and the back of the head; faces appear at
distances and in light where a stylized face reads as a *choice*. The reaction to a dead tablet can be played
by a stilled hand, a second press, and the teacher's own reflection in the black screen. Full facial
performance is a later gate, not a precondition for the pilot.

### 2.2 The tools, by stage

| Stage | Owner | Why |
|---|---|---|
| Script, beats, facts | repo + `SERIES.md` + the app's own code | facts come from the system (D37) |
| Storyboard | **Grease Pencil 3 in Blender**, drawn over blocked 3D | spatial from the first frame; the same cameras survive into layout |
| Animatic | **Blender VSE + Story Pencil** | shot swapping and edit in one file |
| Environments, props | **Blender** + Poly Haven/ambientCG CC0 + Geometry Nodes | |
| Hardware | **the existing `hardware-3d` library** — unchanged | it is already to standard |
| Characters | **Blender**: MPFB2 or original base → Rigify/CloudRig | free, in-Blender, maintained |
| Body animation | hand-keyed, CMU/Mixamo for locomotion only | licence-safe; hand-keyed acting beats bad mocap |
| Face | shape keys + **Rhubarb** for phonemes, hand-keyed for eyes/brows | |
| Lighting | Blender for filmed shots; the OE3D rig for system shots | |
| Real-time shots | **OE3D / three.js in HyperFrames** | proven, ~0.33 s/frame on the finished 1080p60 film, deterministic |
| Path-traced shots | **Blender Cycles on a rented GPU** | §11 |
| Compositing | **Blender compositor** (EXR passes, Cryptomatte) | keeps it in one automatable process |
| Editorial master, captions, audio mix, brand furniture, loudness | **HyperFrames** — unchanged | it already owns all of this (D36–D40) |
| Grade, if a shot needs more than the compositor | DaVinci Resolve free | |
| Sound | Freesound CC0 + Zapsplat + Kokoro TTS (already in the engine) | |
| Tracking | `shots.json` in git | §2.6 |

### 2.3 What I am recommending **against**, and why

- **Against Kitsu/Flamenco/Watchtower today.** They are free and good and they are for studios. With one
  operator and one render machine, a production tracker is three services to run and nothing to coordinate.
  The repo already treats specs as data (`school-network.mjs`); a `shots.json` manifest in git gives status,
  versioning and history for free. Revisit at >2 people or >1 film in flight.
- **Against Meshy and every per-generation 3D service.** The existing library proves procedural Blender
  scripts beat them for this subject: exact, ours, reproducible, free, and they match the 2D drawings. If
  generative 3D is ever needed, TRELLIS 2 and TripoSR (MIT) are self-hostable on the same rented GPU — no
  per-asset fee. Hunyuan3D's licence is not unrestricted; read it before use.
- **Against AMASS, GVHMR/WHAM weights and Cascadeur's free tier** — all non-commercial (§1.2).
- **Against a 10-minute film as the next step.** §10 proposes 46 seconds.

### 2.4 One defect this stack has today, found while checking it

Blender 5.x renders through **AgX** by default. The OE3D stage renders through
`THREE.NeutralToneMapping` (`three/src/index.js:105`). They are different tone curves, so **a Blender shot cut
next to an OE3D shot will not match** — the hand-over the whole hybrid idea depends on would show a colour
step. The bundled three 0.186.1 **already contains `THREE.AgXToneMapping`**. Fix: standardise on AgX in both
renderers, and prove it with a two-frame comparison before the pilot is shot. This is a one-line change and a
test, and it belongs to the engine's owner, not to me.

### 2.5 Colour and interchange

AgX everywhere, sRGB delivery, EXR (half, DWAA) for anything that goes to compositing, PNG only for stills.
**Not ACES** — its wide-gamut workflow buys nothing when the deliverable is an sRGB MP4 for WhatsApp and a
projector, and it costs a calibration discipline nobody here is going to maintain. Geometry moves as **glTF/GLB**
(the engine's format, meshopt-compressed); USD only if a second DCC ever joins, which it should not.

### 2.6 The tracker

`shots.json` per film: id, sequence, duration, status (`board|layout|anim|light|render|comp|final`), owner,
route (R1/R2/R3), assets used, last render hash, notes. It is read by the shot builder, the render driver and
the QC pass, so status cannot drift from reality — a status is derived from artefacts on disk, never typed.

---

## 3. COST MATRIX

| Dependency | Class | Cost | Note |
|---|---|---|---|
| Blender 5.2.2 LTS | OPEN SOURCE (GPL) | 0 | installed |
| Rigify, Grease Pencil 3, VSE, compositor, Story Pencil | OPEN SOURCE | 0 | ship with Blender |
| CloudRig | OPEN SOURCE | 0 | Blender Studio |
| MPFB2 | OPEN SOURCE (GPLv3, CC0 assets) | 0 | |
| Blender Studio rigs (Rain/Snow/Storm) | CC-BY | 0 | credit required; reference and training only |
| Poly Haven, ambientCG | CC0 | 0 | HDRIs, materials, some props |
| BlenderKit free tier | FREE TIER | 0 | |
| CMU mocap | FREE, unrestricted | 0 | |
| Mixamo | FREE TIER | 0 | no redistribution of files |
| Rhubarb Lip Sync (+ NG add-on) | OPEN SOURCE | 0 | |
| three.js 0.186.1, HyperFrames, glTF-Transform, meshoptimizer | OPEN SOURCE | 0 | in the repo |
| Kokoro-82M TTS, faster-whisper | OPEN SOURCE | 0 | in the engine |
| FFmpeg | OPEN SOURCE | 0 | installed |
| Freesound CC0 / Pixabay / Zapsplat | CC0 / FREE | 0 | check each file's licence |
| DaVinci Resolve (free) | FREE | 0 | ≤4K, ≤60 fps — enough |
| OpenImageDenoise, Cryptomatte, OpenEXR | OPEN SOURCE | 0 | in Blender |
| SheepIt render farm | FREE | 0 | **privacy cost** — scene goes to strangers |
| **Rented GPU (Vast.ai / RunPod RTX 4090)** | **PAY PER USE** | **~$0.30–0.60/hr; ≈$3–6 per 60-second pilot** | the one real cost |
| Auto-Rig Pro | PAID OPTIONAL | $50 once | only if retargeting becomes the bottleneck |
| Cascadeur Indie | PAID OPTIONAL | subscription | free tier is non-commercial — do not use it |
| A GPU workstation / eGPU | PAID OPTIONAL (capital) | see §11.4 | pays for itself only at high volume |
| Meshy / paid 3D generation | **NOT RECOMMENDED** | per asset | procedural Blender is better here |

**PAID REQUIRED: none.** The entire pipeline runs on free and open-source software. The only money that must
be spent is a few dollars of rented GPU time per finished minute — and even that is optional if every shot is
routed to the real-time renderer (§11).

---

## 4. PIPELINE ARCHITECTURE

### 4.1 The stages, and who owns each

```
IDEA ─────────── owner (a fault type from SERIES.md)
SCRIPT ───────── repo: beats + facts pulled from the app's own code, [confirm] markers for unknowns
STORYBOARD ───── Blender, Grease Pencil 3 over blocked geometry  → boards/*.png + shots.json
ANIMATIC ─────── Blender VSE (Story Pencil) + the real Kokoro voice → animatic.mp4, LOCKS DURATION
ASSETS ───────── Blender (procedural scripts) + CC0 libraries      → assets/**, asset.json each
CHARACTERS ───── Blender: base → Rigify/CloudRig → wardrobe → look  → characters/**
ENVIRONMENTS ─── Blender + Geometry Nodes                           → sets/**
RIGGING ──────── Rigify/CloudRig; props rigged where they move
ANIMATION ────── Blender, hand-keyed; CMU/Mixamo locomotion base
LIGHTING ─────── Blender per sequence (a lighting rig is an asset, not a per-shot improvisation)
RENDER ───────── R1 real-time (OE3D) | R2 Blender EEVEE | R3 Blender Cycles on rented GPU
COMPOSITING ──── Blender compositor from EXR passes → per-shot ProRes/PNG sequence
HYPERFRAMES ──── the editorial master: shots as clips, captions, overlays, brand furniture, audio mix
SOUND ────────── Freesound/Zapsplat + Kokoro narration, mixed in HyperFrames (-16 LUFS, -1.5 dBTP)
EDIT ─────────── HyperFrames timeline (there is no second edit)
MASTER ───────── hyperframes render → MP4 1920×1080; QC gate; Resource Library upload
```

**The spine does not change: HyperFrames stays the single deterministic timeline and the renderer of record.**
Blender is a *shot source*, never a parallel edit. One timeline means one caption system, one loudness pass,
one brand furniture, one QC — all of which already exist and are already tested.

### 4.2 Studio folder architecture

Films live beside the existing ones; the studio library is shared, and `_engine/hardware-3d` is **not moved**.

```
videos/
  _engine/                        ← existing, untouched (HyperFrames engine, hardware-3d, OE3D runtime)
  _studio/                        ← NEW: everything Blender
    README.md
    lib/                          oe_studio/  (python package: scene, camera, light, qc, export)
      scene.py  camera.py  lighting.py  materials.py  validate.py  render.py  qc.py
    kits/
      camera-rigs/                one .blend per rig: 24/35/50/85/100 bodies with real sensor + DOF
      lighting-rigs/              classroom-morning, classroom-overcast, office-fluorescent, product-studio
      geometry-nodes/             cable.blend  desk-scatter.blend  wear.blend  crowd.blend
      materials/                  the studio material library (.blend, asset-marked)
    characters/
      <name>/  base.blend  rig.blend  wardrobe.blend  looks/  shapekeys/  character.json
    sets/
      <name>/  set.blend  set.json  refs/
    props/
      <name>/  prop.blend  prop.json
    hdri/                         CC0 only, with a LICENCE file per file
    mocap/                        CMU/Mixamo working files — .gitignored (redistribution)
  <film-slug>/                    ← one directory per film, HyperFrames project as today
    BRIEF.md SCRIPT.md STORYBOARD.md DIRECTION.md REVIEW.md
    shots.json                    ← the tracker
    boards/                       storyboard frames
    blend/
      SEQ_010_CLASSROOM/ SH_010.blend SH_020.blend …
    renders/
      SH_010/ v003/ exr/ …  beauty.mov
    compositions/                 HyperFrames HTML (unchanged)
    assets/ capture/ snapshots/ renders/    (unchanged)
```

**Naming.** `SEQ_<nnn>_<NAME>` / `SH_<nnn>` / `v<nnn>`, zero-padded, never renamed after the animatic locks.
Objects: `<type>_<name>[_<variant>]` — `prop_tablet_a`, `chr_teacher_asha`, `set_classroom_b`, `cam_SH_050`,
`lgt_key_window`. Anchors keep the library's existing scheme (`anchor_port_*`, `anchor_led_*`).

---

## 5. REQUIRED INSTALLATIONS

Nothing is installed until Gate 1 passes. In order, smallest first:

| # | Thing | How | Check before installing |
|---|---|---|---|
| 1 | *(nothing)* — Blender 5.2.2, FFmpeg, Node 26, Chrome, the Kokoro venv are already here | — | `blender --version` |
| 2 | Poly Haven Asset Browser add-on **or** just download the 3–4 HDRIs needed | extensions.blender.org | 5.2 compatibility |
| 3 | MPFB2 2.0.17+ | extensions.blender.org | states 4.2+; verify on 5.2 with a one-click human |
| 4 | CloudRig | projects.blender.org/Isaiah-Odhner/CloudRig | 5.2 branch |
| 5 | Rhubarb Lip Sync NG | github Premik/blender_rhubarb_lipsync_ng | 5.2 + Python 3.13 |
| 6 | DaVinci Resolve free | blackmagicdesign.com | only if the Blender compositor proves insufficient |
| 7 | A Vast.ai / RunPod account | — | **owner decision, §17** |

Every add-on is verified against **5.2 specifically** (Python 3.13 broke a wave of add-ons in the 5.1 line) and
recorded with its version and licence in a `PROVENANCE.md` beside the library's, before it touches a film.

---

## 6. PREMIUM 3D ASSET ACCEPTANCE STANDARD v1

Extends — does not replace — `videos/_engine/hardware-3d/README.md §Conventions`, which every asset already
keeps. An asset is **rejected** if any MUST fails. "Hero" = seen closer than 40 cm on screen.

### Geometry
- **MUST** be metres, real-world size; Y-up on export; front faces +Z; origin where the object meets the world.
- **MUST** have applied transforms (scale 1,1,1), no negative scale, no n-gons on a deforming surface.
- **MUST** have **physical thickness** — no single-plane "sheet metal". A panel has an edge.
- **MUST** have bevelled hard edges: 0.3–1.0 mm on moulded plastic, 0.1–0.3 mm on sheet metal. A perfectly
  sharp edge is the single most common tell of a cheap model, because it catches no light.
- **MUST** model, on a hero asset: ports, buttons, vents, seams, screws, the parting line of the mould, and
  the recess a label sits in. Printed legends are geometry or a 2K decal — never painted into an 8K colour map.
- **SHOULD** keep triangle budget: hero ≤ 150k, midground ≤ 40k, background ≤ 8k. LOD1/LOD2 generated by
  glTF-Transform `simplify`, not hand-decimated.
- **MUST** have correct normals (no flipped faces) and no face on an empty material slot
  (`oe_kit.no_orphan_faces` — the library already enforces this).

### UVs and textures
- **MUST** be UV-unwrapped with no overlapping shells except deliberate mirrored halves; texel density within
  ±20 % across an object, and consistent across a set.
- **MUST** be 1K–2K. 4K only for a hero surface that fills the frame. Never 8K.
- **MUST** ship PNG/WebP, power-of-two, with colour maps in sRGB and every other map in Non-Colour.

### Materials (PBR)
- **MUST** be Principled BSDF, glTF metallic-roughness compatible.
- **MUST** be metallic 0 or 1 — never in between except on a genuinely mixed surface.
- **MUST** carry **micro-surface imperfection**: no material is uniformly rough. Plastic gets a fine
  roughness break-up; a touched surface gets fingerprint smear; a floor gets wear where feet go.
- Plastic: roughness 0.25–0.5, IOR 1.45–1.55, a trace of sheen on ABS. Rubber: 0.6–0.85, no specular tint.
  Painted metal: roughness 0.3–0.6 over metallic 0 with a clearcoat — **not** the same shader as raw aluminium.
  Brushed metal: anisotropic. Glass: transmission with real thickness. Screens: emissive with a black level
  that is not 0, and a specular layer so the room reflects in them.
- LEDs: their own mesh and material named `led_<id>`, emission driven by the scene, never baked lit.

### Delivery
- **MUST** have an `asset.json` (the library's existing schema) and a **PROVENANCE.md row before use**.
- **MUST** pass `validate.py` headless: scale, transforms, normals, orphan faces, naming, anchor presence,
  texel density, triangle count, material class, licence row present.
- **MUST** survive a **close-up test render** at 1920×1080 filling 60 % of frame, inspected by eye. An asset
  that has never been rendered close is not accepted.

### Licensing
- The library's existing gate applies unchanged: no NC, no Editorial-only, no unclear licence, no trademark
  without a category-B justification, no redistribution of licensed source files.

---

## 7. CHARACTER STANDARD

A character is production-ready when **all** of this is true. Nothing here is aspirational; each line exists
because its absence shows on screen.

### Identity
- The character is a **named, specific person** with an age, a role, a way of standing, and clothes that a
  teacher in that school would actually wear. "Generic teacher" produces generic acting.
- Represents the audience honestly: Tanzanian secondary-school staff and students, with skin tones,
  hair and clothing designed and referenced — not the default of whatever generator produced the base.

### Mesh
- One base topology shared by every character in the library, so wardrobe, weights, shape keys and
  look-dev transfer. Quads; edge loops around the eyes and mouth; deforming areas have enough loops to bend
  (shoulder, elbow, knee, hip) and no more.
- 25k–60k triangles at LOD0 for a shot that reaches the shoulders; a hero close-up may use subdivision.
- UVs: one shared layout across the library. Hands and face get generous texel density; the back of the
  head does not.

### Rig
- **Rigify or CloudRig** — never a hand-built rig, because a hand-built rig cannot be regenerated.
- IK/FK on arms and legs with a working snap; a foot roll; a hand with individual finger curl controls;
  head/eye aim; a torso with hips and chest separable.
- **A pose is checked against the ground**: feet do not slide, hands do not pass through objects. Contact is
  enforced with constraints (a hand holding a tablet is parented to it, not eyeballed).
- Rest pose is A-pose; a Rigify metarig is kept in the file so the rig can be regenerated.

### Face
- Minimum set of shape keys: the Preston-Blair viseme set (for Rhubarb) plus brow up/down/in, eye
  wide/squint, lid blink (separate L/R), nose crease, cheek raise, mouth corner up/down/wide/narrow, jaw open.
  ARKit's 52 is the target only if a face ever fills the frame.
- **Eyes get their own animation, always.** A blink pattern and a saccade to whatever the character is
  looking at is the difference between a person and a mannequin, and it costs minutes.

### Acting requirements (the part that is usually skipped)
A shot with a character is not accepted unless:
- **Weight**: the body's centre of mass is over the support, and it shifts before the body moves.
- **Anticipation** before any deliberate action; **follow-through** and **overlap** after it.
- **No sliding feet.** Contact frames are held; the foot plants and stays planted.
- **No floating hands.** A hand that touches an object deforms nothing but arrives, contacts, and takes the
  object's weight.
- **Breathing** in every hold. Nothing is perfectly still except a dead device.
- **Eye direction leads the head, the head leads the body.**
- **Emotional restraint.** Concern is a stilled hand and a second press — not raised arms.
- Timing is on twos where it reads better than on ones; a hold is a real hold, not a pause in a loop.

### Delivery
- `character.json`: id, name, role, base version, rig type, shape-key set, wardrobe variants, look versions,
  triangle counts, licence and provenance of every borrowed part.
- Linked into shots as a **library override**, never appended — a fix to the character must reach every shot.

---

## 8. SHOT STANDARD — when a shot may go to final render

A shot passes when **every** line is answered. This is the gate the automation enforces (§9).

It **extends** the four-pass review already in use (`videos/how-a-school-connects-world/REVIEW.md`:
story → direction → frame → engineering), which caught label suppression in close-ups, a label pointing at
mid-air, and a repair shot framed along the plug's axis so a 6.5 mm gap foreshortened to nothing. Those are
character-shot failures waiting to happen; the list below adds the lines a shot with a person in it needs.

**Story**
1. The shot has one job, written in `shots.json`, in one sentence.
2. The action is understandable with the sound off and the captions hidden.

**Composition**
3. There is one focal point, and the eye finds it within half a second.
4. Nothing important sits in the caption band (bottom ~17 %), under the slate (top-left) or the logo (top-right).
5. Foreground, midground and background are distinguishable; the frame has depth, not just objects.

**Camera**
6. The focal length is chosen and recorded (a real body and sensor, not a default 50).
7. Every move answers "what should the learner understand now". A move with no answer is deleted.
8. One move per beat; it decelerates to rest; no idle drift in a hold.
9. Depth of field is motivated and the focus lands on the subject at the frame it matters.

**Animation**
10. Contacts hold. No sliding, no interpenetration, no floating.
11. Anticipation and follow-through exist on every deliberate action.
12. There is breathing and eye motion in every hold.
13. Motion blur is on for any shot that will be seen at speed.

**Look**
14. Key, fill and rim are placed deliberately; the subject separates from the background.
15. Materials respond to light: the screen reflects, the plastic has micro-roughness, the metal is anisotropic.
16. Exposure matches the neighbouring shots; AgX in both renderers (§2.4).

**Technical truth**
17. Every state shown is true of the real system, checked against the code, and `[confirm]`-marked facts are
    confirmed by the owner before render.
18. A light is lit because the link is up. The text names what the picture has already shown.

**Continuity**
19. Props, wardrobe, light direction, time of day and screen content match the neighbouring shots.
20. Anything carried into the shot leaves it in the same state.

**Render readiness**
21. A 25 %-resolution preview of the full shot has been watched end to end.
22. No fireflies, no clipped highlights except deliberate ones, no aliasing on a high-contrast edge.
23. The shot's `route`, sample count, resolution and expected cost are recorded before the job is submitted.

---

## 9. AUTOMATION PLAN (Blender Python)

Everything below is a script in `_studio/lib/oe_studio/`, run headless, in the same spirit as the existing
`verify-*.js` suites — **the standards above are executable or they are decoration**.

| Tool | What it does | Replaces |
|---|---|---|
| `newfilm.py <slug>` | the whole directory tree, `shots.json`, the HyperFrames project | manual setup |
| `shotbuild.py <shot>` | builds `SH_nnn.blend` from `shots.json`: links the set, characters and props as overrides, drops in the named camera rig and lighting rig, sets frame range from the animatic, sets colour management and output paths | hand-assembling every shot |
| `validate.py <asset>` | §6 as code: scale, transforms, normals, orphan faces, naming, anchors, texel density, triangles, material class, provenance row | eyeballing |
| `charcheck.py <char>` | §7 as code: topology counts, rig type, required controls present, shape-key set complete, override-ready | |
| `shotcheck.py <shot>` | the mechanical half of §8: caption-band/slate/logo intrusion, focal length recorded, camera-move-without-purpose flag, contact test (hand-to-prop distance per frame), foot-slide test (planted foot's world delta), exposure vs neighbours | five of the review defects D36 found by eye |
| `preview.py <shot>` | 25 % resolution, low samples, a watchable MP4, in one command | |
| `renderjob.py <shot> --route=R1\|R2\|R3` | writes the job: frame ranges, passes, EXR/Cryptomatte, resume from partial output, cost estimate before it starts | |
| `farm.py up/down` | rents the GPU, syncs the project, runs the job, pulls the frames, **destroys the instance** | forgetting a rented instance is the only way to waste real money |
| `comp.py <shot>` | the compositor graph from passes, per-shot, saved as a node group | |
| `qc.py <shot>` | black frames, frozen frames (hash equality across time), firefly detection (outlier luminance), clipping histogram, first/last-frame contact sheet | |
| `contactsheet.py <seq>` | every shot's middle frame and both sides of every cut, tiled — exactly what `world-sheet.mjs` does for the 3D world, which is how D40's four worst bugs were found in minutes |
| `toglb.py <shot>` | bakes an R1 shot's animation to GLB for the OE3D runtime, with the anchor naming preserved | |
| `prepush` addition | `validate` + `charcheck` + `shotcheck` + `qc` on anything changed, as a gate | |

Two rules borrowed from this repo's culture, because they are the reason it works:
**rendered frames are the evidence, not the build** (D36.6), and **the world is proved before the film is
built on it** (D40.9).

---

## 10. PILOT — "The tablet that will not wake"

**46 seconds, 10 shots, 2 sequences.** Not 10 minutes. The pilot exists to prove the *system*, and everything
that can go wrong will go wrong in the first 46 seconds as thoroughly as in ten minutes, for a twentieth of
the cost. It is also deliberately built so that **it can be finished entirely on route R1** if the owner
declines GPU rental — the Cycles version is then an upgrade, not a rescue.

**Environment:** one classroom, morning, dry season. Windows on camera-left, louvred, so the key is a big soft
wrap from one side; hard sun patches on the floor, not on faces. Concrete floor, painted block walls to
chair-rail height, wooden desks with steel legs, a noticeboard, a chalkboard, one wall socket with a four-way
adaptor, exercise books. Controlled imperfection: chalk dust, scuffed desk edges, one chair out of line.

**Characters:** *Asha*, teacher, mid-30s (hero). Four students, background, mid-distance only.

| # | Shot | s | Purpose | Camera / lens | Action & acting | Light | Assets | Animation | Route | Sound |
|---|---|---|---|---|---|---|---|---|---|---|
| **SEQ_010 — CLASSROOM** |
| 010 | Establish | 5 | where we are, before a word is said | static, slow 3 cm push, **28 mm**, camera 1.35 m (seated eye height) | empty frame; dust in the window light; a student's hand turns a page at the edge | window key, bounce off the floor, no fill from camera | set_classroom, desks, books | GN scatter; one hand cycle | **R3** (hero) | room tone, distant playground, one bird |
| 020 | Asha enters | 6 | a person with weight and purpose | tracking behind, **35 mm**, dolly 1.2 m, decelerating | walks in carrying books against the hip; the load is visible in the shoulder line and the shorter stride on the loaded side | key from the windows crosses her as she passes | chr_asha, prop_books | CMU walk as base, hand-keyed carry + arrival | **R3** | footsteps on concrete, door, cloth |
| 030 | Books down | 4 | weight, contact, a real hand | **50 mm**, static, waist-high, slight low angle | books land; the stack settles 2 mm; her hand stays a beat before releasing | same key, a practical from the window sill | prop_books, prop_desk | hand-keyed; contact constraint | **R3** | book thump, paper settle |
| 040 | Picks up the tablet | 5 | the subject of the film enters her hands | **85 mm**, static, over-shoulder | fingers find the edge; the tablet tips up into the grip; the weight transfers | key wraps the tablet face; rim from the window separates it | prop_tablet (hero), chr_asha hands | hand-keyed, parented at contact | **R3** | plastic-on-wood, cloth |
| 050 | The power button | 4 | **the story beat** | **100 mm macro**, static, f/2.8, focus on the button | the thumb presses, holds 1.2 s, releases. Nothing. | one hard-edged specular from the window along the bevel | prop_tablet, hand | hand-keyed; the press deforms the thumb pad | **R3** | a real button click, then silence — the silence is the point |
| 060 | The black screen | 3 | the reaction, without a face performance | **85 mm**, static, screen fills frame | her reflection in the dead glass is the only image; it holds still, then tilts as she turns the device | key reflected; the screen's black level is not 0 | prop_tablet | reflection is the character's own motion | **R3** | room tone alone |
| 070 | Second press, then the charger | 5 | a person checking, not panicking | **50 mm**, a 20 cm truck left as she reaches | presses again; waits; reaches for the cable; seats the plug; looks | same | prop_charger, prop_socket | hand-keyed; plug seat is mechanical | **R3** | cable, plug seat, a chair |
| 080 | She turns to the other device | 4 | the hand-off to the system | **35 mm**, static, she crosses to frame-right | sets the tablet down (still dark), wakes the laptop, opens the support form | screen light becomes a second key on her face | prop_laptop, set | hand-keyed | **R3** | keys, chair |
| **SEQ_020 — WHAT THE SYSTEM DOES** (the existing engine, unchanged) |
| 090 | Into the screen | 6 | the physical becomes the technical | push into the laptop screen until the frame **is** the screen; a silhouette match hands over to the OE3D world (D39 rule 1) | the report leaves the tablet → AP → router → modem → **or does not leave at all, and waits in the tablet** | OE3D studio rig, AgX | hardware-3d library, school-network graph | OE3D, pure function of t | **R1** | the engine's existing data motif |
| 100 | It lands on a person | 4 | the truth: it rings the **school administrator's** bell, not a distant technician (§1.3) | pull back from the notification to the queue | one row appears in a list; the priority is visible | 2D overlay on the 3D world | existing | OE3D + overlay | **R1** | one soft notification tone |

**Transitions.** 010→020 cut on movement. 040→050 cut on the hand's arrival. 050→060 cut on the release.
080→090 the only dissolve in the film, and it is a match, not a fade. 100 → the closing rule card, as the
series already does.

**What the pilot is testing:** whether a character can be built, rigged, acted, lit and rendered to the
standard in §§6–8 by this system at all; whether R3 frames and R1 frames cut together after the AgX fix;
whether `shotbuild`/`shotcheck`/`qc` catch what a human reviewer catches; and what a finished minute actually
costs in hours and dollars.

---

## 11. RENDER STRATEGY

### 11.1 Three routes, and the rule for choosing

| Route | Engine | Cost/frame here | Use for |
|---|---|---|---|
| **R1** | OE3D / three.js in HyperFrames | **~0.33 s** (measured: 4,350 frames of finished 1080p60 film in ~24 min) | the technical world, hardware, system views, overlays, data flow, **and stylized character shots once the look is developed** |
| **R2** | Blender EEVEE | ~91 s at 540p **here** — only viable on a GPU | previews and look-dev **on a GPU machine**; not a production route on this laptop |
| **R3** | Blender Cycles, **rented GPU** | ~$0.30–0.60/hr; ≈8 GPU-hours for a 60 s pilot ⇒ **$3–6** | physical shots with people, real depth of field, soft shadows, volumetric light through a window |

**The rule:** a shot goes to R3 only if it needs something R1 cannot fake — true global illumination in a room,
real defocus, volumetrics, or a hero surface at macro distance. Everything else is R1. A route is recorded in
`shots.json` before work starts and changing it is a decision, not a drift.

### 11.2 The three stages

1. **Preview** — 480×270, 8–16 samples, no motion blur, EEVEE or R1. Watched end to end. Minutes.
2. **Review** — 960×540, 64 samples, denoised, motion blur on, real materials, into a cut with sound. This is
   the version the owner approves. Hours on a rented GPU; free on R1.
3. **Final** — 1920×1080, adaptive sampling to a noise threshold (not a fixed sample count), OIDN, EXR half
   DWAA with Combined + Cryptomatte + Depth + Mist, then comp. **Resumable**: every frame is a file, and a job
   that dies restarts at the missing frame.

### 11.3 Discipline that costs nothing and saves days

Persistent data on; adaptive sampling with a noise threshold; light linking so the rim light touches only the
subject; volumetrics only in the shots that show a light shaft; simplify/subdivision limits driven by camera
distance; **never render what the camera cannot see** — a shot file links only what is in frame plus what
casts into it; render at 100 % resolution once, never "at 200 % to be safe".

On R1 the budget is different and worth stating, because it is counter-intuitive: the existing film is
4,350 frames over 7 models totalling ~490 KB with **no textures at all**, and its cost is dominated by
**shot count and shadow-map size, not polygon count**. A character in R1 therefore pays for itself in
shadow resolution and draw calls, not in triangles — which is the opposite of the instinct an offline
renderer trains.

### 11.4 The hardware question, stated plainly

This laptop cannot finish a path-traced film. Three honest options:

| Option | Cost | Verdict |
|---|---|---|
| **Rent a GPU per job** (Vast.ai/RunPod, RTX 4090) | ~$0.30–0.60/hr, ≈$3–6 per finished minute | **Recommended.** No capital, no maintenance, scales to a deadline, and `farm.py` destroys the instance so it cannot bleed money. Sensitive scenes stay under your account, unlike SheepIt. |
| **Buy a GPU workstation / eGPU** | capital | Only worth it above roughly 40–60 finished minutes a year, and it also fixes look-dev, which rental does not. Worth revisiting after the pilot gives a real hours-per-minute figure. |
| **Stay CPU-only and route everything to R1** | 0 | **Genuinely viable** for this series, and the pilot is built so it can be delivered this way. The ceiling is a real-time renderer's ceiling: no true GI, no real defocus, simpler shadows. |

### 11.5 Determinism

R1 is deterministic by construction and now proven for skinned characters. Cycles is deterministic per frame
for a fixed seed and sample count, but **adaptive sampling plus a different thread count can change a frame**
— so a re-render on a different rented machine is not guaranteed identical. Therefore: a shot is rendered once,
in one job, and the **frames are the artefact** that goes into the edit. Never re-render half a shot elsewhere.

---

## 12. BLENDER ↔ HYPERFRAMES STRATEGY

**HyperFrames remains the master.** It owns the timeline, captions, brand furniture, the audio mix and the
loudness pass, the QC gate and the final MP4. Blender never produces a finished film.

Two ways Blender output enters, and a rule for which:

| | **Live (R1)** | **Baked (R2/R3)** |
|---|---|---|
| What crosses | `.glb` — geometry, skin, animation clips, anchors | an image sequence → one high-bitrate clip per shot |
| Played by | `mixer.setTime(t)` / the engine's clock setter | a `<video>` clip with `data-start`, muted, on the shot's track |
| Determinism | pure function of t (**proven today**) | frames are fixed files |
| Cost | ~0.33 s/frame on the measured finished 1080p60 film, free | $3–6 per minute of screen time |
| Good for | hardware, system views, stylized characters, anything that must respond to the timeline | rooms, people in light, defocus, volumetrics |
| Constraint | no rAF, no `Date.now()`, no randomness — the engine's existing rule | the shot is locked; a change means a re-render |

**The hand-over between them is D39's silhouette rule, unchanged**: match the framing and the lens across the
cut, hand over on a held frame, and only then let the camera move. With §2.4's AgX fix, the two renderers
agree tonally and the hand-over becomes invisible rather than merely quick.

**What must never happen:** a second edit in Blender's VSE that races the HyperFrames timeline; captions burned
into a Blender render; audio mixed anywhere but HyperFrames. One timeline, or the loudness, the captions and
the brand furniture drift apart across a series of 26 films.

---

## 13. RISKS / LIMITATIONS

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **No GPU.** Path-traced production is impossible on this machine. | Critical | §11.4 — rent per job, or route everything to R1. Decide at Gate 1. |
| 2 | **Character quality is the highest-variance part of the plan.** Bad acting or a dead-eyed face will make the film worse than the existing 2D/3D work. | High | §2.1 stylized + hands-first; §7 acting checklist; Gate 3 approves a single character before any second one is built. |
| 3 | **Scope.** "5–10 minutes" at this quality is a multi-month commitment per film, and there are 26 fault types. | High | A 46-second pilot; a length decision only after the pilot's real hours-per-minute is known. |
| 4 | **Licence traps** — AMASS, Cascadeur free, GVHMR weights, Mixamo redistribution, Megascans now paid, GrabCAD non-commercial. | High | §1.2 table; the library's existing licensing gate; PROVENANCE row **before** download. |
| 5 | **Tonal mismatch between the two renderers** (§2.4). | Medium | AgX both sides, proven with a two-frame comparison before the pilot. |
| 6 | **Technical lies for cinematic reasons** — the brief's own example already contains one (§1.3). | Medium | Storyboard from the code; `[confirm]` markers; the `verify-workflows.js` discipline. |
| 7 | **A rented instance left running.** | Medium | `farm.py` destroys it; never start one by hand. |
| 8 | **Add-on breakage** — Python 3.13 broke many add-ons in the 5.1 line. | Medium | Pin Blender 5.2.x; verify each add-on on 5.2; record the version. |
| 9 | **Bus factor of one.** | Medium | Everything is a script in git; no manual step that is not reproducible. |
| 10 | **Real schools, real people.** A recognisable school or child in a film is a consent question, and SheepIt would send that scene to strangers. | Medium | Characters are designed, never modelled from a photo of a real child; no SheepIt for any film with people. |
| 11 | **Blender re-render determinism** (§11.5). | Low | Render a shot once, keep the frames. |
| 12 | **Disk.** EXR sequences are large — a 46 s pilot at 1080p half-float with passes is roughly 15–25 GB. | Low | 113 GB free; EXRs are `.gitignore`d; only the encoded shot clip is kept. |

---

## 14. WHAT REQUIRES HUMAN CREATIVE APPROVAL

1. **The visual direction** (§2.1): stylized-realism characters + true hardware, and the hands-first discipline.
2. **Whether people appear at all.** A serious alternative is a series with no characters, which the existing
   engine already does well. This is the owner's call about what the audience needs.
3. **Character design** — Asha's design, age, wardrobe, and how the school and its students are portrayed.
   This is a representation question about real Tanzanian schools and it is not mine to decide.
4. **The render-capacity decision** (§11.4).
5. **Film length** and how many of the 26 fault types get the cinematic treatment rather than the existing
   engine's treatment.
6. **Any `[confirm]` fact** before it is animated.
7. **Whether the pilot replaces or complements the three existing prototypes** — SERIES.md says two of the
   three will be deleted once one is chosen; this proposal adds a fourth axis and that decision now has four
   options, not three.
8. **Budget authority** for a Vast.ai/RunPod account, and its cap.
9. **The deployed hardware list** — the actual router, switch, access point, UPS, charging hub and LRS in
   OE's schools, with a front and rear photo of each. This is the open blocker the engine's author named, and
   only the owner can answer it. Without it every asset stays **category A** (generic) and a film can never
   show a teacher the device that is really in front of them. A pilot with a person in it makes this sharper,
   not softer: the tablet in Asha's hands should be the tablet the schools actually have.

## 15. WHAT I CAN EXECUTE AUTONOMOUSLY (after Gate 1)

1. The whole `_studio` scaffold, the Python package, and every tool in §9.
2. The AgX alignment and its two-frame proof (with the engine owner's agreement — it is their file).
3. Sets, props and environment dressing as procedural Blender scripts, to §6, with provenance rows.
4. The camera-rig and lighting-rig kits.
5. Geometry Nodes systems: cables, desk scatter, wear, book stacks.
6. Storyboard and animatic **as drafts** for review.
7. Rigging, and the mechanical layer of animation (contacts, foot plants, prop constraints).
8. Every check, gate and contact sheet; every preview render; the render driver and the farm lifecycle.
9. Sound design assembly from CC0 libraries, and the mix into the existing HyperFrames pipeline.
10. All documentation, provenance and licence records.

I will **not**, without asking: install anything (§5), spend money, download a licensed asset, publish a film,
touch `videos/_engine` or any path another session holds, or decide how Tanzanian teachers and students are
portrayed.

## 16. UNKNOWN-UNKNOWNS DISCOVERED

Things that were not in the brief, and change a decision:

1. **The real-time engine on disk can carry characters deterministically** — measured today. This removes the
   render farm from most of the plan and is the largest single finding.
2. **EEVEE is slower than Cycles on this machine.** The standard "use EEVEE for speed" advice is wrong here.
3. **`BLENDER_EEVEE_NEXT` no longer exists**; the id reverted to `BLENDER_EEVEE`. Any script written against
   4.2 silently picks the wrong engine.
4. **Blender 5.x removed `Action.fcurves`** (slotted actions) and moved `use_persistent_data` to
   `scene.render` — both broke scripts I wrote today. Old Blender-Python recipes on the internet will not run.
5. **AgX vs NeutralToneMapping** — the two renderers do not currently match (§2.4).
6. **Cascadeur's free tier is non-commercial**, which is the opposite of how it is usually described.
7. **AMASS is non-commercial**, and most modern video-to-motion research (GVHMR, WHAM) inherits
   non-commercial weights and the SMPL licence. The free AI-mocap route is largely closed for commercial use.
8. **CMU mocap is unrestricted** and is therefore worth more than every newer free option.
9. **Megascans stopped being free at the end of 2024** and new packs left Quixel Bridge at the start of 2026.
10. **NVIDIA open-sourced Audio2Face** (Sept 2025) — the best free facial-audio model now exists, with no
    Blender integration and an NVIDIA GPU requirement. Worth revisiting if a GPU is ever bought.
11. **Blender 5.2 supports online asset libraries** — a shared studio library can be hosted and pulled on
    demand, which changes how a multi-machine setup would work later.
12. **SheepIt's real cost is confidentiality**, not money: the scene file goes to anonymous volunteers.
13. **AI video models still garble on-screen text**, which disqualifies them for this genre specifically.
14. **Blender ships as a pip module (`bpy`)**, so asset and shot checks can run in ordinary CI without a
    Blender install — the same pattern as this repo's `verify-*.js` gate.
15. **Blender Studio's Rain/Snow/Storm rigs are CC-BY** and are the best available reference for what a
    production rig must contain.

## 17. NEXT APPROVAL GATE — Gate 1 (FROZEN)

**Owner decision, 2026-09-26:** freeze this proposal; finish the existing 72-second film as the internal
quality benchmark; only then begin Gate 2 character/art direction. Nothing is installed, nothing is built,
and no money is spent under this proposal while it is frozen.

1. **Direction** — approve, amend or reject §2.1 (stylized-realism people, true hardware, hands-first).
2. **People** — do these films have characters at all, or does the existing engine's language stay?
3. **Render capacity** — rent a GPU per job (≈$3–6 per finished minute), buy a machine, or stay CPU-only and
   deliver on R1?
4. **Pilot** — approve §10's 46-second shot list, or change it.
5. **Scope** — how many of the 26 fault types are cinematic, and how long is a cinematic one?
6. **Installations** — approve the §5 list (all free) before anything is downloaded.

On approval, Gate 2 is **art direction**: reference boards, the classroom set look-dev, and Asha's design —
before a single frame is rendered and before any second character exists.
