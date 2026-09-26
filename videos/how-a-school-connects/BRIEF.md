---
workflow: faceless-explainer
flow: automation
storyboard: no
message: "Every packet crosses four links on its way out of school; when one breaks, you check them in order and the fault shows itself."
destination: youtube
aspect: 1920x1080
language: en
audience: "School teachers and school ICT admins in Tanzania, non-specialists, often watching on a phone over a slow link"
length: 30s
angle: how-to
---

## Intent

The first prototype of the OE Support System's explainer videos, and an evaluation of HyperFrames as
their production engine. "How a School Connects to the Internet": a school computer, the Ethernet
cable, the network switch, the router, the internet service provider and the internet, with packets
travelling through them; then a connection failure, the visual troubleshooting, and the successful
reconnection. PowerCert-style clarity (a technical drawing that moves and explains) in an original
visual language. PowerCert's artwork, branding and illustrations must not be copied.

The owner said "make the world class decision" and did not answer brief questions, so this run is
autonomous (`flow: automation`, `storyboard: no`). The rendered draft stops for human review; no
further videos are made until the visual system is approved.

## Customizations

- Original SVG technical illustrations of each device (no stock icons, no photos).
- One continuous network drawing with camera moves (punch-in on the device being explained), not a
  sequence of unrelated slides.
- Packets travel along the cables; the failure breaks the travel visibly (red, interrupted), and the
  recovery shows green.
- Synchronized narration and subtle professional sound effects.
- 1920 × 1080, 60 fps.
- The official Opportunity Education logo (asked by the owner, 2026-09-26): small in the top-right corner
  from the first second, fixed to the screen so the camera never moves it; the full logo above the lesson
  line on the end card, where the corner mark fades out so it is never shown twice. The official paths,
  with the branding guide's dark treatment (gold sunburst, white lettering). Never redrawn.

## Notes

- Decided for the owner (receipts):
  - **16:9 / YouTube-class destination:** the owner specified 1920 × 1080.
  - **English narration:** the product's copy is English-only (owner, 2026-09-24).
  - **Angle how-to:** the video ends in a troubleshooting order people can act on, not just a concept.
  - **The fault shown is the one schools report most:** the uplink from the router to the ISP. The check
    order on screen is the real first-line order: cable and link lights, switch, router, then the ISP.
- Where it will be used: outside the app (staff WhatsApp groups, training sessions, a channel). Inside
  the app, explainers stay drawn live (commit 5be4f8f: ~45 KB vs ~8 MB, plays offline).
- Avoid: generic presentation-style animation, decorative effects that teach nothing, stock icons.
- Every rendered frame is reviewed as a picture before delivery; code that runs is not proof of quality.
