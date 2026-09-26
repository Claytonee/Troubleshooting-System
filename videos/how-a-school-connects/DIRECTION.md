# How a School Connects — v2 direction

The prototype rebuilt as a directed explainer film, to the Motion Director Master Brief (2026-09-26).
This file is the plan, written before any code, and afterwards the record: storyboard, rationale,
primitives, assets, corrections, remaining weaknesses, recommendations.

## Phase 1 — Diagnosis of v1 (watched as rendered, 0.75 fps review sheet)

**Keep**
- The opening: one continuous pull-back from the dead screen.
- The topology reads left to right, instantly.
- Semantic colour: blue in motion, green verified, red failed.
- CHECK IN ORDER: ticks in sequence, stopping at the first failure. It is the strongest idea and becomes the series' spine.
- Sharp rendering and invisible cuts.

**Weak**
- **2.7–4.0 s: the topology is dumped, not unfolded.** Every device appears at once, dim, then four numbered chips float in
  empty space with nothing to point at.
- **12–13 s: noise.** Six labels and four sub-labels on screen together, most of them too small to read at the wide shot.
- **13.3–16 s: the failure is a state change, not a mechanism.** A line turns red and snaps *in mid-air*. Real
  connections fail at an interface (a port, a plug, a link light), not in the middle of a cable. Nothing shows the
  router trying and getting no answer. The WAN indicator, the thing a teacher can actually see, is a 6 px dot.
- **17–25 s: the checklist knows the answer.** The ticks sit in a rail far from the things being checked. The camera
  barely moves, so the investigation is announced rather than performed.
- **26.7–28 s: diagnosis jumps to "fixed".** The line mends itself: no action, no cause, and no proof. "Back online" is
  declared without a test.
- **Decorative ISP and internet:** a building and a cloud with no destination that could answer.
- **Captions:** a saturated blue chip on every word, the loudest thing on screen.
- **Terminology:** "first dark light", "provider line": vivid but imprecise.

## Phase 2 — Learning objective

**When the internet stops, follow the signal from the computer outwards, checking each link in order. The first failed
link is where to investigate; fix it there, then prove the fix with a round trip.**

Supporting ideas
1. A request travels a real path: computer → switch → router → WAN → provider → a server on the internet.
2. The router is the gateway: LAN ports face the school, one WAN port faces the provider.
3. When one link fails, traffic stops *there*. Everything before it still works, which is why checking in order finds it.
4. The first failed link defines the fault domain; start with the cause you can check yourself.
5. A fix is not done until a test goes out and an answer comes back.

**The misconception corrected:** "no internet means the computer (or the whole network) is broken." It usually means
one link, and you can find which.

**The fault shown:** the router's WAN cable has worked loose. It is common after cleaning or a knock, it is visible at
the WAN port's link light, and it is fixed on the spot. Anything a school cannot fix is named as the next suspect,
not acted out.

## Phase 3 — Storyboard (one continuous world; the camera never cuts to another place)

World: one long bench, left to right, wider than the screen. The camera travels it; the whole of it is seen only at the end.
Computer (monitor + tower with its network port) · cable · switch (8 ports + uplink) · cable · router (LAN 1–4, WAN,
status lights) · WAN cable with a real plug · provider modem · provider line · a web server inside "the internet".

