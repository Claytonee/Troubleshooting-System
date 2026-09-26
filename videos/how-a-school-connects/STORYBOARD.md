---
format: 1920x1080
duration: 30s
message: "Every packet crosses four links on its way out of school; when one breaks, you check them in order and the fault shows itself."
arc: how-to-process
audience: "School teachers and school ICT admins in Tanzania, non-specialists, often watching on a phone over a slow link"
mode: autonomous
music: none
fps: 60
---

# How a School Connects to the Internet

## Video direction

**The stage (every frame, identical world coordinates).** One technical drawing on a single baseline
in the upper ~70% of the canvas (captions own the bottom ~17%). Device centres, left to right:
school computer (x≈200), switch (x≈620), router (x≈1000), internet provider building (x≈1380), the
internet cloud (x≈1730), baseline y≈400. The **four links of the chain**, numbered wherever they are
counted: ① the Ethernet cable (computer→switch), ② the switch, ③ the router, ④ the provider line
(router→provider). The provider→internet hop is drawn but never counted: it is not the school's to check.
Each device is an original flat SVG drawing in the brand's line language (2px strokes in `text-muted`,
fills in `card-bg`, one `primary` accent stripe), with a small status LED. Every frame redraws this stage
in the same positions, so every seam is an invisible `cut` and the film reads as one continuous shot;
only the camera (a `.camera` wrapper: scale/x/y), the packets, the LEDs and the link states change.

**Palette (from frame.md).** Ground `bg #0f1117` with a faint hairline grid (`border`, ~6%); devices
idle at ~35% opacity and "light" to 100% when named. Packets and live links `primary #4f7cff`; healthy
LEDs and ticks `positive #2dd98a`; the break, the dead LED and the fault chip `negative #ff5263`; labels
`text #e8eaf0`, sublabels `text-muted #9ba1b5`. The OE gold `#FFAE00` appears once, as the hairline rule
over the closing lesson line. Type by role from frame.md (DM Sans: h2 for the lesson, h3 for callouts,
h4-eyebrow for the "CHECK IN ORDER" rail, counter for sublabels; DM Mono for chip numerals).

**Motion grammar.** Long-tail eases (`power3.out` for entrances, `power2.inOut` for camera and packet
travel), nothing bouncy except the check badges' single small settle. VO-paced reveals everywhere:
a device lights, and its label appears, on the phrase that names it (cue times in `cues.json`, frame-relative).
Packets travel along the actual cable paths, never in straight screen lines. One camera move per leg,
decelerating to rest; no idle drift during holds.

**Rhythm.** Frame 1 moves (the pull-back), Frame 2 moves (the travel), Frame 3 is the held tension beat
(one short push, then still), Frame 4 is a procedural build (four ticks on four cues), Frame 5 releases
(flow resumes) and ends on a still, held lesson line for ~2s.

**Never.** Stock icons or emoji; photos; bokeh or purple-blue "AI" gradients; glow halos on everything
(one soft glow on the live packet only); front-loading a frame then freezing it; independent floating
elements (screensaver); any text in the caption band; PowerCert's artwork, colours or characters.

## Frame 1 — No internet in the lab

- scene: Tight on the school computer's screen showing a crossed-out globe and "No internet"; the camera pulls back to the whole chain, the devices dim, and the four links are numbered as the voice says "four links".
- voiceover: "No internet in the lab? The fault is in one of four links."
- duration: 4.744s
- transition_in: cut
- status: animated
- src: compositions/frames/01-no-internet.html
- type: hook
- persuasion: Pain validation + frame-then-fill (name the four links before showing them)
- beat: Recognition + curiosity
- blueprint: zoom-out-workspace-reveal (Adapt)
- focal: the computer screen's "No internet" state, then the numbered chain
- roles: screen status = foreground subject · the stage devices = supporting (dim ~35%) · hairline grid = background
- sfx: whoosh-short

narrativeRole: Starts from the moment every teacher knows, the dead screen, and re-scopes it into a chain
with a countable number of places the fault can be.
keyMessage: The problem is findable: it sits in one of four links.

