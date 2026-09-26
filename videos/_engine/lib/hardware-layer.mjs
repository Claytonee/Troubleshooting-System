/**
 * The hybrid layer (D39): a Three.js composition laid over a stretch of 2D frames while the story is on
 * physical hardware. The 2D frame beneath carries the drawing up to the hand-over and after it; this layer
 * carries the real object, and its own copy of the screen furniture (slate, logo, top scrim) so the cut
 * between them is invisible.
 *
 * The scene is a pure function of the layer's time. That time comes from the layer's own GSAP timeline,
 * read through a clock setter: HyperFrames seeks the timeline, GSAP sets `clock.t`, the setter renders.
 * So a frame renders the same whether it is reached in order, out of order, or twice.
 *
 * Assets: the runtime (shared/three-oe3d.js — three.js + HardwareStage, bundled) and GLBs from hardware-3d/,
 * copied into the project by make.mjs. Loading is declared to the runtime through __hf.buildReady.
 *
 * @param o.id        composition id (e.g. 'hw3d')
 * @param o.dur       seconds
 * @param o.bg        ground colour (C.bg)
 * @param o.slate     { kicker, title }
 * @param o.logo      the official logo's SVG paths (frame.mjs LOGO_DARK)
 * @param o.C         palette
 * @param o.models    { name: 'assets/hw3d/router.glb', … }
 * @param o.scene     browser JS: function body (OE3D, stage, notes, C) → returns render(t)
 */
export function hardwareLayer(o) {
  return `<template>
  <style>
    @font-face { font-family: "DM Sans"; src: url("assets/fonts/DMSans-Variable.ttf") format("truetype"); font-weight: 100 1000; }
    #${o.id}-root { position: absolute; inset: 0; opacity: 0; background: ${o.bg}; }
    #${o.id}-canvas { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; display: block; }
    #${o.id}-notes { position: absolute; left: 0; top: 0; overflow: visible; }
    #${o.id}-scrim { position: absolute; left: 0; right: 0; top: 0; height: 160px; background: linear-gradient(to bottom, rgba(15,17,23,0.95) 0, rgba(15,17,23,0.78) 70px, rgba(15,17,23,0) 160px); }
    #${o.id}-bug { position: absolute; top: 46px; right: 58px; width: 232px; height: 24px; opacity: 0.9; }
    #${o.id}-bug svg { display: block; width: 100%; height: 100%; }
    #${o.id}-slate { position: absolute; top: 40px; left: 58px; opacity: 0.9; font-family: "DM Sans", sans-serif; }
    #${o.id}-slate .k { font-weight: 600; font-size: 17px; letter-spacing: 2.8px; color: ${o.C.primary}; text-transform: uppercase; }
    #${o.id}-slate .t { font-weight: 600; font-size: 27px; color: ${o.C.text}; margin-top: 4px; }
  </style>
  <div id="root" data-composition-id="${o.id}" data-width="1920" data-height="1080" data-duration="${o.dur}">
    <div id="${o.id}-root" class="clip" data-start="0" data-duration="${o.dur}" data-track-index="0">
      <canvas id="${o.id}-canvas" width="1920" height="1080"></canvas>
      <svg id="${o.id}-notes" viewBox="0 0 1920 1080" width="1920" height="1080" xmlns="http://www.w3.org/2000/svg"></svg>
      <div id="${o.id}-scrim"></div>
      <!-- the frame's own slate, repeated so the hand-over is seamless: identical text in the identical place, by design -->
      <div id="${o.id}-slate"><div class="k" data-layout-allow-overlap data-layout-allow-occlusion>${o.slate.kicker}</div><div class="t" data-layout-allow-overlap data-layout-allow-occlusion>${o.slate.title}</div></div>
      <div id="${o.id}-bug"><svg viewBox="0 0 300 31" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Opportunity Education">${o.logo}</svg></div>
    </div>
  </div>
  <script src="assets/hw3d/three-oe3d.js" data-oe3d="1"></script>
  <script>
  (function () {
    var ID = ${JSON.stringify(o.id)}, DUR = ${o.dur}, C = ${JSON.stringify(o.C)}, MODELS = ${JSON.stringify(o.models)};
    window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {};
    var ready; window.__hf.buildReady[ID] = new Promise(function (r) { ready = r; });
    var render = null, last = 0;
    // The clock: GSAP sets t on every seek of this timeline; the setter draws that exact moment.
    var clock = {}; Object.defineProperty(clock, 't', { get: function () { return last; }, set: function (v) { last = v; if (render) render(v); } });
    var tl = gsap.timeline({ paused: true });
    tl.to(clock, { t: DUR, duration: DUR, ease: 'none' }, 0);
    window.__timelines = window.__timelines || {}; window.__timelines[ID] = tl;

    function start() {
      var OE3D = window.OE3D;
      var stage = new OE3D.HardwareStage(document.getElementById(ID + '-canvas'));
      var notes = document.getElementById(ID + '-notes');
      var names = Object.keys(MODELS);
      Promise.all(names.map(function (n) { return stage.load(n, MODELS[n]); })).then(function () {
        var root = document.getElementById(ID + '-root');
        render = (function (OE3D, stage, notes, C, root) {
${o.scene}
        })(OE3D, stage, notes, C, root);
        render(last); ready();
      }, function (e) { console.error('[' + ID + '] 3D assets failed', e); ready(); });
    }
    // One shared runtime per page (the static tag above). Whichever order the page runs the two scripts in,
    // start() runs once the runtime exists: at once if it already loaded, else on its load event.
    if (window.OE3D) start();
    else {
      var s = document.querySelector('script[data-oe3d]');
      if (!s) { s = document.createElement('script'); s.src = 'assets/hw3d/three-oe3d.js'; s.setAttribute('data-oe3d', '1'); document.head.appendChild(s); }
      s.addEventListener('load', start);
      s.addEventListener('error', function () { console.error('[' + ID + '] three-oe3d.js failed to load'); ready(); });
    }
  })();
  </script>
</template>
`;
}

