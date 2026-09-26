/**
 * The OE motion language, as reusable primitives (DIRECTION.md recommendations 1–3, D38).
 *
 * Proved in the directed prototype (episode 00 v2) and promoted here so every episode moves with
 * the same personality and investigates the same way:
 *   TEMPO            one set of speeds, holds and eases per purpose
 *   tag              NAME + role, shown only while the camera is there
 *   sideBracket      a bracket over a group of ports with a short label (e.g. LAN · the school side)
 *   leader           a thin dashed line joining a check to the light it checks
 *   seekRing / seek  a light being looked at (a dashed ring that pulses)
 *   check            DiagnosticCheck: numbered chip + seeking state + leader + ✓/✕
 *   faultDomain      a bounded region with its label at the bottom edge
 *   causesCard       ranked likely causes; the first can be highlighted
 *   plug / plugLoose / plugSeat   CableReconnect: an RJ45 plug that hangs loose and is pushed home
 *   bigLabel         one strong message in world space (FIRST FAILED LINK, CONNECTION RESTORED)
 *
 * SVG builders return (p) => markup for Stage.add(); timeline builders return browser JS for a frame body.
 */
import { C } from './palette.mjs';

/** Motion tokens: the same state always moves the same way. */
export const TEMPO = {
  travel: 540,          // px/s — a packet on an ordinary journey
  verify: 1600,         // px/s — the test that proves a fix travels fastest
  flow: 700,            // px/s — calm restored traffic
  holdAfterFailure: 0.9, // s of stillness after something fails
  look: 0.85,           // s a check "looks" before it resolves
  track: 'sine.inOut',  // camera following a moving thing
  push: 'power2.inOut', // camera moving to a new subject
  reveal: 'power3.inOut', // long pull-backs and returns
};

const T = (x, y, t, px, fill, w = 600, ls = 0, anchor = 'middle', extra = '') =>
  `<text${extra} x="${x}" y="${y}" text-anchor="${anchor}" style='font-family:"DM Sans";font-weight:${w};font-size:${px}px;letter-spacing:${ls}px' fill="${fill}">${t}</text>`;
export const text = T;

export const tag = (id, x, y, name, role) => (p) =>
  `<g id="${p}${id}" opacity="0">${T(x, y, name, 22, C.text, 700, 3.2)}${role ? T(x, y + 28, role, 19, C.muted, 400) : ''}</g>`;

export const sideBracket = (id, x0, x1, y, label) => (p) =>
  `<g id="${p}${id}" opacity="0"><path d="M${x0},${y + 8} V${y} H${x1} V${y + 8}" fill="none" stroke="${C.primary}" stroke-width="1.6"/>${T((x0 + x1) / 2, y - 10, label, 15, C.text, 600, 0.4)}</g>`;

export const leader = (id, from, to) => (p) =>
  `<path id="${p}${id}" opacity="0" d="M${from.x},${from.y} L${to.x},${to.y}" stroke="${C.muted}" stroke-width="1.4" stroke-dasharray="3 4"/>`;

export const seekRing = (id, at, r = 11, color = C.warn) => (p) =>
  `<g transform="translate(${at.x},${at.y})"><g id="${p}${id}" opacity="0"><circle r="${r}" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="3 3"/></g></g>`;

/** Timeline: the ring pulses `times` times from `at` — something is being looked for. */
export const seek = (id, at, times = 2, gap = 0.88) => [...Array(times)].map((_, k) => {
  const t = +(at + k * gap).toFixed(3);
  return `tl.fromTo($('${id}'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out', transformOrigin: '50% 50%' }, ${t});
    tl.to($('${id}'), { scale: 1.35, opacity: 0, duration: 0.5, ease: 'power1.out', transformOrigin: '50% 50%' }, ${+(t + 0.35).toFixed(3)});`;
}).join('\n    ');

/**
 * DiagnosticCheck (timeline): chip n appears beside the light, looks (its ring turns from amber to blue
 * while the light is examined), then resolves ✓ or ✕. The leader `lead<n>`, if drawn, appears with it.
 */
