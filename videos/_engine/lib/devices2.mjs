/**
 * Devices, v2 — built to survive a close-up (Motion Director brief §12–14).
 *
 * v1 devices read well small; these teach at every distance: ports are real RJ45 openings
 * with a latch notch, every port has its own link light above it, the router shows its two
 * sides (LAN 1–4 facing the school, one WAN port facing the provider) and its status lights
 * carry their icons. Cables attach at the BOTTOM of a port and hang below the bench.
 *
 * Same contract as devices.mjs: local coordinates around the anchor (0,0) on the bench;
 * `ports`, `leds` (ids `${p}${id}-led-${name}`), screen states `${p}${id}-scr-${name}`.
 */
import { C } from './palette.mjs';

// The ring keeps an UNLIT light visible: "the WAN light is off" has to be seen, not inferred from a gap.
const led = (p, id, name, x, y, r = 3) => `<circle id="${p}${id}-led-${name}" cx="${x}" cy="${y}" r="${r}" fill="${C.line}" stroke="${C.faint}" stroke-width="0.7"/>`;
/** Device micro-labels: teaching text in a close-up, so readable (muted, ≥4.5:1). `passes`: may slide under the screen furniture during a camera move. */
const tiny = (x, y, t, fill = C.muted, s = 8, passes = false) => `<text${passes ? ' data-layout-allow-overlap data-layout-allow-occlusion' : ''} x="${x}" y="${y}" text-anchor="middle" style='font-family:"DM Mono";font-weight:500;font-size:${s}px;letter-spacing:0.4px' fill="${fill}">${t}</text>`;
/** An RJ45 socket, opening centred at (x,y), w×h, latch notch at the bottom. */
const rj45 = (x, y, w = 22, h = 18, stroke = C.faint) =>
  `<path d="M${x - w / 2},${y - h / 2} h${w} v${h * 0.72} h${-w * 0.22} v${h * 0.28} h${-w * 0.56} v${-h * 0.28} h${-w * 0.22} Z" fill="${C.well}" stroke="${stroke}" stroke-width="1.1"/>` +
  `<rect x="${x - w * 0.3}" y="${y - h / 2 + 2.5}" width="${w * 0.6}" height="2.2" rx="1" fill="${C.faint}" opacity="0.6"/>`;

