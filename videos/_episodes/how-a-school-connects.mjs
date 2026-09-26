/**
 * Episode 00 — How a school connects to the internet (fault type: Connectivity / No internet access).
 * The approved prototype, ported onto the engine: its regression reference.
 */
export default {
  slug: 'how-a-school-connects',
  kicker: 'Connectivity',
  title: 'How the school connects',
  category: 'Connectivity', subcategory: 'No internet access',
  message: 'Every packet crosses four links on its way out of school; when one breaks, you check them in order and the fault shows itself.',
  length: '30s',
  lesson: 'Check the links in order.',
  stageNote: 'Computer → Ethernet cable → switch → router → provider → the internet, left to right. The four links counted: ① cable, ② switch, ③ router, ④ provider line (the one that breaks).',
  creative: ['Signature: one anchored zoom-out from the dead screen to the whole chain.', 'Packets on one global clock; the provider line snaps and mends.'],
  facts: ['Check order, computer outwards: cable and link light, switch, router, provider line (guide #1: router lights, cable, other devices, then the provider).', 'The first dark light is the fault; a dark WAN light with power and LAN lit points at the provider (explainer lrs-or-internet).'],

  frames: [
    { id: '01-no-internet', title: 'No internet in the lab', pad: [0.7, 0.4],
      phrases: [['No internet in the lab?', 0.45], ['The fault is in one of four links.', 0]],
      scene: 'Tight on the dead screen; one anchored zoom-out to the whole chain; the four links numbered.', type: 'hook', persuasion: 'Pain validation + frame-then-fill', beat: 'Recognition + curiosity', blueprint: 'zoom-out-workspace-reveal (Adapt)',
      timeline: (x) => `
    ${['sw', 'rt', 'isp', 'net'].map((k) => `dim('${k}', 0.35, 0);`).join(' ')}
    cam(6.8, ${x.st.screen.x}, ${x.st.screen.y}, 0);
    camKeys(${x.J(x.anchoredZoom(6.8, 1, x.st.screen, { x: 960, y: 440 }, 3.45))}, 0.05);
    tl.to($('pc-scr-noinet'), { opacity: 0.35, duration: 0.08 }, 0.32); tl.to($('pc-scr-noinet'), { opacity: 1, duration: 0.08 }, 0.42);
    chipsIn(4, ${x.w('four') ?? x.c(1, 0.9)}, 0.09, 14);` },

    { id: '02-the-path', title: 'The path a packet takes', pad: [0.35, 0.45],
      phrases: [['Your computer sends packets,', 0.3], ['down the cable,', 0.3], ['to the switch,', 0.3], ['through the router,', 0.3], ['to your provider,', 0.35], ['and out to the internet.', 0]],
      scene: 'The camera follows the packets; each device lights and gets its label as it is named.', type: 'product_intro', persuasion: 'Progressive disclosure + causal chain', beat: 'Clarity + momentum', blueprint: 'spatial-pan-stations (Adapt)',
      timeline: (x) => `
    ${['sw', 'rt', 'isp', 'net'].map((k) => `dim('${k}', 0.35, 0);`).join(' ')}
    for (var i = 1; i <= 4; i++) chipSet(i, 'n', 0);
    fade([$('chip1'), $('chip2'), $('chip3'), $('chip4')], 0, 0.02, 0.3);
    fade($('pc-scr-noinet'), 0, 0.02, 0.3); fade($('pc-scr-idle'), 1, 0.1, 0.3);
    cam(1, 960, 440, 0);
    cam(1.5, 330, 420, ${x.c(0)}, 1.3);
    show($('lab-pc'), ${x.c(0, 0.05)}, 0.5, { y: 10 });
    drawLink('L1', ${x.c(1)}, ${x.geo.r3(x.c(2) - x.c(1) - 0.05)});
    show($('lab-cable'), ${x.c(1, 0.05)}, 0.5, { y: 10 });
    cam(1.5, 560, 420, ${x.c(1)}, 1.15);
    dim('sw', 1, ${x.c(2)}, 0.35); show($('lab-sw'), ${x.c(2, 0.05)}, 0.5, { y: 10 });
    for (var k = 0; k < 8; k++) { led('sw.p' + k, C.pos, ${x.c(2, 0.05)} + k * 0.03, 0.1); if (k) led('sw.p' + k, C.line, ${x.c(2, 0.4)} + k * 0.03, 0.2); }
    led('sw.pwr', C.pos, ${x.c(2, 0.05)}, 0.2);
    drawLink('L2', ${x.c(2, 0.2)}, ${x.geo.r3(x.c(3) - x.c(2) - 0.25)});
    cam(1.5, 800, 420, ${x.c(2)}, 1.15);
    dim('rt', 1, ${x.c(3)}, 0.35); show($('lab-rt'), ${x.c(3, 0.05)}, 0.5, { y: 10 });
    led('rt.pwr', C.pos, ${x.c(3, 0.05)}, 0.2);
    drawLink('L3a', ${x.c(3, 0.18)}, 0.44); drawLink('L3b', ${x.c(3, 0.62)}, ${x.geo.r3(x.c(4) - x.c(3) - 0.67)});
    led('rt.wan', C.pos, ${x.c(3, 0.2)}, 0.2);
    cam(1.5, 1090, 410, ${x.c(3)}, 1.15);
    dim('isp', 1, ${x.c(4)}, 0.35); show($('lab-isp'), ${x.c(4, 0.05)}, 0.5, { y: 10 });
    drawLink('L4', ${x.c(4, 0.45)}, ${x.geo.r3(x.c(5) - x.c(4) - 0.5)});
    cam(1.5, 1400, 400, ${x.c(4)}, 1.3);
    dim('net', 1, ${x.c(5)}, 0.35); show($('lab-net'), ${x.c(5, 0.05)}, 0.5, { y: 10 });
    cam(1, 960, 440, ${x.c(5, 0.05)}, 1.4, 'power3.inOut');` },

    { id: '03-link-breaks', title: 'One link breaks', pad: [0.25, 0.5],
      phrases: [['When one link breaks,', 0.3], ['the packets stop right there.', 0]],
      scene: 'The provider line snaps; packets die at the gap; the camera goes to the consequence.', type: 'pain_point', persuasion: 'Counterexample + before/after', beat: 'Tension', blueprint: 'camera-journey (Adapt)',
      timeline: (x) => `
    ${x.allOn()}
    cam(1, 960, 440, 0);
    var B = ${x.geo.r3(x.BREAK - x.off)};
    breakLink('L3', B);
    linkDark('L4', B + 0.1, 0.5);
    fade([$('dev-isp'), $('dev-net'), $('lab-isp'), $('lab-net')], 0.28, B + 0.1, 0.5);
    led('rt.wan', C.neg, B + 0.05, 0.15);
    cam(1.6, 1105, 412, ${x.c(1, -0.1)}, 1.1);` },

    { id: '04-check-in-order', title: 'Check the links in order', pad: [0.25, 0.55],
      phrases: [['Check them in order, from the computer out.', 0.5], ['Cable.', 0.45], ['Switch.', 0.45], ['Router.', 0.45], ['Provider.', 0.6], ['The first dark light is your fault.', 0]],
      scene: 'Four numbered checks under the links flip one per word; the provider flips red; the dark light is pointed at.', type: 'feature_showcase', persuasion: 'Signposting + numbered enumeration', beat: 'Focus + aha', blueprint: 'agent-progress-theater (Adapt)',
      timeline: (x) => `
    ${x.allOn()} ${x.broken()}
    cam(1.6, 1105, 412, 0);
    cam(1, 960, 440, ${x.c(0)}, 1.4);
    tl.fromTo($('rail'), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' }, ${x.c(0, 0.5)});
    chipsIn(4, ${x.c(0, 1.0)}, 0.12, 16);
    chipFlip(1, true, ${x.c(1, 0.04)}); led('sw.p0', C.pos, ${x.c(1, 0.04)});
    chipFlip(2, true, ${x.c(2, 0.04)}); led('sw.pwr', C.pos, ${x.c(2, 0.04)});
    chipFlip(3, true, ${x.c(3, 0.04)}); led('rt.pwr', C.pos, ${x.c(3, 0.04)});
    chipFlip(4, false, ${x.c(4, 0.04)});
    tl.fromTo($('fault'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, ${x.c(4, 0.12)});
    blink('rt.wan', C.neg, ${x.c(4, 0.1)}, 2); led('rt.wan', C.line, ${x.c(4, 1.05)}, 0.25);
    cam(1.25, 1080, 420, ${x.c(5)}, 1.4);
    tl.fromTo($('dark'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, ${x.c(5, 0.15)});` },

    { id: '05-back-online', title: 'Back online', pad: [0.25, 1.9],
      phrases: [['Fix that one link,', 0.3], ['and the school is back online.', 0]],
      scene: 'The line mends, the check turns green, flow resumes, the screen says Connected, the lesson card lands.', type: 'cta', persuasion: 'Callback + distillation', beat: 'Satisfaction + resolve', blueprint: 'camera-journey (Adapt)',
      timeline: (x) => `
    ${x.allOn()} ${x.broken()}
    led('sw.p0', C.pos, 0, 0); led('sw.pwr', C.pos, 0, 0); led('rt.pwr', C.pos, 0, 0); led('rt.wan', C.line, 0, 0);
    on($('rail'), 0); chipSet(1, 'ok', 0); chipSet(2, 'ok', 0); chipSet(3, 'ok', 0); chipSet(4, 'x', 0); on($('fault'), 0); on($('dark'), 0);
    cam(1.25, 1080, 420, 0);
    var F = ${x.geo.r3(x.FIX - x.off)};
    fade($('dark'), 0, ${x.c(0)}, 0.35);
    mendLink('L3', F);
    fade($('fault'), 0, F - 0.1, 0.25);
    chipFlip(4, true, F); led('rt.wan', C.pos, F);
    cam(1, 960, 440, ${x.c(0, 0.1)}, 1.5);
    drawLink('L4', F + 0.25, 0.45);
    fade([$('dev-isp'), $('dev-net'), $('lab-isp'), $('lab-net')], 1, F + 0.2, 0.5);
    screen('pc', 'idle', 'ok', ${x.c(1)});
    fade([$('rail'), $('chip1'), $('chip2'), $('chip3'), $('chip4')], 0, ${x.c(1, 1.1)}, 0.4);
    endCard(${x.c(1, 1.3)});` },
  ],

  stage(x) {
    const { Stage, LIB, geo, C, lessonCard, callout } = x;
    const st = new Stage();
    st.place('pc', LIB.computer(), { x: 200, y: 410, scale: 1.35 })
      .place('sw', LIB.netSwitch(), { x: 620, y: 405, scale: 1.35 })
      .place('rt', LIB.router(), { x: 1000, y: 405, scale: 1.35 })
      .place('isp', LIB.isp(), { x: 1380, y: 410, scale: 1.35 })
      .place('net', LIB.cloud(), { x: 1740, y: 330, scale: 1.35 });
    const pt = (r) => st.pt(r);
    st.link('L1', geo.sag(pt('pc.out'), pt('sw.in'), 448))
      .link('L2', geo.sag(pt('sw.out'), pt('rt.in'), 442))
      .link('L4', geo.ease(pt('isp.out'), pt('net.in'), 70));
    const GAP = st.splitLink('L3', geo.sag(pt('rt.out'), pt('isp.in'), 446));
    st.seg('sw', pt('sw.in'), pt('sw.out')).seg('rt', pt('rt.in'), pt('rt.out'))
      .seg('isp1', pt('isp.in'), pt('isp.mid')).seg('isp2', pt('isp.mid'), pt('isp.up')).seg('isp3', pt('isp.up'), pt('isp.out'))
      .seg('cl', pt('net.in'), pt('net.mid'));
    st.label('pc', 200, 505, 'School computer').label('cable', 404, 360, 'Ethernet cable', '', 26)
      .label('sw', 620, 505, 'Switch', 'joins every computer in the building').label('rt', 1000, 505, 'Router', "the school's gateway")
      .label('isp', 1380, 505, 'Internet provider', 'carries the school out').label('net', 1740, 505, 'The internet');
    const mid = geo.bez(...geo.sag(pt('pc.out'), pt('sw.in'), 448))(0.5);
    st.chip(1, mid.x, 625).chip(2, 620, 625).chip(3, 1000, 625).chip(4, GAP.x, 625);
    st.add((p) => `<g id="${p}rail" opacity="0">
      <text x="64" y="632" style='font-family:"DM Sans";font-weight:600;font-size:19px;letter-spacing:2.6px' fill="${C.primary}">CHECK IN ORDER</text>
      <path d="M300,578 H1262" stroke="${C.primary}" stroke-opacity="0.45" stroke-width="2"/><path d="M1252,571 L1264,578 L1252,585" fill="none" stroke="${C.primary}" stroke-opacity="0.45" stroke-width="2" stroke-linejoin="round"/></g>
      <text id="${p}fault" x="${GAP.x.toFixed(1)}" y="694" text-anchor="middle" opacity="0" style='font-family:"DM Sans";font-weight:700;font-size:20px;letter-spacing:2.8px' fill="${C.neg}">FAULT</text>`);
    st.add(callout('dark', 'FIRST DARK LIGHT', { x: 1165, y: 205 }, pt('rt.led.wan')));
    st.screen = geo.P(200, 410 + 1.35 * -67);   // the computer's screen centre, for the opening zoom
    // helpers the timelines share
    x.allOn = () => `${['pc', 'cable', 'sw', 'rt', 'isp', 'net'].map((k) => `on($('lab-${k}'), 0);`).join(' ')} ${['L1', 'L2', 'L3a', 'L3b', 'L4'].map((k) => `linkOn('${k}', 0);`).join(' ')}
    off($('pc-scr-noinet'), 0); on($('pc-scr-idle'), 0); led('sw.p0', C.pos, 0, 0); led('sw.pwr', C.pos, 0, 0); led('rt.pwr', C.pos, 0, 0); led('rt.wan', C.pos, 0, 0);`;
    x.broken = () => `breakLink('L3', 0, true); tl.set($('L4-lit'), { strokeDashoffset: $('L4-lit').getAttribute('data-len') }, 0);
    dim('isp', 0.28, 0); dim('net', 0.28, 0); tl.set([$('lab-isp'), $('lab-net')], { opacity: 0.28 }, 0); led('rt.wan', C.neg, 0, 0);`;
    x.BREAK = x.G(3, 1.05); x.FIX = x.G(5, 1.1);
    return st;
  },

  flows(x) {
    const { flows, st, G, cue } = x;
    const out = [];
    const c2 = [0, 1, 2, 3, 4, 5].map((i) => G(2, cue(2, i)));
    const port = st.pt('pc.out');
    [0, 0.28, 0.56].forEach((lag, k) => {
      const pts = flows.journey(st, [['L1', c2[1] + lag, c2[2] - 0.05 + lag], ['sw', c2[2] - 0.05 + lag, c2[2] + 0.2 + lag],
        ['L2', c2[2] + 0.2 + lag, c2[3] - 0.05 + lag], ['rt', c2[3] - 0.05 + lag, c2[3] + 0.18 + lag],
        ['L3a', c2[3] + 0.18 + lag, c2[3] + 0.62 + lag], ['L3b', c2[3] + 0.62 + lag, c2[4] - 0.05 + lag],
        ['isp1', c2[4] - 0.05 + lag, c2[4] + 0.12 + lag], ['isp2', c2[4] + 0.12 + lag, c2[4] + 0.3 + lag], ['isp3', c2[4] + 0.3 + lag, c2[4] + 0.45 + lag],
        ['L4', c2[4] + 0.45 + lag, c2[5] - 0.05 + lag], ['cl', c2[5] - 0.05 + lag, c2[5] + 0.35 + lag]]);
      const hold = { x: port.x - 4 - k * 22, y: port.y };
      pts.unshift({ g: +(c2[0] + 0.35 + k * 0.3).toFixed(3), ...hold }, { g: +(c2[1] + lag).toFixed(3), ...hold });
      out.push({ id: `lead${k}`, pts, end: 'arrive' });
    });
    const ALL = ['L1', 'sw', 'L2', 'rt', 'L3a', 'L3b', 'isp1', 'isp2', 'isp3', 'L4', 'cl'], TO_GAP = ['L1', 'sw', 'L2', 'rt', 'L3a'];
    const toGap = flows.routeLength(st, TO_GAP);
    out.push(...flows.stream(st, { id: 's', keys: ALL, from: G(2, cue(2, 5)), until: x.total, every: 0.36, speed: 560,
      cut: (g0) => { const reach = g0 + toGap / 560; return reach >= x.BREAK && reach < x.FIX ? [TO_GAP, 'die'] : null; } }));
    return out;
  },

  sfx(x) {
    const s = [[1, 'whoosh-short', 0.45, 0.22]];
    for (let i = 0; i < 6; i++) s.push([2, 'click-soft', x.cue(2, i, 0.04), 0.26]);
    s.push([3, 'error', 1.0, 0.24]);
    for (let i = 1; i <= 3; i++) s.push([4, 'click-soft', x.cue(4, i, 0.04), 0.3]);
    s.push([4, 'error', x.cue(4, 4, 0.04), 0.24], [5, 'chime', x.cue(5, 1), 0.26]);
    return s;
  },
};
