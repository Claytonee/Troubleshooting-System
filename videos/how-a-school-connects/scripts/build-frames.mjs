#!/usr/bin/env node
/**
 * Builds the five frame compositions from ONE stage definition.
 *
 * The storyboard's promise is that every seam is invisible: the drawing sits in
 * the same place in every frame, and only the camera, the packets and the link
 * states change. Five hand-written files would drift apart by a pixel here and
 * a colour there, so the stage is defined once and each frame file is emitted
 * from it, with its own timeline.
 *
 * Packets run on a GLOBAL clock. A packet still travelling when one frame cuts
 * to the next continues from the same point in the next frame, because both
 * frames compute it from the same schedule. Positions are pre-sampled here at
 * equal arc length (constant speed), so the timeline is plain keyframes: seek-
 * safe, no plugins, no per-frame callbacks.
 *
 *   node scripts/build-frames.mjs     (reads cues.json, audio_meta.json, STORYBOARD durations)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const cues = JSON.parse(readFileSync('cues.json', 'utf8'));
const meta = JSON.parse(readFileSync('audio_meta.json', 'utf8'));
const DUR = Object.fromEntries(meta.voices.map((v) => [v.frame, v.duration_s]));
const OFFSET = {}; { let o = 0; for (const f of [1, 2, 3, 4, 5]) { OFFSET[f] = +o.toFixed(3); o += DUR[f]; } }
const cue = (f, i) => cues[f].phrases[i].start;
const word = (f, w) => { const v = meta.voices.find((x) => x.frame === f); const hit = v.words.find((x) => x.text.toLowerCase().replace(/[^a-z]/g, '') === w); return hit ? hit.start : null; };

// ── palette (frame.md) ─────────────────────────────────────────────────────────
const C = { bg: '#0f1117', surface: '#161921', well: '#0b0d12', raised: '#232838', line: '#2a2f3d',
  primary: '#4f7cff', text: '#e8eaf0', muted: '#9ba1b5', faint: '#636a82', pos: '#2dd98a', neg: '#ff5263', gold: '#FFAE00' };
const CAM = { cx: 960, cy: 440 };

// The official Opportunity Education logo (assets/brand/SOURCE.md): its own paths, never redrawn.
// On this dark ground it takes the branding guide's dark treatment — gold sunburst, white lettering.
const LOGO_PATHS = readFileSync('assets/brand/oe-logo-official.svg', 'utf8').match(/<path[^>]*>/g);
if (!LOGO_PATHS || LOGO_PATHS.length !== 21) throw new Error('official logo: expected its 21 paths');
const LOGO_DARK = LOGO_PATHS.join('').replace(/fill="#263746"/g, 'fill="#ffffff"');   // canvas point the camera centres on (above the caption band)

// ── geometry ───────────────────────────────────────────────────────────────────
const P = (x, y) => ({ x, y });
const bez = (p0, p1, p2, p3) => (t) => { const u = 1 - t; return P(u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x, u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y); };
const line = (a, b) => (t) => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const splitBez = (p0, p1, p2, p3, t = 0.5) => {       // de Casteljau: two halves, exact
  const L = (a, b) => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const a = L(p0, p1), b = L(p1, p2), c = L(p2, p3), d = L(a, b), e = L(b, c), f = L(d, e);
  return [[p0, a, d, f], [f, e, c, p3]];
};
const dPath = ([a, b, c, d]) => `M${a.x},${a.y} C${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`;
const length = (fn, n = 400) => { let s = 0, prev = fn(0); for (let i = 1; i <= n; i++) { const p = fn(i / n); s += Math.hypot(p.x - prev.x, p.y - prev.y); prev = p; } return s; };
/** n points at equal ARC LENGTH along fn — constant speed when played with ease 'none'. */
const arc = (fn, n) => {
  const fine = []; let s = 0, prev = fn(0); fine.push([0, prev]);
  for (let i = 1; i <= 600; i++) { const p = fn(i / 600); s += Math.hypot(p.x - prev.x, p.y - prev.y); fine.push([s, p]); prev = p; }
  const out = []; let j = 0;
  for (let k = 0; k <= n; k++) { const target = (s * k) / n; while (j < fine.length - 1 && fine[j + 1][0] < target) j++; out.push(fine[Math.min(j + 1, fine.length - 1)][1]); }
  out[0] = fn(0); return out;
};

// Devices are drawn at a base size and shown 1.35× about a fixed anchor (their foot on the
// baseline): big enough to read on a phone at the wide shot. Every port, link and packet
// route below is derived through T(), so the drawing and the paths cannot disagree.
const S = 1.35;
const DEV = { pc: P(200, 410), sw: P(620, 405), rt: P(1000, 405), isp: P(1380, 410), net: P(1740, 330) };
const T = (k, x, y) => P(+(DEV[k].x + S * (x - DEV[k].x)).toFixed(2), +(DEV[k].y + S * (y - DEV[k].y)).toFixed(2));
const devWrap = (k, inner) => `<g transform="translate(${DEV[k].x},${DEV[k].y}) scale(${S}) translate(${-DEV[k].x},${-DEV[k].y})">${inner}</g>`;
const sag = (a, b, dip) => [a, P(+(a.x + (b.x - a.x) * 0.35).toFixed(2), dip), P(+(a.x + (b.x - a.x) * 0.65).toFixed(2), dip), b];

