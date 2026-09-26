/**
 * Episode 00 — the hybrid 2D + real-3D prototype (D39). The polished film (how-a-school-connects) with ONE
 * section upgraded, as the brief asks: Fault Domain → 3D router → WAN inspection → reconnect → link restored
 * → (back to the diagram) → verification. Every other frame is the approved film, unchanged.
 *
 * The hand-over is a silhouette match, not a cut: the 2D camera pushes to the router at exactly the framing
 * where the 3D front view lands the real router's face on the drawing's (the Blender router is built to router2's layout: hardware-3d/), the
 * 3D layer fades in over it, and only then does the camera move and reveal depth. The return mirrors it.
 */
import base from './how-a-school-connects.mjs';
import { LOGO_DARK } from '../_engine/lib/frame.mjs';
import { hardwareLayer, CALLOUTS_JS } from '../_engine/lib/hardware-layer.mjs';
import { readFileSync } from 'node:fs';

/** The 3D choreography (browser JS): shot B–G on the real router. Kept beside the spec, pasted into the layer. */
const SCENE = readFileSync(new URL('./how-a-school-connects-3d.scene.js', import.meta.url), 'utf8');

const MATCH = { s: 2.3, px: 1560, py: 532.4 };            // 2D framing of the router face at the hand-over

const frame6 = {
  id: '06-the-fix', title: 'The fix (3D)', pad: [0.3, 2.0],
  phrases: [
    ['Here is the router itself.', 0.55],
    ['Its status lights, the LAN ports for the school, and the WAN port for the provider.', 0.6],
    ['Its WAN cable has worked loose.', 0.6],
    ['Push it in until it clicks.', 0.8],
    ['The WAN light comes on,', 0.4],
    ['and the router is back online.', 0],
  ],
  scene: 'The camera pushes into the drawn router; at the matched framing the real router takes its place and the camera turns to show its depth: status lights, LAN ports, WAN port. It moves in on the WAN port: the connector is not seated and the WAN light is off. The connector is aligned and pushed home; the latch clicks; after a moment the WAN light comes on and flickers with traffic; the INTERNET light searches and turns green. The camera returns to the front; the drawing takes over again and the path beyond wakes up.',
  type: 'feature_showcase', persuasion: 'Demonstration on the real object', beat: 'Resolve (deliberate)', blueprint: 'hybrid 2D→3D hand-over',
  shots: 'B push into the drawn router · C 3D orientation · D WAN close-up · E reseat · F link up · G back to the diagram.',
};

/** Frame-local key times of the 3D section, from the voice. */
function keys(x) {
  const c = (i, d = 0) => x.cue(6, i, d), w = (word, fb) => x.word(6, word) ?? fb;
  const k = {};
  k.push0 = c(0); k.push1 = c(0, 1.3);
  k.fadeIn = k.push1 + 0.05;
  k.orbit0 = k.fadeIn + 0.45; k.orbit1 = Math.max(k.orbit0 + 1.6, c(1, 0.3));
  k.noteStatus = w('status', c(1)); k.noteLan = w('lan', c(1, 1.6)); k.noteWan = (() => { const v = x.meta.voices.find((q) => q.frame === 6); const h = v && v.words.find((q) => /^wan/i.test(q.text) && q.start < c(2)); return h ? h.start : c(1, 3); })();
  k.dolly0 = c(2, -0.25); k.dolly1 = c(2, 1.25);
  k.noteLoose = k.dolly1 - 0.15;
  k.seat = w('clicks', c(3, 1.2));
  k.linkUp = Math.max(k.seat + 0.9, w('comes', c(4, 0.4)));      // auto-negotiation takes a moment; never instant
  k.inetTry = k.linkUp + 0.5; k.inetOk = c(5, 0.4);
  k.back0 = c(5, 0.15); k.back1 = k.back0 + 1.5;
  k.fadeOut = k.back1 + 0.15;
  k.return2d = k.fadeOut + 0.45;
  for (const q of Object.keys(k)) k[q] = +k[q].toFixed(3);
  return k;
}

