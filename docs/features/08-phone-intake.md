# 08 — USSD and SMS intake: the floor under everything else

**Status:** built and verified, 2026-09-10 · **Suite:** `backend/scripts/verify-phone-intake.js` (59 assertions)

## The gap

Every way into this system needed data. The web form and the PWA need a browser
and a connection; WhatsApp needs a smartphone *and* a bundle. A teacher whose
bundle ran out, or who carries a feature phone, **had no way to reach this system
at all**.

That is not a missing feature, it is a missing floor — and it is invisible from
the inside, because a fault nobody can report appears in no metric. The audit
found it by looking at which tables are empty rather than which are full.

## Why USSD, specifically

The research is unambiguous about what reaches people in Tanzania:

- The national **School Information System (SIS/TAMISEMI)** is built to work
  online *and* offline in low-connectivity areas.
- **InfoTaaluma** reaches 200,000+ parents across 253 Tanzanian schools with an
  app **and SMS**, explicitly "to ensure even parents without internet access can
  stay involved".
- **Eneza Education** reached rural Kenyan students over plain SMS.
- **USSD** needs no internet, runs on every handset sold here, is session-based,
  has a smaller packet than SMS so it arrives faster, and — decisively —
  **everyone already knows the interaction from mobile money**. Nobody needs
  training to press 1.
- **Africa's Talking** provisions USSD shortcodes on **Vodacom Tanzania and
  Airtel Tanzania**, and is already this system's SMS vendor. No new supplier, no
  new contract.

## What was built

### The USSD tree

```
*149*00#
  OE Msaada wa Vifaa
  1. Ripoti hitilafu        2. Hali ya ripoti zangu      3. Namba ya msaada

1 → (unrecognised number only) school CODE
  → Tatizo ni lipi?     1 Intaneti/WiFi · 2 Tablet · 3 Quest · 4 Umeme · 5 Akaunti · 6 Nyingine
  → Limeathiri nini?    1 Shule nzima · 2 Darasa moja · 3 Kifaa kimoja
  → Eleza kwa ufupi (0 kuruka)
  → END  Imepokelewa. Namba: QFT-0257
```

Four presses and one optional sentence. The whole menu fits inside the 182-char
USSD screen (asserted by the suite, because a menu that overflows is a menu that
truncates mid-word on a Nokia).

### Decisions, and why

**Swahili first.** This is the channel for people who are *not* at a browser, and
the browser is the only place English is unavoidable here.

**The caller picks scale, not severity.** Nobody can judge "critical", and if you
offer it everyone picks it. *Whole school / one class / one device* is something
a teacher can answer truthfully, and it maps onto the SLA honestly:

| They said | Priority | Because |
|---|---|---|
| Shule nzima | critical | the school cannot teach today |
| Darasa moja | high | a class is stopped |
| Kifaa kimoja | medium | one device, work continues |

**No server-side session store.** Africa's Talking posts the whole input trail on
every step (`1*mtakuja*2*3`), so the menu is a pure function of that string.
Nothing to expire, leak, or clean up — and a dropped call leaves no orphan row.

**A recognised number is never asked what we already know.** If the phone matches
a user or teacher record we skip the school step entirely, file against their
school, and attribute the fault to their account.

**A phone number is still not authentication.** An unrecognised number may
*report* — against a school code it supplies, marked `ussd-unverified` — but may
never *read*: option 2 refuses it outright. Otherwise the shortcode becomes a way
to enumerate another school's problems, and a public shortcode is dialled by
whoever finds it.

**The caller is never left staring at a dead session.** Every failure path ends
with `END` and a sentence in Swahili telling them what to do instead. They paid
for that call.

**Abandoned sessions are recorded.** `ussd_sessions` holds one row per call with
its outcome — `menu`, `bad_school_code`, `status_denied`, `filed`. A session that
opened the menu and stopped **is a fault somebody wanted to report and could
not**, and that is precisely the number this feature exists to move. Recording
only the successes would hide the thing worth measuring.

### SMS

Deliberately keyword-light: a teacher in a hurry writes what is wrong, not a
command. Anything that is not `STATUS`/`HALI` or `MSAADA`/`HELP` is treated as a
fault report and classified by the same rules WhatsApp uses. An unrecognised
number is told to lead with its school code (`mtakuja projector imekufa`).

The callback replies **200 immediately** and then works, because the vendor
retries anything else — and a retry would file the fault twice.

### Authentication of the callbacks

Africa's Talking does not sign its callbacks. The URL therefore carries a shared
secret (`?key=…`) set in their dashboard, checked before anything else, and
**fail-closed**: with `PHONE_INTAKE_KEY` unset the endpoint refuses and says so
in Swahili rather than accepting anonymous fault reports. Same rule as the deploy
webhook and the heartbeat.

## The bug this found

Extracting the routing rule into `services/intake.js` exposed a real
inconsistency. **WhatsApp faults were assigned straight to the field engineer**
and answered *"An engineer has been notified"* — while the same teacher reporting
the same fault on the web went to their school administrator, which is the rule
the school asked for on 2026-09-09. Two channels, two answers, one system.

The rule now lives in exactly one place and every channel asks it:

| Reported by | assigned_to | escalation_level | school admin told |
|---|---|---|---|
| teacher / unverified phone | **null** | `school` | yes |
| …but critical | field engineer | `platform` | yes, and told why |
| school admin, or head office | field engineer | `platform` | no — they are the school level |

Asserted from all four channels by the suite, including a source check that the
WhatsApp handler no longer assigns directly.

## Verification

`node backend/scripts/verify-phone-intake.js` — 59 assertions, all passing,
leaving zero rows behind. Covers: the shared-secret guard (missing, wrong), the
menu shape and its 182-char budget, the unknown-number school-code path
(including a bad code), the three scope→priority mappings and the critical
bypass, the recognised-number shortcut, the read/write asymmetry on option 2,
SMS filing and keywords, the five routing cases, and the session ledger
including abandonment and one-row-per-session.

All nine existing suites still pass alongside it (478 assertions total).

## Deployment

```
PHONE_INTAKE_KEY=<a long random string>     # required; unset, the endpoints refuse
AT_USERNAME, AT_API_KEY                     # already used for outbound SMS
```

In the Africa's Talking dashboard:

- **USSD** → create/point the service code at
  `https://support.mkatolikikiganjani.com/api/ussd?key=<PHONE_INTAKE_KEY>`
- **SMS** → point the inbound callback at
  `https://support.mkatolikikiganjani.com/api/sms/inbound?key=<PHONE_INTAKE_KEY>`
- Optional: `settings.support_phone` is what option 3 reads out.

Until the shortcode is provisioned the endpoints simply sit there refusing
unauthenticated calls; nothing else in the system changes.
