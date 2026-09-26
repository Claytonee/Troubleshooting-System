/**
 * The device library: original flat SVG drawings in one line language.
 *
 * Each device is drawn in LOCAL coordinates around its anchor (0,0) — the point
 * where it sits on the baseline — and returns:
 *   svg(p, id)  the markup; element ids are `${p}${id}-…`, the group `${p}dev-${id}`
 *   ports       named attachment points (local), for links and packet routes
 *   leds        named status lights (local): ids `${p}${id}-led-${name}`
 *   screens     named screen states (ids `${p}${id}-scr-${name}`), first one visible
 *
 * Style: 1.6px strokes in `muted`, bodies in `surface`, recesses in `well`, one
 * `primary` accent stripe per device. No stock icons, no photos, nothing borrowed.
 */
import { C } from './palette.mjs';

const T = (x, y, s, fill, extra = '') => `<text x="${x}" y="${y}" text-anchor="middle" style='font-family:"DM Sans";font-weight:600;font-size:${s}px' fill="${fill}" ${extra}>`;
const MONO = (x, y, s, fill) => `<text x="${x}" y="${y}" text-anchor="middle" style='font-family:"DM Mono";font-weight:500;font-size:${s}px' fill="${fill}">`;
const led = (p, id, name, x, y, r = 3.4) => `<circle id="${p}${id}-led-${name}" cx="${x}" cy="${y}" r="${r}" fill="${C.line}"/>`;
const body = (x, y, w, h, rx = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.6"/>`;

/** Screen states shared by anything with a display. cx,cy = screen centre; k = scale. */
export const SCREENS = {
  noinet: (cx, cy, k = 1) => `
    <circle cx="${cx}" cy="${cy - 12 * k}" r="${10.5 * k}" fill="none" stroke="${C.muted}" stroke-width="${1.6 * k}"/>
    <ellipse cx="${cx}" cy="${cy - 12 * k}" rx="${4.5 * k}" ry="${10.5 * k}" fill="none" stroke="${C.muted}" stroke-width="${1.2 * k}"/>
    <line x1="${cx - 10.5 * k}" y1="${cy - 12 * k}" x2="${cx + 10.5 * k}" y2="${cy - 12 * k}" stroke="${C.muted}" stroke-width="${1.2 * k}"/>
    <line x1="${cx - 11 * k}" y1="${cy - 23 * k}" x2="${cx + 11 * k}" y2="${cy - 1 * k}" stroke="${C.neg}" stroke-width="${2.4 * k}" stroke-linecap="round"/>
    ${T(cx, cy + 20 * k, 10 * k, C.text)}No internet</text>`,
  idle: (cx, cy, k = 1) => `
    <rect x="${cx - 52 * k}" y="${cy - 30 * k}" width="${104 * k}" height="${8 * k}" rx="${2 * k}" fill="${C.raised}"/>
    <rect x="${cx - 48 * k}" y="${cy - 14 * k}" width="${70 * k}" height="${4 * k}" rx="${2 * k}" fill="${C.raised}"/>
    <rect x="${cx - 48 * k}" y="${cy - 4 * k}" width="${90 * k}" height="${4 * k}" rx="${2 * k}" fill="${C.raised}"/>
    <rect x="${cx - 48 * k}" y="${cy + 6 * k}" width="${56 * k}" height="${4 * k}" rx="${2 * k}" fill="${C.raised}"/>`,
  ok: (cx, cy, k = 1) => `
    <circle cx="${cx - 24 * k}" cy="${cy}" r="${5 * k}" fill="${C.pos}"/>
    <text x="${cx - 14 * k}" y="${cy + 4 * k}" style='font-family:"DM Sans";font-weight:600;font-size:${11 * k}px' fill="${C.pos}">Connected</text>`,
};
function screenStates(p, id, names, cx, cy, k) {
  return names.map((n, i) => `<g id="${p}${id}-scr-${n}"${i ? ' opacity="0"' : ''}>${(typeof n === 'string' && SCREENS[n] ? SCREENS[n](cx, cy, k) : '')}</g>`).join('');
}

// ── the prototype's five (coordinates carried over exactly) ─────────────────────

export const computer = ({ screens = ['noinet', 'idle', 'ok'] } = {}) => ({
  kind: 'computer',
  ports: { out: { x: 40, y: 0 } },
  leds: {},
  screen: { cx: 0, cy: -67, w: 120, h: 74 },
  svg: (p, id) => `<g id="${p}dev-${id}">
    <rect x="-70" y="-114" width="140" height="96" rx="8" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.6"/>
    <rect x="-60" y="-104" width="120" height="74" rx="3" fill="${C.well}"/>
    <rect x="-7" y="-18" width="14" height="14" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.4"/>
    <rect x="-40" y="-4" width="80" height="8" rx="4" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.4"/>
    <rect x="-10" y="-25" width="20" height="2.4" rx="1.2" fill="${C.primary}"/>
    ${screenStates(p, id, screens, 0, -67, 1)}
  </g>`,
});

export const netSwitch = ({ ports = 8 } = {}) => ({
  kind: 'switch',
  ports: { in: { x: -90, y: 5 }, out: { x: 90, y: 5 }, ...Object.fromEntries([...Array(ports)].map((_, i) => [`p${i}`, { x: -68 + i * 18, y: 4 }])) },
  leds: { pwr: { x: 78, y: -10 }, ...Object.fromEntries([...Array(ports)].map((_, i) => [`p${i}`, { x: -68 + i * 18, y: -9 }])) },
  svg: (p, id) => `<g id="${p}dev-${id}">
    ${body(-90, -21, 180, 42)}
    <rect x="-90" y="-21" width="4" height="42" rx="2" fill="${C.primary}"/>
    ${[...Array(ports)].map((_, i) => `<rect x="${-74 + i * 18}" y="-1" width="12" height="10" rx="1.5" fill="${C.well}" stroke="${C.faint}" stroke-width="0.8"/>${led(p, id, `p${i}`, -68 + i * 18, -9, 2.2)}`).join('')}
    ${led(p, id, 'pwr', 78, -10, 3)}
  </g>`,
});

export const router = () => ({
  kind: 'router',
  ports: { in: { x: -70, y: 5 }, out: { x: 70, y: 5 } },
  leds: { pwr: { x: -32, y: -2 }, lan: { x: -14, y: -2 }, wifi: { x: 4, y: -2 }, wan: { x: 50, y: -4 } },
  svg: (p, id) => `<g id="${p}dev-${id}">
    <line x1="-45" y1="-25" x2="-55" y2="-81" stroke="${C.muted}" stroke-width="3" stroke-linecap="round"/><circle cx="-55" cy="-84" r="4" fill="${C.muted}"/>
    <line x1="45" y1="-25" x2="55" y2="-81" stroke="${C.muted}" stroke-width="3" stroke-linecap="round"/><circle cx="55" cy="-84" r="4" fill="${C.muted}"/>
    ${body(-70, -25, 140, 46, 10)}
    <rect x="-70" y="-25" width="140" height="3.5" rx="1.7" fill="${C.primary}"/>
    ${led(p, id, 'pwr', -32, -2, 3.6)}${led(p, id, 'lan', -14, -2, 3.6)}${led(p, id, 'wifi', 4, -2, 3.6)}
    ${led(p, id, 'wan', 50, -4, 4.2)}
    ${MONO(50, 14, 9, C.muted)}WAN</text>
  </g>`,
});

export const isp = () => ({
  kind: 'isp',
  ports: { in: { x: -62, y: 0 }, mid: { x: 0, y: 0 }, up: { x: 0, y: -80 }, out: { x: 62, y: -80 } },
  leds: {},
  svg: (p, id) => `<g id="${p}dev-${id}">
    <line x1="0" y1="-122" x2="0" y2="-158" stroke="${C.muted}" stroke-width="3" stroke-linecap="round"/><circle cx="0" cy="-162" r="5" fill="${C.muted}"/>
    <path d="M-14,-170 A20,20 0 0 1 14,-170 M-22,-178 A31,31 0 0 1 22,-178" fill="none" stroke="${C.muted}" stroke-width="2" stroke-linecap="round"/>
    <rect x="-62" y="-122" width="124" height="138" rx="4" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.6"/>
    <rect x="-62" y="-122" width="124" height="4" rx="2" fill="${C.primary}"/>
    ${[...Array(15)].map((_, i) => `<rect x="${-46 + (i % 3) * 34}" y="${-108 + Math.floor(i / 3) * 18}" width="18" height="9" rx="1" fill="${C.raised}"/>`).join('')}
    <rect x="-12" y="-10" width="24" height="26" rx="2" fill="${C.well}" stroke="${C.muted}" stroke-width="1.2"/>
  </g>`,
});

export const cloud = () => ({
  kind: 'cloud',
  ports: { in: { x: -88, y: 32 }, mid: { x: -10, y: 6 } },
  leds: {},
  svg: (p, id) => `<g id="${p}dev-${id}">
    <path d="M-88,50 H68 C100,50 112,16 92,-4 C96,-38 60,-58 34,-44 C20,-76 -28,-78 -42,-44 C-72,-50 -94,-26 -84,0 C-110,8 -110,50 -88,50 Z" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.8"/>
    <path d="M-40,14 H40 M-28,-2 H28" stroke="${C.primary}" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>
  </g>`,
});

// ── new for the series ─────────────────────────────────────────────────────────

/** The school's LRS: a small server. `net` leaves from its back. */
export const lrs = () => ({
  kind: 'lrs',
  ports: { net: { x: 46, y: -14 }, in: { x: -46, y: -14 } },
  leds: { pwr: { x: -24, y: -104 }, disk: { x: -10, y: -104 }, net: { x: 4, y: -104 } },
  svg: (p, id) => `<g id="${p}dev-${id}">
    ${body(-46, -122, 92, 122, 7)}
    <rect x="-46" y="-122" width="4" height="122" rx="2" fill="${C.primary}"/>
    ${led(p, id, 'pwr', -24, -104, 3.4)}${led(p, id, 'disk', -10, -104, 3.4)}${led(p, id, 'net', 4, -104, 3.4)}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="-30" y="${-84 + i * 11}" width="60" height="4" rx="2" fill="${C.raised}"/>`).join('')}
    <circle cx="26" cy="-104" r="6" fill="none" stroke="${C.muted}" stroke-width="1.4"/><path d="M26,-109 V-104" stroke="${C.muted}" stroke-width="1.4" stroke-linecap="round"/>
    ${MONO(0, -10, 10, C.muted)}LRS</text>
  </g>`,
});

/** A student tablet, standing. The USB-C port is at its foot. */
export const tablet = ({ screens = ['idle'] } = {}) => ({
  kind: 'tablet',
  ports: { usb: { x: 0, y: 0 } },
  leds: {},
  screen: { cx: 0, cy: -64, w: 66, h: 100 },
  svg: (p, id) => `<g id="${p}dev-${id}">
    <rect x="-40" y="-124" width="80" height="120" rx="10" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.6"/>
    <rect x="-33" y="-114" width="66" height="96" rx="4" fill="${C.well}"/>
    <rect x="-8" y="-9" width="16" height="3" rx="1.5" fill="${C.primary}"/>
    ${screens.map((n, i) => `<g id="${p}${id}-scr-${n}"${i ? ' opacity="0"' : ''}>${battery(n, 0, -66)}</g>`).join('')}
  </g>`,
});
/** Tablet screen states: idle (an app) · offline · lesson · fail · battery empty/charging/full. */
function battery(state, cx, cy) {
  const toast = (col, txt) => `<rect x="${cx - 29}" y="${cy - 46}" width="58" height="11" rx="5.5" fill="${col}" opacity="0.18"/><circle cx="${cx - 22}" cy="${cy - 40.5}" r="2.4" fill="${col}"/><text x="${cx - 17}" y="${cy - 37.8}" style='font-family:"DM Sans";font-weight:600;font-size:7px' fill="${C.text}">${txt}</text>`;
  const lessonUI = `<rect x="${cx - 29}" y="${cy - 30}" width="58" height="9" rx="2" fill="${C.primary}"/><text x="${cx - 25}" y="${cy - 23.5}" style='font-family:"DM Sans";font-weight:700;font-size:6.5px' fill="${C.bg}">Quest</text><rect x="${cx - 25}" y="${cy - 15}" width="50" height="22" rx="3" fill="${C.raised}"/><rect x="${cx - 21}" y="${cy - 10}" width="30" height="3.5" rx="1.5" fill="${C.muted}"/><rect x="${cx - 21}" y="${cy - 3}" width="40" height="3" rx="1.5" fill="${C.faint}"/><rect x="${cx - 25}" y="${cy + 11}" width="36" height="3" rx="1.5" fill="${C.raised}"/><rect x="${cx - 25}" y="${cy + 18}" width="46" height="3" rx="1.5" fill="${C.raised}"/>`;
  if (state === 'offline') return toast(C.neg, 'No internet') + `<rect x="${cx - 25}" y="${cy - 22}" width="50" height="40" rx="3" fill="${C.raised}" opacity="0.5"/>`;
  if (state === 'lesson') return toast(C.warn, 'Offline · syncs later') + lessonUI;
  if (state === 'lessonok') return lessonUI;
  if (state === 'fail') return `<circle cx="${cx}" cy="${cy - 6}" r="13" fill="none" stroke="${C.neg}" stroke-width="2.6" stroke-dasharray="58 30"/><path d="M${cx - 5},${cy - 11} L${cx + 5},${cy - 1} M${cx + 5},${cy - 11} L${cx - 5},${cy - 1}" stroke="${C.neg}" stroke-width="2.4" stroke-linecap="round"/>${T(cx, cy + 20, 7.5, C.text)}Can't reach Quest</text>`;
  if (state === 'idle') return `<rect x="${cx - 24}" y="${cy - 30}" width="48" height="6" rx="2" fill="${C.raised}"/><rect x="${cx - 24}" y="${cy - 18}" width="36" height="4" rx="2" fill="${C.raised}"/><rect x="${cx - 24}" y="${cy - 9}" width="44" height="4" rx="2" fill="${C.raised}"/>`;
  const fill = state === 'empty' ? `<rect x="${cx - 13}" y="${cy + 10}" width="26" height="5" rx="1.5" fill="${C.neg}"/>`
    : state === 'charging' ? `<rect x="${cx - 13}" y="${cy - 2}" width="26" height="17" rx="1.5" fill="${C.warn}"/><path d="M${cx + 2},${cy - 14} L${cx - 6},${cy + 2} H${cx + 1} L${cx - 3},${cy + 14}" fill="none" stroke="${C.well}" stroke-width="2.4" stroke-linejoin="round"/>`
      : `<rect x="${cx - 13}" y="${cy - 16}" width="26" height="31" rx="1.5" fill="${C.pos}"/>`;
  return `<rect x="${cx - 17}" y="${cy - 20}" width="34" height="39" rx="4" fill="none" stroke="${C.muted}" stroke-width="2"/><rect x="${cx - 6}" y="${cy - 24}" width="12" height="4" rx="1" fill="${C.muted}"/>${fill}`;
}

