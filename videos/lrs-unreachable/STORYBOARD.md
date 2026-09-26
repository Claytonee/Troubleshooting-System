---
format: 1920x1080
duration: 40s
message: "Quest runs from the LRS inside the school, not from the internet: if the LRS answers, the lesson runs; if it does not, report it as critical."
arc: how-to-process
audience: "Teachers and school ICT admins in Tanzania"
mode: autonomous
music: none
fps: 60
---

# The lesson lives in the school

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

**This episode's stage.** Inside a dashed boundary ("inside the school"): tablet → WiFi → router, then the router forks. The lower road stays inside: switch → the LRS server. The upper road climbs out through the boundary to the internet provider and the internet.

## Frame 1 — The internet is down

- scene: Tight on a tablet that says No internet; one anchored pull-back to the whole school, dim, with the world outside it.
- voiceover: "The internet is down. Can the lesson still run?"
- duration: 4.182s
- transition_in: cut
- status: animated
- src: compositions/frames/01-internet-down.html
- type: hook
- persuasion: Rhetorical question
- beat: Worry + curiosity
- blueprint: zoom-out-workspace-reveal (Adapt)



## Frame 2 — Two roads

- scene: WiFi carries a packet to the router; the router forks; the camera follows the inside road to the LRS, then climbs the outside road to the internet.
- voiceover: "Your tablet reaches the router over WiFi. From there, two roads. One stays inside the school, to the LRS, where Quest lives. The other goes out to the internet, only to sync your work."
- duration: 13.111s
- transition_in: cut
- status: animated
- src: compositions/frames/02-two-roads.html
- type: product_intro
- persuasion: Progressive disclosure + comparison of two paths
- beat: Clarity
- blueprint: spatial-pan-stations (Adapt)



## Frame 3 — The lesson carries on

- scene: The outside road snaps; the camera commits to the inside road where requests and lessons keep flowing; work to sync queues amber at the router.
- voiceover: "So when the internet goes down, the lesson carries on. Work waits, and syncs later."
- duration: 6.587s
- transition_in: cut
- status: animated
- src: compositions/frames/03-lesson-carries-on.html
- type: benefit_highlight
- persuasion: Counterexample + before/after
- beat: Relief
- blueprint: camera-journey (Adapt)



## Frame 4 — When the LRS stops answering

- scene: The LRS goes quiet and requests die at its door; the camera whips to the tablet (nothing loads) and back through the three checks.
- voiceover: "But if the LRS stops answering, nothing loads. Check its power light, its cable at the switch, then Quest on a tablet."
- duration: 9.311s
- transition_in: cut
- status: animated
- src: compositions/frames/04-lrs-stops.html
- type: feature_showcase
- persuasion: Signposting + numbered enumeration
- beat: Tension → focus
- blueprint: agent-progress-theater (Adapt)



## Frame 5 — Report it as critical

- scene: Pull back; a pointer says leave the LRS on; the app's Report Error card fills in Connectivity / LRS unreachable / CRITICAL; the lesson card lands.
- voiceover: "Still nothing? Don't unplug it. Report it as critical: no LRS, no lesson."
- duration: 8.196s
- transition_in: cut
- status: animated
- src: compositions/frames/05-report-critical.html
- type: cta
- persuasion: Distillation + call to act
- beat: Resolve
- blueprint: camera-journey (Adapt)


