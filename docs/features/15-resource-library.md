# Feature 15 — The resource library: what we support, what to film, and where it lives

**Status:** researched · planned 2026-09-25
**Follows:** feature 14 (guided resolution) — that feature ranks resources; this one creates them
**Storage:** Cloudflare R2

---

## 1. What we are actually supporting

Written down properly, because every decision below follows from it.

**Opportunity Education Tanzania** runs **Quest Forward Learning** — a digital,
student-centred curriculum approved by the **Tanzania Institute of Education for
Forms 1–4 in 2024**, the first student-centred digital programme to be certified
nationally. Roughly **35+ secondary schools across 10 regions**, **7,000+
students**, **500+ teachers**.

The equipment we keep alive at each school:

| Layer | What is there | How it fails |
|---|---|---|
| **Tablets** | Low-cost Android, one **parental/admin account**, all others locked down so a student cannot browse or install | Charging, cracked screens, lockdown drifting, an account that will not sign in |
| **LRS** | **Local Resource Server**, introduced 2020 — serves the whole curriculum over the school LAN so lessons run with no internet | Disk full, dust, power, silent to the heartbeat |
| **Display** | Smart screens, TVs, projectors, laptops | HDMI, no signal, input, resolution |
| **Network** | Router, **UTP/Ethernet**, switches, **data cabinet**, ISP uplink | Rodent-chewed cable, a lead out of its port, WAN down, slow at 2pm |
| **Power** | **UPS**, sockets, extensions, earth | Battery that no longer holds, a scorched socket, an outage that the hub does not come back from |

Two facts about this stack decide everything that follows.

**First: the failure is almost always physical and local.** A lead out of a port,
a battery at end of life, a hub that did not come back after a power cut, dust in
a fan. These are not software problems, and they are not solved by reading.

**Second: the uplink is the least reliable thing in the building.** That is why
the LRS exists. A support video streamed from Cloudflare is a support video that
plays exactly when it is least needed.

## 2. The finding that changes the task

You asked me to go and download videos, images and PDFs into the system. I want
to put a stronger option in front of you first, because the research points hard
at it.

> **The resources that will actually fix these faults cannot be downloaded from
> the internet, because they are about *this* equipment.**

A generic video called "how to reset a router" is worth very little to a teacher
at Kilema. A **forty-second phone video of the actual data cabinet at Kilema**,
showing which lead is the WAN and what the light does when it is seated properly,
is worth more than every router video on the internet put together. The same is
true of the charging hub, the UPS battery test, the parental-control screen on
the exact tablet build we ship, and the LRS disk check.

We are also uniquely able to make them: **field engineers already drive to these
schools**, and feature 5 already plans those visits. A phone and a shot list turn
every visit into library stock.

So the recommendation is: **produce first, source second.** Not because sourcing
is wrong, but because production is where almost all the value is, and it is the
only part nobody else can do for us.

### What can lawfully be brought in from outside

Sourcing still matters for the long tail. The ladder, strongest first:

1. **Our own material** — Quest Forward guides, TIE-approved curriculum assets,
   anything OE authored. No question, no limit.
2. **Manufacturer documentation** for the exact hardware we run — tablet, router,
   UPS, hub, switch. Many permit redistribution for support purposes; where they
   do not, we store the **link and the page number**, not the file.
3. **Openly licensed work** — CC0, CC-BY, CC-BY-SA. Perfectly usable, and the
   licence and attribution are stored *with the file* so they travel with it.
4. **Nothing else.** I will not download third-party videos — YouTube or otherwise
   — and re-host them on our storage. That is copyright infringement whatever the
   purpose, it puts OE's name on it, and a takedown would remove the resource on
   the day a teacher needs it. Where such a video is genuinely the best thing
   available, we store the **link** and mark the resource as needing internet.

`resources.licence` and `resources.source_url` become required fields for
anything not produced by OE, so the library can always answer "where did this
come from and may we use it".

## 3. What to film — the first shot list

Ordered by what actually breaks. Each is **≤ 90 seconds, portrait, one fault, no
narration required** (Swahili caption track added afterwards; a teacher often
watches with the sound off in a classroom).

**Power and charging** — the largest single category in our own fault history
| # | Shot |
|---|---|
| 1 | Charging hub: what a healthy LED looks like, what a dead one looks like |
| 2 | Reseating the hub power lead, and the 30-second wait |
| 3 | UPS battery test: how to run it, what "it no longer holds" looks like |
| 4 | A swollen tablet battery — what it looks like and why it leaves service immediately |
| 5 | Socket and extension safety: scorched, loose, overloaded |

**Network**
| 6 | Inside the data cabinet: which port is WAN, which is LAN, what each light means |
| 7 | Reseating a UTP lead, and how to tell a damaged one (rodent, crush, kink) |
| 8 | Router restart: the correct order, and how long to wait |
| 9 | Checking whether the problem is the school LAN or the ISP |

**LRS**
| 10 | Where the LRS is, what its lights mean, and that it must be on the UPS |
| 11 | Checking free disk space, and clearing the fans and vents |
| 12 | What a teacher sees when the LRS is down, versus when the internet is down |

