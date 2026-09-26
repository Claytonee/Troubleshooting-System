---
format: 1920x1080
duration: 30s
message: "Every packet crosses four links on its way out of school; when one breaks, you check them in order and the fault shows itself."
arc: how-to-process
audience: "Teachers and school ICT admins in Tanzania"
mode: autonomous
music: none
fps: 60
---

# How the school connects

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

**This episode's stage.** Computer → Ethernet cable → switch → router → provider → the internet, left to right. The four links counted: ① cable, ② switch, ③ router, ④ provider line (the one that breaks).

## Frame 1 — No internet in the lab

- scene: Tight on the dead screen; one anchored zoom-out to the whole chain; the four links numbered.
- voiceover: "No internet in the lab? The fault is in one of four links."
- duration: 4.744s
- transition_in: cut
- status: animated
- src: compositions/frames/01-no-internet.html
- type: hook
- persuasion: Pain validation + frame-then-fill
- beat: Recognition + curiosity
- blueprint: zoom-out-workspace-reveal (Adapt)



## Frame 2 — The path a packet takes

- scene: The camera follows the packets; each device lights and gets its label as it is named.
- voiceover: "Your computer sends packets, down the cable, to the switch, through the router, to your provider, and out to the internet."
- duration: 8.752s
- transition_in: cut
- status: animated
- src: compositions/frames/02-the-path.html
- type: product_intro
- persuasion: Progressive disclosure + causal chain
- beat: Clarity + momentum
- blueprint: spatial-pan-stations (Adapt)



## Frame 3 — One link breaks

- scene: The provider line snaps; packets die at the gap; the camera goes to the consequence.
- voiceover: "When one link breaks, the packets stop right there."
- duration: 3.741s
- transition_in: cut
- status: animated
- src: compositions/frames/03-link-breaks.html
- type: pain_point
- persuasion: Counterexample + before/after
- beat: Tension
- blueprint: camera-journey (Adapt)



## Frame 4 — Check the links in order

- scene: Four numbered checks under the links flip one per word; the provider flips red; the dark light is pointed at.
- voiceover: "Check them in order, from the computer out. Cable. Switch. Router. Provider. The first dark light is your fault."
- duration: 9.552s
- transition_in: cut
- status: animated
- src: compositions/frames/04-check-in-order.html
- type: feature_showcase
- persuasion: Signposting + numbered enumeration
- beat: Focus + aha
- blueprint: agent-progress-theater (Adapt)



## Frame 5 — Back online

- scene: The line mends, the check turns green, flow resumes, the screen says Connected, the lesson card lands.
- voiceover: "Fix that one link, and the school is back online."
- duration: 5.127s
- transition_in: cut
- status: animated
- src: compositions/frames/05-back-online.html
- type: cta
- persuasion: Callback + distillation
- beat: Satisfaction + resolve
- blueprint: camera-journey (Adapt)