const PC_OUT = T('pc', 240, 410), SW_IN = T('sw', 530, 410), SW_OUT = T('sw', 710, 410), RT_IN = T('rt', 930, 410), RT_OUT = T('rt', 1070, 410);
const ISP_IN = T('isp', 1318, 410), ISP_MID = T('isp', 1380, 410), ISP_UP = T('isp', 1380, 330), ISP_OUT = T('isp', 1442, 330);
const NET_IN = T('net', 1652, 362), NET_MID = T('net', 1730, 336);
const WAN = T('rt', 1050, 401), SCREEN = T('pc', 200, 343);
const L1 = sag(PC_OUT, SW_IN, 448);                 // ① Ethernet cable
const L2 = sag(SW_OUT, RT_IN, 442);                 // switch → router
const L3 = sag(RT_OUT, ISP_IN, 446);                // ④ provider line
const [L3a, L3b] = splitBez(...L3);
const GAP = L3a[3];                                  // where it breaks
const L4 = [ISP_OUT, P(ISP_OUT.x + 70, ISP_OUT.y), P(NET_IN.x - 70, NET_IN.y), NET_IN];   // provider → internet
const MID = (pts) => bez(...pts)(0.5);

// The route a packet takes, as pieces.
const ROUTE = [
  { key: 'L1', fn: bez(...L1) }, { key: 'sw', fn: line(SW_IN, SW_OUT) },
  { key: 'L2', fn: bez(...L2) }, { key: 'rt', fn: line(RT_IN, RT_OUT) },
  { key: 'L3a', fn: bez(...L3a) }, { key: 'L3b', fn: bez(...L3b) },
  { key: 'isp1', fn: line(ISP_IN, ISP_MID) }, { key: 'isp2', fn: line(ISP_MID, ISP_UP) },
  { key: 'isp3', fn: line(ISP_UP, ISP_OUT) },
  { key: 'L4', fn: bez(...L4) }, { key: 'cl', fn: line(NET_IN, NET_MID) },
];
for (const r of ROUTE) r.len = length(r.fn);

// ── packet schedules (global seconds) ──────────────────────────────────────────
const DT = 1 / 30;       // keyframe spacing; GSAP interpolates between them at 60 fps
/** Sample a journey given as [[routeKey, gStart, gEnd], …] into [{g, x, y}]. */
function journey(legs) {
  const pts = [];
  for (const [key, g0, g1] of legs) {
    const seg = ROUTE.find((r) => r.key === key);
    const n = Math.max(2, Math.round((g1 - g0) / DT));
    arc(seg.fn, n).forEach((p, i) => { if (i || !pts.length) pts.push({ g: g0 + ((g1 - g0) * i) / n, x: +p.x.toFixed(2), y: +p.y.toFixed(2) }); });
  }
  return pts;
}
/** A constant-speed trip over a contiguous run of route pieces. */
function trip(fromKey, toKey, g0, speed) {
  const i0 = ROUTE.findIndex((r) => r.key === fromKey), i1 = ROUTE.findIndex((r) => r.key === toKey);
  const legs = []; let g = g0;
  for (let i = i0; i <= i1; i++) { const d = ROUTE[i].len / speed; legs.push([ROUTE[i].key, g, g + d]); g += d; }
  return journey(legs);
}

const G = (f, t) => +(OFFSET[f] + t).toFixed(3);
const BREAK_AT = G(3, 1.05);          // the provider line snaps
const FIXED_AT = G(5, 1.1);           // the gap has closed again
const SPEED = 560;                    // px/s for the steady stream
const STREAM_FROM = G(2, cue(2, 5));  // the stream starts on "and out to the internet"
const STREAM_EVERY = 0.36;

const packets = [];
// Frame 2's three lead packets: they wait at the port, then arrive at each device as it is named.
const c2 = [0, 1, 2, 3, 4, 5].map((i) => G(2, cue(2, i)));
[0, 0.28, 0.56].forEach((lag, k) => {
  const hold = P(PC_OUT.x - 4 - k * 22, PC_OUT.y);
  const legs = [['L1', c2[1] + lag, c2[2] - 0.05 + lag], ['sw', c2[2] - 0.05 + lag, c2[2] + 0.2 + lag],
    ['L2', c2[2] + 0.2 + lag, c2[3] - 0.05 + lag], ['rt', c2[3] - 0.05 + lag, c2[3] + 0.18 + lag],
    ['L3a', c2[3] + 0.18 + lag, c2[3] + 0.62 + lag], ['L3b', c2[3] + 0.62 + lag, c2[4] - 0.05 + lag],
    ['isp1', c2[4] - 0.05 + lag, c2[4] + 0.12 + lag], ['isp2', c2[4] + 0.12 + lag, c2[4] + 0.3 + lag], ['isp3', c2[4] + 0.3 + lag, c2[4] + 0.45 + lag],
    ['L4', c2[4] + 0.45 + lag, c2[5] - 0.05 + lag], ['cl', c2[5] - 0.05 + lag, c2[5] + 0.35 + lag]];
  const pts = journey(legs);
  pts.unshift({ g: +(c2[0] + 0.35 + k * 0.3).toFixed(3), x: hold.x, y: hold.y }, { g: +(c2[1] + lag).toFixed(3), x: hold.x, y: hold.y });
  // the queue slides up to the port before leaving
  packets.push({ id: `lead${k}`, pts, end: 'arrive' });
});
// The steady stream: each packet takes the whole route, unless the line is broken when it gets there.
{
  const toGap = ROUTE.slice(0, ROUTE.findIndex((r) => r.key === 'L3a') + 1).reduce((s, r) => s + r.len, 0);
  for (let k = 0; ; k++) {
    const g0 = +(STREAM_FROM + k * STREAM_EVERY).toFixed(3);
    if (g0 > OFFSET[5] + DUR[5]) break;
    const reach = g0 + toGap / SPEED;
    const broken = reach >= BREAK_AT && reach < FIXED_AT;
    const pts = broken ? trip('L1', 'L3a', g0, SPEED) : trip('L1', 'cl', g0, SPEED);
    packets.push({ id: `s${k}`, pts, end: broken ? 'die' : 'arrive' });
  }
}

