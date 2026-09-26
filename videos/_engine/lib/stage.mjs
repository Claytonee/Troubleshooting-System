/**
 * The stage: one world drawing shared by every frame of an episode.
 *
 * Devices are placed at an anchor with a scale; links are drawn between their
 * ports; labels, check chips and free SVG sit in the same world coordinates.
 * The camera moves over this world, never the other way round — so an episode's
 * frames can be cut together without a seam.
 *
 * Flows (packets, electric current) run on the episode's GLOBAL clock: a thing in
 * flight when one frame cuts to the next continues from the same point, because
 * both frames sample the same schedule.
 */
import { C } from './palette.mjs';
import { P, bez, line, splitBez, dPath, length, arc, r3 } from './geometry.mjs';

export class Stage {
  constructor() { this.items = []; this.links = []; this.pieces = {}; this.labels = []; this.chips = []; this.under = []; this.over = []; }

  /** Place a device (from devices.mjs) at world (x,y), shown `scale`× about its anchor. */
  place(id, dev, { x, y, scale = 1 }) { this.items.push({ id, dev, x, y, scale }); return this; }

  /** World point of `id.port`, or of `id.led.name`. */
  pt(ref) {
    const [id, a, b] = ref.split('.');
    const it = this.items.find((i) => i.id === id);
    if (!it) throw new Error(`stage: no device "${id}"`);
    const local = b ? it.dev.leds[b] : it.dev.ports[a];
    if (!local) throw new Error(`stage: "${ref}" is not a port/led of ${it.dev.kind}`);
    return P(it.x + it.scale * local.x, it.y + it.scale * local.y);
  }

  /** A drawn link (cubic): a dim base and a lit overlay that can draw on, break and recolour. */
  link(key, pts, { width = 4 } = {}) {
    const len = +length(bez(...pts)).toFixed(1);
    this.links.push({ key, pts, len, width });
    this.pieces[key] = { key, fn: bez(...pts), len };
    return this;
  }
  /** Two links from one curve, split at t — the place it can break. Returns the break point. */
  splitLink(key, pts, t = 0.5, opts) {
    const [a, b] = splitBez(...pts, t);
    this.link(key + 'a', a, opts).link(key + 'b', b, opts);
    this.breaks = this.breaks || {}; this.breaks[key] = a[3];
    return a[3];
  }
  /** An undrawn straight piece a packet may travel (e.g. through a device). */
  seg(key, a, b) { this.pieces[key] = { key, fn: line(a, b), len: length(line(a, b)) }; return this; }

  /** The same piece travelled backwards (content coming back, e.g. from the LRS). */
  rev(key) { const pc = this.piece(key); this.pieces[key + '~'] = { key: key + '~', fn: (t) => pc.fn(1 - t), len: pc.len }; return this; }

  /** passes: this label is meant to slide under the screen furniture (captions, the top scrim) during a camera move — marked for the layout audit on its own text blocks, never a wrapper. */
  label(id, x, y, text, sub = '', px = 34, { passes = false } = {}) { this.labels.push({ id, x, y, text, sub, px, passes }); return this; }
  chip(i, x, y) { this.chips.push({ i, x, y }); return this; }
  /** Raw SVG under the devices or over everything (callouts, cards, the lesson). */
  add(svgFn, layer = 'over') { (layer === 'under' ? this.under : this.over).push(svgFn); return this; }

  piece(key) { const pc = this.pieces[key]; if (!pc) throw new Error(`stage: no route piece "${key}"`); return pc; }

