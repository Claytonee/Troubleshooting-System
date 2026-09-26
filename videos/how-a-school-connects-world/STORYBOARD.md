---
format: 1920x1080
duration: 72s
message: "When the internet stops, follow the signal from the computer outwards and check each link in order: the first failed link is where to investigate; fix it there, then prove it with a round trip."
arc: how-to-process
audience: "Teachers and school ICT admins in Tanzania"
mode: autonomous
music: none
fps: 60
---

# Follow the signal

## Video direction

**The look (3D-first, D40).** One continuous technical world on a dark ground (`bg #0f1117`): a table with a
grid that fades before the frame reaches its edge, and real hardware standing on it — the computer, the
switch, the router, the provider's modem, the internet as a matte globe. Nothing physical is drawn. Devices
come from the OE hardware library (`_engine/hardware-3d`), lit as product visualisation: a soft room, a key
three-quarters to the camera's left, a rim so a dark device separates from a dark ground, a contact shadow.
Captions own the bottom ~17%; the series slate is top-left and the official Opportunity Education logo
top-right, both fixed to the screen. OE's colours belong to the labels, the status marks and the travelling
signal — never to the hardware, which keeps believable charcoal plastic, gold contacts and a blue patch cord.

**The camera is the explanation.** The system view is near-orthographic (an 8° lens from several metres), so
hardware reads like a clean diagram while keeping material and depth; teaching views are medium; inspection
is a 12–20 cm close-up on a named port. Every move answers *what should the learner understand now* — push
in to look, track along the path being checked, pull back to put it together. One move per beat, decelerating
to rest, `power2.inOut`; no idle drift in a hold, and no move for its own sake. Scale, shadow, floor reach,
halo size and signal width all follow the shot automatically.

**Motion grammar.** Healthy: a calm, continuous signal. Investigation: slower, analytical moves. Failure:
motion stops — the light pushes into the cable, dies, retries. Repair: mechanical and purposeful — align,
insert straight, the latch presses and springs. Verification: a renewed round trip. Nothing bounces, nothing
scales for emphasis, and nothing uses web-UI motion.

**Signal.** Data is a travelling light *inside* the cable, never a dot above it. Request and response differ
only in direction and a controlled shift within the OE palette; a verified path holds a faint green in the
jacket.

**Information.** 2D carries only what is not an object: labels, the numbered check list, the fault-domain
bracket, the closing rule, the captions. Labels are screen-space, anchored to a point in the world, kept out
of the slate, the logo and the caption band, and **dropped rather than allowed to collide**. At most two
major annotations at once; one banner for the sharpest fact.

**States are physical before they are written.** A light is lit because the link is up; a plug is proud of its
port because nobody pushed it home. The text names what the hardware has already shown.

**This episode's stage.** One technical tabletop, seen from many distances: the desktop (monitor + tower, its network port on the back), an 8-port switch, the school router (LAN 1–4 | WAN, status lights), the provider's modem, and the internet as a matte globe. Real patch cables run between real ports. The camera is the only thing that changes scale.

## Frame 1 — The symptom

- scene: The real screen, filling the frame: No internet, this page can't be reached. The camera eases back to the whole desktop — monitor and tower — still telling us nothing about where it broke.
- voiceover: "The internet has stopped at school. The computer can't tell you where."
- duration: 5.198s
- transition_in: cut
- status: animated
- src: compositions/frames/01-symptom.html
- type: hook
- persuasion: Pain validation
- beat: Recognition
- blueprint: 3D macro → medium pull-back

screen (fov 26) → desk. No labels: the screen is the message.

## Frame 2 — Follow the signal

- scene: The camera pulls back off the desk until the whole path stands in one near-orthographic view: computer, switch, router, the provider's modem, the internet. A light leaves the computer and runs along the cable into the switch. Each device is named as the narration reaches it; then the camera moves in on the router and its two kinds of port are named where they are.
- voiceover: "So follow the signal. The switch joins the school's computers and passes their traffic to the router, the school's gateway. Its LAN ports face the school. Its WAN port faces the provider."
- duration: 13.362s
- transition_in: cut
- status: animated
- src: compositions/frames/02-follow-the-signal.html
- type: education
- persuasion: Mental model
- beat: Orientation
- blueprint: pull-back reveal → dolly to hero