// ── the stage (world coordinates = canvas coordinates at camera 1×) ─────────────
const F_LABEL = (px) => `font-family:"DM Sans";font-weight:600;font-size:${px}px`;
const wrapT = (k) => `translate(${DEV[k].x},${DEV[k].y}) scale(${S}) translate(${-DEV[k].x},${-DEV[k].y})`;
function stageSvg(p) {
  const ports = [...Array(8)].map((_, i) => `<rect x="${546 + i * 18}" y="404" width="12" height="10" rx="1.5" fill="${C.well}" stroke="${C.faint}" stroke-width="0.8"/><circle id="${p}pled${i}" cx="${552 + i * 18}" cy="396" r="2.2" fill="${C.line}"/>`).join('');
  const windows = [...Array(15)].map((_, i) => `<rect x="${1334 + (i % 3) * 34}" y="${302 + Math.floor(i / 3) * 18}" width="18" height="9" rx="1" fill="${C.raised}"/>`).join('');
  const linkPair = (id, pts) => { const d = dPath(pts); const len = length(bez(...pts)).toFixed(1);
    return `<path id="${p}${id}-base" d="${d}" fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${len} ${len}" stroke-dashoffset="0"/>
      <path id="${p}${id}-lit" d="${d}" fill="none" stroke="${C.primary}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${len} ${len}" stroke-dashoffset="${len}" data-len="${len}"/>`; };
  const chip = (i, x) => `<g transform="translate(${x.toFixed(1)},625)"><g id="${p}chip${i}" opacity="0">
      <circle id="${p}chip${i}-c" r="30" fill="${C.bg}" stroke="${C.primary}" stroke-width="2.5"/>
      <text id="${p}chip${i}-n" y="9.5" text-anchor="middle" style="font-family:'DM Mono';font-weight:500;font-size:28px" fill="${C.text}">${i}</text>
      <path id="${p}chip${i}-ok" d="M-12,1 L-4,9 L13,-9" fill="none" stroke="${C.bg}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
      <path id="${p}chip${i}-x" d="M-9,-9 L9,9 M9,-9 L-9,9" fill="none" stroke="${C.bg}" stroke-width="4" stroke-linecap="round" opacity="0"/>
    </g></g>`;
  const label = (id, x, y, t, sub, px = 34) => `<g id="${p}lab-${id}" opacity="0"><text x="${x}" y="${y}" text-anchor="middle" style='${F_LABEL(px)}' fill="${C.text}">${t}</text>${sub ? `<text x="${x}" y="${y + 34}" text-anchor="middle" style='font-family:"DM Sans";font-weight:400;font-size:24px' fill="${C.muted}">${sub}</text>` : ''}</g>`;
  return `<svg class="${p}svg" viewBox="0 0 1920 1080" width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="${p}grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40,0 H0 V40" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="1"/></pattern>
    <filter id="${p}glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect x="-2000" y="-2000" width="6000" height="5000" fill="url(#${p}grid)"/>

  <!-- links (base = unlit, lit = drawn on) -->
  ${linkPair('L1', L1)}${linkPair('L2', L2)}${linkPair('L3a', L3a)}${linkPair('L3b', L3b)}${linkPair('L4', L4)}
  <g transform="translate(${GAP.x},${GAP.y})"><g id="${p}gapmark" opacity="0"><path d="M-11,-11 L11,11 M11,-11 L-11,11" stroke="${C.neg}" stroke-width="5" stroke-linecap="round"/></g></g>

  <!-- school computer -->
  <g transform="${wrapT('pc')}"><g id="${p}dev-pc">
    <rect x="130" y="296" width="140" height="96" rx="8" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.6"/>
    <rect x="140" y="306" width="120" height="74" rx="3" fill="${C.well}"/>
    <rect x="193" y="392" width="14" height="14" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.4"/>
    <rect x="160" y="406" width="80" height="8" rx="4" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.4"/>
    <rect x="190" y="385" width="20" height="2.4" rx="1.2" fill="${C.primary}"/>
    <g id="${p}scr-noinet">
      <circle cx="200" cy="331" r="10.5" fill="none" stroke="${C.muted}" stroke-width="1.6"/>
      <ellipse cx="200" cy="331" rx="4.5" ry="10.5" fill="none" stroke="${C.muted}" stroke-width="1.2"/>
      <line x1="189.5" y1="331" x2="210.5" y2="331" stroke="${C.muted}" stroke-width="1.2"/>
      <line x1="189" y1="320" x2="211" y2="342" stroke="${C.neg}" stroke-width="2.4" stroke-linecap="round"/>
      <text id="${p}scr-noinet-t" x="200" y="363" text-anchor="middle" style='font-family:"DM Sans";font-weight:600;font-size:10px' fill="${C.text}">No internet</text>
    </g>
    <g id="${p}scr-idle" opacity="0">
      <rect x="148" y="313" width="104" height="8" rx="2" fill="${C.raised}"/>
      <rect x="152" y="329" width="70" height="4" rx="2" fill="${C.raised}"/><rect x="152" y="339" width="90" height="4" rx="2" fill="${C.raised}"/><rect x="152" y="349" width="56" height="4" rx="2" fill="${C.raised}"/>
    </g>
    <g id="${p}scr-ok" opacity="0">
      <circle cx="176" cy="343" r="5" fill="${C.pos}"/>
      <text x="186" y="347" style='font-family:"DM Sans";font-weight:600;font-size:11px' fill="${C.pos}">Connected</text>
    </g>
  </g></g>

  <!-- network switch -->
  <g transform="${wrapT('sw')}"><g id="${p}dev-sw">
    <rect x="530" y="384" width="180" height="42" rx="6" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.6"/>
    <rect x="530" y="384" width="4" height="42" rx="2" fill="${C.primary}"/>
    ${ports}
    <circle id="${p}sw-pwr" cx="698" cy="395" r="3" fill="${C.line}"/>
  </g></g>

  <!-- router -->
  <g transform="${wrapT('rt')}"><g id="${p}dev-rt">
    <line x1="955" y1="380" x2="945" y2="324" stroke="${C.muted}" stroke-width="3" stroke-linecap="round"/><circle cx="945" cy="321" r="4" fill="${C.muted}"/>
    <line x1="1045" y1="380" x2="1055" y2="324" stroke="${C.muted}" stroke-width="3" stroke-linecap="round"/><circle cx="1055" cy="321" r="4" fill="${C.muted}"/>
    <rect x="930" y="380" width="140" height="46" rx="10" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.6"/>
    <rect x="930" y="380" width="140" height="3.5" rx="1.7" fill="${C.primary}"/>
    <circle id="${p}rt-pwr" cx="968" cy="403" r="3.6" fill="${C.line}"/><circle cx="986" cy="403" r="3.6" fill="${C.line}"/><circle cx="1004" cy="403" r="3.6" fill="${C.line}"/>
    <circle id="${p}rt-wan" cx="1050" cy="401" r="4.2" fill="${C.line}"/>
    <text x="1050" y="419" text-anchor="middle" style='font-family:"DM Mono";font-weight:500;font-size:9px' fill="${C.muted}">WAN</text>
  </g></g>

  <!-- internet provider -->
  <g transform="${wrapT('isp')}"><g id="${p}dev-isp">
    <line x1="1380" y1="288" x2="1380" y2="252" stroke="${C.muted}" stroke-width="3" stroke-linecap="round"/><circle cx="1380" cy="248" r="5" fill="${C.muted}"/>
    <path d="M1366,240 A20,20 0 0 1 1394,240 M1358,232 A31,31 0 0 1 1402,232" fill="none" stroke="${C.muted}" stroke-width="2" stroke-linecap="round"/>
    <rect x="1318" y="288" width="124" height="138" rx="4" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.6"/>
    <rect x="1318" y="288" width="124" height="4" rx="2" fill="${C.primary}"/>
    ${windows}
    <rect x="1368" y="400" width="24" height="26" rx="2" fill="${C.well}" stroke="${C.muted}" stroke-width="1.2"/>
  </g></g>

  <!-- the internet -->
  <g transform="${wrapT('net')}"><g id="${p}dev-net">
    <path d="M1652,380 H1808 C1840,380 1852,346 1832,326 C1836,292 1800,272 1774,286 C1760,254 1712,252 1698,286 C1668,280 1646,304 1656,330 C1630,338 1630,380 1652,380 Z" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.8"/>
    <path d="M1700,344 H1780 M1712,328 H1768" stroke="${C.primary}" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>
  </g></g>

  <!-- labels (appear when named) -->
  ${label('pc', 200, 505, 'School computer')}
  ${label('cable', 404, 360, 'Ethernet cable', '', 26)}
  ${label('sw', 620, 505, 'Switch', 'joins every computer in the building')}
  ${label('rt', 1000, 505, 'Router', "the school's gateway")}
  ${label('isp', 1380, 505, 'Internet provider', 'carries the school out')}
  ${label('net', 1740, 505, 'The internet')}

  <!-- the check-in-order rail -->
  <g id="${p}rail" opacity="0">
    <text x="64" y="632" style='font-family:"DM Sans";font-weight:600;font-size:19px;letter-spacing:2.6px' fill="${C.primary}">CHECK IN ORDER</text>
    <path d="M300,578 H1262" stroke="${C.primary}" stroke-opacity="0.45" stroke-width="2"/><path d="M1252,571 L1264,578 L1252,585" fill="none" stroke="${C.primary}" stroke-opacity="0.45" stroke-width="2" stroke-linejoin="round"/>
  </g>
  ${chip(1, MID(L1).x)}${chip(2, 620)}${chip(3, 1000)}${chip(4, GAP.x)}
  <text id="${p}fault" x="${GAP.x.toFixed(1)}" y="694" text-anchor="middle" opacity="0" style='font-family:"DM Sans";font-weight:700;font-size:20px;letter-spacing:2.8px' fill="${C.neg}">FAULT</text>

  <!-- the callout -->
  <g id="${p}callout" opacity="0">
    <text x="1165" y="205" text-anchor="middle" style='font-family:"DM Sans";font-weight:700;font-size:28px;letter-spacing:3px' fill="${C.neg}">FIRST DARK LIGHT</text>
    <path id="${p}leader" d="M1150,222 C1120,280 ${WAN.x + 10},330 ${WAN.x},${(WAN.y - 9).toFixed(1)}" fill="none" stroke="${C.neg}" stroke-width="2" stroke-dasharray="4 5"/>
  </g>

  <!-- the lesson -->
  <g id="${p}lesson" opacity="0">
    <g transform="translate(795,34) scale(1.1)">${LOGO_DARK}</g>
    <rect x="912" y="90" width="96" height="3" rx="1.5" fill="${C.gold}"/>
    <text x="960" y="164" text-anchor="middle" style='font-family:"DM Sans";font-weight:600;font-size:62px;letter-spacing:-1.2px' fill="${C.text}">Check the links in order.</text>
  </g>

  <g id="${p}packets"></g>
</svg>`;
}