  svg(p) {
    const links = this.links.map(({ key, pts, len, width }) => `<path id="${p}${key}-base" d="${dPath(pts)}" fill="none" stroke="${C.line}" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="${len} ${len}" stroke-dashoffset="0"/>
      <path id="${p}${key}-lit" d="${dPath(pts)}" fill="none" stroke="${C.primary}" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="${len} ${len}" stroke-dashoffset="${len}" data-len="${len}"/>`).join('');
    const breaks = Object.entries(this.breaks || {}).map(([k, b]) => `<g transform="translate(${b.x},${b.y})"><g id="${p}${k}-gap" opacity="0"><path d="M-11,-11 L11,11 M11,-11 L-11,11" stroke="${C.neg}" stroke-width="5" stroke-linecap="round"/></g></g>`).join('');
    const devices = this.items.map(({ id, dev, x, y, scale }) => `<g transform="translate(${x},${y}) scale(${scale})">${dev.svg(p, id)}</g>`).join('\n');
    const labels = this.labels.map(({ id, x, y, text, sub, px, passes }) => { const lay = passes ? ' data-layout-allow-overlap data-layout-allow-occlusion' : ''; return `<g id="${p}lab-${id}" opacity="0"><text${lay} x="${x}" y="${y}" text-anchor="middle" style='font-family:"DM Sans";font-weight:600;font-size:${px}px' fill="${C.text}">${text}</text>${sub ? `<text${lay} x="${x}" y="${y + 34}" text-anchor="middle" style='font-family:"DM Sans";font-weight:400;font-size:24px' fill="${C.muted}">${sub}</text>` : ''}</g>`; }).join('');
    const chips = this.chips.map(({ i, x, y }) => `<g transform="translate(${r3(x)},${r3(y)})"><g id="${p}chip${i}" opacity="0">
      <circle id="${p}chip${i}-c" r="30" fill="${C.bg}" stroke="${C.primary}" stroke-width="2.5"/>
      <text id="${p}chip${i}-n" y="9.5" text-anchor="middle" style="font-family:'DM Mono';font-weight:500;font-size:28px" fill="${C.text}">${i}</text>
      <path id="${p}chip${i}-ok" d="M-12,1 L-4,9 L13,-9" fill="none" stroke="${C.bg}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
      <path id="${p}chip${i}-x" d="M-9,-9 L9,9 M9,-9 L-9,9" fill="none" stroke="${C.bg}" stroke-width="4" stroke-linecap="round" opacity="0"/>
    </g></g>`).join('');
    const run = (arr) => arr.map((f) => (typeof f === 'function' ? f(p) : f)).join('\n');
    return `<svg class="${p}svg" viewBox="0 0 1920 1080" width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="${p}grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40,0 H0 V40" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="1"/></pattern>
    <filter id="${p}glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect x="-3000" y="-3000" width="8000" height="7000" fill="url(#${p}grid)"/>
  ${run(this.under)}
  ${links}
  ${breaks}
  ${devices}
  ${labels}
  ${chips}
  ${run(this.over)}
  <g id="${p}packets"></g>
</svg>`;
  }
}

// ── flows on the global clock ───────────────────────────────────────────────────

const DT = 1 / 30;   // keyframe spacing; GSAP interpolates between them

/** A journey through route pieces with explicit times: [[pieceKey, g0, g1], …] → [{g,x,y}]. */
export function journey(stage, legs) {
  const pts = [];
  for (const [key, g0, g1] of legs) {
    const pc = stage.piece(key), n = Math.max(2, Math.round((g1 - g0) / DT));
    arc(pc.fn, n).forEach((q, i) => { if (i || !pts.length) pts.push({ g: r3(g0 + ((g1 - g0) * i) / n), x: +q.x.toFixed(2), y: +q.y.toFixed(2) }); });
  }
  return pts;
}
/** Constant speed (px/s) along a list of pieces, starting at global time g0. */
export function trip(stage, keys, g0, speed) {
  const legs = []; let g = g0;
  for (const k of keys) { const d = stage.piece(k).len / speed; legs.push([k, g, g + d]); g += d; }
  return journey(stage, legs);
}
export const routeLength = (stage, keys) => keys.reduce((s, k) => s + stage.piece(k).len, 0);

/**
 * A steady stream: one item every `every` s from `from` to `until` (global), each travelling
 * `keys` at `speed`. `cut(g0)` may return a shorter key list and 'die' for items that meet a
 * break (e.g. [keysToGap, 'die']); return null to travel the whole route.
 */
export function stream(stage, { id, keys, from, until, every = 0.36, speed = 560, cut = null, kind = 'packet' }) {
  const out = [];
  for (let k = 0; ; k++) {
    const g0 = r3(from + k * every);
    if (g0 > until) break;
    const c = cut ? cut(g0) : null;
    out.push({ id: `${id}${k}`, pts: trip(stage, c ? c[0] : keys, g0, speed), end: c ? c[1] : 'arrive', kind });
  }
  return out;
}