desk → topology (near-ortho, 8° lens) → router medium. Labels: COMPUTER · SWITCH · ROUTER · PROVIDER'S MODEM · THE INTERNET, then LAN PORTS / WAN PORT.

## Frame 3 — No way out

- scene: A request runs from the computer through the switch into the router. At the WAN it pushes a few centimetres into the cable, fades, tries again, and dies. The WAN light never comes on and the cable beyond stays dark.
- voiceover: "Every request leaves through it. This one doesn't get out. Nothing gets past the router."
- duration: 6.792s
- transition_in: cut
- status: animated
- src: compositions/frames/03-no-way-out.html
- type: problem
- persuasion: Demonstration
- beat: Tension
- blueprint: signal stall at a physical boundary

chain (computer → router) → router + modem. One label, late: NO PHYSICAL LINK.

## Frame 4 — Check in order

- scene: The camera travels the path in the order a person checks it: behind the computer to its network port, to the switch port, to the router's LAN port, to its WAN port. Each stop carries a small numbered status beside the light it is reading — three verified, the fourth failed.
- voiceover: "Check the path in order, from the computer outwards. The computer's link light: on. The switch port: on. The router's LAN port: on. Its WAN port: off. The first failed link."
- duration: 15.287s
- transition_in: cut
- status: animated
- src: compositions/frames/04-check-in-order.html
- type: education
- persuasion: Method
- beat: Diagnosis
- blueprint: lateral track along the chain, status overlays

computer.eth → switch.p8 → router.lan1 → router.wan. Four status labels, anchored to the lights.

## Frame 5 — The fault domain

- scene: The camera holds the router and the provider's modem together; everything else in the world goes quiet. One label names the region: FAULT DOMAIN, router WAN ↔ provider's modem. Then the camera begins to move in on the cable itself.
- voiceover: "So the fault is between the router and the provider's modem. Start with what you can check yourself: the cable."
- duration: 7.552s
- transition_in: cut
- status: animated
- src: compositions/frames/05-fault-domain.html
- type: education
- persuasion: Narrowing
- beat: Isolation
- blueprint: emphasis by dimming, one bracket label

router + modem, held; the push toward the WAN port begins on "the cable".

## Frame 6 — The fix

- scene: The WAN port fills the frame: the connector stands proud of the port and sags, because nothing is holding it. It straightens, goes in, the latch presses and springs into its notch — a click. The WAN light stays dark for a moment while the link negotiates, then comes on and flickers with traffic; the router's INTERNET light goes from red through amber to green.
- voiceover: "It has worked loose. Push it in until it clicks. The WAN light comes on, and the router is back online."
- duration: 8.312s
- transition_in: cut
- status: animated
- src: compositions/frames/06-the-fix.html
- type: feature_showcase
- persuasion: Demonstration on the object
- beat: Resolve (deliberate)
- blueprint: mechanical insert, then state change

WAN macro (11 cm), held through the repair. Labels: WAN CABLE LOOSE, then WAN LINK UP.

## Frame 7 — Verify

- scene: The camera pulls back to the whole path. A request runs out through the switch, the router, the modem, to the internet — and an answer comes back along the same cables, the other way. Only when it is home does anything claim success.
- voiceover: "Don't assume it's fixed. Test it: a request goes out, and an answer comes back."
- duration: 9.078s
- transition_in: cut
- status: animated
- src: compositions/frames/07-verify.html
- type: proof
- persuasion: Verification
- beat: Proof
- blueprint: request and response along the lit path

WAN macro → topology. Label: CONNECTIVITY VERIFIED, after the answer arrives.

## Frame 8 — Restore

- scene: The whole network stands calm, every light as it should be, one quiet round trip still running. The rule is written under it.
- voiceover: "Check the path in order. The first failed link shows you where to look."
- duration: 6.908s
- transition_in: cut
- status: animated
- src: compositions/frames/08-restore.html
- type: cta
- persuasion: Rule to remember
- beat: Landing
- blueprint: hold wide, one line of text

topology, held. The closing rule over a gold rule.
