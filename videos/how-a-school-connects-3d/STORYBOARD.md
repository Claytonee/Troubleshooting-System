---
format: 1920x1080
duration: 70s
message: "When the internet stops, follow the signal from the computer outwards and check each link in order: the first failed link is where to investigate; fix it there, then prove it with a round trip."
arc: how-to-process
audience: "Teachers and school ICT admins in Tanzania"
mode: autonomous
music: none
fps: 60
---

# Follow the signal

## Video direction

**The look (every episode, approved by the owner 2026-09-26).** One original technical drawing on a dark
ground (`bg #0f1117`, faint hairline grid) in the upper ~70% of the canvas; captions own the bottom ~17%.
Devices are flat SVG in one line language (strokes `muted`, bodies `surface`, one `primary` stripe) with
status lights. Every frame redraws the same stage in the same positions, so every seam is an invisible
`cut`; only the camera (two nested wrappers: scale about the frame centre, move of the world), the flows
(packets `primary`, electric current `warn`), the lights and the link states change. Healthy = `positive`,
fault = `negative`. The official Opportunity Education logo sits top-right, the series slate top-left, both
fixed to the screen; at the end they hand over to the lesson card (logo, gold rule, one line to remember).

**Motion grammar.** Long-tail eases (`power3.out` entrances, `power2.inOut` camera and travel), never bouncy.
Reveals are paced to the voice: a thing lights, and its label appears, on the phrase that names it (cue times
in `cues.json`). Flows travel the drawn paths on one global clock, so a packet in flight at a cut continues
in the next frame. One camera move per leg, decelerating to rest; the long pull-back is an anchored zoom.
No idle drift in a hold.

**Never.** Stock icons, emoji, photos, bokeh or purple "AI" gradients; glow on anything but a flow; a frame
front-loaded then frozen; floating decoration; text in the caption band; a sentence of the narration
repeated on screen (short pointers only); anyone else's artwork or characters.

**This episode's stage.** One long bench, wider than the screen: computer (monitor + tower with its network port) · cable · switch (8 ports + uplink) · cable · router (LAN 1–4 | WAN, status lights) · WAN cable with a real plug · provider modem · provider line · a web server inside "the internet". The camera travels it; the whole of it is seen only at the end.

## Frame 1 — The symptom

- scene: Macro on the browser: No internet, the network icon badged. The camera eases back to the whole computer: the monitor and the tower with its network port.
- voiceover: "The internet has stopped at school. The computer can't tell you where."
- duration: 5.198s
- transition_in: cut
- status: animated
- src: compositions/frames/01-symptom.html
- type: hook
- persuasion: Pain validation
- beat: Recognition
- blueprint: zoom-out-workspace-reveal (Adapt)

Shot 01 (macro, screen) → Shot 02 (medium, monitor + tower). Held; no labels.

## Frame 2 — Follow the signal

- scene: One packet leaves the tower; the camera tracks it along the cable into the switch (port 3 in, uplink out), along the next cable into the router, then pushes in on the router's two sides.
- voiceover: "So follow the signal. The switch joins the school's computers and passes their traffic to the router, the school's gateway. Its LAN ports face the school. Its WAN port faces the provider."
- duration: 13.362s
- transition_in: cut
- status: animated
- src: compositions/frames/02-follow-the-signal.html
- type: product_intro
- persuasion: Progressive disclosure + causal chain
- beat: Clarity + momentum
- blueprint: spatial-pan-stations (Adapt)

Shots 03–05: tracking right with the packet; arrive at the switch; track to the router; push in on the router face.

## Frame 3 — No way out

- scene: Close on the WAN port: the packet crosses the router to it, pushes out twice and gives up; the WAN light never lights, the INTERNET light fails. Hold. Pull back right: the cable, the modem and the internet beyond are unreachable.
- voiceover: "Every request leaves through it. This one doesn't get out. Nothing gets past the router."
- duration: 6.792s
- transition_in: cut
- status: animated
- src: compositions/frames/03-no-way-out.html
- type: pain_point
- persuasion: Demonstration of the mechanism failing
- beat: Tension → stillness
- blueprint: camera-journey (Adapt)