| Shot | Learning purpose | Camera | Main object | Motion | Narration purpose | Into next shot | ≈s |
|---|---|---|---|---|---|---|---|
| 01 Symptom | what the teacher sees | macro on the screen | browser: "No internet"; taskbar icon | still; the icon's warning badge pulses once | name the symptom | ease back to reveal the tower | 3 |
| 02 The question | the computer can't say where | medium: monitor + tower | tower's network port | hold | "it can't tell you where" | a packet appears at the port | 3 |
| 03 Follow the signal | the path exists | tracking right along cable 1 | one request packet | packet travels; camera tracks it | introduce "follow the signal" | the cable leads into the switch | 3 |
| 04 Switch | joins the school's devices | arrives at switch, medium | switch port 3 → uplink | port light blinks in, uplink blinks out | what a switch does | uplink cable leads on | 3 |
| 05 Router: gateway | LAN inside, WAN outside | push into router face | LAN 1 → WAN port | LAN 1 blinks; the two sides are marked | the router's job and its two sides | the packet heads for WAN | 5 |
| 06 Failure | where it stops, physically | close on the WAN port | packet at WAN | arrives · pauses · retries twice · fades; WAN light stays unlit; INTERNET light fails | "this one doesn't get out" | **hold (silence)** | 4 |
| 07 Consequence | everything beyond is unreachable | pull back right | WAN cable, modem, internet (dim) | path beyond goes quiet | nothing gets past the router | pull back to the computer | 3 |
| 08 Investigate ① | check in order: computer | push to the tower's port | port link light | CHECKING ring → ✓; path segment lights | first check | follow cable 1 | 3 |
| 09 ② switch | switch port | track to switch port 3 | port light | ✓; next segment lights | | follow uplink | 2.5 |
| 10 ③ router LAN | router LAN 1 | track to router | LAN 1 light | ✓ | | slide to WAN | 2.5 |
| 11 ④ WAN | the first failed link | close on WAN port | WAN light unlit | ✕; **FIRST FAILED LINK**; hold | why the search stops here | pull back | 4 |
| 12 Fault domain | isolate | medium: router ↔ modem | bracket over WAN cable | healthy devices dim; domain labelled | "between router and provider" | causes appear | 3 |
| 13 Likely causes | start with what you can check | same | three causes, first highlighted | list reveals, 1st highlights | choose the cable first | push to the plug | 3.5 |
| 14 Inspect | the cause, seen | macro on the WAN plug | plug half out, latch gap | hold; the gap is marked | "it has worked loose" | the push | 2.5 |
| 15 Fix | the action | macro | plug | slides in, click; WAN link light on; INTERNET light amber → green | "push until it clicks" | pull back to the computer | 4 |
| 16 Verify | prove it | fast tracking shot, left to right and back | test packet (outlined) + reply | round trip computer → server → computer; server answers | "don't assume; test" | **CONNECTION RESTORED** | 7 |
| 17 Restore | the healthy system | wide, whole bench | steady two-way flow | calm continuous flow | the principle | end card | 5 |

## Phase 4 — Motion plan

- **Pacing:** travel at a moderate pace (~420 px/s); the failure beat slows (a pause before the retry, a 0.8 s hold
  after); the investigation moves at walking pace between checks; the fix is deliberate; the verification is the
  fastest travel in the film; the restore is calm.
- **Packets are actors:** *request* (blue, solid), *reply* (green, solid), *test* (blue outline, larger). They
  enter from a port, travel, get forwarded (the port light answers), get blocked (arrive, pause, two short retries,
  fade), return, and resume.
- **Devices behave:** a port's link light is steady green when linked. Its activity blinks when a packet passes.
  The router's INTERNET light is green when WAN is up, amber while connecting, red when WAN is down.
- **Attention:** one focal point at a time. Contextual device titles (NAME + one-line role) appear when the camera
  arrives and leave when it goes. Healthy devices dim during isolation.
- **Signature moments (OE language):** FOLLOW THE SIGNAL (the tracking packet) · CHECK THE PATH (segments light as
  checks pass) · FIRST FAILED LINK · FAULT DOMAIN · VERIFY THE FIX (round trip).
- **Sound:** a soft click per passed check, a restrained error at the failure, a connector click at the fix, one
  gentle chime when the reply arrives. No music.
- **Captions:** quieter. Smaller, no coloured chip; the active word is simply full-strength text on a dark pill.

---

## As built (v2, 2026-09-26) — `renders/video.mp4`, 71.5 s, 1920×1080, 60 fps, −16.0 LUFS / −1.5 dBTP

