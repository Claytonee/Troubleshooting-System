---
workflow: faceless-explainer
flow: automation
storyboard: no
message: "Quest runs from the LRS inside the school, not from the internet: if the LRS answers, the lesson runs; if it does not, report it as critical."
destination: youtube
aspect: 1920x1080
language: en
audience: "Teachers and school ICT admins in Tanzania, non-specialists, often on a phone over a slow link"
length: 40s
angle: how-to
---

## Intent

OE Support explainer series — Connectivity: The lesson lives in the school. Fault type in the system: Connectivity / LRS unreachable.
Built with the OE explainer engine (videos/_engine) on the visual system the owner approved on 2026-09-26
(the prototype, videos/how-a-school-connects).

## Customizations

- The engine's shared look: one continuous technical drawing, camera moves, the official OE logo, captions.
- Signature: the fork. The router splits two roads; the camera commits to the inside road while the outside one breaks.
- Requests travel blue, lesson content comes back green, and work waiting to sync queues amber at the router.
- The report card is the app's own Report Error form, filled in the way this fault should be.

## Notes

- The lesson runs from the LRS; the internet is only for sync (explainer lrs-or-internet, scenes 2–4).
- If Quest will not load at all, the LRS is the problem and the lesson cannot run: report it as CRITICAL (explainer, scene 6).
- Checks: the LRS power light, its cable at the switch (link light), then open Quest on a tablet.
- Do not unplug the LRS (a server switched off at the wall can lose data; the engineer decides).
- A teacher's critical report goes straight to the field engineer (intake.routeFor).
