# OE Support — the explainer series

> **Paused (2026-09-26).** Per the Motion Director Master Brief the owner adopted, no further episodes are made until
> the directed prototype (episode 00, v2, `how-a-school-connects/DIRECTION.md`) passes human review, and its visual,
> motion, camera and troubleshooting language is settled. Episode 01 was built on the v1 language before the pause;
> it will be rebuilt on the approved v2 language.

One short video (25–40 s) for every fault type a school can report in the system
(`SUBCATS` in `frontend/js/utils.js`: 26 of them, plus "Other"). Built with the OE explainer engine
(`videos/_engine`) on the look the owner approved on 2026-09-26: one continuous technical drawing, a camera
that tells the story, the official Opportunity Education logo, English narration and captions.

**Order.** By how often each fault is reported (local counts, 2026-09-26; production counts will replace
these when they are pulled), then by how much a teacher can do about it on the spot.

**Every episode follows the same four beats**, so the series teaches one habit:
1. **The moment** — what the teacher sees (the dead screen, the dark hub, the red light).
2. **How it works** — the path that is broken, drawn and named in order.
3. **Check in order** — the first-line checks, one per word, ticked or crossed on screen.
4. **Fixed, or report it** — the one line to remember, and when to stop and report (with the priority).

**Facts.** Steps come from the system's own guides (`troubleshooting_guides` #1–#5), its explainers
(`lrs-or-internet`, `charging-hub-dead`) and the app's routing rules. Where a step is standard first-line
practice that the system does not yet state, it is marked **[confirm]**, and the owner confirms it before
that episode is rendered. Power episodes never ask a teacher to open, rewire or repair anything electrical
(guide #4: "Do NOT attempt electrical repairs").

| # | Slug | Fault type | Local count | Status |
|---|---|---|---|---|
| 00 | `how-a-school-connects` | Connectivity / No internet access | 3 | **v2 directed prototype, awaiting review** |
| 01 | `lrs-unreachable` | Connectivity / LRS unreachable | 10 | built on v1 language; to be rebuilt after review |
| 02 | `wifi-router-down` | Connectivity / WiFi router down | 7 | planned |
| 03 | `tablet-not-charging` | Hardware / Tablet not charging | 7 | planned |
| 04 | `projector-fault` | Hardware / Projector fault | 7 | planned |
| 05 | `tablet-screen-broken` | Hardware / Tablet screen broken | 7 | planned |
| 06 | `keyboard-mouse` | Hardware / Keyboard/mouse | 6 | planned |
| 07 | `laptop-wont-start` | Hardware / Laptop won't start | 6 | planned |
| 08 | `account-locked` | Accounts / Account locked | 6 | planned |
| 09 | `student-login` | Accounts / Student login | 4 | planned |
| 10 | `content-not-loading` | Platform / Content not loading | 4 | planned |
| 11 | `ups-battery-backup` | Power / UPS/battery backup | 3 | planned |
| 12 | `no-electricity` | Power / No electricity | 3 | planned |
| 13 | `socket-fault` | Power / Socket fault | 2 | planned |
| 14 | `slow-internet` | Connectivity / Slow internet | 2 | planned |
| 15 | `password-reset` | Accounts / Password reset | 2 | planned |
| 16 | `quest-login-failure` | Platform / Quest login failure | 2 | planned |
| 17 | `quest-app-crash` | Platform / Quest app crash | 1 | planned |
| 18 | `switch-fault` | Connectivity / Switch fault | 0 | planned |
| 19 | `generator-failure` | Power / Generator failure | 0 | planned |
| 20 | `surge-damage` | Power / Surge damage | 0 | planned |
| 21 | `slow-platform` | Platform / Slow platform | 0 | planned |
| 22 | `teacher-dashboard-error` | Platform / Teacher dashboard error | 0 | planned |
| 23 | `teacher-login` | Accounts / Teacher login | 0 | planned |
| 24 | `new-account-needed` | Accounts / New account needed | 0 | planned |
| 25 | `printer-issue` | Hardware / Printer issue | 0 | planned |

---

## The episodes

### 01 — LRS unreachable · "The lesson lives in the school"
- **Message:** Quest runs from the LRS inside the school, not from the internet. If the LRS answers, the
  lesson runs; if it does not, report it as critical.
- **Creative:** the router splits into two roads, one short road to the LRS and one long road out to the
  internet. The camera flies the short road, then cuts the long one to show the lesson still loads. Then the LRS
  goes dark and the short road dies. **Camera signature:** a fork: the camera commits to one branch, and the
  cut to the other branch lands the contrast.
- **Checks:** ① the LRS power light, ② its network cable at the switch (link light), ③ open Quest on a tablet,
  ④ still nothing: report it as **CRITICAL** (a lesson cannot run). Do not unplug the LRS. **[confirm]**: the LRS
  address shown in guide #1 (`192.168.0.10`) is shown on screen only as "the school's LRS"; the teacher step
  is to open Quest, not to ping.
- **Sources:** explainer `lrs-or-internet` (two paths; lesson continues if the LRS is alive; critical if not);
  guide #1 step 5.

### 02 — WiFi router down · "Read the lights"
- **Message:** the router's lights tell you which side failed; restart it once, properly, then read them again.
- **Creative:** an extreme close-up on the router's light panel as a "dashboard". Each light gets a name as the
  camera slides along it. The WAN light is the one that says "the problem is outside the school".
  **Camera signature:** a macro slide along the LEDs, then a pull-back to the whole room of tablets losing WiFi.
- **Checks:** ① power light (if off: its adapter and socket), ② restart: off, 30 seconds, on, wait two minutes,
  ③ WiFi light on, ④ WAN light off or red → the provider, report it; still down after 20 minutes → **CRITICAL**.
- **Sources:** guide #1 (steps 1, 2, 7); explainer `lrs-or-internet` step 5 (WAN light meaning).

### 03 — Tablet not charging · "Cable, port, hub"
- **Message:** test the cable, then the port, then the hub, so one swap tells you which part failed.
- **Creative:** current flows as a stream of amber sparks from the wall to the hub to each tablet. Each
  swap is a split-screen A/B, same tablet with a known-good cable. **Camera signature:** a vertical tilt from
  the wall socket down the lead to the hub, then a lateral track along the row of tablets.
- **Checks:** ① known-good cable, ② another hub port, ③ clear the tablet's port, ④ charge from the wall, ⑤ several
  tablets dead on one hub → the hub (unplug 30 s, reseat the lead); report with the hub number and serials.
  Only supplied chargers.
- **Sources:** guide #2; explainer `charging-hub-dead`.

### 04 — Projector fault · "Signal, source, lamp"
- **Message:** most projector faults are the cable or the input source, not the projector.
- **Creative:** the beam as the story. The camera rides the light from lens to wall, and the fault shows as the
  beam arriving with nothing in it. **Camera signature:** a push through the lens into the HDMI cable, travelling
  back along the signal to the laptop.
- **Checks:** ① power both ends, ② HDMI/VGA seated, ③ laptop Win+P → Duplicate, ④ projector input matches
  the port, ⑤ red lamp light = lamp needs replacing (report); hot = let it cool 5 minutes.
- **Sources:** guide #5.

### 05 — Tablet screen broken · "Stop, protect, report"
- **Message:** a cracked screen is a safety issue first: take the tablet out of use, record it, swap a spare.
- **Creative:** a crack draws itself across the glass in slow motion. The camera backs off and the tablet
  goes into a labelled bag. **Camera signature:** the crack's path *is* the camera path.
- **Checks:** ① stop using it (glass cuts), ② note the serial / asset tag and take a photo, ③ report it (Hardware /
  Tablet screen broken), ④ the field engineer swaps a spare. **[confirm]** whether schools hold spares on site
  (the system models spares per school: `tablets.is_spare`).

### 06 — Keyboard / mouse · "Plug, port, other computer"
- **Checks:** ① replug into another USB port, ② wireless: batteries, the on switch, the receiver, ③ try it on
  another computer: works there → the computer's port; dead everywhere → the device. Report with the asset tag.
  **[confirm]** wireless devices in use.
- **Creative:** the signal as a single glowing keystroke travelling from key to screen. **Camera:** a key-press
  macro, then a fast pull along the cable.

### 07 — Laptop won't start · "Power in, power held, power out"
- **Checks:** ① charger light on and plugged at a working socket, ② charge 15 minutes, ③ hold the power button
  15 seconds, then press once, ④ lights but no picture: brightness / external display. Report with the asset
  tag. **[confirm]** the laptop models (battery removable or not).
- **Creative:** the power path drawn as current: socket → brick → laptop → screen. **Camera:** a slow push into
  the charging LED.

### 08 — Account locked · "Wait, then reset"
- **Checks:** too many wrong passwords lock the account for a while; wait, then use the right username and
  password. Still locked → the school admin or the platform team unlocks it. **[confirm]** Quest's lockout
  time; this system's own lock is 15 minutes (`LOGIN_LIMITS`).
- **Creative:** a sign-in card with a padlock that counts attempts. **Camera:** a push into the padlock as it
  closes, then a time-lapse clock.

### 09 — Student login · "Name, password, then the teacher"
- **Checks:** ① username exactly as issued (no spaces, right case), ② caps lock, ③ internet/LRS reachable,
  ④ the teacher resets the password. **[confirm]** who resets student passwords in Quest.

### 10 — Content not loading · "One lesson or all of them?"
- **Checks:** ① does other content load? (all fail → the LRS: episode 01), ② reload, ③ another tablet,
  ④ one item fails everywhere → report it with the course and unit name.
- **Sources:** explainer `lrs-or-internet`.

### 11 — UPS / battery backup · "The beep is a clock"
- **Checks:** a beeping UPS is on battery: save work; the router and LRS keep running for a while; check the
  mains; if power will not return soon, shut the LRS down properly before the battery runs out. **[confirm]**
  UPS models and runtime; guide #4 step 5.

### 12 — No electricity · "Inside, outside, generator"
- **Checks:** ① main breaker panel (switch back only a tripped breaker, once), ② do the neighbours have power?
  ③ generator: fuel, oil, start it manually if auto-start failed, ④ never attempt electrical repairs; all tech
  offline → **CRITICAL**. **Safety:** generators outside only (fumes).
- **Sources:** guide #4.

### 13 — Socket fault · "Test with something you trust"
- **Checks:** ① plug in a device you know works, ② try another socket, ③ scorch marks, heat, a burning smell:
  switch it off at the breaker, do not use it, report it. Never open a socket.

### 14 — Slow internet · "One pipe, many users"
- **Creative:** the uplink as a pipe; every tablet adds packets until they queue.
- **Checks:** one device or all? all → big downloads or updates running, the data plan, restart the router once;
  one → move nearer the WiFi, restart the tablet. **[confirm]** whether schools are on data bundles.

### 15 — Password reset · 16 — Quest login failure · 17 — Quest app crash
- From guide #3 (login: internet first, cache, incognito, username format, forgot password, critical if many)
  and first-line app practice (close fully, reopen, restart the tablet; many tablets at once → report).
  **[confirm]** Quest's forgot-password flow.

### 18 — Switch fault · 19 — Generator failure · 20 — Surge damage · 21 — Slow platform ·
### 22 — Teacher dashboard error · 23 — Teacher login · 24 — New account needed · 25 — Printer issue
- Planned after the first ten are reviewed. Episode 24 is taken from the system itself: a teacher joins through
  the school admin's registration link, and the school admin approves (D35, How It Works).