// ── per-frame timelines (browser code, as strings built from data) ─────────────
const r3 = (n) => +n.toFixed(3);
function frameFile(f, id, body) {
  const p = `f${f}-`;   // element ids must start with a letter: `#01-…` is not a valid selector
  const dur = DUR[f];
  const inWindow = packets
    .map((pk) => ({ ...pk, pts: pk.pts.map((q) => ({ t: r3(q.g - OFFSET[f]), x: q.x, y: q.y })) }))
    .filter((pk) => pk.pts[pk.pts.length - 1].t > 0 && pk.pts[0].t < dur);
  return `<template>
  <style>
    @font-face { font-family: "DM Sans"; src: url("assets/fonts/DMSans-Variable.ttf") format("truetype"); font-weight: 100 1000; }
    @font-face { font-family: "DM Mono"; src: url("assets/fonts/DMMono-Medium.ttf") format("truetype"); font-weight: 500; }
    #root { position: absolute; inset: 0; overflow: hidden; font-family: "DM Sans", sans-serif; }
    #${p}ground { position: absolute; inset: 0; background: ${C.bg}; }
    #${p}view { position: absolute; inset: 0; }
    #${p}cam-scale { position: absolute; inset: 0; transform-origin: ${CAM.cx}px ${CAM.cy}px; }
    #${p}cam-move { position: absolute; inset: 0; }
    #${p}bug { position: absolute; top: 46px; right: 58px; width: 232px; height: 24px; opacity: 0; }
    #${p}bug svg { display: block; width: 100%; height: 100%; }
    .${p}svg { position: absolute; left: 0; top: 0; overflow: visible; }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1920" data-height="1080" data-duration="${dur}">
    <div id="${p}ground" class="clip" data-start="0" data-duration="${dur}" data-track-index="0"></div>
    <div id="${p}view" class="clip" data-start="0" data-duration="${dur}" data-track-index="1">
      <div id="${p}cam-scale" data-layout-allow-overflow><div id="${p}cam-move">
${stageSvg(p)}
      </div></div>
      <div id="${p}bug"><svg viewBox="0 0 300 31" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Opportunity Education">${LOGO_DARK}</svg></div>
    </div>
  </div>
  <script>
  (function () {
    var P = ${JSON.stringify(p)}, $ = function (s) { return document.getElementById(P + s); };
    var C = ${JSON.stringify(C)}, CX = ${CAM.cx}, CY = ${CAM.cy};
    var tl = gsap.timeline({ paused: true });
    /** Camera: world point (px,py) at the frame's centre, zoom s. Two nested wrappers,
        so the focus travels in a straight line while the zoom changes. */
    function cam(s, px, py, at, dur, ease) {
      var to = { x: CX - px, y: CY - py, duration: dur || 0, ease: ease || 'power2.inOut' };
      if (!dur) { tl.set($('cam-move'), { x: CX - px, y: CY - py }, at); tl.set($('cam-scale'), { scale: s }, at); return; }
      tl.to($('cam-move'), to, at);
      tl.to($('cam-scale'), { scale: s, duration: dur, ease: ease || 'power2.inOut' }, at);
    }
    function show(el, at, d, from) { tl.fromTo(el, Object.assign({ opacity: 0 }, from || {}), { opacity: 1, x: 0, y: 0, duration: d || 0.5, ease: 'power3.out' }, at); }
    function drawLink(key, at, d) { var el = $(key + '-lit'); tl.to(el, { strokeDashoffset: 0, duration: d, ease: 'none' }, at); }
    function linkOn(key, at) { tl.set($(key + '-lit'), { strokeDashoffset: 0 }, at); }
    function dim(key, o, at) { tl.set($('dev-' + key), { opacity: o }, at); }
    function led(id, color, at) { tl.to($(id), { attr: { fill: color }, duration: 0.18, ease: 'power1.out' }, at); }
    function chipFlip(i, ok, at) {
      var col = ok ? C.pos : C.neg;
      tl.to($('chip' + i + '-c'), { attr: { fill: col, stroke: col }, duration: 0.2, ease: 'power2.out' }, at);
      tl.to($('chip' + i + '-n'), { opacity: 0, duration: 0.12 }, at);
      tl.to($('chip' + i + (ok ? '-ok' : '-x')), { opacity: 1, duration: 0.15 }, at + 0.06);
      tl.fromTo($('chip' + i), { scale: 1.16 }, { scale: 1, duration: 0.35, ease: 'power3.out', transformOrigin: '50% 50%' }, at);
    }
    function chipsIn(at, stagger, rise) {
      for (var i = 1; i <= 4; i++) tl.fromTo($('chip' + i), { opacity: 0, y: rise || 0 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, at + (i - 1) * stagger);
    }
    // Packets: pre-sampled global schedule, sliced to this frame.
    var PK = ${JSON.stringify(inWindow.map((pk) => ({ id: pk.id, end: pk.end, pts: pk.pts.map((q) => [q.t, q.x, q.y]) })))};
    var layer = $('packets'), NS = 'http://www.w3.org/2000/svg';
    PK.forEach(function (pk) {
      var el = document.createElementNS(NS, 'rect');
      el.setAttribute('id', P + 'pk-' + pk.id); el.setAttribute('x', -8); el.setAttribute('y', -6);
      el.setAttribute('width', 16); el.setAttribute('height', 12); el.setAttribute('rx', 3);
      el.setAttribute('fill', C.primary); el.setAttribute('filter', 'url(#' + P + 'glow)'); el.setAttribute('opacity', 0);
      layer.appendChild(el);
      var pts = pk.pts, i0 = 0;
      while (i0 < pts.length - 1 && pts[i0 + 1][0] <= 0) i0++;          // already in flight at t=0
      var start = Math.max(0, pts[i0][0]);
      var first = pts[i0];
      if (pts[i0][0] < 0 && i0 < pts.length - 1) {                        // interpolate the exact position at t=0
        var a = pts[i0], b = pts[i0 + 1], u = (0 - a[0]) / (b[0] - a[0]);
        first = [0, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
      }
      tl.set(el, { x: first[1], y: first[2], opacity: 1 }, start);
      var kf = [], last = first[0];
      for (var k = i0 + 1; k < pts.length; k++) { kf.push({ x: pts[k][1], y: pts[k][2], duration: pts[k][0] - last, ease: 'none' }); last = pts[k][0]; }
      if (kf.length) tl.to(el, { keyframes: kf }, start);
      if (pk.end === 'die') {
        tl.to(el, { attr: { fill: C.neg }, duration: 0.08 }, last);
        tl.to(el, { scale: 1.8, opacity: 0, duration: 0.45, ease: 'power2.out', transformOrigin: '50% 50%' }, last + 0.06);
      } else {
        tl.to(el, { opacity: 0, duration: 0.25, ease: 'power1.in' }, last - 0.2);
      }
    });
${body}
    window.__timelines[${JSON.stringify(id)}] = tl;
  })();
  </script>
</template>
`;
}