/** Desktop: monitor with a browser and taskbar, and a tower with its network port. */
export const desktop = () => {
  const sx = -140, sy = -178, sw = 180, sh = 108;
  const taskbar = (bad) => `<rect x="${sx}" y="${sy + sh - 11}" width="${sw}" height="11" fill="#141821"/>
      <g transform="translate(${sx + sw - 16},${sy + sh - 5.5})"><rect x="-5" y="-3.2" width="10" height="6" rx="1" fill="none" stroke="${C.muted}" stroke-width="1"/><path d="M-2,3 v1.8 M2,3 v1.8" stroke="${C.muted}" stroke-width="1"/>
      ${bad ? `<circle cx="5" cy="-3.5" r="3.4" fill="${C.warn}"/><text x="5" y="-1.6" text-anchor="middle" style='font-family:"DM Sans";font-weight:800;font-size:5px' fill="${C.bg}">!</text>` : `<circle cx="5" cy="-3.5" r="2.4" fill="${C.pos}"/>`}</g>`;
  const chrome = `<rect x="${sx}" y="${sy}" width="${sw}" height="13" fill="#1a1e29"/><circle cx="${sx + 7}" cy="${sy + 6.5}" r="2" fill="${C.faint}"/><circle cx="${sx + 13}" cy="${sy + 6.5}" r="2" fill="${C.faint}"/>
      <rect x="${sx + 22}" y="${sy + 3}" width="${sw - 30}" height="7" rx="3.5" fill="${C.raised}"/>`;
  const gx = sx + sw / 2;
  return {
    kind: 'desktop',
    ports: { nic: { x: 113, y: -20 } },
    leds: { link: { x: 104, y: -42 }, act: { x: 122, y: -42 }, pwr: { x: 118, y: -122 } },
    screen: { cx: gx, cy: sy + sh / 2 },
    svg: (p, id) => `<g id="${p}dev-${id}">
      <rect x="${sx - 10}" y="${sy - 10}" width="${sw + 20}" height="${sh + 20}" rx="10" fill="${C.surface}" stroke="${C.muted}" stroke-width="2.2"/>
      <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="3" fill="${C.well}"/>
      <g id="${p}${id}-scr-noinet">${chrome}
        <circle cx="${gx}" cy="${sy + 44}" r="12" fill="none" stroke="${C.muted}" stroke-width="2.2"/><ellipse cx="${gx}" cy="${sy + 44}" rx="5" ry="12" fill="none" stroke="${C.muted}" stroke-width="1.1"/><line x1="${gx - 12}" y1="${sy + 44}" x2="${gx + 12}" y2="${sy + 44}" stroke="${C.muted}" stroke-width="1.1"/>
        <line x1="${gx - 13}" y1="${sy + 31}" x2="${gx + 13}" y2="${sy + 57}" stroke="${C.neg}" stroke-width="2.6" stroke-linecap="round"/>
        <text x="${gx}" y="${sy + 74}" text-anchor="middle" style='font-family:"DM Sans";font-weight:700;font-size:11px' fill="${C.text}">No internet</text>
        <text x="${gx}" y="${sy + 85}" text-anchor="middle" style='font-family:"DM Sans";font-weight:400;font-size:6.5px' fill="${C.muted}">This page can't be reached</text>
        ${taskbar(true)}</g>
      <g id="${p}${id}-scr-ok" opacity="0">${chrome}
        <rect x="${sx + 8}" y="${sy + 19}" width="${sw - 16}" height="14" rx="2" fill="${C.primary}" opacity="0.85"/>
        <rect x="${sx + 8}" y="${sy + 39}" width="64" height="38" rx="3" fill="${C.raised}"/>
        ${[84, 70, 88, 52].map((w, i) => `<rect x="${sx + 80}" y="${sy + 41 + i * 9}" width="${w}" height="4" rx="2" fill="${C.raised}"/>`).join('')}
        ${taskbar(false)}</g>
      <rect x="-60" y="-60" width="20" height="44" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.8"/>
      <rect x="-100" y="-16" width="100" height="10" rx="5" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.8"/>
      <rect x="70" y="-156" width="84" height="156" rx="7" fill="${C.surface}" stroke="${C.muted}" stroke-width="2.2"/>
      <rect x="80" y="-144" width="64" height="8" rx="2" fill="${C.well}"/>
      <circle cx="100" cy="-122" r="6" fill="none" stroke="${C.muted}" stroke-width="1.8"/><path d="M100,-127 V-122" stroke="${C.muted}" stroke-width="1.8" stroke-linecap="round"/>
      ${led(p, id, 'pwr', 118, -122, 2.6)}
      ${[0, 1, 2, 3].map((i) => `<rect x="82" y="${-104 + i * 7}" width="60" height="2.4" rx="1.2" fill="${C.raised}"/>`).join('')}
      ${rj45(113, -28, 20, 16)}
      ${led(p, id, 'link', 104, -42, 2.8)}${led(p, id, 'act', 122, -42, 2.8)}
      ${tiny(113, -52, 'NETWORK', C.muted, 7.4)}
    </g>`,
  };
};