Shot 06 (close, WAN port; the failure; a held beat of stillness) → Shot 07 (pull back right: the consequence).

## Frame 4 — Check in order

- scene: The camera returns to the computer and walks the path again: at each link light a numbered check appears and resolves; each passed check lights its stretch of cable green; the WAN check fails and the search stops there.
- voiceover: "Check the path in order, from the computer outwards. The computer's link light: on. The switch port: on. The router's LAN port: on. Its WAN port: off. The first failed link."
- duration: 15.287s
- transition_in: cut
- status: animated
- src: compositions/frames/04-check-in-order.html
- type: feature_showcase
- persuasion: Signposting + numbered enumeration
- beat: Focus → aha
- blueprint: agent-progress-theater (Adapt)

Shots 08–11: long pan back to the computer; ① tower link light; follow the cable to ② switch port 3; ③ router LAN 1; ④ WAN: ✕ FIRST FAILED LINK.

## Frame 5 — The fault domain

- scene: Pull back to the router and the modem; the healthy part of the path quietens; a dashed boundary marks the fault domain; the modem's own LAN light is off too; three likely causes appear and the first is chosen.
- voiceover: "So the fault is between the router and the provider's modem. Start with what you can check yourself: the cable."
- duration: 7.552s
- transition_in: cut
- status: animated
- src: compositions/frames/05-fault-domain.html
- type: benefit_highlight
- persuasion: Isolation + ranked causes
- beat: Clarity
- blueprint: compose

Shots 12–13: pull back to router ↔ modem; FAULT DOMAIN; likely causes, the first highlighted.

## Frame 6 — The fix (3D)

- scene: The camera pushes into the drawn router; at the matched framing the real router takes its place and the camera turns to show its depth: status lights, LAN ports, WAN port. It moves in on the WAN port: the connector is not seated and the WAN light is off. The connector is aligned and pushed home; the latch clicks; after a moment the WAN light comes on and flickers with traffic; the INTERNET light searches and turns green. The camera returns to the front; the drawing takes over again and the path beyond wakes up.
- voiceover: "Here is the router itself. Its status lights, the LAN ports for the school, and the WAN port for the provider. Its WAN cable has worked loose. Push it in until it clicks. The WAN light comes on, and the router is back online."
- duration: 19.361s
- transition_in: cut
- status: animated
- src: compositions/frames/06-the-fix.html
- type: feature_showcase
- persuasion: Demonstration on the real object
- beat: Resolve (deliberate)
- blueprint: hybrid 2D→3D hand-over

B push into the drawn router · C 3D orientation · D WAN close-up · E reseat · F link up · G back to the diagram.

## Frame 7 — Verify

- scene: Back at the computer, the quieted path wakes; a test packet leaves and the camera pulls back as it crosses every link to a server on the internet; the answer comes back the whole way; the page loads: CONNECTION RESTORED.
- voiceover: "Don't assume it's fixed. Test it: a request goes out, and an answer comes back."
- duration: 9.078s
- transition_in: cut
- status: animated
- src: compositions/frames/07-verify.html
- type: social_proof
- persuasion: Demonstration (round trip)
- beat: Anticipation → relief
- blueprint: camera-journey (Adapt)

Shot 16: medium on the computer → pull back to the whole bench while the test crosses it and the answer returns.

## Frame 8 — Restore

- scene: The whole bench, healthy: calm two-way flow on every link. The principle lands on the end card.
- voiceover: "Check the path in order. The first failed link shows you where to look."
- duration: 6.908s
- transition_in: cut
- status: animated
- src: compositions/frames/08-restore.html
- type: cta
- persuasion: Distillation
- beat: Confidence
- blueprint: compose

Shot 17: the whole topology, steady; the end card.