/**
 * A long zoom-out, anchored. Tweening zoom and focus independently makes a 7:1 pull-back swing
 * through empty cable halfway (seen at 1.6s in the first render). Here the zoom is interpolated
 * in log space and the anchor (the computer's screen) holds the centre until the zoom is mostly
 * done, then eases to where it sits in the wide shot. Returned as plain keyframes.
 */
function anchoredZoom(s0, s1, A, fEnd, dur, n = 72) {
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const endScreen = P(CAM.cx + s1 * (A.x - fEnd.x), CAM.cy + s1 * (A.y - fEnd.y));
  const move = [], scale = [];
  for (let k = 1; k <= n; k++) {
    const u = k / n, e = ease(u), e2 = ease(Math.min(1, Math.max(0, (u - 0.3) / 0.7)));
    const sc = Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * e);
    const sx = CAM.cx + (endScreen.x - CAM.cx) * e2, sy = CAM.cy + (endScreen.y - CAM.cy) * e2;
    const fx = A.x - (sx - CAM.cx) / sc, fy = A.y - (sy - CAM.cy) / sc;
    move.push({ x: +(CAM.cx - fx).toFixed(2), y: +(CAM.cy - fy).toFixed(2), duration: +(dur / n).toFixed(4), ease: 'none' });
    scale.push({ scale: +sc.toFixed(4), duration: +(dur / n).toFixed(4), ease: 'none' });
  }
  return { move, scale };
}
const Z1 = anchoredZoom(6.8, 1, SCREEN, P(CAM.cx, CAM.cy), 3.45);