/** Switch: 8 RJ45 ports with a link light over each; port 8 is the uplink to the router. */
export const switch2 = () => {
  const px = (i) => -112 + i * 30;
  return {
    kind: 'switch',
    ports: Object.fromEntries([...Array(8)].map((_, i) => [`p${i + 1}`, { x: px(i), y: -9 }])),
    leds: { pwr: { x: 138, y: -48 }, ...Object.fromEntries([...Array(8)].map((_, i) => [`p${i + 1}`, { x: px(i) - 6, y: -42 }])) },
    svg: (p, id) => `<g id="${p}dev-${id}">
      <rect x="-150" y="-60" width="300" height="60" rx="7" fill="${C.surface}" stroke="${C.muted}" stroke-width="2.2"/>
      <rect x="-150" y="-60" width="300" height="4" rx="2" fill="${C.primary}"/>
      ${[...Array(8)].map((_, i) => `${rj45(px(i), -18, 22, 18, i === 7 ? C.primary : C.faint)}${led(p, id, `p${i + 1}`, px(i) - 6, -42, 2.8)}${i === 7 ? tiny(px(i) + 11, -39.8, 'UPLINK', C.primaryText, 7) : tiny(px(i) + 6, -39.8, String(i + 1), C.muted, 7.6)}`).join('')}
      ${led(p, id, 'pwr', 138, -48, 3)}${tiny(138, -36, 'PWR', C.muted, 7)}
    </g>`,
  };
};

/** Router: status lights across the top with icons; LAN 1–4 and a separate WAN port below. */
export const router2 = () => {
  const lan = (i) => -104 + i * 30, WX = 104;
  const icon = {
    pwr: (x, y) => `<circle cx="${x}" cy="${y}" r="4.2" fill="none" stroke="${C.muted}" stroke-width="1.1"/><path d="M${x},${y - 5.5} V${y - 1}" stroke="${C.muted}" stroke-width="1.1" stroke-linecap="round"/>`,
    inet: (x, y) => `<circle cx="${x}" cy="${y}" r="4.6" fill="none" stroke="${C.muted}" stroke-width="1"/><ellipse cx="${x}" cy="${y}" rx="2" ry="4.6" fill="none" stroke="${C.muted}" stroke-width="0.8"/><line x1="${x - 4.6}" y1="${y}" x2="${x + 4.6}" y2="${y}" stroke="${C.muted}" stroke-width="0.8"/>`,
    wifi: (x, y) => `<path d="M${x - 5},${y - 1} q5,-5 10,0 M${x - 2.8},${y + 1.4} q2.8,-2.8 5.6,0" fill="none" stroke="${C.muted}" stroke-width="1.1" stroke-linecap="round"/><circle cx="${x}" cy="${y + 3.4}" r="1" fill="${C.muted}"/>`,
    lan: (x, y) => `<rect x="${x - 5}" y="${y - 3}" width="4" height="4" fill="none" stroke="${C.muted}" stroke-width="0.9"/><rect x="${x + 1}" y="${y - 3}" width="4" height="4" fill="none" stroke="${C.muted}" stroke-width="0.9"/><path d="M${x - 3},${y + 1} v2 h6 v-2" fill="none" stroke="${C.muted}" stroke-width="0.9"/>`,
  };
  const status = [['pwr', -60, 'POWER'], ['inet', -20, 'INTERNET'], ['wifi', 20, 'WI-FI'], ['lan', 60, 'LAN']];
  return {
    kind: 'router',
    ports: { ...Object.fromEntries([1, 2, 3, 4].map((n) => [`l${n}`, { x: lan(n - 1), y: -9 }])), wan: { x: WX, y: -9 }, core: { x: 0, y: -30 } },
    leds: { pwr: { x: -60, y: -76 }, inet: { x: -20, y: -76 }, wifi: { x: 20, y: -76 }, lan: { x: 60, y: -76 },
      ...Object.fromEntries([1, 2, 3, 4].map((n) => [`l${n}`, { x: lan(n - 1) - 7, y: -42 }])), wan: { x: WX - 9, y: -42 } },
    svg: (p, id) => `<g id="${p}dev-${id}">
      <rect x="-150" y="-104" width="300" height="104" rx="12" fill="${C.surface}" stroke="${C.muted}" stroke-width="2.2"/>
      <rect x="-150" y="-104" width="300" height="4" rx="2" fill="${C.primary}"/>
      <line x1="-150" y1="-58" x2="150" y2="-58" stroke="${C.line}" stroke-width="1.2"/>
      ${status.map(([k, x, t]) => `${icon[k](x, -90)}${led(p, id, k, x, -76, 3.4)}${tiny(x, -63, t, C.muted, 6.8, true)}`).join('')}
      ${[0, 1, 2, 3].map((i) => `${rj45(lan(i), -18)}${led(p, id, `l${i + 1}`, lan(i) - 7, -42, 2.8)}${tiny(lan(i) + 6, -39.8, `${i + 1}`, C.muted, 7.6)}`).join('')}
      ${tiny(lan(0) - 22, -15, 'LAN', C.muted, 7.6)}
      <rect x="${WX - 20}" y="-51" width="40" height="44" rx="4" fill="none" stroke="${C.primary}" stroke-width="1.2" stroke-opacity="0.7"/>
      ${rj45(WX, -18, 22, 18, C.primary)}${led(p, id, 'wan', WX - 9, -42, 3.2)}${tiny(WX + 6, -39.6, 'WAN', C.primaryText, 8.4)}
    </g>`,
  };
};