export const check = (n, ledRef, at, ok, { restColor = 'C.pos' } = {}) => `tl.fromTo($('chip${n}'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, ${at});
    if ($('lead${n}')) tl.fromTo($('lead${n}'), { opacity: 0 }, { opacity: 1, duration: 0.35 }, ${+(at + 0.1).toFixed(3)});
    tl.fromTo($('chip${n}-c'), { attr: { stroke: C.warn } }, { attr: { stroke: C.primary }, duration: 0.5 }, ${at});
    ${ok ? `blink('${ledRef}', ${restColor}, ${+(at + 0.25).toFixed(3)}, 1, 0.3);` : ''}
    chipFlip(${n}, ${ok}, ${+(at + TEMPO.look).toFixed(3)});`;

export const faultDomain = (id, { x, y, w, h }, label, sub = '') => (p) =>
  `<g id="${p}${id}" opacity="0"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${C.neg}" fill-opacity="0.035" stroke="${C.neg}" stroke-opacity="0.75" stroke-width="1.8" stroke-dasharray="10 8"/>
    ${T(x + 22, y + h + 28, label, 18, C.neg, 700, 2.6, 'start')}${sub ? T(x + 22 + label.length * 13.2, y + h + 28, sub, 18, C.text, 500, 0, 'start') : ''}</g>`;

export const causesCard = (id, { x, y, w = 290 }, title, items) => (p) => {
  const h = 58 + items.length * 36;
  return `<g id="${p}${id}" opacity="0"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${C.surface}" stroke="${C.muted}" stroke-opacity="0.5" stroke-width="1.4"/>
    ${T(x + 22, y + 30, title, 14, C.muted, 600, 2.4, 'start')}
    <rect id="${p}${id}-1" opacity="0" x="${x + 12}" y="${y + 43}" width="${w - 24}" height="34" rx="8" fill="${C.primary}" fill-opacity="0.16" stroke="${C.primary}" stroke-opacity="0.6"/>
    ${items.map((t, i) => `${T(x + 30, y + 66 + i * 36, String(i + 1), 17, C.primary, 700, 0, 'start')}${T(x + 54, y + 66 + i * 36, t, 18, C.text, 500, 0, 'start')}`).join('')}</g>`;
};

/** CableReconnect: an RJ45 plug seated in the port whose bottom is at `port`; its boot ends 16 px below. */
export const plug = (id, port) => (p) => `<g><g id="${p}${id}" transform="translate(0,0)">
    <rect x="${port.x - 11}" y="${port.y - 22}" width="22" height="26" rx="2.5" fill="#c9cfdd" fill-opacity="0.22" stroke="${C.muted}" stroke-width="1.3"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${port.x - 8 + i * 3}" y="${port.y - 20}" width="1.6" height="6" fill="${C.warn}" opacity="0.8"/>`).join('')}
    <rect x="${port.x - 6}" y="${port.y + 4}" width="12" height="12" rx="2" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.2"/>
  </g></g>`;
export const plugLoose = (id, port) => `tl.set($('${id}'), { y: 15, rotation: 7, svgOrigin: '${port.x} ${port.y + 2}' }, 0);`;
/** Timeline: the plug is pushed home — a firm move, a tiny overshoot, seated. */
export const plugSeat = (id, port, at) => `tl.to($('${id}'), { y: 0, rotation: 0, duration: 0.32, ease: 'power3.in', svgOrigin: '${port.x} ${port.y + 2}' }, ${at});
    tl.to($('${id}'), { y: -1.5, duration: 0.06, ease: 'power1.out' }, ${+(at + 0.32).toFixed(3)}); tl.to($('${id}'), { y: 0, duration: 0.1 }, ${+(at + 0.38).toFixed(3)});`;

export const bigLabel = (id, x, y, t, color, px = 18, anchor = 'start') => (p) =>
  `<g id="${p}${id}" opacity="0">${T(x, y, t, px, color, 700, px >= 30 ? 4 : 2.2, anchor)}</g>`;