// ── the five shots ──────────────────────────────────────────────────────────────
const four = word(1, 'four') ?? cue(1, 1) + 0.9;
const LINKS = ['L1', 'L2', 'L3a', 'L3b', 'L4'];
const allLit = (at) => LINKS.map((k) => `    linkOn('${k}', ${at});`).join('\n');
const devDim = (keys, o) => keys.map((k) => `    dim('${k}', ${o}, 0);`).join('\n');
const labelsOn = ['pc', 'cable', 'sw', 'rt', 'isp', 'net'].map((k) => `    tl.set($('lab-${k}'), { opacity: 1 }, 0);`).join('\n');
const brokenState = (at) => `    tl.set($('L3a-lit'), { attr: { stroke: C.neg }, strokeDashoffset: 26 }, ${at}); tl.set($('L3a-base'), { strokeDashoffset: 26 }, ${at});
    tl.set($('L3b-lit'), { attr: { stroke: C.neg }, strokeDashoffset: -26 }, ${at}); tl.set($('L3b-base'), { strokeDashoffset: -26 }, ${at});
    tl.set($('L4-lit'), { strokeDashoffset: $('L4-lit').getAttribute('data-len') }, ${at});
    tl.set($('gapmark'), { opacity: 1 }, ${at});
    dim('isp', 0.28, ${at}); dim('net', 0.28, ${at});
    tl.set($('rt-wan'), { attr: { fill: C.neg } }, ${at});`;
const greens = (at) => `    tl.set($('pled0'), { attr: { fill: C.pos } }, ${at}); tl.set($('sw-pwr'), { attr: { fill: C.pos } }, ${at}); tl.set($('rt-pwr'), { attr: { fill: C.pos } }, ${at});`;