| Time | Frame | Shots | What the viewer sees |
|---|---|---|---|
| 0:00–0:05 | 01 Symptom | 01–02 | Macro on "No internet" and the badged network icon; eases back to the monitor and the tower |
| 0:05–0:19 | 02 Follow the signal | 03–05 | One packet leaves the tower's port; tracked along the cable into switch port 3 and out of UPLINK; along to router LAN 1; SWITCH / ROUTER titles appear on arrival and leave; the router's LAN side and WAN side are marked |
| 0:19–0:25 | 03 No way out | 06–07 | Close on the WAN port: the packet pushes out twice, a seeking ring on the WAN light finds nothing, INTERNET flickers amber and settles red, **NO LINK**; a held beat; pull back to the unreachable path beyond |
| 0:25–0:41 | 04 Check in order | 08–11 | Long pan back to the computer; ① tower link light ✓ (cable 1 turns green); ② switch port 3 ✓ (cable 2 turns green); ③ router LAN 1 ✓; ④ WAN ✕, **FIRST FAILED LINK** |
| 0:41–0:48 | 05 Fault domain | 12–13 | The healthy half quietens; **FAULT DOMAIN · router WAN ↔ provider modem**; the modem's LAN light is off too; the camera leans in to the likely causes; "WAN cable loose" is chosen |
| 0:48–0:56 | 06 The fix | 14–15 | Macro on the plug hanging out: **LOOSE**; pushed home with a click; the camera settles; the WAN light comes on at both ends; ④ turns ✓; INTERNET searches amber, then green; the path beyond wakes |
| 0:56–1:05 | 07 Verify | 16 | "Don't assume": the screen still says No internet; pull back to the whole bench; a test packet crosses every link to a server on the internet; the green answer comes back all the way; the page loads; **CONNECTION RESTORED** |
| 1:05–1:11 | 08 Restore | 17 | Calm two-way flow on every link; end card: *Check the path in order. The first failed link shows where to investigate.* |

## Motion-director rationale — the major changes

1. **One actor.** In v1 many packets flowed while the story was told. In v2 exactly one packet is on screen from the
   first cable to the failure, and the camera follows it. The viewer always knows where to look: at the signal.
2. **The failure is a mechanism, at an interface.** The packet reaches the WAN port, tries, tries again and gives up,
   while the light that should answer never does. v1 snapped a cable in mid-air, which is not how a connection fails,
   and put a red ✕ where the viewer should have seen a cause.
3. **The investigation is performed, not announced.** Each numbered check appears beside the light it checks, joined
   to it by a leader, looks (a seeking ring) and resolves. The camera walks the path at walking pace. Each passed
   check turns its stretch of cable green (CHECK THE PATH), so the healthy path grows until it meets the first failure.
4. **Isolate, then choose.** The healthy half quietens, the fault domain is bounded, and the causes are ranked with the
   one a teacher can check first. This is the step v1 skipped between "WAN failed" and "fixed".
5. **The fix is an action; the proof is a round trip.** The plug is seen loose, pushed home, and the lights answer at
   both ends. Check ④ closes only once the camera has settled on it. Nothing is declared restored until a request
   reaches a real destination and the answer comes back.