/** A charging hub for a class set: N USB ports along the top, power inlet at the left end. */
export const chargingHub = ({ ports = 8 } = {}) => ({
  kind: 'hub',
  ports: { power: { x: -120, y: -18 }, ...Object.fromEntries([...Array(ports)].map((_, i) => [`u${i}`, { x: -91 + i * 26, y: -36 }])) },
  leds: { pwr: { x: 104, y: -18 }, ...Object.fromEntries([...Array(ports)].map((_, i) => [`u${i}`, { x: -91 + i * 26, y: -22 }])) },
  svg: (p, id) => `<g id="${p}dev-${id}">
    ${body(-120, -36, 240, 36, 7)}
    <rect x="-120" y="-36" width="4" height="36" rx="2" fill="${C.primary}"/>
    ${[...Array(ports)].map((_, i) => `<rect x="${-97 + i * 26}" y="-35" width="12" height="5" rx="1.5" fill="${C.well}" stroke="${C.faint}" stroke-width="0.8"/>${led(p, id, `u${i}`, -91 + i * 26, -22, 2.4)}`).join('')}
    ${led(p, id, 'pwr', 104, -18, 3.6)}
    ${MONO(104, -6, 7, C.muted)}PWR</text>
  </g>`,
});

/** A wall socket, UK type G (as used in Tanzania), with its switch. */
export const socket = () => ({
  kind: 'socket',
  ports: { plug: { x: 0, y: -40 } },
  leds: { sw: { x: 22, y: -64 } },
  svg: (p, id) => `<g id="${p}dev-${id}">
    <rect x="-44" y="-88" width="88" height="88" rx="10" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.6"/>
    <rect x="-5" y="-72" width="10" height="16" rx="1.5" fill="${C.well}"/>
    <rect x="-24" y="-40" width="16" height="9" rx="1.5" fill="${C.well}"/><rect x="8" y="-40" width="16" height="9" rx="1.5" fill="${C.well}"/>
    <rect x="16" y="-76" width="14" height="22" rx="2" fill="${C.raised}" stroke="${C.muted}" stroke-width="1"/>
    ${led(p, id, 'sw', 22, -64, 2.6)}
  </g>`,
});

export const LIB = { computer, netSwitch, router, isp, cloud, lrs, tablet, chargingHub, socket };
