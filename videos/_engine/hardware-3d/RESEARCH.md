# Where professional 3D hardware comes from — and what we may do with it

Reviewed 2026-09-26 for the OE hybrid explainer system (D39). Our use: models rendered into **training
videos** that OE publishes (a commercial organisation's own material), never redistributed as files, never
used to train an AI model. Licences are summarised here; the licence on the asset's own page is the one that
binds, and it is re-read and recorded in PROVENANCE.md before any download.

## Sources

| Source | What it has for us | Licences | Rendered training video? | AI restriction | GLB? |
|---|---|---|---|---|---|
| **Sketchfab** (free downloads) | Many community routers/switches/connectors; quality varies from game props to careful product models | CC0, CC BY, CC BY-SA, CC BY-ND, CC BY-NC, Sketchfab Standard, Editorial | CC0 / CC BY / Standard: yes (CC BY needs credit; Standard needs credit "where technically feasible" in A/V work). **NC and Editorial: no** | Creators may tag **NoAI**; Sketchfab's terms forbid using NoAI uploads in generative-AI datasets | Yes (auto-converted glTF) |
| **Fab** (Epic: absorbed the Sketchfab store, ArtStation, UE Marketplace) | Paid and free product models | Fab Standard (Personal < US$100k revenue / Professional), CC BY | Standard: yes | Per-asset "Disallow use by generative AI" (NoAI) flag | Often |
| **CGTrader** | Large paid catalogue incl. networking hardware | Royalty Free, **Royalty Free No AI**, **Editorial**, custom | Royalty Free: yes. **Editorial: journalism only — no** | "No AI" variant forbids ML training | Varies |
| **TurboSquid** (Shutterstock) | Large paid catalogue, some "CheckMate" certified | TurboSquid 3D Model License; some "Editorial Uses Only" | Yes — the licence names "instructional videos, walkthrough tutorials". **Editorial-only: no** | Imagery may not be used in ML / generative AI without authorisation | Varies |
| **BlenderKit** | Blender-native assets, good materials | Royalty Free, CC0 | Yes ("you can sell renders and animations") | — | Via Blender export |
| **Poly Haven** | HDRIs, materials, props — **almost no electronics** | **CC0** | Yes, anything, no credit | — | Yes |
| **GrabCAD** (community CAD) | Very accurate CAD of real devices and connectors | Community terms: **non-commercial unless the contributor agrees in writing** | **Not without written permission** | — | No (STEP/SLDPRT → convert) |
| **Manufacturer CAD** (TE Connectivity, Amphenol via TraceParts / 3Dfindit / SnapMagic; some device makers) | Exact connector and jack geometry | Each portal's terms; usually "to design with our parts" | Unclear for video → **ask first** | — | No (STEP → convert, heavy) |

## What the search turned up (Sketchfab public search, 2026-09-26)

| Candidate | Licence | Faces | Verdict |
|---|---|---|---|
| "Router" (D-Link, Rasmus82) | CC BY | 2.2k | **Excluded.** Carries D-Link's trademark (CC BY licenses the modeller's copyright, not the brand); game-prop detail, ports not modelled |
| "Modern Wifi Router" (crazyyuan) | CC BY | 2.2k | **Excluded.** Stylised prop, fictional logo, unusable in close-up |
| "Grandpa's Wifi Router" | CC BY | 13k | **Excluded.** A 1950s radio joke |
| "TL-SF1005D" (arieffitrah) | CC BY | 26k | **Candidate — category B** if OE deploys this TP-Link 5-port switch; realistic, numbered ports |
| "8 Port Ethernet Switch" (ducksplash) | CC BY | 93k | **Excluded.** Neon "gaming" styling |
| "Rj45 connector" (ilmah06) | CC BY | 1.0M | Accurate, but raw CAD density: usable only after decimation. Not needed — ours is built to fit our jack |

**Conclusion for the prototype.** No free model was a close-up-quality *generic* router, the good ones are
brand-specific, and every Sketchfab/Fab/CGTrader download needs a signed-in account. The prototype's router,
plug and cable are therefore **original** (category A), authored as Blender scripts — which also lets the
router match the 2D drawing exactly, the precondition for a silhouette hand-over. The owner offered to sign in
where needed; that is the right path for **category B twins**, once we know the deployed models.

## Licensing gate (every external asset)

Before download, record in PROVENANCE.md: asset name, source, creator, URL, licence, commercial use,
attribution, AI restriction, modification, redistribution, date reviewed. Then:

- **Refuse** anything NC, Editorial-only, NoAI-if-our-use-touches-AI, or unclear. Downloadable ≠ reusable.
- **CC BY / Standard:** the credit goes in the video's end credits and the episode README.
- **Trademarks:** a licence for the mesh is not a licence for the logo on it. Category A strips brands;
  category B keeps them only for training on that exact device.
- **Never redistribute** source files (Standard/RF licences forbid it): the repo keeps licensed files out of
  git unless the licence allows it, and records where they came from.

## Starter set (minimum, in order of what breaks)

From the local fault history (SERIES.md): connectivity and power first.

| # | Asset | Category | Why | Likely source |
|---|---|---|---|---|
| 1 | Wi-Fi/Ethernet router | A ✔ built | WAN/LAN faults, the commonest | ours |
| 2 | RJ45 plug + cable | A ✔ built | every cable check | ours |
| 3 | 8-port desktop switch | A | "switch fault", port lights | ours (same kit as the router) |
| 4 | Provider modem / CPE | A | the provider boundary | ours |
| 5 | Desktop computer (tower + NIC) | A | the start of every path | ours / Poly Haven parts |
| 6 | Laptop + charger | A | "laptop won't start" | licensed (Fab/CGTrader RF) or ours |
| 7 | Tablet + charging hub | B | "tablet not charging" — the real hub matters | twin of the deployed hub |
| 8 | UPS | B | "the beep is a clock" | twin (APC/other: ask which) |
| 9 | Power strip + wall socket | A | power checks | ours |
| 10 | Wireless access point | A | Wi-Fi down | ours |
| 11 | 24-port switch, rack, patch panel | A/B | data cabinet visits | licensed or twin |
| 12 | Projector, printer | A | hardware episodes | licensed RF |

**What I need from the owner to start category B:** the models of router, switch, access point, UPS,
charging hub and LRS actually deployed; a photo of each (front and rear) is enough to judge whether a
licensed model exists or an original twin is quicker.
