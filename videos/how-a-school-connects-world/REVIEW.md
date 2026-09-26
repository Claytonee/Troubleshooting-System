# D40 — 3D-first: the same film, rebuilt in one technical world

**Question for the owner:** the hybrid prototype showed that the 3D hardware sequence was stronger than the
drawn hardware around it. This film takes that to its conclusion — no drawn hardware at all, one continuous
3D world, the camera doing the explaining. **Which production system is the series built on?**

Three films, same script, same voice, same length, three systems:

| | Film | Length | What it is |
|---|---|---|---|
| 2D | `../how-a-school-connects/renders/video.mp4` | 72.5 s | the directed drawing (D38) |
| hybrid | `../how-a-school-connects-3d/renders/video.mp4` | 83.6 s | the drawing, with the repair on real hardware (D39) |
| **3D-first** | `renders/video.mp4` | **72.5 s** | **this one: one world, camera-led (D40)** |

The scripts are identical word for word, so anything you notice is the production system, not the writing.

---

## What the rebuild changes

**Nothing is drawn.** The computer, the switch, the router, the provider's modem, the connectors and the
cables are real models from `_engine/hardware-3d/`, standing in one space on one table. 2D carries only what
is *information*: the labels, the numbered status list, the closing rule, the captions, the slate and the
logo.

**The camera is the explanation.** The same router that is 150 px wide in the system view is the one the
film later inspects at 12 cm — there is no cut to another style, no hand-over, no second drawing to keep in
sync. Shots are semantic (`topology()`, `devices([…])`, `port('router.wan')`), not coordinates.

| Shot | Time | What the learner sees |
|---|---|---|
| A — symptom | 0:00 | the real screen: *No internet*; the camera eases back to the whole desktop |
| B — the path | 0:05 | the camera pulls back to a near-orthographic system view; each device is named where it stands |
| C — the two kinds of port | 0:13 | in on the router: LAN ports face the school, the WAN port faces the provider |
| D — no way out | 0:18 | a request runs to the router, pushes into the WAN cable, dies, tries again; the WAN light never comes on |
| E — check in order | 0:25 | the camera travels the path: computer port ✓, switch port ✓, router LAN ✓, router WAN ✗ |
| F — fault domain | 0:40 | router and modem held together, the rest of the world quiet |
| G — the repair | 0:48 | the WAN port at 12 cm: the connector stands proud and sags; it is straightened, pushed home, the latch clicks |
| H — link, then service | 0:52 | the WAN light stays dark while the link negotiates, then lights; INTERNET goes red → amber → green |
| I — verify | 0:56 | back to the system view: a request goes out, an answer comes back, the path turns green |
| J — the rule | 1:05 | the whole network calm, one round trip still running, one line of text |

**Data is a light inside the cable** — a shader on a sheath around the tube, travelling at the speed the
schedule gives it. There is no dot flying above the hardware.

**The hardware fails before the text does.** The light stops at the WAN, twice; the WAN light stays dark;
the modem's LAN light stays dark. Only then does *NO PHYSICAL LINK* appear.

**Physical link is not service.** The provider's modem keeps POWER, LINK and INTERNET lit throughout: its
line is synchronised and the service beyond it is up. Only its LAN light — the one facing the loose cable —
is dark. A teacher must not learn to read a loose cable as an outage.

---

## Reviews

Four passes over the rendered film, and what each one changed. Every correction below was made and
re-verified before the delivered render.

### A. Full screen

The world holds together: one space, one light, believable materials, and no seam anywhere — the system
view, the port inspection and the repair are visibly the same objects. Printed legends (POWER, INTERNET,
WI-FI, LAN, 1–4, WAN, PROVIDER) are sharp at 1080p, the LEDs read as lights rather than coloured dots, and
the cables land in real ports.

*Corrections made:*
1. **The signal's failure was nearly invisible.** The light pushed 5 cm into a 40 cm cable inside a sheath
   only 1.4× the cable's own radius: at medium range that is a pale sheen. The travelling light now has a
   floor on its width (`signalWidth ≥ 1.6× the cable`) and pushes 11 cm — it visibly leaves the WAN port,
   travels, and dies.
2. **The retries were timed to the schedule, not to the narration**, so "this one doesn't get out" played
   over a still picture. The attempts are now timed to the words.
3. **The camera's rear-port shot was a black field with a lit port in it.** A close-up has no room in frame
   for the floor or the other devices to bounce light back; the fill now rises as the shot tightens, and that
   shot is framed 6 cm wider.
4. **The provider's INTERNET light went amber the instant the plug seated** — before the link existed. It now
   waits for the WAN light, which is the whole distinction the film teaches.

### B. Small screen (640×360)

Checked at the size a teacher will actually watch it. The hardware, the ports, the plug's gap, the WAN light
and the 30 px tag labels all read. *Correction made:* the numbered check labels were 20 px — under 7 px on a
phone, unreadable, and they carry the most important content in the film. Title 26 px, number 23 px, the
verdict 27 px, with the verdict moved clear of the title's box.

### C. Muted

With the sound off the physical story still runs: dead screen → the path → the light stops at the WAN → four
checks, three lit and one dark → a connector standing proud of its port → pushed home → the light comes on →
a round trip → the whole path green. Corrections A.1–A.2 exist because of this pass: before them, the single
most important beat — the failure — did not exist without the narration.

### D. Frame review (ports, cables, lights, labels, collisions)

