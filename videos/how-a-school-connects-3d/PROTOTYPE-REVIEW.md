# D39 prototype — hybrid 2D + real 3D: technical review

**Question for the owner:** does the hybrid approach improve clarity and production quality enough to become part
of the OE Motion Design System? This document is the evidence. Decision record: DECISIONS.md D39.

**Deliverable:** `renders/video.mp4` — 1920×1080, 60 fps, 83.6 s, −16 LUFS (full quality, ~31 MB) and
`renders/video-phone.mp4` (same picture, 14 MB, for sharing). The polished 2D film it upgrades is
`../how-a-school-connects/renders/video.mp4` (72.5 s): everything outside 0:48–1:07 is that film, unchanged.

## What changed — one section only

| Shot | Time | What the learner sees |
|---|---|---|
| A — fault identified | 0:40 | unchanged 2D: FAULT DOMAIN, router WAN ↔ modem |
| B — enter physical view | 0:48 | the 2D camera pushes to the drawn router; at the matched framing the real router fades in *on top of it*, same face, same place |
| C — orientation | 0:50 | the camera swings to three-quarter (the long lens widens, so the flat drawing gains depth); callouts: STATUS LIGHTS · LAN PORTS · WAN PORT |
| D — WAN close-up | 0:56 | the WAN port: WAN LIGHT: OFF (no link); CONNECTOR not fully seated (out 6.5 mm, sagging 7°) |
| E — repair | 0:59 | the plug straightens and is pushed home; the latch presses and springs into the notch; click |
| F — link negotiation | 1:00 | the WAN light stays dark ~2 s (auto-negotiation), then LINK UP, then flickers with traffic; INTERNET red → amber → green |
| G — back to the system | 1:04 | the camera returns to the matched framing; the drawing (already in the repaired state) takes over; the first packet crosses the reseated cable |
| H — verification | 1:08 | unchanged 2D: REQUEST chain, RESPONSE chain, CONNECTIVITY VERIFIED |

## Reviews

**A. Full screen.** The hardware reads as believable product-visualisation: soft studio light, a rim that separates
a dark device from the dark ground, soft contact shadow, the drawing's grid continuing as the floor. Ports, lights,
icons and printed legends are sharp at 1080p.

**B. Small screen (640×360).** The WAN port, the plug and the WAN light's state are identifiable at phone size.
*Correction made:* callout labels were 22 px (≈7 px on a phone, unreadable) → 30/24 px.

**C. Muted.** The repair reads without narration: the plug visibly stands out, goes home, and the light comes on.
*Correction made:* at 4.5 mm out the loose plug read as "in" on a phone; it now sits 6.5 mm out and sagging, which
is also what an unlatched plug does.

**D. Frame review.** No clipping, no cable penetration, no z-fighting, no bad reflections. *Corrections made:*
1. **Accuracy:** each callout's anchor dot took the callout's colour, so "WAN LIGHT: OFF" put a **red dot on the WAN
   light** — it looked lit red. Anchors are now hollow neutral rings.
2. The connector callout collided with the captions; it now sits beside the plug.
3. The hand-over was 190 px off vertically (a sign error in the framing); it now lands exactly on the drawing.
4. Earlier, in the asset test: icons had been pulled inside the body, LED halos were cut into wedges by the panel,
   and gloss on the bevel read as a light-bar — all fixed at the source.
5. A syntax error in the layer's script froze the **whole** film at t=0 without failing the build. `make.mjs` now
   refuses a layer whose script does not parse.

## What worked

- **The silhouette hand-over.** Because the 3D router is built to the 2D router's exact layout, the long-lens front
  view lands on the drawing: the transition reads as the drawing *becoming* the object, not as a cut to a different
  video. The return mirrors it.
- **Teaching the physical check.** The close-up answers questions the drawing cannot: which hole is WAN, what a
  half-seated plug looks like, where its light is, what "comes on" looks like.
- **Determinism.** The 3D scene is a pure function of the layer's own timeline (a clock setter GSAP drives on every
  seek). Snapshots taken out of order and the render agree.
- **No network at render.** three.js is bundled with the runtime; models are local GLBs. (jsdelivr failed TLS twice
  on the day — GSAP itself still comes from a CDN in the frames; vendoring it is recommended.)
- **Clean licensing.** The hardware is ours: no third-party geometry, textures or trademarks.

## What did not, or not yet

- **Length.** The physical section costs ~11 s more than the 2D repair (83.6 s vs 72.5 s). The orientation shot
  (status lights, LAN, WAN) is most of it; it teaches layout, but it is the first thing to trim if pace matters.
- **One generic device.** Real OE schools will have specific routers. For a teacher, the *real* model is worth more
  than a well-made generic one — that is category B, and it needs the deployed model list.
- **The 2D ↔ 3D cables differ.** The drawing's cables hang as grey curves; the 3D cables are blue patch cords. The
  crossfade hides it, but a close watcher sees the cable change colour at the hand-over.
- **Render cost** (below) rises with 3D, but not enough to matter.

## Render performance

Full film: 83.6 s at 60 fps (≈5,000 frames) rendered in **14–17 minutes** on this laptop (two renders) (Intel HD 620 GPU,
hardware WebGL), then the two-pass loudness step. Asset weight: router 129 KB, plug 16 KB, runtime 802 KB (once per
page). One WebGL context, 2K shadow map, ~11k triangles + two generated cables.

## Visual consistency

Same slate, logo, scrim, captions and colour language as the 2D film; the 3D layer repeats the furniture so the
cut is invisible. OE colours live only in the callouts and highlights; the hardware keeps believable charcoal
plastic, gold contacts, a blue patch cord and a printed blue WAN surround (a common real convention).

## Licensing

No external models used. Candidates evaluated and excluded, with reasons: `_engine/hardware-3d/RESEARCH.md`.
Records: `_engine/hardware-3d/PROVENANCE.md`. Fonts: DM Sans / DM Mono (OFL). three.js (MIT, notice kept in the
bundle).

## Did 3D meaningfully improve learning?

**For the physical moment: yes.** "Push the WAN plug in until it clicks" is an instruction about an object; seeing
the port, the half-seated plug and the dark light answers "which one, and how will I know" in a way the drawing
only symbolises. **For the system: no, and it should not be used there** — topology, fault domain and the
request/response proof are clearer in 2D, which is why they stayed 2D.

**Recommendation:** adopt the hybrid for hands-on moments only (inspect, reseat, identify a light or port), keep it
under ~12 s per episode, and prioritise category-B twins of the hardware OE actually deploys.
