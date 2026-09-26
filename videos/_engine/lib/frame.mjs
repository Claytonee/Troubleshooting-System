/**
 * Emits one HyperFrames frame composition (a <template> fragment) from:
 *   - the episode's Stage (world drawing),
 *   - the flows sliced to this frame's window,
 *   - a timeline body (browser JS using the helpers below).
 *
 * Screen-space furniture is identical in every frame, so cuts stay invisible:
 * the official OE logo top-right, the series slate top-left, fixed to the screen.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, CAM } from './palette.mjs';
import { P, r3 } from './geometry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOGO_PATHS = readFileSync(join(HERE, '..', 'shared', 'brand', 'oe-logo-official.svg'), 'utf8').match(/<path[^>]*>/g);
if (!LOGO_PATHS || LOGO_PATHS.length !== 21) throw new Error('official logo: expected its 21 paths');
/** The official logo, dark treatment from docs/OE_BRANDING_GUIDE.md: gold sunburst, white lettering. */
export const LOGO_DARK = LOGO_PATHS.join('').replace(/fill="#263746"/g, 'fill="#ffffff"');

/** The closing card: official logo, gold rule, one line to remember. World space, top of frame. */
export const lessonCard = (text) => (p) => `<g id="${p}lesson" opacity="0">
    <g transform="translate(795,34) scale(1.1)">${LOGO_DARK}</g>
    <rect x="912" y="90" width="96" height="3" rx="1.5" fill="${C.gold}"/>
    <text x="960" y="164" text-anchor="middle" style='font-family:"DM Sans";font-weight:600;font-size:62px;letter-spacing:-1.2px' fill="${C.text}">${text}</text>
  </g>`;

/** A pointer: short red (or any colour) caps text with a dashed leader to a world point. */
export const callout = (id, text, at, to, color = C.neg, px = 28) => (p) => `<g id="${p}${id}" opacity="0">
    <text x="${at.x}" y="${at.y}" text-anchor="middle" style='font-family:"DM Sans";font-weight:700;font-size:${px}px;letter-spacing:3px' fill="${color}">${text}</text>
    <path d="M${at.x - 15},${at.y + 17} C${at.x - 45},${at.y + 75} ${to.x + 10},${to.y - 70} ${to.x},${to.y - 9}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4 5"/>
  </g>`;

/**
 * A long zoom-out, anchored: zoom interpolated in log space while the anchor holds the centre,
 * then eases to where it sits in the wide shot. Plain keyframes (seek-safe).
 */
export function anchoredZoom(s0, s1, A, fEnd, dur, n = 72) {
  const e3 = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const endScreen = P(CAM.cx + s1 * (A.x - fEnd.x), CAM.cy + s1 * (A.y - fEnd.y));
  const move = [], scale = [];
  for (let k = 1; k <= n; k++) {
    const u = k / n, e = e3(u), e2 = e3(Math.min(1, Math.max(0, (u - 0.3) / 0.7)));
    const sc = Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * e);
    const sx = CAM.cx + (endScreen.x - CAM.cx) * e2, sy = CAM.cy + (endScreen.y - CAM.cy) * e2;
    const fx = A.x - (sx - CAM.cx) / sc, fy = A.y - (sy - CAM.cy) / sc;
    move.push({ x: +(CAM.cx - fx).toFixed(2), y: +(CAM.cy - fy).toFixed(2), duration: +(dur / n).toFixed(4), ease: 'none' });
    scale.push({ scale: +sc.toFixed(4), duration: +(dur / n).toFixed(4), ease: 'none' });
  }
  return { move, scale };
}

