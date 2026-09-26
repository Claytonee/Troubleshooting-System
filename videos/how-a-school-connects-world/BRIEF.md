---
workflow: faceless-explainer
flow: automation
storyboard: no
message: "When the internet stops, follow the signal from the computer outwards and check each link in order: the first failed link is where to investigate; fix it there, then prove it with a round trip."
destination: youtube
aspect: 1920x1080
language: en
audience: "Teachers and school ICT admins in Tanzania, non-specialists, often on a phone over a slow link"
length: 72s
angle: how-to
---

## Intent

OE Support explainer series — Connectivity: Follow the signal. Fault type in the system: Connectivity / No internet access.
Built with the OE explainer engine (videos/_engine) on the visual system the owner approved on 2026-09-26
(the prototype, videos/how-a-school-connects).

## Customizations

- The engine's shared look: one continuous technical drawing, camera moves, the official OE logo, captions.
- ONE WORLD: the system view, the port inspection and the repair are the same objects, the same light, the same space — the camera carries the explanation, not a cut to another style.
- THE PATH IS LIT, NOT DOTTED: data is a travelling light inside the cable itself. Nothing floats above the hardware.
- THE HARDWARE FAILS BEFORE THE TEXT SAYS SO: the light pushes into the WAN cable twice, dies, and the WAN light stays dark — only then is anything written on screen.
- PHYSICAL LINK IS NOT THE SAME AS SERVICE: the provider's modem keeps its LINK and INTERNET lights the whole film; only its LAN light, the one facing the loose cable, is dark.

## Notes

- A port's link light is lit when a working cable connects both ends; unlit means no link (RJ45 behaviour).
- The router's INTERNET light fails when its WAN side has no link; the provider modem's LAN light is also off, because the cable reaches neither end.
- Check order computer → switch → router LAN → router WAN finds the first failed link (guide #1: lights, cable, then provider).
- A fix is verified by a request that gets an answer, not by a green light alone.
- A generic unmanaged switch auto-negotiates any port, so the router may use any of the eight: no port is labelled "uplink".