/** The provider's modem at the school: LAN in from the router, the provider line out. */
export const modem = () => ({
  kind: 'modem',
  ports: { lan: { x: -52, y: -9 }, line: { x: 58, y: -20 } },
  leds: { pwr: { x: -40, y: -56 }, link: { x: 0, y: -56 }, inet: { x: 40, y: -56 }, lan: { x: -58, y: -34 } },
  svg: (p, id) => `<g id="${p}dev-${id}">
    <rect x="-80" y="-80" width="160" height="80" rx="9" fill="${C.surface}" stroke="${C.muted}" stroke-width="2.2"/>
    <rect x="-80" y="-80" width="160" height="4" rx="2" fill="${C.faint}"/>
    ${[['pwr', -40, 'POWER'], ['link', 0, 'LINK'], ['inet', 40, 'INTERNET']].map(([k, x, t]) => `${led(p, id, k, x, -56, 3.2)}${tiny(x, -44, t, C.muted, 6.8, true)}`).join('')}
    ${rj45(-52, -18, 20, 16)}${led(p, id, 'lan', -58, -34, 2.6)}${tiny(-46, -31.8, 'LAN', C.muted, 7.2)}
    <circle cx="58" cy="-20" r="6" fill="${C.well}" stroke="${C.faint}" stroke-width="1.1"/><circle cx="58" cy="-20" r="2" fill="${C.faint}"/>${tiny(58, -31.8, 'LINE', C.muted, 7.2)}
  </g>`,
});

/** A web server somewhere on the internet: the destination that can answer. */
export const server = () => ({
  kind: 'server',
  ports: { in: { x: -60, y: -60 }, core: { x: 0, y: -78 } },
  leds: { a: { x: 34, y: -130 }, b: { x: 34, y: -86 }, c: { x: 34, y: -42 } },
  svg: (p, id) => `<g id="${p}dev-${id}">
    <rect x="-60" y="-156" width="120" height="156" rx="8" fill="${C.surface}" stroke="${C.muted}" stroke-width="2.2"/>
    ${[0, 1, 2].map((i) => `<rect x="-48" y="${-146 + i * 44}" width="96" height="34" rx="4" fill="${C.well}"/>${[0, 1, 2].map((j) => `<rect x="-40" y="${-138 + i * 44 + j * 8}" width="52" height="3" rx="1.5" fill="${C.raised}"/>`).join('')}${led(p, id, 'abc'[i], 34, -130 + i * 44, 3)}`).join('')}
  </g>`,
});

export const LIB2 = { desktop, switch2, router2, modem, server };