export default {
  ...base,
  slug: 'how-a-school-connects-3d',
  title: 'Follow the signal',
  message: base.message,
  creative: [...base.creative, 'D39 prototype: the physical inspection and the repair happen on a real 3D router, handed over from the drawing by a silhouette match and back again.'],
  frames: base.frames.map((fr) => (fr.id !== '06-the-fix' ? fr : {
    ...frame6,
    timeline: (x) => {
      const k = keys(x);
      return `
    ${x.setup(6)}
    cam(1.35, 2170, 480, 0);
    fade([$('domain'), $('causes'), $('tag-mdm'), $('mdmlan'), $('upstream')], 0, ${x.c(0)}, 0.4);
    // what the 3D front view will not show leaves the drawing before the hand-over
    fade([$('chip1'), $('chip2'), $('chip3'), $('chip4'), $('lead3'), $('lead4'), $('nolink')], 0, ${x.c(0, 0.2)}, 0.4);
    cam(${MATCH.s}, ${MATCH.px}, ${MATCH.py}, ${k.push0}, ${(k.push1 - k.push0).toFixed(3)}, 'power3.inOut');
    // while the 3D view covers it, the drawing takes the repaired state (the hand-back must match)
    var H = ${(k.fadeIn + 0.5).toFixed(3)};
    tl.set($('plug-body'), { y: 0, rotation: 0, svgOrigin: '1695 590' }, H);
    off($('loose'), H);
    led('rt.wan', C.pos, H, 0); led('mdm.lan', C.pos, H, 0); led('rt.inet', C.pos, H, 0);
    tl.set($('c3-lit'), { attr: { stroke: C.primary }, strokeDashoffset: 0 }, H);
    chipSet(4, 'ok', H); off($('chip4'), H);
    // while the 3D layer is fully opaque the drawing is not drawn at all (nothing hidden beneath it)
    tl.set($('view'), { opacity: 0 }, ${(k.fadeIn + 0.5).toFixed(3)}); tl.set($('view'), { opacity: 1 }, ${(k.fadeOut - 0.01).toFixed(3)});
    // back in the drawing: the path beyond wakes up and the first packet crosses the repaired cable
    cam(1.05, 2050, 510, ${k.return2d}, 1.3, 'power2.inOut');
    fade([$('dev-srv'), $('net'), $('line-base'), $('dev-mdm'), $('c3-base')], 1, ${(k.return2d + 0.3).toFixed(3)}, 0.6);
    tl.set($('line-lit'), { attr: { stroke: C.primary } }, 0); drawLink('line', ${(k.return2d + 0.5).toFixed(3)}, 0.7);`;
    },
  })),

  flows(x) {
    const k = keys(x);
    x.firstAt = () => x.G(6, k.return2d + 0.25);
    return base.flows(x);
  },

  sfx(x) {
    const k = keys(x);
    const s = base.sfx(x).filter(([f]) => f !== 6);
    s.push([6, 'click', k.seat - 0.03, 0.36]);   // the latch
    s.push([6, 'ping', k.linkUp, 0.09]);         // the link comes up
    return s;
  },

  /** The 3D layer (lib/hardware-layer.mjs): the real router over frame 6 while the camera is on it. */
  layers(x) {
    const k = keys(x), off = x.OFF[6];
    const t0 = +(k.fadeIn - 0.05).toFixed(3);
    const start = +(off + t0).toFixed(3), end = +(off + k.fadeOut + 0.45).toFixed(3), dur = +(end - start).toFixed(3);
    const scene = CALLOUTS_JS + `
        var K = ${JSON.stringify(k)}, T0 = ${t0}, MATCH_CFG = ${JSON.stringify({ pxW: 390 * MATCH.s, cy: 440 })};
` + SCENE;
    return [{ id: 'hw3d', start, dur, html: hardwareLayer({ id: 'hw3d', dur, bg: x.C.bg, C: x.C, logo: LOGO_DARK,
      slate: { kicker: base.kicker, title: base.title },
      models: { router: 'assets/hw3d/router.web.glb', plug: 'assets/hw3d/rj45-plug.web.glb' }, scene }) }];
  },
};