Adapt: keep the single decelerating zoom-out as the signature move; the "detail" is the computer's screen
and the "containing whole" is the network chain; no cursor.
Scene 1 (0.0–0.7s): extreme close-up (camera ≈3.4× on the computer screen, centred): the screen's
crossed-out globe and the words "No internet" fill the frame; the status line flickers once. The
pull-back has already begun, slowly.
Scene 2 (0.7–2.4s, VO "No internet in the lab?"): the zoom-out continues and accelerates away; the
monitor bezel, then the desk unit, then the neighbouring devices enter frame (dim ~35%).
Scene 3 (2.4–3.6s, VO "The fault is in one of four links."): the zoom-out decelerates to rest at 1×, the
whole stage locked; on "four links" (≈3.5s) four numbered chips ①–④ pop in under the cable, switch,
router and provider line, left to right (stagger ≈0.08s).
Scene 4 (3.6–4.744s): held read; chips and dim stage still.

## Frame 2 — The path a packet takes

- scene: A packet leaves the computer and rides each cable in turn; each device lights and gets its label and one-line job as the voice names it; the camera follows the packet and settles on the full chain.
- voiceover: "Your computer sends packets — down the cable, to the switch, through the router, to your provider — and out to the internet."
- duration: 8.752s
- transition_in: cut
- status: animated
- src: compositions/frames/02-the-path.html
- type: product_intro
- persuasion: Progressive disclosure + causal chain (demonstration: the mechanism running)
- beat: Clarity + momentum
- blueprint: spatial-pan-stations (Adapt)
- focal: the travelling packet and the device it has just reached
- roles: packet = foreground subject · lit device + its label = foreground · unlit devices = supporting (dim) · grid = background
- sfx: click-soft

narrativeRole: Names each device in the order a packet meets it, so the viewer builds the chain in their head
exactly as it is wired. The sublabels carry each device's job without extra narration: the switch
"joins every computer in the building", the router is "the school's gateway", the provider "carries the
school to the internet".
keyMessage: Data leaves in packets and crosses cable → switch → router → provider → internet, in that order.

Adapt: keep one virtual camera traversing pre-placed stations; the stations are the devices and the
traversal follows the packet; the chips from Frame 1 fade out in the first 0.3s.
Scene 1 (0.0–2.2s, VO "Your computer sends packets,"): camera eases to ≈1.5× centred on the computer;
the computer lights (35%→100%) with its label "School computer"; three packets (small rounded squares,
`primary`, soft glow) emerge from its port one after another.
Scene 2 (2.2–3.36s, VO "down the cable,"): the cable to the switch lights (stroke draws in `primary`); the
packets ride it; label "Ethernet cable" appears above the cable's midpoint. Camera begins panning right.
Scene 3 (3.36–4.5s, VO "to the switch,"): the switch lights, its port LEDs flicker green once; label
"Switch" + sublabel "joins every computer in the building". Camera continues right.
Scene 4 (4.5–5.66s, VO "through the router,"): the router lights, antenna LED green; label "Router" +
sublabel "the school's gateway".
Scene 5 (5.66–7.03s, VO "to your provider,"): the long provider line lights and the packets cross it; the
provider building lights; label "Internet provider" + sublabel "carries the school out".
Scene 6 (7.03–8.752s, VO "and out to the internet."): the cloud lights; label "The internet"; the camera
pulls back to 1× on the whole chain and holds; a steady stream of packets flows along the full path
(finite, evenly spaced) to the end of the frame.

## Frame 3 — One link breaks

- scene: Packets flow; the router–provider line turns red and breaks; the next packet reaches the router and dies at the gap; the provider and the cloud go grey.
- voiceover: "When one link breaks, the packets stop right there."
- duration: 3.741s
- transition_in: cut
- status: animated
- src: compositions/frames/03-link-breaks.html
- type: pain_point
- persuasion: Counterexample (show the mechanism failing) + before/after
- beat: Tension
- blueprint: camera-journey (Adapt)
- focal: the break in the provider line
- roles: break + dying packet = foreground subject · the rest of the lit chain = supporting · grid = background
- sfx: error

narrativeRole: Shows what "no internet" physically is, a packet that cannot cross one link. That turns the
viewer's vague outage into a single location.
keyMessage: An outage is one broken link, and everything before it still works.

