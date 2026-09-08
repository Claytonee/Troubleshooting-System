# 1. LRS heartbeat → self-opening tickets

**Status:** implemented · **Effort:** S · **Changes:** reactive → proactive

## What the giants do

Datadog and PagerDuty do not wait for a complaint. The device emits, the
emission stops, an incident opens itself and the on-call engineer is paged. The
whole discipline is described as moving from "reactive firefighting" to
"proactive prevention" ([PagerDuty](https://www.pagerduty.com/resources/incident-management-response/learn/what-is-proactive-incident-management/),
[AIOps tools 2026](https://www.selector.ai/learning-center/aiops-tools-key-features-and-top-8-solutions/)).
In K-12 fleet management the same shift shows up as automated remediation
triggered by device state rather than by a helpdesk call
([EdTech Magazine](https://edtechmagazine.com/k12/article/2026/03/device-management-schools-how-small-it-teams-manage-big-device-fleets-perfcon)).

## What was missing

The infrastructure was already here — `schools.lrs_ip`, an `lrs_devices` table
with status, and `lrs_history`. What was missing was any signal *from* the
device. Consequence, straight out of `dashboardController.js`:

```sql
-- "schools healthy"
s.id NOT IN (SELECT school_id FROM errors
             WHERE status != 'resolved' AND priority IN ('critical','high'))
```

Healthy meant *nobody filed a ticket*. A school in a blackout, where nobody
**can** file a ticket, counted as healthy — and the KPI on the admin dashboard
was measuring reporting activity while claiming to measure infrastructure.

## Design

### Direction: the LRS calls us

The server does **not** poll `lrs_ip`. Those addresses are private LAN
addresses (`192.168.0.10`) behind school NAT — unreachable from cPanel. So the
agent on the LRS pushes outward, which also means a dead uplink is
indistinguishable from a dead box, and that is correct: from the school's point
of view both mean "no Quest".

```
  LRS at school ──POST /api/heartbeat──▶  server: stamp last_heartbeat_at
   (cron, 5 min)   X-Heartbeat-Key                 ▲
                                                   │
  cPanel cron ────POST /api/heartbeat/sweep───────┘  3 missed → open a CRITICAL
   (every 5 min)   X-Webhook-Secret                  error + SMS the sub-admin
```

### Why a sweep endpoint and not a timer

Passenger recycles the Node process on shared hosting, so an in-process
`setInterval` is not a schedule. `ROADMAP_AND_DESIGN.md` §5 already settled
this: scheduled work is an authenticated internal endpoint hit by a cPanel Cron
Job. The sweep follows that, and is idempotent so a double-fire is harmless.

### Thresholds

| | |
|---|---|
| Agent interval | 5 min |
| Missed beats before opening | 3 (≈15 min) |
| Grace | a device that has never reported is `unknown`, not `down` — a school without the agent installed must not generate tickets |
| Recovery | a heartbeat arriving while a self-opened error is unresolved appends an update and resolves it |

Three beats, not one: a single missed beat is normal on a rural link. Fifteen
minutes is well inside the 4-hour critical SLA, so the engineer still gets
almost the whole window.

### Deduplication

At most one open auto-error per device, keyed on
`errors.auto_source = 'lrs_heartbeat:<device id>'`. The sweep opens one only
when no unresolved error carries that key. Without this, a school down for a
week would accumulate ~2000 tickets.

### Schema (additive)

`lrs_devices`
| column | type | why |
|---|---|---|
| `last_heartbeat_at` | DATETIME NULL | when the box last spoke |
| `heartbeat_agent_version` | VARCHAR(30) NULL | which agent, for rollout |
| `heartbeat_uptime_seconds` | INT NULL | distinguishes a reboot loop from a dead link |
| `heartbeat_disk_free_pct` | SMALLINT NULL | the next failure to catch early |
| `heartbeat_missed_since` | DATETIME NULL | when the silence started |

`errors`
| column | type | why |
|---|---|---|
| `auto_source` | VARCHAR(80) NULL | dedup key; also marks a ticket as machine-opened |

Nullable, `ADD COLUMN IF NOT EXISTS`, idempotent on boot. No drops.

### Auth

`POST /api/heartbeat` is not a user session — the LRS has no login. It carries
`X-Heartbeat-Key`, compared against `HEARTBEAT_KEY` with
`crypto.timingSafeEqual`. With no key configured the endpoint refuses rather
than accepting anonymous beats, matching how `/api/deploy` already behaves.
Rate limited separately: a 5-minute beat from ~13 schools is trivial traffic,
and a flood is a signal in itself.

### Health becomes a measurement

`schools_healthy` gains a second condition: no unresolved critical/high error
**and** the LRS is not silent. A school whose LRS has stopped reporting is no
longer counted healthy, whether or not anyone noticed.

## Not built

- Polling `lrs_ip` from the server — unreachable, see above.
- ML anomaly detection on the heartbeat series. Thirteen devices at 5-minute
  resolution will not train anything useful; a missed-beat threshold gets
  essentially all of the value.
- Automated remediation (remote reboot). It needs an agent with privileges on
  the box and a rollback story; detection first, action later.

## Verification

Evidence recorded in the commit message. Covered:
- a beat from an unknown school code is rejected, and a wrong key is rejected;
- a first beat moves the device from `unknown` to `up`;
- backdating `last_heartbeat_at` past the threshold and sweeping opens exactly
  one CRITICAL error, with `auto_source` set;
- sweeping again opens **no** second error (dedup);
- a beat arriving afterwards resolves the auto-opened error and appends an
  update;
- a device that has never reported produces no error;
- `schools_healthy` drops while a school is silent and recovers with the beat.

## Operating it

Environment: `HEARTBEAT_KEY` (required for the endpoint to accept), reusing
`WEBHOOK_SECRET` for the sweep.

On each LRS (`crontab -e`):

```bash
*/5 * * * * curl -fsS -m 20 -X POST https://support.mkatolikikiganjani.com/api/heartbeat \
  -H "Content-Type: application/json" -H "X-Heartbeat-Key: $HEARTBEAT_KEY" \
  -d "{\"school_code\":\"MTK\",\"hostname\":\"$(hostname)\",\"uptime_seconds\":$(cut -d. -f1 /proc/uptime),\"disk_free_pct\":$(df --output=pcent / | tail -1 | tr -dc 0-9 | awk '{print 100-$1}')}" >/dev/null
```

In cPanel → Cron Jobs, every 5 minutes:

```bash
curl -fsS -m 30 -X POST https://support.mkatolikikiganjani.com/api/heartbeat/sweep -H "X-Webhook-Secret: $WEBHOOK_SECRET"
```

Roll out to one school first and watch `lrs_devices.last_heartbeat_at` before
enabling the sweep — until the sweep runs, a missing agent costs nothing.