/** Browser-side helpers every frame's timeline uses. `P` = element id prefix. */
const RUNTIME = `
    var $ = function (s) { return document.getElementById(P + s); };
    var tl = gsap.timeline({ paused: true });
    /** Camera: world (px,py) at the frame's centre, zoom s; nested wrappers so the focus travels straight. */
    function cam(s, px, py, at, dur, ease) {
      if (!dur) { tl.set($('cam-move'), { x: CX - px, y: CY - py }, at); tl.set($('cam-scale'), { scale: s }, at); return; }
      tl.to($('cam-move'), { x: CX - px, y: CY - py, duration: dur, ease: ease || 'power2.inOut' }, at);
      tl.to($('cam-scale'), { scale: s, duration: dur, ease: ease || 'power2.inOut' }, at);
    }
    function camKeys(z, at) { tl.to($('cam-move'), { keyframes: z.move }, at); tl.to($('cam-scale'), { keyframes: z.scale }, at); }
    function show(el, at, d, from) { tl.fromTo(el, Object.assign({ opacity: 0 }, from || {}), { opacity: 1, x: 0, y: 0, duration: d || 0.5, ease: 'power3.out' }, at); }
    function fade(el, o, at, d) { tl.to(el, { opacity: o, duration: d || 0.4, ease: 'power1.out' }, at); }
    function on(el, at) { tl.set(el, { opacity: 1 }, at); }
    function off(el, at) { tl.set(el, { opacity: 0 }, at); }
    function drawLink(key, at, d) { tl.to($(key + '-lit'), { strokeDashoffset: 0, duration: d, ease: 'none' }, at); }
    function linkOn(key, at) { tl.set($(key + '-lit'), { strokeDashoffset: 0 }, at); }
    function linkDark(key, at, d) { var el = $(key + '-lit'); tl.to(el, { strokeDashoffset: el.getAttribute('data-len'), duration: d || 0.5, ease: 'power2.in' }, at); }
    function linkColor(key, color, at, d) { tl.to($(key + '-lit'), { attr: { stroke: color }, duration: d || 0.15 }, at); }
    /** Break a split link (key+'a' / key+'b') at its middle; mend reverses it. */
    function breakLink(key, at, instant) {
      var parts = [key + 'a', key + 'b'];
      if (instant) { tl.set($(parts[0] + '-lit'), { attr: { stroke: C.neg }, strokeDashoffset: 26 }, at); tl.set($(parts[0] + '-base'), { strokeDashoffset: 26 }, at);
        tl.set($(parts[1] + '-lit'), { attr: { stroke: C.neg }, strokeDashoffset: -26 }, at); tl.set($(parts[1] + '-base'), { strokeDashoffset: -26 }, at); tl.set($(key + '-gap'), { opacity: 1 }, at); return; }
      tl.to([$(parts[0] + '-lit'), $(parts[1] + '-lit')], { attr: { stroke: C.neg }, duration: 0.12 }, at - 0.25);
      tl.to([$(parts[0] + '-lit'), $(parts[0] + '-base')], { strokeDashoffset: 26, duration: 0.3, ease: 'power3.out' }, at);
      tl.to([$(parts[1] + '-lit'), $(parts[1] + '-base')], { strokeDashoffset: -26, duration: 0.3, ease: 'power3.out' }, at);
      tl.fromTo($(key + '-gap'), { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power3.out', transformOrigin: '50% 50%' }, at + 0.05);
    }
    function mendLink(key, at) {
      tl.to([$(key + 'a-lit'), $(key + 'a-base'), $(key + 'b-lit'), $(key + 'b-base')], { strokeDashoffset: 0, duration: 0.5, ease: 'power3.inOut' }, at - 0.5);
      tl.to($(key + '-gap'), { opacity: 0, duration: 0.25 }, at - 0.45);
      tl.to([$(key + 'a-lit'), $(key + 'b-lit')], { attr: { stroke: C.primary }, duration: 0.3 }, at - 0.05);
    }
    function dim(dev, o, at, d) { if (d) tl.to($('dev-' + dev), { opacity: o, duration: d, ease: 'power2.out' }, at); else tl.set($('dev-' + dev), { opacity: o }, at); }
    function led(ref, color, at, d) { var el = $(ref.replace('.', '-led-')); if (d === 0) tl.set(el, { attr: { fill: color } }, at); else tl.to(el, { attr: { fill: color }, duration: d || 0.18, ease: 'power1.out' }, at); }
    function blink(ref, color, at, times, gap) { for (var k = 0; k < (times || 2); k++) { led(ref, C.line, at + k * (gap || 0.44), 0.18); led(ref, color, at + k * (gap || 0.44) + 0.22, 0.18); } }
    /** Swap a device's visible screen state. */
    function screen(dev, from, to, at, d) { fade($(dev + '-scr-' + from), 0, at, d || 0.25); fade($(dev + '-scr-' + to), 1, at + 0.08, d || 0.3); }
    function chipsIn(n, at, stagger, rise) { for (var i = 1; i <= n; i++) tl.fromTo($('chip' + i), { opacity: 0, y: rise || 0 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, at + (i - 1) * stagger); }
    function chipFlip(i, ok, at) {
      var col = ok ? C.pos : C.neg;
      tl.to($('chip' + i + '-c'), { attr: { fill: col, stroke: col }, duration: 0.2, ease: 'power2.out' }, at);
      tl.to($('chip' + i + '-n'), { opacity: 0, duration: 0.12 }, at);
      tl.to($('chip' + i + (ok ? '-x' : '-ok')), { opacity: 0, duration: 0.1 }, at);
      tl.to($('chip' + i + (ok ? '-ok' : '-x')), { opacity: 1, duration: 0.15 }, at + 0.06);
      tl.fromTo($('chip' + i), { scale: 1.16 }, { scale: 1, duration: 0.35, ease: 'power3.out', transformOrigin: '50% 50%' }, at);
    }
    function chipSet(i, state, at) {           // 'ok' | 'x' | 'n' without motion
      var col = state === 'ok' ? C.pos : state === 'x' ? C.neg : C.bg;
      tl.set($('chip' + i + '-c'), { attr: { fill: col, stroke: state === 'n' ? C.primary : col } }, at);
      tl.set($('chip' + i + '-n'), { opacity: state === 'n' ? 1 : 0 }, at);
      tl.set($('chip' + i + '-ok'), { opacity: state === 'ok' ? 1 : 0 }, at);
      tl.set($('chip' + i + '-x'), { opacity: state === 'x' ? 1 : 0 }, at);
      tl.set($('chip' + i), { opacity: 1 }, at);
    }
    /** The end: the corner furniture hands over to the lesson card. */
    function endCard(at) {
      fade([$('bug'), $('slate')], 0, at - 0.2, 0.4);
      tl.fromTo($('lesson'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, at);
    }
    // Flows: pre-sampled global schedules, sliced to this frame.
    (function () {
      var layer = $('packets'), NS = 'http://www.w3.org/2000/svg';
      PK.forEach(function (pk) {
        var el;
        if (pk.kind === 'queued' || pk.kind === 'content') { el = document.createElementNS(NS, 'rect'); el.setAttribute('x', -8); el.setAttribute('y', -6); el.setAttribute('width', 16); el.setAttribute('height', 12); el.setAttribute('rx', 3); el.setAttribute('fill', pk.kind === 'queued' ? C.warn : C.pos); }
        else if (pk.kind === 'spark') { el = document.createElementNS(NS, 'circle'); el.setAttribute('r', 6); el.setAttribute('fill', C.warn); }
        else { el = document.createElementNS(NS, 'rect'); el.setAttribute('x', -8); el.setAttribute('y', -6); el.setAttribute('width', 16); el.setAttribute('height', 12); el.setAttribute('rx', 3); el.setAttribute('fill', C.primary); }
        el.setAttribute('id', P + 'pk-' + pk.id); el.setAttribute('filter', 'url(#' + P + 'glow)'); el.setAttribute('opacity', 0);
        layer.appendChild(el);
        var pts = pk.pts, i0 = 0;
        while (i0 < pts.length - 1 && pts[i0 + 1][0] <= 0) i0++;
        var start = Math.max(0, pts[i0][0]), first = pts[i0];
        if (pts[i0][0] < 0 && i0 < pts.length - 1) { var a = pts[i0], b = pts[i0 + 1], u = (0 - a[0]) / (b[0] - a[0]); first = [0, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
        tl.set(el, { x: first[1], y: first[2], opacity: 1 }, start);
        var kf = [], last = first[0];
        for (var k = i0 + 1; k < pts.length; k++) { kf.push({ x: pts[k][1], y: pts[k][2], duration: pts[k][0] - last, ease: 'none' }); last = pts[k][0]; }
        if (kf.length) tl.to(el, { keyframes: kf }, start);
        if (pk.end === 'die') { tl.to(el, { attr: { fill: C.neg }, duration: 0.08 }, last); tl.to(el, { scale: 1.8, opacity: 0, duration: 0.45, ease: 'power2.out', transformOrigin: '50% 50%' }, last + 0.06); }
        else if (pk.end === 'arrive') tl.to(el, { opacity: 0, duration: 0.25, ease: 'power1.in' }, last - 0.2);
        else if (pk.end === 'stay') {}
      });
    })();
`;