Adapt: keep a motivated camera leg to the consequence; one push only, then still (the held tension beat).
Scene 1 (0.0–1.0s, VO "When one link breaks,"): the full chain, all lit, the packet stream flowing as
Frame 2 ended.
Scene 2 (1.0–1.7s): the provider line flashes red and snaps: a gap opens in its middle with two ragged
ends; the provider building and the cloud fade to grey; the router's uplink LED turns red.
Scene 3 (1.7–2.9s, VO "the packets stop right there."): the camera pushes to ≈1.6× on the router and the
gap; the next packet runs from the switch through the router to the gap's edge, flashes red, and fades;
packets still on the left side keep reaching the router (everything before the break works).
Scene 4 (2.9–3.741s): held read on the break.

## Frame 4 — Check the links in order

- scene: The four numbered chips return beneath the links; the camera steps from the computer outwards; cable, switch and router each flip to a green tick as their link light glows; the provider chip flips red "FAULT"; the dark LED is called out.
- voiceover: "Check them in order, from the computer out: cable, switch, router, provider. The first dark light is your fault."
- duration: 9.552s
- transition_in: cut
- status: animated
- src: compositions/frames/04-check-in-order.html
- type: feature_showcase
- persuasion: Signposting (first… then… finally) + numbered enumeration
- beat: Focus + "aha"
- blueprint: agent-progress-theater (Adapt)
- focal: the checklist chips flipping in order
- roles: chips ①–④ = foreground subject · link LEDs = foreground · stage = supporting · grid = background
- sfx: click-soft, error

narrativeRole: The action the viewer takes away. A fixed order turns guessing into a procedure, and the
first dark link light is the answer.
keyMessage: Check from the computer outwards; the first link that is dark is the fault.

Adapt: keep the state-mutation checklist as the signature move (numbered outline badges flip to solid
ticks one by one); the checklist is laid out under the links it checks instead of in a card; no cursor.
Scene 1 (0.0–2.86s, VO "Check them in order, from the computer out."): the camera eases back to 1× (from
Frame 3's push); the eyebrow "CHECK IN ORDER" and a thin arrow along the baseline appear at left; the four
chips ①–④ rise in under the cable, switch, router and provider line (outline, numbered).
Scene 2 (2.86s, VO "Cable."): chip ① flips to a solid green tick; the cable's link LED glows green.
Scene 3 (3.85s, VO "Switch."): chip ② flips green; the switch's port LEDs glow green.
Scene 4 (4.92s, VO "Router."): chip ③ flips green; the router's LED glows green.
Scene 5 (5.95s, VO "Provider."): chip ④ flips to solid red with a cross and the word "FAULT"; the provider
line's LED is dark and pulses red twice (finite).
Scene 6 (7.24s, VO "The first dark light is your fault."): the camera pushes gently toward the router and
the provider line (≈1.25×); a callout "The first dark light is the fault" (h3) appears above the break,
with a thin leader to the dark LED. Hold to the end.

## Frame 5 — Back online

- scene: The provider line rejoins (red → blue), chip ④ turns green, packets flow end to end again, the cloud and provider relight, the computer's screen shows "Connected", and the lesson line settles under a gold rule.
- voiceover: "Fix that one link, and the school is back online."
- duration: 5.127s
- transition_in: cut
- status: animated
- src: compositions/frames/05-back-online.html
- type: cta
- persuasion: Callback (the hook's dead screen now shows connected) + distillation
- beat: Satisfaction + resolve
- blueprint: camera-journey (Adapt)
- focal: the rejoining link, then the lesson line
- roles: link + chip ④ = foreground subject · flowing packets = supporting · lesson line = foreground (end) · grid = background
- sfx: chime

narrativeRole: Closes the loop on the hook: the same computer is online again, and the procedure is
distilled into one line to remember: "Check the links in order."
keyMessage: One link fixed restores the whole path.

Adapt: keep the landing leg to the changed state; the camera returns to the full chain and comes to rest.
Scene 1 (0.0–1.67s, VO "Fix that one link,"): from the Frame 4 push, the gap in the provider line closes
(the two ends draw together), the line turns `primary`, chip ④ flips from red cross to green tick, the
callout fades out; the camera eases back to 1×.
Scene 2 (1.67–3.0s, VO "and the school is back online."): packets stream the full path again; the
provider building and the cloud relight; the computer's screen switches to a small green "Connected".
Scene 3 (3.0–5.127s): the lesson line "Check the links in order." (h2) settles above the stage under a
short gold hairline rule, with a small "OE Support" eyebrow; packets keep flowing (finite); the frame holds.