**Tablets**
| 13 | The parental/admin account: what it is for, and why students never get it |
| 14 | A locked-down tablet that has drifted — how it looks and who to call |
| 15 | Cracked screen, dead screen, and what is worth repairing |

**Display**
| 16 | Smart screen / TV: HDMI seating, input selection, no-signal |

Sixteen clips at ≤ 8 MB each is **under 130 MB** — about 1.3% of the free R2
allowance. Storage is not the constraint. Attention is.

### The rules that keep them useful

- **≤ 90 seconds.** A fault video that needs two minutes is two videos.
- **≤ 8 MB, 720p.** Not a storage rule — a *school link* rule. A 40 MB clip on a
  rural uplink is a clip nobody watches.
- **Film the fault, not the person.** No students in frame, no faces, no names.
  These go to other schools.
- **Show the failure state as well as the fix.** "What a dead hub LED looks
  like" is half the diagnosis.
- **Swahili caption track**, English second — the same default as everywhere else
  (feature 14).

## 4. Where it lives: Cloudflare R2, with the LRS in front of it

### Why R2

- **10 GB storage, zero egress, always free**; 1M writes and 10M reads a month.
  For a sixteen-clip library serving 35 schools, the bill is zero and stays zero.
- **S3-compatible**, so nothing here is proprietary — the library can be lifted to
  any S3 provider later without rewriting the application.
- Egress is the reason. Cloudinary bills bandwidth; 35 schools re-watching a
  video every term is exactly the shape of bill that grows without warning.

### The architecture, and the part that matters most

```
   Platform admin uploads
            │
            ▼
   ┌──────────────────┐        nightly / on visit
   │  Cloudflare R2   │ ─────────────────────────────►  ┌─────────────┐
   │  (private)       │                                  │  School LRS │
   └──────────────────┘                                  └─────────────┘
            │                                                   │
            │  signed URL, short-lived                          │  LAN, no uplink needed
            ▼                                                   ▼
        A teacher with internet                        A teacher with no internet
```

**The LRS is the point.** Every school already has a server on the LAN holding the
entire curriculum offline, precisely because the uplink cannot be trusted. Support
videos belong on it for the same reason. A teacher whose router is dead cannot
stream a video about dead routers — but they can reach a box in the next room.

So: R2 is the **origin and the distribution point**; the LRS is the **cache that
works when nothing else does**. Anything the offline shell already does (feature 2)
continues to work for the small stuff; video is too large for a service-worker
cache and goes to the LRS instead.

### Access

- **Buckets stay private.** Objects are private in R2 by default and should remain
  so: a resource can name a school's equipment layout.
- **Serve through a custom domain** on our own zone — `r2.dev` is explicitly
  rate-limited and documented as not for production.
- **Short-lived presigned URLs** issued by our API after the normal auth check, so
  the existing role rules keep applying to files as they do to records.

### Implementation note

R2 speaks S3, so `@aws-sdk/client-s3` works. I would rather **not** pull it in:
we need exactly PUT, GET, HEAD, DELETE and LIST on one bucket, and SigV4 signing
is about eighty lines with `node:crypto`. That matches how `scripts/lib/browser.js`
drives Chrome with no npm dependency at all, and it keeps the deploy small on a
cPanel box. If signing proves fiddly, the SDK is the fallback — but it should be
a fallback, not the starting point.

**Cloudinary stays until R2 is proven.** Dual-write, then read from R2, then stop
writing to Cloudinary — expand, migrate, contract, exactly as CLAUDE.md requires.
No existing URL is ever rewritten in place.

## 5. Plan

**Phase A — storage** `services/storage.js` with an R2 driver behind the same
interface the Cloudinary calls use today. Dual-write new uploads. Nothing moves
yet, nothing breaks.

**Phase B — the resource record grows up** `manuals` gains `equipment`
(tablet / lrs / router / ups / display / cabinet), `fault_tags`, `duration_s`,
`language`, `licence`, `source_url`, `produced_by`. All nullable and additive;
feature 14's ranking immediately gets much sharper, because it can match a fault
to the *equipment* rather than to words.

**Phase C — production** the shot list, filmed on visits, uploaded by the platform
admin (who remains the only person who can publish — your decision of 2026-09-25).
A capture checklist joins the visit sheet from feature 5.

**Phase D — the LRS mirror** a manifest endpoint the LRS pulls nightly, so every
school holds the library locally. This is the phase that makes it work during an
outage, which is when it is needed.

**Phase E — backfill from outside** manufacturer PDFs and openly-licensed material
for whatever the shot list does not cover, each with its licence and source
recorded.

## 6. What I need from you

1. **The exact hardware list** — tablet model(s), router model(s), UPS model(s),
   hub, switch, LRS build. Manufacturer documentation is the easiest lawful win
   and I cannot fetch the right manuals without the model numbers.
2. **A Cloudflare account with R2 enabled**, and a subdomain we may point at the
   bucket (`resources.mkatolikikiganjani.com`, say).
3. **Whether the LRS can pull from the internet on a schedule.** If it can, phase D
   is straightforward; if it cannot, the library travels on the engineer's laptop
   during a visit, which also works and is worth knowing now.
4. **Who films.** My recommendation: the field engineers, on the visits they are
   already making, with the shot list on the visit sheet.