No clipping, no cable passing through a device, no z-fighting, no mirrored or default-material surfaces. The
LED states are internally consistent frame by frame, and the modem's LINK and INTERNET stay lit throughout.

*Corrections made:*
1. **Every label was being silently suppressed in the close-ups.** The "keep off the subject" box covered the
   whole frame when the subject *was* the frame, so no position ever fitted: a box larger than 42% of the
   frame is now ignored, and labels have a second, further-out ring of positions to try.
2. Three labels were placed over the provider's white modem or off the frame edge; they now sit on the
   router's dark face.
3. The closing rule was written across the hardware; it moved to the empty band above it, and
   *CONNECTIVITY VERIFIED* now clears out before it — one message at a time.
4. The fault-domain label pointed at a spot in mid-air; it points at the cable itself.
5. The repair shot was framed along the plug's axis, which foreshortens a 6.5 mm gap to nothing, and cropped
   the status row to half a word. It is now 46° off-axis and aimed below the row.

**Left as it is:** `canvas_content_at_edge` warnings at 20–36 s. In a close-up the subject fills the frame by
design; that check is written for 2D compositions.

---

## Engineering

- **The network is a graph** (`_engine/lib/school-network.mjs`): devices, ports, connections and the order a
  person checks them. Cables, plugs, the signal's route, the status list and the fault domain all read the
  same definition, so the picture and the troubleshooting order cannot drift apart.
- **The world runtime** (`_engine/three/src/world.js`): world, cables with plugs generated from port anchors
  and normals, the signal tracer, the semantic camera rig, emphasis by dimming, collision-aware labels.
- **One call scales the shot** (`OE3D.shoot`): camera, shadow camera, how far the floor reaches, halo size,
  signal width. A shot cannot set one and forget another.
- **The lighting rig follows the camera**: the key is always three-quarters to the viewer's left and above.
- **Determinism**: nothing reads a clock. The scene is a pure function of the layer's own timeline.
- **The world sheet** (`_engine/tools/world-sheet.mjs`) proves the world before any film is built on it.

## What it cost

- **Render:** 72.5 s at 60 fps (4,350 frames) in **~23 minutes** on this laptop (Intel HD 620, hardware
  WebGL), plus the two-pass loudness step. Every one of those frames is a 3D render, where the hybrid was 3D
  for 20 s of its 83.6 — and it takes about half as long again as the hybrid's whole film (14–17 min), not
  several times as long, because the scene is small and the shadow map follows the shot instead of covering
  the whole table.
- **Weight:** 7 models, ~490 KB of `.web.glb` all together (the heaviest is the internet globe at 96 KB),
  plus the 817 KB runtime, once per page. No textures anywhere: every legend is geometry.
- **Scene:** ~59k triangles of hardware plus the generated cables and their lit sheaths (each cable is rebuilt
  at ~220 segments per metre, so the four together are of the same order again); one WebGL context, one 2048
  shadow map that follows the shot.
- **Authoring:** the whole film is 224 lines of scene code and 159 of spec, on a 680-line runtime. Nothing is
  hand-positioned: the layout, the ports, the cables, the signal's route and the check list all come from one
  80-line description of the network.

## What did not, or not yet

- **The system view is a band.** Five devices in a line across a 16:9 frame leaves the top third empty; the
  labels use it, but a topology with more devices will need a second row or a bend into depth.
- **The tower is a big dark box.** Charcoal plastic at 4% albedo is honest and looks right beside the router,
  but it gives the eye nothing in a wide shot. A real school's machine would be lighter, or beige.
- **One generic set.** Real schools have specific routers. For a teacher the real model is worth more than a
  good generic one — that is category B, and it needs the deployed model list.
- **No fault but this one.** `FAULT` is data now, so a switch fault or a dead port needs a new script and a
  new set of key times, not a new scene — but that is untested until the second episode is built.

## Licensing

Every model is ours: original procedural Blender scripts, no third-party geometry, textures or trademarks
(`_engine/hardware-3d/PROVENANCE.md`, one row per asset, and an `asset.json` in every asset folder). Fonts:
DM Sans / DM Mono (OFL). three.js (MIT, notice kept in the bundle).

## Recommendation

**Build the series on this one.** The hybrid's finding was that the 3D hardware was stronger than the drawing
beside it; the answer to that is not to put them side by side more carefully, it is to stop drawing hardware.
What this rebuild shows:

- **Nothing was lost.** The parts the hybrid review said belonged in 2D — topology, the fault domain, the
  request/response proof — work in the 3D world, because near-orthographic framing plus dimming does what a
  diagram did, on the same objects a teacher will touch.
- **The seam is gone**, and with it the whole class of problems the hybrid had to manage: the matched
  framing, the two cable styles, the hand-over, keeping the drawing and the model in step.
- **It is the same length as the 2D film** (72.5 s, against the hybrid's 83.6 s), because there is no time
  spent introducing the hardware: it was there all along.
- **It is cheaper to author**, not dearer: the network is described once, and the camera does the rest.

**What to decide:** whether episodes 01–25 are rebuilt on this. If yes, the next two steps are the deployed
hardware (category B twins: router, switch, AP, UPS, charging hub, LRS) and a second fault type built by
changing `FAULT` and the script only — which is the real test of whether this is a system or one good film.

**One caution.** The strength here is that the hardware is honest, and honesty is a standing cost: every
model-specific film must state its own manufacturer's meaning for every light, or it teaches a convention
that may be wrong on the device in the room.