/**
 * @param o.id      composition id (e.g. "02-the-path")
 * @param o.f       frame number (1-based)
 * @param o.dur     duration (s)
 * @param o.off     global offset of this frame (s)
 * @param o.stage   Stage
 * @param o.flows   [{id, pts:[{g,x,y}], end, kind}]  (global time)
 * @param o.slate   { kicker, title }
 * @param o.body    timeline JS (string)
 * @param o.first   first frame (fades the furniture in)
 */
export function frameFile(o) {
  const p = `f${o.f}-`;
  const PK = o.flows
    .map((pk) => ({ id: pk.id, end: pk.end, kind: pk.kind || 'packet', pts: pk.pts.map((q) => [r3(q.g - o.off), q.x, q.y]) }))
    .filter((pk) => (pk.pts[pk.pts.length - 1][0] > 0 || pk.end === 'stay') && pk.pts[0][0] < o.dur);
  const furniture = o.first
    ? `tl.fromTo([$('bug'), $('slate')], { opacity: 0 }, { opacity: 0.9, duration: 0.6, ease: 'power1.out' }, 0.3); tl.fromTo($('scrim'), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out' }, 0.3);`
    : `tl.set([$('bug'), $('slate')], { opacity: 0.9 }, 0); tl.set($('scrim'), { opacity: 1 }, 0);`;
  return `<template>
  <style>
    @font-face { font-family: "DM Sans"; src: url("assets/fonts/DMSans-Variable.ttf") format("truetype"); font-weight: 100 1000; }
    @font-face { font-family: "DM Mono"; src: url("assets/fonts/DMMono-Medium.ttf") format("truetype"); font-weight: 500; }
    #root { position: absolute; inset: 0; overflow: hidden; font-family: "DM Sans", sans-serif; }
    #${p}ground { position: absolute; inset: 0; background: ${C.bg}; }
    #${p}view { position: absolute; inset: 0; }
    #${p}cam-scale { position: absolute; inset: 0; transform-origin: ${CAM.cx}px ${CAM.cy}px; }
    #${p}cam-move { position: absolute; inset: 0; }
    .${p}svg { position: absolute; left: 0; top: 0; overflow: visible; }
    /* The furniture sits on clean ground: world content fades out under the top edge. */
    #${p}scrim { position: absolute; left: 0; right: 0; top: 0; height: 160px; opacity: 0; background: linear-gradient(to bottom, rgba(15,17,23,0.95) 0, rgba(15,17,23,0.78) 70px, rgba(15,17,23,0) 160px); }
    #${p}bug { position: absolute; top: 46px; right: 58px; width: 232px; height: 24px; opacity: 0; }
    #${p}bug svg { display: block; width: 100%; height: 100%; }
    #${p}slate { position: absolute; top: 40px; left: 58px; opacity: 0; }
    #${p}slate .k { font-family: "DM Sans"; font-weight: 600; font-size: 17px; letter-spacing: 2.8px; color: ${C.primary}; text-transform: uppercase; }
    #${p}slate .t { font-family: "DM Sans"; font-weight: 600; font-size: 27px; color: ${C.text}; margin-top: 4px; }
  </style>
  <div id="root" data-composition-id="${o.id}" data-width="1920" data-height="1080" data-duration="${o.dur}">
    <div id="${p}ground" class="clip" data-start="0" data-duration="${o.dur}" data-track-index="0"></div>
    <div id="${p}view" class="clip" data-start="0" data-duration="${o.dur}" data-track-index="1">
      <div id="${p}cam-scale" data-layout-allow-overflow><div id="${p}cam-move">
${o.stage.svg(p)}
      </div></div>
      <div id="${p}scrim"></div>
      <div id="${p}slate"><div class="k">${o.slate.kicker}</div><div class="t">${o.slate.title}</div></div>
      ${o.lesson ? `<svg class="${p}svg" viewBox="0 0 1920 1080" width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">${lessonCard(o.lesson)(p)}</svg>` : ''}
      <div id="${p}bug"><svg viewBox="0 0 300 31" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Opportunity Education">${LOGO_DARK}</svg></div>
    </div>
  </div>
  <script>
  (function () {
    var P = ${JSON.stringify(p)}, C = ${JSON.stringify(C)}, CX = ${CAM.cx}, CY = ${CAM.cy};
    var PK = ${JSON.stringify(PK)};
${RUNTIME}
    ${furniture}
${o.body}
    window.__timelines[${JSON.stringify(o.id)}] = tl;
  })();
  </script>
</template>
`;
}