/**
 * Callouts for the hardware view, drawn in the page over the canvas. Each follows its anchor by projecting
 * it every frame: a label never drifts off the port it names, whatever the camera does.
 * Browser JS (a string) to paste into a layer scene.
 */
export const CALLOUTS_JS = `
    var NS = 'http://www.w3.org/2000/svg';
    function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); (parent || notes).appendChild(e); return e; }
    /** A callout: title (caps) + sub line, a dashed leader to the anchor, a dot on it. side: 'up'|'down'|'left'|'right'. */
    function callout(id, title, sub, color) {
      var g = el('g', { id: id, opacity: 0 });
      var line = el('path', { fill: 'none', stroke: C.muted, 'stroke-width': 2, 'stroke-dasharray': '5 6' }, g);
      // The anchor is a hollow neutral ring, never a filled colour: a red dot on a light reads as a red light
      // (found in the frame review: "WAN LIGHT: OFF" appeared to light the WAN LED red).
      var dot = el('circle', { r: 7, fill: 'none', stroke: C.text, 'stroke-width': 2 }, g);
      // Sized for a phone: 30/24 px at 1080p is ~10/8 px on a 360 px-tall screen (22/20 px was unreadable there).
      var t1 = el('text', { 'font-family': 'DM Sans', 'font-weight': 700, 'font-size': 30, 'letter-spacing': 2.8, fill: color || C.text }, g); t1.textContent = title;
      var t2 = el('text', { 'font-family': 'DM Sans', 'font-weight': 500, 'font-size': 24, fill: C.muted }, g); t2.textContent = sub || '';
      return { g: g, place: function (p, dx, dy, anchorEnd, opacity) {
        g.setAttribute('opacity', opacity);
        if (opacity <= 0.001) return;
        var lx = p.x + dx, ly = p.y + dy;
        line.setAttribute('d', 'M' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' L' + lx.toFixed(1) + ',' + ly.toFixed(1));
        dot.setAttribute('cx', p.x.toFixed(1)); dot.setAttribute('cy', p.y.toFixed(1));
        var ax = anchorEnd === 'end' ? lx - 10 : anchorEnd === 'middle' ? lx : lx + 10, a = anchorEnd || 'start';
        var ty = dy < 0 ? ly - 44 : ly + 34;
        t1.setAttribute('x', ax.toFixed(1)); t1.setAttribute('y', ty.toFixed(1)); t1.setAttribute('text-anchor', a);
        t2.setAttribute('x', ax.toFixed(1)); t2.setAttribute('y', (ty + 32).toFixed(1)); t2.setAttribute('text-anchor', a);
      } };
    }
    /** 0 before a, 1 from a+f to b-f, 0 after b. */
    function win(t, a, b, f) { f = f || 0.3; var u = Math.min(1, Math.max(0, (t - a) / f)), v = Math.min(1, Math.max(0, (b - t) / f)); return Math.min(u, v); }
`;
