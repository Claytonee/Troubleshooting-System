# 2. Offline-first PWA

**Status:** implemented · **Effort:** M · **Changes:** works when it matters most

## What the giants do

Every serious field-service platform assumes the technician loses signal.
ServiceNow Mobile Agent keeps working "in areas with limited or no
connectivity"; Dynamics 365 Field Service ships offline-first as the default
profile. The pattern is the same everywhere: complete forms, capture photos,
change status **with no network**, then sync automatically when signal returns
([ServiceNow](https://buzzclan.com/digital-transformation/servicenow-mobile-agent/),
[Dynamics 365](https://learn.microsoft.com/id-id/dynamics365/field-service/mobile/overview),
[field service apps 2026](https://www.arrivy.com/blog/best-field-service-mobile-apps-for-technicians/)).

## What is missing

Checked: **no service worker, no web app manifest, no IndexedDB.**
`localStorage` holds only the JWT and the cached user (`api.js:10-15`).

The consequence is a loop the system cannot escape:

> A teacher cannot report that the internet is down, using the internet that is
> down.

And the guides that would help — "WiFi / Internet Not Working", seven steps,
already in `troubleshooting_guides` — are exactly what is unreachable at the
moment they are needed.

## Design

### Three tiers of offline, in order of value

**a. Read the guides offline.** The knowledge base is small, static and the most
useful thing to have without a network. Precache the app shell, CSS, JS, fonts
and `GET /api/guides` on install; serve them cache-first. This alone converts a
dead app into a working manual.

**b. Queue a report offline.** `POST /api/errors` while offline writes the
payload to IndexedDB and returns a local provisional code. A Background Sync
registration (falling back to a flush on the next `online` event and on app
start) replays the queue. The UI shows the ticket as *pending sync*, never as
filed.

**c. Queue a status change.** Same mechanism for `PATCH /api/errors/:id/status`,
which is what a sub-admin does at a school with no signal.

### Cache strategy per resource

| Resource | Strategy | Why |
|---|---|---|
| shell (`index.html`, CSS, JS, fonts) | precache, cache-first, versioned | must boot with no network |
| `GET /api/guides`, `/api/manuals` metadata | stale-while-revalidate | the offline manual |
| `GET /api/errors`, `/api/dashboard` | network-first, cached fallback with an "as of" timestamp | stale data must never look live |
| `POST`/`PATCH` mutations | queue in IndexedDB | the whole point |
| Cloudinary files | not cached | 100MB ceiling per file; bandwidth is the scarce resource |

The versioned cache name is tied to the `?v=NN` asset version already used in
`index.html`, so the existing cache-busting habit keeps working and a deploy
cannot leave a client on a half-old shell.

### The two failure modes this must not have

**Stale data presented as current.** Any screen served from cache carries an
explicit "as of HH:MM" marker. A dashboard that silently shows yesterday's
counts is worse than a dashboard that will not load.

**Silent queue loss.** A queued report is visible, countable and retryable in
the UI, with the failure reason if the replay is rejected. A sync that
disappears destroys trust in the whole system permanently.

### Idempotency

Replay needs a client-generated `client_ref` (UUID) on every queued mutation,
stored as a unique column on `errors`. Without it a retry after a timeout that
actually succeeded files the same fault twice. This is additive:
`ADD COLUMN client_ref VARCHAR(64) NULL` plus a unique index, and the server
returns the existing row on a repeat.

### Installability

A manifest with the OE mark, `display: standalone`, portrait orientation, and
the brand colours already in `variables.css`. On a school tablet it then
launches from the home screen as an app rather than a bookmark — which is also
what makes teachers treat it as one.

## Not built

- Caching uploaded media. Photos are the bulk of the bytes and the least useful
  offline.
- Offline authentication beyond the existing 7-day JWT. Issuing credentials to
  a device that cannot reach the server is a security problem, not a feature.
- Conflict resolution UI. Two people editing the same ticket offline is rare
  here; last-write-wins plus the audit log is proportionate.

## What testing changed about the design

Four things were found by running it offline rather than by reasoning about it,
and each changed the implementation:

**The offline trigger is a failed request, not `navigator.onLine`.** In these
schools the LAN is routinely up while the uplink is dead: the tablet is happily
associated to the router, so `navigator.onLine` reports `true` and would have
queued nothing. Stopping the server while the page stayed "online" reproduced
exactly that, and it is the normal case here, not an edge case.

**Reference data has to be warmed, not merely cacheable.** The report form was
unusable offline: the school dropdown was empty and the form refused to submit,
because `/api/schools` had only ever been network-first and the user had not
opened the form while online. It is now cached like the guides *and* fetched on
login.

**Warming has to wait for the worker to control the page.** On a first visit the
worker installs but does not yet control, and a fetch issued in that window
bypasses it entirely — so warming on login cached nothing the first time and
everything the second. The teacher's first offline attempt is the one that
matters, so `warm()` now waits for `controllerchange`.

**Nothing retried once the uplink came back.** The `online` event and Background
Sync both key on `navigator.onLine`, and in this failure mode that signal never
moves: the LAN is up, so the tablet reports itself online the whole time. With
the tab left open, a queued report still sat in the queue 15 seconds after the
server was reachable again, because no trigger had fired — the earlier "it
synced" result had actually been the page reloading. Fixed with a backoff retry
(15s / 30s / 60s / 2min) that runs only while something is queued and disarms
when the queue drains, so an idle device polls nothing.

**`window.Offline` is always undefined.** `offline.js` declares `Offline` with
`const`, which is a script-scope binding rather than a property of `window`, so
every `if (window.Offline)` guard was permanently false and `Offline.init()`
never ran at all. Measured: `typeof Offline === 'object'` while
`'Offline' in window === false`. The same pattern was already in `auth.js` for
`window.ChatPage`, which meant the AI transcript had never once been cleared on
logout despite a comment saying it must be — fixed here too.

## Verification plan

- DevTools offline: the app boots, guides open, a report can be filed and shows
  as pending.
- Back online: the queue drains, the provisional code is replaced by the real
  `QFT-####`, and exactly one row exists in `errors`.
- Replay the same queued item twice: still one row (the `client_ref` test).
- A cached dashboard shows its "as of" marker and is never mistaken for live.
- Lighthouse installability passes; the app launches standalone from the home
  screen on a real Android tablet.
- Measured: shell size in KB, and the byte cost of a cold start versus today.