const FRAMES = {
  1: ['01-no-internet', `
    tl.set($('scr-noinet-t'), { opacity: 1 }, 0);
    tl.fromTo($('bug'), { opacity: 0 }, { opacity: 0.9, duration: 0.6, ease: 'power1.out' }, 0.3);
${devDim(['sw', 'rt', 'isp', 'net'], 0.35)}
    // Scene 1-3: one continuous zoom-out from the dead screen to the whole chain, decelerating to rest.
    cam(6.8, ${SCREEN.x}, ${SCREEN.y}, 0);
    tl.to($('cam-move'), { keyframes: ${JSON.stringify(Z1.move)} }, 0.05);
    tl.to($('cam-scale'), { keyframes: ${JSON.stringify(Z1.scale)} }, 0.05);
    tl.to($('scr-noinet-t'), { opacity: 0.35, duration: 0.08 }, 0.32); tl.to($('scr-noinet-t'), { opacity: 1, duration: 0.08 }, 0.42);
    // "four links": the chain is numbered, left to right.
    chipsIn(${r3(four + cue(1, 1) * 0 + 0.0)}, 0.09, 14);`],
  2: ['02-the-path', `
    tl.set($('bug'), { opacity: 0.9 }, 0);
    tl.set($('scr-noinet'), { opacity: 1 }, 0);
${devDim(['sw', 'rt', 'isp', 'net'], 0.35)}
    chipsIn(0, 0, 0); tl.set([$('chip1'), $('chip2'), $('chip3'), $('chip4')], { opacity: 1 }, 0);
    tl.to([$('chip1'), $('chip2'), $('chip3'), $('chip4')], { opacity: 0, duration: 0.3, ease: 'power1.out' }, 0.02);
    tl.to($('scr-noinet'), { opacity: 0, duration: 0.3 }, 0.02); tl.to($('scr-idle'), { opacity: 1, duration: 0.3 }, 0.1);
    cam(1, 960, 440, 0);
    // "Your computer sends packets,"
    cam(1.5, 330, 420, ${r3(cue(2, 0))}, 1.3);
    show($('lab-pc'), ${r3(cue(2, 0) + 0.05)}, 0.5, { y: 10 });
    // "down the cable,"
    drawLink('L1', ${r3(cue(2, 1))}, ${r3(cue(2, 2) - cue(2, 1) - 0.05)});
    show($('lab-cable'), ${r3(cue(2, 1) + 0.05)}, 0.5, { y: 10 });
    cam(1.5, 560, 420, ${r3(cue(2, 1))}, 1.15);
    // "to the switch,"
    tl.to($('dev-sw'), { opacity: 1, duration: 0.35, ease: 'power2.out' }, ${r3(cue(2, 2))});
    show($('lab-sw'), ${r3(cue(2, 2) + 0.05)}, 0.5, { y: 10 });
    [0, 1, 2, 3, 4, 5, 6, 7].forEach(function (i) { tl.to($('pled' + i), { attr: { fill: C.pos }, duration: 0.1 }, ${r3(cue(2, 2) + 0.05)} + i * 0.03); if (i) tl.to($('pled' + i), { attr: { fill: C.line }, duration: 0.2 }, ${r3(cue(2, 2) + 0.4)} + i * 0.03); });
    tl.to($('sw-pwr'), { attr: { fill: C.pos }, duration: 0.2 }, ${r3(cue(2, 2) + 0.05)});
    drawLink('L2', ${r3(cue(2, 2) + 0.2)}, ${r3(cue(2, 3) - cue(2, 2) - 0.25)});
    cam(1.5, 800, 420, ${r3(cue(2, 2))}, 1.15);
    // "through the router,"
    tl.to($('dev-rt'), { opacity: 1, duration: 0.35, ease: 'power2.out' }, ${r3(cue(2, 3))});
    show($('lab-rt'), ${r3(cue(2, 3) + 0.05)}, 0.5, { y: 10 });
    tl.to($('rt-pwr'), { attr: { fill: C.pos }, duration: 0.2 }, ${r3(cue(2, 3) + 0.05)});
    drawLink('L3a', ${r3(cue(2, 3) + 0.18)}, 0.44); drawLink('L3b', ${r3(cue(2, 3) + 0.62)}, ${r3(cue(2, 4) - cue(2, 3) - 0.67)});
    tl.to($('rt-wan'), { attr: { fill: C.pos }, duration: 0.2 }, ${r3(cue(2, 3) + 0.2)});
    cam(1.5, 1090, 410, ${r3(cue(2, 3))}, 1.15);
    // "to your provider,"
    tl.to($('dev-isp'), { opacity: 1, duration: 0.35, ease: 'power2.out' }, ${r3(cue(2, 4))});
    show($('lab-isp'), ${r3(cue(2, 4) + 0.05)}, 0.5, { y: 10 });
    drawLink('L4', ${r3(cue(2, 4) + 0.45)}, ${r3(cue(2, 5) - cue(2, 4) - 0.5)});
    cam(1.5, 1400, 400, ${r3(cue(2, 4))}, 1.3);
    // "and out to the internet." — the whole chain, flowing
    tl.to($('dev-net'), { opacity: 1, duration: 0.35, ease: 'power2.out' }, ${r3(cue(2, 5))});
    show($('lab-net'), ${r3(cue(2, 5) + 0.05)}, 0.5, { y: 10 });
    cam(1, 960, 440, ${r3(cue(2, 5) + 0.05)}, 1.4, 'power3.inOut');`],
  3: ['03-link-breaks', `
    tl.set($('bug'), { opacity: 0.9 }, 0);
${labelsOn}
${allLit(0)}
    tl.set($('scr-noinet'), { opacity: 0 }, 0); tl.set($('scr-idle'), { opacity: 1 }, 0);
${greens(0)}    tl.set($('rt-wan'), { attr: { fill: C.pos } }, 0);
    cam(1, 960, 440, 0);
    // Scene 2: the provider line flashes red and snaps; the far side goes grey.
    var B = ${r3(BREAK_AT - OFFSET[3])};
    tl.to([$('L3a-lit'), $('L3b-lit')], { attr: { stroke: C.neg }, duration: 0.12 }, B - 0.25);
    tl.to([$('L3a-lit'), $('L3a-base')], { strokeDashoffset: 26, duration: 0.3, ease: 'power3.out' }, B);
    tl.to([$('L3b-lit'), $('L3b-base')], { strokeDashoffset: -26, duration: 0.3, ease: 'power3.out' }, B);
    tl.fromTo($('gapmark'), { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power3.out', transformOrigin: '50% 50%' }, B + 0.05);
    tl.to($('L4-lit'), { strokeDashoffset: $('L4-lit').getAttribute('data-len'), duration: 0.5, ease: 'power2.in' }, B + 0.1);
    tl.to([$('dev-isp'), $('dev-net'), $('lab-isp'), $('lab-net')], { opacity: 0.28, duration: 0.5, ease: 'power2.out' }, B + 0.1);
    tl.to($('rt-wan'), { attr: { fill: C.neg }, duration: 0.15 }, B + 0.05);
    // Scene 3: the camera goes to the consequence — the gap, and the packets dying at it.
    cam(1.6, 1105, 412, ${r3(cue(3, 1) - 0.1)}, 1.1, 'power2.inOut');`],
  4: ['04-check-in-order', `
    tl.set($('bug'), { opacity: 0.9 }, 0);
${labelsOn}
${allLit(0)}
${brokenState(0)}
    tl.set([$('lab-isp'), $('lab-net')], { opacity: 0.28 }, 0);
    tl.set($('scr-noinet'), { opacity: 0 }, 0); tl.set($('scr-idle'), { opacity: 1 }, 0);
    cam(1.6, 1105, 412, 0);
    // Scene 1: back to the whole chain; the rail and the four numbered checks.
    cam(1, 960, 440, ${r3(cue(4, 0))}, 1.4, 'power2.inOut');
    tl.fromTo($('rail'), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' }, ${r3(cue(4, 0) + 0.5)});
    chipsIn(${r3(cue(4, 0) + 1.0)}, 0.12, 16);
    // Scenes 2-5: one check per word, from the computer out.
    chipFlip(1, true, ${r3(cue(4, 1) + 0.04)}); led('pled0', C.pos, ${r3(cue(4, 1) + 0.04)});
    chipFlip(2, true, ${r3(cue(4, 2) + 0.04)}); led('sw-pwr', C.pos, ${r3(cue(4, 2) + 0.04)});
    chipFlip(3, true, ${r3(cue(4, 3) + 0.04)}); led('rt-pwr', C.pos, ${r3(cue(4, 3) + 0.04)});
    chipFlip(4, false, ${r3(cue(4, 4) + 0.04)});
    tl.fromTo($('fault'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, ${r3(cue(4, 4) + 0.12)});
    [0, 1].forEach(function (k) { tl.to($('rt-wan'), { attr: { fill: C.line }, duration: 0.18 }, ${r3(cue(4, 4) + 0.1)} + k * 0.44); tl.to($('rt-wan'), { attr: { fill: C.neg }, duration: 0.18 }, ${r3(cue(4, 4) + 0.32)} + k * 0.44); });
    tl.to($('rt-wan'), { attr: { fill: C.line }, duration: 0.25 }, ${r3(cue(4, 4) + 1.05)});
    // Scene 6: the answer, pointed at.
    cam(1.25, 1080, 420, ${r3(cue(4, 5))}, 1.4, 'power2.inOut');
    tl.fromTo($('callout'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, ${r3(cue(4, 5) + 0.15)});`],
  5: ['05-back-online', `
    tl.set($('bug'), { opacity: 0.9 }, 0);
${labelsOn}
${allLit(0)}
${brokenState(0)}
    tl.set([$('lab-isp'), $('lab-net')], { opacity: 0.28 }, 0);
    tl.set($('scr-noinet'), { opacity: 0 }, 0); tl.set($('scr-idle'), { opacity: 1 }, 0);
${greens(0)}
    tl.set($('rt-wan'), { attr: { fill: C.line } }, 0);
    tl.set($('rail'), { opacity: 1 }, 0); tl.set([$('chip1'), $('chip2'), $('chip3'), $('chip4')], { opacity: 1 }, 0);
    ['1', '2', '3'].forEach(function (i) { tl.set($('chip' + i + '-c'), { attr: { fill: C.pos, stroke: C.pos } }, 0); tl.set($('chip' + i + '-n'), { opacity: 0 }, 0); tl.set($('chip' + i + '-ok'), { opacity: 1 }, 0); });
    tl.set($('chip4-c'), { attr: { fill: C.neg, stroke: C.neg } }, 0); tl.set($('chip4-n'), { opacity: 0 }, 0); tl.set($('chip4-x'), { opacity: 1 }, 0);
    tl.set($('fault'), { opacity: 1 }, 0); tl.set($('callout'), { opacity: 1 }, 0);
    cam(1.25, 1080, 420, 0);
    // Scene 1: "Fix that one link," — the ends draw together, the line goes blue, the check turns green.
    var F = ${r3(FIXED_AT - OFFSET[5])};
    tl.to($('callout'), { opacity: 0, duration: 0.35, ease: 'power1.out' }, ${r3(cue(5, 0))});
    tl.to([$('L3a-lit'), $('L3a-base')], { strokeDashoffset: 0, duration: 0.5, ease: 'power3.inOut' }, F - 0.5);
    tl.to([$('L3b-lit'), $('L3b-base')], { strokeDashoffset: 0, duration: 0.5, ease: 'power3.inOut' }, F - 0.5);
    tl.to($('gapmark'), { opacity: 0, duration: 0.25 }, F - 0.45);
    tl.to([$('L3a-lit'), $('L3b-lit')], { attr: { stroke: C.primary }, duration: 0.3 }, F - 0.05);
    tl.to($('fault'), { opacity: 0, duration: 0.25 }, F - 0.1);
    tl.to($('chip4-x'), { opacity: 0, duration: 0.12 }, F); chipFlip(4, true, F);
    led('rt-wan', C.pos, F);
    cam(1, 960, 440, ${r3(cue(5, 0) + 0.1)}, 1.5, 'power2.inOut');
    // Scene 2: "and the school is back online."
    tl.to($('L4-lit'), { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' }, F + 0.25);
    tl.to([$('dev-isp'), $('dev-net'), $('lab-isp'), $('lab-net')], { opacity: 1, duration: 0.5, ease: 'power2.out' }, F + 0.2);
    tl.to($('scr-idle'), { opacity: 0, duration: 0.25 }, ${r3(cue(5, 1))}); tl.to($('scr-ok'), { opacity: 1, duration: 0.3 }, ${r3(cue(5, 1) + 0.1)});
    // Scene 3: the one line to remember, held.
    tl.to($('rail'), { opacity: 0, duration: 0.4 }, ${r3(cue(5, 1) + 1.1)});
    tl.to([$('chip1'), $('chip2'), $('chip3'), $('chip4')], { opacity: 0, duration: 0.4 }, ${r3(cue(5, 1) + 1.1)});
    tl.to($('bug'), { opacity: 0, duration: 0.4, ease: 'power1.in' }, ${r3(cue(5, 1) + 1.0)});
    tl.fromTo($('lesson'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, ${r3(cue(5, 1) + 1.3)});`],
};

mkdirSync('compositions/frames', { recursive: true });
for (const [f, [id, body]] of Object.entries(FRAMES)) {
  writeFileSync(`compositions/frames/${id}.html`, frameFile(Number(f), id, body));
  console.log(`${id}: ${DUR[f]}s, starts at ${OFFSET[f]}s`);
}
console.log(`packets: ${packets.length} (${packets.filter((p) => p.end === 'die').length} die at the break)`);
