---
workflow: faceless-explainer
flow: automation
storyboard: no
message: "When the internet stops, follow the signal from the computer outwards and check each link in order: the first failed link is where to investigate; fix it there, then prove it with a round trip."
destination: youtube
aspect: 1920x1080
language: en
audience: "Teachers and school ICT admins in Tanzania, non-specialists, often on a phone over a slow link"
length: 70s
angle: how-to
---

## Intent

OE Support explainer series — Connectivity: Follow the signal. Fault type in the system: Connectivity / No internet access.
Built with the OE explainer engine (videos/_engine) on the visual system the owner approved on 2026-09-26
(the prototype, videos/how-a-school-connects).

## Customizations

- The engine's shared look: one continuous technical drawing, camera moves, the official OE logo, captions.
- FOLLOW THE SIGNAL: one packet is the only actor until the fix is proven.
- The failure is physical: the packet reaches the WAN port, tries twice, and gives up; the WAN light never comes on.
- CHECK THE PATH: each passed check lights its stretch of cable green.
- The repair is an action (the plug pushed home), and the proof is a round trip to a real destination.

## Notes

- A port's link light is lit when a working cable connects both ends; unlit means no link (RJ45 behaviour).
- The router's INTERNET light fails when its WAN side has no link; the provider modem's LAN light is also off, because the cable reaches neither end.
- Check order computer → switch → router LAN → router WAN finds the first failed link (guide #1: lights, cable, then provider).
- A fix is verified by a request that gets an answer, not by a green light alone.