6. **Contextual type.** A device's name and role appear when the camera arrives and leave when it goes. Two titles that
   repeated the narration were rewritten to add information ("one port for each device", "links the school to its
   provider"). Captions are quieter: smaller, no coloured chip, on a dark strip.
7. **Rhythm.** Moderate travel; a held silence after the failure; walking pace for the checks; a deliberate fix; the
   fastest travel for verification; a calm ending.

## Reusable motion primitives (engine: `videos/_engine/lib`)

| Primitive | Where | Meaning |
|---|---|---|
| PacketEnter / PacketForward | `stage.journey`, port blips | a packet enters at a port; the port's light flickers as it passes |
| **PacketBlocked** | `stage.blocked()` + end `fade` | arrives, pushes out, pauses, retries, gives up quietly |
| PacketReturn | reverse pieces (`rev`), kind `reply` | the answer travels the same path back, green |
| **VerifyPacket** | kind `test`, round trip | a larger outlined packet: the test that proves a fix |
| PacketFlow | `stream()` | steady traffic; `cut` makes items die at a break |
| StatusLED | `led`, `blink`, **`blip`** | steady link, flicker on activity, amber searching, red failed |
| **DiagnosticCheck** | `check()` (episode helper) | numbered chip + seeking state + leader to its light + ✓/✕ |
| **CheckThePath** | links drawn green as checks pass | the verified path grows |
| **FirstFailedLink · FaultDomain** | labels, bounded region, dimming | where the search stops; everything healthy steps back |
| **CableReconnect** | `plug-body` seat + click + lights at both ends | the repair, seen |
| ContextTag | `tag()` | NAME + role, only while the camera is there |
| Camera track / push / pull | `cam()` (nested wrappers), `anchoredZoom` | motivated moves; the long pull-back anchored |
| Screen furniture | slate, logo, top scrim, lesson card (1–2 lines) | fixed to the screen, on clean ground |

## Assets improved (`videos/_engine/lib/devices2.mjs`)

- **Desktop:** a browser with a real "No internet" page and a badged network icon; a tower with its network port and
  link/activity lights.
- **Switch:** eight RJ45 ports with latch notches, a light per port, a marked UPLINK.
- **Router:** status lights with icons (POWER, INTERNET, WI-FI, LAN); LAN 1–4; a distinct, outlined WAN port. The
  antennas are removed (they crossed the LAN/WAN labels, and the WI-FI light already says it).
- **Provider modem** (POWER, LINK, INTERNET, LAN, LINE) replaces a decorative building. **A web server** inside
  "the internet" replaces a decorative cloud: a destination that can answer.
- **An RJ45 plug** that can hang loose and be seated; a bench line that grounds the world; micro-labels readable
  (≥4.5:1). Every device was checked in a close-up before it was used.

## Technical inaccuracies corrected

- A connection that "snaps in mid-air" → a failure at an interface: the WAN port, its unlit light, a loose plug.
- "First dark light" → **first failed link**; "provider line" → **router WAN ↔ provider modem**.
- The internet as a cloud → **a server that answers**; restoration proven by a round trip, not by a colour change.
- The modem's LAN light is off when the WAN cable is out, because the cable reaches neither end. It is consistent with,
  and supports, the fault domain.
- The router's INTERNET light: amber while searching, red when WAN has no link, green once it is back.

## Remaining weaknesses (seen in the render)

- **The wide shots (0.64×) are small on a phone.** The verification packets are ~22 px and the labels there are not
  readable. The story survives on motion and colour, but a phone viewer loses detail.
- **The loose plug is visible from the router's first close-up (0:12).** This is true to life and rewards an attentive
  viewer, but it slightly pre-empts the investigation.
- **The consequence shot (0:24–0:25)** is still quieter than it should be: dim devices on a dark ground. A clearer
  "unreachable" treatment (the path beyond drawn broken) would help.
- **The voice is synthetic (Kokoro).** It is clear, but the short answers ("on." / "off.") are flat.
- **No depth yet:** no parallax, no shadow. The brief allows mild depth; v2 stayed flat for clarity.
- **Captions:** word timing comes from speech recognition and can lead the voice by a few tenths of a second.
- **Not yet checked on a real phone or a classroom projector.** Dark themes often wash out on projectors.

## Recommendations for the OE motion language before the next video

1. **Motion tokens:** fixed durations and eases per state (travel, search, fail, hold, fix, verify, restore), so every
   video moves with the same personality.
2. **Promote the episode helpers into the engine:** `check()`, fault domain, likely causes and plug reconnect are
   written once here. They should become named engine primitives with their own tests.
3. **A focus primitive:** when a check or title is active, everything else steps back automatically, not by hand.
4. **Type scale bound to camera scale:** no essential text below ~22 px at the shot's camera scale; the build should
   fail on it.
5. **Wide-shot rule:** never let understanding depend on detail below 0.8× scale.
6. **A projector-safe variant:** a light palette for classrooms, tested on a real projector.
7. **The narrator:** choose the final voice (human or licensed TTS) before the series, with a pronunciation list
   (LRS, WAN, Quest).
8. **Keep the structure:** symptom → follow the signal → check in order → isolate → fix → verify → restore. It is
   what makes a series.
