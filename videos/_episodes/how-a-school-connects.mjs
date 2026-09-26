/**
 * Episode 00, v2 — "How a school connects", directed to the Motion Director Master Brief (2026-09-26).
 * Plan and record: videos/how-a-school-connects/DIRECTION.md.
 *
 * Learning objective: when the internet stops, follow the signal from the computer outwards, checking
 * each link in order; the first failed link is where to investigate; fix it there, then prove the fix
 * with a round trip.
 *
 * The fault acted out: the router's WAN cable has worked loose (visible at the WAN port's link light,
 * fixable on the spot). What a school cannot fix is named as the next suspect, not acted out.
 */
const WIDE = [0.64, 1510, 330];   // the bench between the end card and the captions

export default {
  slug: 'how-a-school-connects',
  kicker: 'Connectivity',
  title: 'Follow the signal',
  category: 'Connectivity', subcategory: 'No internet access',
  message: 'When the internet stops, follow the signal from the computer outwards and check each link in order: the first failed link is where to investigate; fix it there, then prove it with a round trip.',
  length: '70s',
  lesson: ['Check the path in order.', 'The first failed link shows where to investigate.'],
  stageNote: 'One long bench, wider than the screen: computer (monitor + tower with its network port) · cable · switch (8 ports + uplink) · cable · router (LAN 1–4 | WAN, status lights) · WAN cable with a real plug · provider modem · provider line · a web server inside "the internet". The camera travels it; the whole of it is seen only at the end.',
  creative: ['FOLLOW THE SIGNAL: one packet is the only actor until the fix is proven.', 'The failure is physical: the packet reaches the WAN port, tries twice, and gives up; the WAN light never comes on.', 'CHECK THE PATH: each passed check lights its stretch of cable green.', 'The repair is an action (the plug pushed home), and the proof is a round trip to a real destination.'],
  facts: ['A port\'s link light is lit when a working cable connects both ends; unlit means no link (RJ45 behaviour).', 'The router\'s INTERNET light fails when its WAN side has no link; the provider modem\'s LAN light is also off, because the cable reaches neither end.', 'Check order computer → switch → router LAN → router WAN finds the first failed link (guide #1: lights, cable, then provider).', 'A fix is verified by a request that gets an answer, not by a green light alone.'],

  frames: [
    { id: '01-symptom', title: 'The symptom', pad: [0.9, 0.5],
      phrases: [['The internet has stopped at school.', 0.55], ["The computer can't tell you where.", 0]],
      scene: 'Macro on the browser: No internet, the network icon badged. The camera eases back to the whole computer: the monitor and the tower with its network port.', type: 'hook', persuasion: 'Pain validation', beat: 'Recognition', blueprint: 'zoom-out-workspace-reveal (Adapt)',
      shots: 'Shot 01 (macro, screen) → Shot 02 (medium, monitor + tower). Held; no labels.',
      timeline: (x) => `
    ${x.setup(1)}
    cam(6.5, ${x.st.scr.x}, ${x.st.scr.y}, 0);
    tl.fromTo($('desk-scr-noinet'), { opacity: 0.92 }, { opacity: 1, duration: 0.6 }, 0.1);
    cam(2.05, 280, 470, ${x.c(0, 0.6)}, ${x.geo.r3(x.dur - x.c(0) - 0.6)}, 'power2.inOut');` },

    { id: '02-follow-the-signal', title: 'Follow the signal', pad: [0.3, 0.45],
      phrases: [['So follow the signal.', 0.5], ["The switch joins the school's computers", 0.2], ['and passes their traffic to the router,', 0.35], ["the school's gateway.", 0.5], ['Its LAN ports face the school.', 0.4], ['Its WAN port faces the provider.', 0]],
      scene: 'One packet leaves the tower; the camera tracks it along the cable into the switch (port 3 in, uplink out), along the next cable into the router, then pushes in on the router\'s two sides.', type: 'product_intro', persuasion: 'Progressive disclosure + causal chain', beat: 'Clarity + momentum', blueprint: 'spatial-pan-stations (Adapt)',
      shots: 'Shots 03–05: tracking right with the packet; arrive at the switch; track to the router; push in on the router face.',
      timeline: (x) => `
    ${x.setup(2)}
    cam(2.05, 280, 470, 0);
    ${x.blips(2)}
    cam(1.75, 520, 520, ${x.c(0, 0.3)}, ${x.geo.r3(x.c(1) - x.c(0) - 0.2)}, 'sine.inOut');
    cam(1.9, 900, 530, ${x.c(1, -0.1)}, 1.1, 'power2.inOut');
    show($('tag-sw'), ${x.c(1, 0.2)}, 0.5, { y: 8 });
    fade($('tag-sw'), 0, ${x.c(2, 0.3)}, 0.4);
    cam(1.75, 1230, 525, ${x.c(2)}, ${x.geo.r3(x.c(3) - x.c(2) - 0.2)}, 'sine.inOut');
    cam(2.25, 1560, 510, ${x.c(3, -0.2)}, 1.1, 'power2.inOut');
    show($('tag-rt'), ${x.c(3, 0.1)}, 0.5, { y: 8 });
    fade($('tag-rt'), 0, ${x.c(4, -0.1)}, 0.35);
    cam(2.6, 1490, 505, ${x.c(4, -0.1)}, 0.9, 'power2.inOut');
    show($('side-lan'), ${x.c(4, 0.15)}, 0.45, { y: 6 });
    cam(2.6, 1650, 505, ${x.c(5, -0.1)}, 0.9, 'power2.inOut');
    show($('side-wan'), ${x.c(5, 0.15)}, 0.45, { y: 6 });` },

    { id: '03-no-way-out', title: 'No way out', pad: [0.25, 0.6],
      phrases: [['Every request leaves through it.', 0.45], ["This one doesn't get out.", 1.0], ['Nothing gets past the router.', 0]],
      scene: 'Close on the WAN port: the packet crosses the router to it, pushes out twice and gives up; the WAN light never lights, the INTERNET light fails. Hold. Pull back right: the cable, the modem and the internet beyond are unreachable.', type: 'pain_point', persuasion: 'Demonstration of the mechanism failing', beat: 'Tension → stillness', blueprint: 'camera-journey (Adapt)',
      shots: 'Shot 06 (close, WAN port; the failure; a held beat of stillness) → Shot 07 (pull back right: the consequence).',
      timeline: (x) => `
    ${x.setup(3)}
    cam(2.6, 1650, 505, 0);
    fade([$('side-lan'), $('side-wan')], 0, ${x.c(0, 0.2)}, 0.4);
    cam(3.5, 1690, 552, ${x.c(0, 0.15)}, 1.2, 'power2.inOut');
    ${x.blips(3)}
    var A = ${x.g(x.ev.attempt)};
    tl.fromTo($('seek'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out', transformOrigin: '50% 50%' }, A);
    tl.to($('seek'), { scale: 1.35, opacity: 0, duration: 0.5, ease: 'power1.out', transformOrigin: '50% 50%' }, A + 0.35);
    tl.fromTo($('seek'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out', transformOrigin: '50% 50%' }, A + 0.88);
    tl.to($('seek'), { scale: 1.35, opacity: 0, duration: 0.5, ease: 'power1.out', transformOrigin: '50% 50%' }, A + 1.23);
    led('rt.inet', C.warn, A + 0.1, 0.12); led('rt.inet', C.neg, A + 0.5, 0.12); led('rt.inet', C.warn, A + 0.98, 0.12); led('rt.inet', C.neg, A + 1.4, 0.2);
    tl.fromTo($('nolink'), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, A + 1.7);
    // Shot 07: the consequence, beyond the WAN port
    cam(1.25, 1960, 515, ${x.c(2, -0.25)}, 1.6, 'power2.inOut');
    fade([$('c3-base'), $('line-base')], 0.3, ${x.c(2, 0.2)}, 0.6);
    fade([$('dev-mdm'), $('dev-srv'), $('net')], 0.32, ${x.c(2, 0.2)}, 0.6);` },

    { id: '04-check-in-order', title: 'Check in order', pad: [0.3, 0.8],
      phrases: [['Check the path in order,', 0.3], ['from the computer outwards.', 0.5], ["The computer's link light: on.", 0.55], ['The switch port: on.', 0.5], ["The router's LAN port: on.", 0.5], ['Its WAN port: off.', 0.75], ['The first failed link.', 0]],
      scene: 'The camera returns to the computer and walks the path again: at each link light a numbered check appears and resolves; each passed check lights its stretch of cable green; the WAN check fails and the search stops there.', type: 'feature_showcase', persuasion: 'Signposting + numbered enumeration', beat: 'Focus → aha', blueprint: 'agent-progress-theater (Adapt)',
      shots: 'Shots 08–11: long pan back to the computer; ① tower link light; follow the cable to ② switch port 3; ③ router LAN 1; ④ WAN: ✕ FIRST FAILED LINK.',
      timeline: (x) => `
    ${x.setup(4)}
    cam(1.25, 1960, 515, 0);
    cam(2.35, 470, 535, ${x.c(0, 0.1)}, 1.9, 'power3.inOut');
    ${x.check(1, 'desk.link', x.c(2), true)}
    tl.set($('c1-lit'), { attr: { stroke: C.pos } }, 0); drawLink('c1', ${x.c(2, 1.0)}, 0.7);
    cam(2.35, 860, 530, ${x.c(3, -0.25)}, 0.95, 'power2.inOut');
    ${x.check(2, 'sw.p3', x.c(3), true)}
    tl.set($('c2-lit'), { attr: { stroke: C.pos } }, 0); drawLink('c2', ${x.c(3, 1.0)}, 0.8);
    cam(2.35, 1440, 520, ${x.c(4, -0.3)}, 1.05, 'power2.inOut');
    ${x.check(3, 'rt.l1', x.c(4), true)}
    cam(2.6, 1700, 520, ${x.c(5, -0.25)}, 0.95, 'power2.inOut');
    ${x.check(4, 'rt.wan', x.c(5), false)}
    show($('ffl'), ${x.c(6, 0.05)}, 0.5, { x: -10 });` },

    { id: '05-fault-domain', title: 'The fault domain', pad: [0.3, 0.55],
      phrases: [['So the fault is between the router', 0.2], ["and the provider's modem.", 0.55], ['Start with what you can check yourself:', 0.35], ['the cable.', 0]],
      scene: 'Pull back to the router and the modem; the healthy part of the path quietens; a dashed boundary marks the fault domain; the modem\'s own LAN light is off too; three likely causes appear and the first is chosen.', type: 'benefit_highlight', persuasion: 'Isolation + ranked causes', beat: 'Clarity', blueprint: 'compose',
      shots: 'Shots 12–13: pull back to router ↔ modem; FAULT DOMAIN; likely causes, the first highlighted.',
      timeline: (x) => `
    ${x.setup(5)}
    cam(2.6, 1700, 520, 0);
    cam(1.12, 2060, 505, ${x.c(0)}, 1.5, 'power2.inOut');
    fade([$('dev-desk'), $('dev-sw'), $('c1-lit'), $('c2-lit'), $('c1-base'), $('c2-base'), $('chip1'), $('chip2'), $('chip3'), $('lead3')], 0.28, ${x.c(0, 0.3)}, 0.7);
    fade([$('dev-mdm'), $('c3-base')], 1, ${x.c(0, 0.3)}, 0.6);
    fade($('ffl'), 0, ${x.c(0, 0.2)}, 0.4);
    tl.fromTo($('domain'), { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power2.out' }, ${x.c(0, 0.8)});
    show($('tag-mdm'), ${x.c(1, 0.05)}, 0.5, { y: 8 });
    tl.fromTo($('mdmlan'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out', transformOrigin: '50% 50%' }, ${x.c(1, 0.6)});
    cam(1.35, 2170, 480, ${x.c(2, -0.1)}, 1.1, 'power2.inOut');
    show($('upstream'), ${x.c(1, 1.0)}, 0.5, { y: 6 });
    tl.fromTo($('causes'), { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' }, ${x.c(2, 0.1)});
    tl.fromTo($('cause1'), { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' }, ${x.c(3)});` },

    { id: '06-the-fix', title: 'The fix', pad: [0.3, 0.6],
      phrases: [['It has worked loose.', 0.55], ['Push it in until it clicks.', 0.7], ['The WAN light comes on,', 0.35], ['and the router is back online.', 0]],
      scene: 'Macro on the WAN plug hanging out of its port; it is pushed home with a click; the WAN link light comes on at both ends; the INTERNET light searches amber, then turns green; the path beyond wakes up.', type: 'feature_showcase', persuasion: 'Demonstration of the action', beat: 'Resolve (deliberate)', blueprint: 'compose',
      shots: 'Shots 14–15: macro on the plug; the push; pull back to the router lights; pull back to the path beyond.',
      timeline: (x) => `
    ${x.setup(6)}
    cam(1.35, 2170, 480, 0);
    fade([$('domain'), $('causes'), $('tag-mdm'), $('mdmlan'), $('upstream')], 0, ${x.c(0)}, 0.4);
    cam(5.2, 1695, 598, ${x.c(0)}, 1.3, 'power3.inOut');   // low enough that the status row stays out from under the slate
    show($('loose'), ${x.c(0, 1.0)}, 0.4);
    var S = ${x.c(1, 0.55)};
    tl.to($('plug-body'), { y: 0, rotation: 0, duration: 0.32, ease: 'power3.in', svgOrigin: '1695 590' }, S);
    tl.to($('plug-body'), { y: -1.5, duration: 0.06, ease: 'power1.out' }, S + 0.32); tl.to($('plug-body'), { y: 0, duration: 0.1 }, S + 0.38);
    fade($('loose'), 0, S + 0.1, 0.25);
    // the WAN light comes on while the camera is still on the plug: cause and effect in one shot
    led('rt.wan', C.pos, ${x.c(2, 0.0)}, 0.12);
    tl.fromTo($('linkup'), { opacity: 0.9, scale: 0.5 }, { opacity: 0, scale: 2.2, duration: 0.7, ease: 'power2.out', transformOrigin: '50% 50%', immediateRender: false }, ${x.c(2, 0.0)});
    tl.set($('c3-lit'), { attr: { stroke: C.primary } }, 0); drawLink('c3', ${x.c(2, 0.12)}, 0.55);
    led('mdm.lan', C.pos, ${x.c(2, 0.55)});
    cam(1.55, 1830, 525, ${x.c(2, 0.7)}, 1.1, 'power2.inOut');   // back far enough to see the first packet reach the modem
    chipFlip(4, true, ${x.c(2, 1.5)});
    led('rt.inet', C.warn, ${x.c(3, -0.2)}, 0.12); led('rt.inet', C.line, ${x.c(3, 0.15)}, 0.12); led('rt.inet', C.warn, ${x.c(3, 0.45)}, 0.12); led('rt.inet', C.pos, ${x.c(3, 0.85)}, 0.2);
    cam(1.05, 2050, 510, ${x.c(3, 0.8)}, 1.4, 'power2.inOut');
    fade($('nolink'), 0, ${x.c(2, -0.2)}, 0.18);   // cleared just before the link comes up, never beside a green light
    fade([$('dev-srv'), $('net'), $('line-base')], 1, ${x.c(3, 0.9)}, 0.6);
    tl.set($('line-lit'), { attr: { stroke: C.primary } }, 0); drawLink('line', ${x.c(3, 1.0)}, 0.7);` },

    { id: '07-verify', title: 'Verify', pad: [0.3, 2.9],
      phrases: [["Don't assume it's fixed.", 0.45], ['Test it:', 0.4], ['a request goes out,', 0.5], ['and an answer comes back.', 0]],
      scene: 'Back at the computer, the quieted path wakes; a test packet leaves and the camera pulls back as it crosses every link to a server on the internet; the answer comes back the whole way; the page loads: CONNECTION RESTORED.', type: 'social_proof', persuasion: 'Demonstration (round trip)', beat: 'Anticipation → relief', blueprint: 'camera-journey (Adapt)',
      shots: 'Shot 16: medium on the computer → pull back to the whole bench while the test crosses it and the answer returns.',
      timeline: (x) => `
    ${x.setup(7)}
    cam(1.05, 2050, 510, 0);
    cam(1.7, 470, 495, ${x.c(0)}, 1.6, 'power3.inOut');
    fade([$('dev-desk'), $('dev-sw'), $('c1-base'), $('c2-base'), $('c1-lit'), $('c2-lit')], 1, ${x.c(0, 0.2)}, 0.6);
    fade([$('chip1'), $('chip2'), $('chip3'), $('chip4'), $('lead3'), $('lead4')], 0, ${x.c(0, 0.2)}, 0.5);
    ${x.blips(7)}
    cam(${WIDE.join(', ')}, ${x.c(1, 0.15)}, 1.35, 'power3.inOut');
    var R = ${x.g(x.ev.restored)};
    // REQUEST: each hop lights as the test reaches it; RESPONSE: the same, coming back
    show($('vreq'), ${x.g(x.ev.req[0] - 0.35)}, 0.4, { y: 6 });
    ${x.ev.req.map((t, i) => `tl.to($('vreq-h${i}'), { attr: { fill: C.text }, duration: 0.2 }, ${x.g(t)});${i ? ` tl.to($('vreq-a${i}'), { attr: { fill: C.primary }, duration: 0.2 }, ${x.g(t - 0.12)});` : ''}`).join(' ')}
    fade($('vreq'), 0, ${x.g(x.ev.rep[0] - 0.25)}, 0.25);
    show($('vrep'), ${x.g(x.ev.rep[0] - 0.05)}, 0.35, { y: 6 });
    ${x.ev.rep.map((t, i) => `tl.to($('vrep-h${i}'), { attr: { fill: C.text }, duration: 0.2 }, ${x.g(t)});${i ? ` tl.to($('vrep-a${i}'), { attr: { fill: C.pos }, duration: 0.2 }, ${x.g(t - 0.12)});` : ''}`).join(' ')}
    screen('desk', 'noinet', 'ok', R + 0.05, 0.3);
    linkColor('c1', C.primary, R + 0.3, 0.6); linkColor('c2', C.primary, R + 0.3, 0.6);
    fade($('vrep'), 0, R + 0.25, 0.3);
    tl.fromTo($('verified'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, R + 0.4);` },

    { id: '08-restore', title: 'Restore', pad: [0.3, 2.6],
      phrases: [['Check the path in order.', 0.55], ['The first failed link shows you where to look.', 0]],
      scene: 'The whole bench, healthy: calm two-way flow on every link. The principle lands on the end card.', type: 'cta', persuasion: 'Distillation', beat: 'Confidence', blueprint: 'compose',
      shots: 'Shot 17: the whole topology, steady; the end card.',
      timeline: (x) => `
    ${x.setup(8)}
    cam(${WIDE.join(', ')}, 0);
    fade($('verified'), 0, ${x.c(0, -0.1)}, 0.5);
    fade([$('dev-desk'), $('dev-sw'), $('dev-rt'), $('dev-mdm'), $('dev-srv'), $('net')], 0.85, ${x.c(0, 0.1)}, 0.9);
    endCard(${x.c(0, 0.1)});` },
  ],

  stage(x) {
    const { Stage, LIB, geo, C } = x;
    const P = geo.P, S = 1.3;
    const st = new Stage();
    st.place('desk', LIB.desktop(), { x: 260, y: 600, scale: S })
      .place('sw', LIB.switch2(), { x: 900, y: 600, scale: S })
      .place('rt', LIB.router2(), { x: 1560, y: 600, scale: S })
      .place('mdm', LIB.modem(), { x: 2130, y: 600, scale: S })
      .place('srv', LIB.server(), { x: 2780, y: 600, scale: 1.2 });
    const pt = (r) => st.pt(r);
    const nic = pt('desk.nic'), p3 = pt('sw.p3'), p8 = pt('sw.p8'), l1 = pt('rt.l1'), wan = pt('rt.wan'), mlan = pt('mdm.lan'), mline = pt('mdm.line'), sin = pt('srv.in');
    const PLUG_END = P(wan.x, wan.y + 16);   // where the cable leaves the seated plug's boot
    const hang = (a, b, d = 700) => [a, P(a.x, d), P(b.x, d), b];
    st.link('c1', hang(nic, p3)).link('c2', hang(p8, l1)).link('c3', hang(PLUG_END, mlan))
      .link('line', [mline, P(mline.x + 150, mline.y), P(sin.x - 150, sin.y), sin]);
    st.seg('sw1', p3, P(p3.x, 555)).seg('sw2', P(p3.x, 555), P(p8.x, 555)).seg('sw3', P(p8.x, 555), p8)
      .seg('rt1', l1, P(l1.x, 532)).seg('rt2', P(l1.x, 532), P(wan.x, 532)).seg('rt3', P(wan.x, 532), wan)
      .seg('plug', wan, PLUG_END)
      .seg('m1', mlan, P(mlan.x, 560)).seg('m2', P(mlan.x, 560), P(mline.x, 560)).seg('m3', P(mline.x, 560), mline)
      .seg('srv', sin, pt('srv.core'));
    const REQ = ['c1', 'sw1', 'sw2', 'sw3', 'c2', 'rt1', 'rt2', 'rt3', 'plug', 'c3', 'm1', 'm2', 'm3', 'line', 'srv'];
    REQ.forEach((k) => st.rev(k));
    x.REQ = REQ; x.REP = [...REQ].reverse().map((k) => k + '~');
    // which light answers when a packet passes the start of a piece
    x.PORT_AT = { c1: 'desk.act', sw1: 'sw.p3', c2: 'sw.p8', rt1: 'rt.l1', plug: 'rt.wan', m1: 'mdm.lan', srv: 'srv.a' };
    x.PORT_AT_REP = { 'srv~': 'srv.b', 'm1~': 'mdm.lan', 'c3~': 'rt.wan', 'rt1~': 'rt.l1', 'sw3~': 'sw.p8', 'c2~': 'rt.l1', 'sw1~': 'sw.p3', 'c1~': 'desk.act' };

    const T = (xx, y, t, px, fill, w = 600, ls = 0, anchor = 'middle') => `<text x="${xx}" y="${y}" text-anchor="${anchor}" style='font-family:"DM Sans";font-weight:${w};font-size:${px}px;letter-spacing:${ls}px' fill="${fill}">${t}</text>`;
    const tag = (id, xx, y, name, role) => (p) => `<g id="${p}${id}" opacity="0">${T(xx, y, name, 22, C.text, 700, 3.2)}${T(xx, y + 28, role, 19, C.muted, 400)}</g>`;
    // bench, internet region, the plug
    st.add((p) => `<line x1="-400" y1="603" x2="3400" y2="603" stroke="${C.line}" stroke-width="1.6" opacity="0.7"/>
      <g id="${p}net"><rect x="2600" y="360" width="360" height="290" rx="40" fill="${C.primary}" fill-opacity="0.03" stroke="${C.muted}" stroke-opacity="0.5" stroke-width="1.6" stroke-dasharray="9 8"/>
        ${T(2624, 396, 'THE INTERNET', 17, C.muted, 600, 2.8, 'start')}</g>`, 'under');
    st.add((p) => `<g transform="translate(0,0)"><g id="${p}plug-body" transform="translate(0,0)">
        <rect x="${wan.x - 11}" y="${wan.y - 22}" width="22" height="26" rx="2.5" fill="#c9cfdd" fill-opacity="0.22" stroke="${C.muted}" stroke-width="1.3"/>
        ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${wan.x - 8 + i * 3}" y="${wan.y - 20}" width="1.6" height="6" fill="${C.warn}" opacity="0.8"/>`).join('')}
        <rect x="${wan.x - 6}" y="${wan.y + 4}" width="12" height="12" rx="2" fill="${C.surface}" stroke="${C.muted}" stroke-width="1.2"/>
      </g></g>`);
    // contextual titles
    st.add(tag('tag-sw', 900, 470, 'SWITCH', 'one port for each device'));
    st.add(tag('tag-rt', 1560, 420, 'ROUTER', 'links the school to its provider'));
    st.add(tag('tag-mdm', 2130, 460, 'PROVIDER MODEM', "the provider's end of the line"));
    // the router's two sides
    const lanL = pt('rt.l1').x - 16, lanR = pt('rt.l4').x + 16;
    st.add((p) => `<g id="${p}side-lan" opacity="0"><path d="M${lanL},466 V458 H${lanR} V466" fill="none" stroke="${C.primary}" stroke-width="1.6"/>${T((lanL + lanR) / 2, 448, 'LAN · the school side', 15, C.text, 600, 0.4)}</g>
      <g id="${p}side-wan" opacity="0"><path d="M${wan.x - 20},466 V458 H${wan.x + 20} V466" fill="none" stroke="${C.primary}" stroke-width="1.6"/>${T(wan.x, 448, 'WAN · the provider side', 15, C.text, 600, 0.4)}</g>`);
    // the failure: a seeking ring on the WAN light, then NO LINK
    const wl = pt('rt.led.wan');
    st.add((p) => `<g transform="translate(${wl.x},${wl.y})"><g id="${p}seek" opacity="0"><circle r="11" fill="none" stroke="${C.warn}" stroke-width="1.6" stroke-dasharray="3 3"/></g></g>
      <g id="${p}nolink" opacity="0"><path d="M${wan.x + 28},${wl.y} H${wan.x + 64}" stroke="${C.neg}" stroke-width="1.2" stroke-dasharray="2.5 3" opacity="0.8"/>${T(wan.x + 69, wl.y + 4.5, 'NO LINK', 11, C.neg, 700, 1.4, 'start')}</g>
      <g transform="translate(${wl.x},${wl.y})"><g id="${p}linkup" opacity="0"><circle r="7" fill="none" stroke="${C.pos}" stroke-width="1.6"/></g></g>`);
    // the investigation
    st.chip(1, 485, 520, 'COMPUTER').chip(2, pt('sw.led.p3').x, 478, 'SWITCH · PORT 3').chip(3, pt('rt.led.l1').x, 424, 'ROUTER · LAN 1').chip(4, wl.x, 424, 'ROUTER · WAN');
    const l1l = pt('rt.led.l1');
    st.add((p) => `<path id="${p}lead3" opacity="0" d="M${l1l.x},455 V${l1l.y - 7}" stroke="${C.muted}" stroke-width="1.4" stroke-dasharray="3 4"/>
      <path id="${p}lead4" opacity="0" d="M${wl.x},455 V${wl.y - 7}" stroke="${C.muted}" stroke-width="1.4" stroke-dasharray="3 4"/>`);
    st.add((p) => `<g id="${p}ffl" opacity="0">${T(wl.x + 26, 460, 'FIRST FAILED LINK', 15, C.neg, 700, 2.2, 'start')}</g>`);
    // the fault domain and the likely causes
    const ml = pt('mdm.led.lan');
    st.add((p) => `<g id="${p}domain" opacity="0"><rect x="1668" y="452" width="596" height="272" rx="22" fill="${C.neg}" fill-opacity="0.035" stroke="${C.neg}" stroke-opacity="0.75" stroke-width="1.8" stroke-dasharray="10 8"/>
        ${T(1690, 756, 'FAULT DOMAIN', 22, C.neg, 700, 2.6, 'start')}${T(1898, 756, 'physical link · router WAN ↔ modem', 22, C.text, 500, 0, 'start')}</g>
      <g transform="translate(${ml.x},${ml.y})"><g id="${p}mdmlan" opacity="0"><circle r="10" fill="none" stroke="${C.neg}" stroke-width="1.6" stroke-dasharray="3 3"/></g></g>
      <g id="${p}causes" opacity="0"><rect x="2290" y="382" width="300" height="136" rx="14" fill="${C.surface}" stroke="${C.muted}" stroke-opacity="0.5" stroke-width="1.6"/>
        ${T(2312, 412, 'MOST LIKELY', 14, C.muted, 600, 2.4, 'start')}
        <rect id="${p}cause1" opacity="0" x="2302" y="424" width="276" height="40" rx="8" fill="${C.primary}" fill-opacity="0.16" stroke="${C.primary}" stroke-opacity="0.6"/>
        ${T(2318, 451, 'WAN cable loose', 22, C.text, 600, 0, 'start')}
        ${T(2312, 497, 'also: modem off, damaged cable', 16, C.muted, 500, 0, 'start')}</g>
      <g id="${p}upstream" opacity="0">${T(2400, 652, 'UPSTREAM', 17, C.pos, 700, 2.4, 'start')}${T(2400, 678, 'modem ↔ internet: lights OK', 18, C.muted, 500, 0, 'start')}</g>`);
    st.add((p) => `<g id="${p}loose" opacity="0">${T(wan.x + 24, wan.y + 26, 'LOOSE', 8, C.neg, 700, 1.4, 'start')}<path d="M${wan.x + 22},${wan.y + 22} L${wan.x + 14},${wan.y + 15}" stroke="${C.neg}" stroke-width="1.2"/></g>`);

    st.scr = P(260 + S * -50, 600 + S * -124);
    x.PLUG_LOOSE = 'tl.set($(\'plug-body\'), { y: 15, rotation: 7, svgOrigin: \'1695 590\' }, 0);';

    // Every frame opens in exactly the state the previous one closed in (a table, not a guess).
    const DIM_HEALTHY = "[$('dev-desk'), $('dev-sw'), $('c1-lit'), $('c2-lit'), $('c1-base'), $('c2-base'), $('chip1'), $('chip2'), $('chip3'), $('lead3')]";
    x.setup = (f) => {
      const s = [`led('desk.pwr', C.pos, 0, 0); led('desk.link', C.pos, 0, 0); led('sw.pwr', C.pos, 0, 0); led('sw.p3', C.pos, 0, 0); led('sw.p8', C.pos, 0, 0);
    led('rt.pwr', C.pos, 0, 0); led('rt.wifi', C.pos, 0, 0); led('rt.lan', C.pos, 0, 0); led('rt.l1', C.pos, 0, 0);
    led('mdm.pwr', C.pos, 0, 0); led('mdm.link', C.pos, 0, 0); led('mdm.inet', C.pos, 0, 0); led('srv.a', C.pos, 0, 0); led('srv.b', C.pos, 0, 0); led('srv.c', C.pos, 0, 0);`];
      const fixed = f >= 7;
      s.push(fixed
        ? "led('rt.wan', C.pos, 0, 0); led('mdm.lan', C.pos, 0, 0); led('rt.inet', C.pos, 0, 0); tl.set([$('c3-lit'), $('line-lit')], { attr: { stroke: C.primary }, strokeDashoffset: 0 }, 0);"
        : "led('rt.inet', C.neg, 0, 0); " + x.PLUG_LOOSE);
      if (f === 3) s.push("on($('side-lan'), 0); on($('side-wan'), 0);");
      if (f >= 4 && f <= 6) s.push("on($('nolink'), 0); tl.set($('line-base'), { opacity: 0.3 }, 0); tl.set([$('dev-srv'), $('net')], { opacity: 0.32 }, 0);");
      if (f === 4 || f === 5) s.push("tl.set($('c3-base'), { opacity: 0.3 }, 0); tl.set($('dev-mdm'), { opacity: 0.32 }, 0);");
      if (f >= 5 && f <= 7) s.push("on($('lead3'), 0); on($('lead4'), 0); chipSet(1, 'ok', 0); chipSet(2, 'ok', 0); chipSet(3, 'ok', 0); chipSet(4, " + (f === 7 ? "'ok'" : "'x'") + ", 0); tl.set([$('c1-lit'), $('c2-lit')], { attr: { stroke: C.pos }, strokeDashoffset: 0 }, 0);");
      if (f === 5) s.push("on($('ffl'), 0);");
      if (f === 6) s.push("on($('domain'), 0); on($('causes'), 0); on($('cause1'), 0); on($('tag-mdm'), 0); on($('mdmlan'), 0); on($('upstream'), 0);");
      if (f === 6 || f === 7) s.push(`tl.set(${DIM_HEALTHY}, { opacity: 0.28 }, 0);`);
      if (f === 8) s.push("tl.set($('desk-scr-noinet'), { opacity: 0 }, 0); tl.set($('desk-scr-ok'), { opacity: 1 }, 0); on($('verified'), 0); tl.set([$('c1-lit'), $('c2-lit')], { attr: { stroke: C.primary }, strokeDashoffset: 0 }, 0);");
      return s.join('\n    ');
    };
    return st;
  },

  /** Screen space (above the drawing, clear of the slate and the captions): REQUEST, RESPONSE, CONNECTIVITY VERIFIED. */
  overlay(x) {
    const { C } = x;
    const HOPS = ['Computer', 'Switch', 'Router', 'Provider', 'Internet'];
    const T = (y, px, w, ls, fill, body) => `<text x="960" y="${y}" text-anchor="middle" style='font-family:"DM Sans";font-weight:${w};font-size:${px}px;letter-spacing:${ls}px' fill="${fill}">${body}</text>`;
    const chain = (p, id, hops, arrow) => hops.map((h, i) => `${i ? `<tspan id="${p}${id}-a${i}" dx="14" fill="${C.faint}">→</tspan>` : ''}<tspan id="${p}${id}-h${i}" dx="${i ? 14 : 0}" fill="${C.faint}">${h}</tspan>`).join('');
    return (p) => `<g id="${p}vreq" opacity="0">${T(226, 24, 700, 4, C.primary, 'REQUEST')}${T(286, 40, 600, 0, C.faint, chain(p, 'vreq', HOPS))}</g>
      <g id="${p}vrep" opacity="0">${T(226, 24, 700, 4, C.pos, 'RESPONSE')}${T(286, 40, 600, 0, C.faint, chain(p, 'vrep', [...HOPS].reverse()))}</g>
      <g id="${p}verified" opacity="0">${T(272, 48, 700, 4, C.pos, 'CONNECTIVITY VERIFIED')}${T(324, 27, 500, 0.4, C.muted, 'request sent · answer received')}</g>`;
  },

  flows(x) {
    const { flows, st, G, cue } = x;
    const out = [], ev = {}, marks = [];
    // FOLLOW THE SIGNAL: one packet (frames 2–3).
    const c2 = (i, d = 0) => G(2, cue(2, i, d)), c3 = (i, d = 0) => G(3, cue(3, i, d));
    const lead = [{ g: c2(0, 0.35), ...st.pt('desk.nic') }];
    flows.hold(lead, c2(0, 0.6));
    lead.push(...flows.journey(st, [['c1', c2(0, 0.6), c2(1, -0.05)], ['sw1', c2(1, -0.05), c2(1, 0.2)], ['sw2', c2(1, 0.2), c2(1, 0.75)], ['sw3', c2(1, 0.75), c2(1, 0.95)],
      ['c2', c2(1, 0.95), c2(2, 0.85)], ['rt1', c2(2, 0.85), c2(2, 1.05)]]).slice(1));
    marks.push(['desk.act', c2(0, 0.55)], ['sw.p3', c2(1, -0.05)], ['sw.p8', c2(1, 0.95)], ['rt.l1', c2(2, 0.85)], ['rt.lan', c2(2, 0.9)]);
    flows.hold(lead, c3(0, 0.35));
    lead.push(...flows.journey(st, [['rt2', c3(0, 0.35), c3(0, 1.5)], ['rt3', c3(0, 1.5), c3(1, -0.1)]]).slice(1));
    ev.attempt = lead[lead.length - 1].g;
    flows.blocked(lead, 0, 1, { tries: 2, reach: 15, gap: 0.42 });
    out.push({ id: 'lead', pts: lead, end: 'fade', trail: true });

    // THE FIX: the first packet over the reseated cable, WAN port → modem.
    const F0 = x.firstAt ? x.firstAt() : G(6, cue(6, 2, 0.45));   // a variant may re-time it (the 3D prototype)
    const first = flows.trip(st, ['plug', 'c3', 'm1'], F0, 520);
    marks.push(['mdm.lan', first[first.length - 1].g]);
    out.push({ id: 'first', pts: first, end: 'arrive', trail: true });

    // VERIFY THE FIX: a test packet goes all the way, and the answer comes all the way back.
    const T0 = G(7, cue(7, 2, 0.1)), SPEED = 1400;   // leaves on "a request goes out"; slower than v2's 1600 so each hop can be followed
    const test = flows.trip(st, x.REQ, T0, SPEED);
    // when the test reaches each hop (Computer, Switch, Router, Provider, Internet) and the answer each on its way back
    const REQ_HOP = { sw1: 1, rt1: 2, m1: 3, srv: 4 }, REP_HOP = { 'm3~': 1, 'rt3~': 2, 'sw3~': 3 };
    ev.req = [T0];
    let g = T0; for (const k of x.REQ) { if (x.PORT_AT[k]) marks.push([x.PORT_AT[k], g]); if (REQ_HOP[k]) ev.req[REQ_HOP[k]] = g; g += st.piece(k).len / SPEED; }
    ev.serverAt = g;
    out.push({ id: 'test', kind: 'test', pts: test, end: 'arrive', trail: true });
    marks.push(['srv.b', g + 0.1], ['srv.c', g + 0.2]);
    const R0 = g + 0.35;
    const reply = flows.trip(st, x.REP, R0, SPEED);
    ev.rep = [R0];
    g = R0; for (const k of x.REP) { if (x.PORT_AT_REP[k]) marks.push([x.PORT_AT_REP[k], g]); if (REP_HOP[k]) ev.rep[REP_HOP[k]] = g; g += st.piece(k).len / SPEED; }
    ev.restored = g; ev.rep[4] = g;
    out.push({ id: 'reply', kind: 'reply', pts: reply, end: 'arrive', trail: true });

    // RESTORE: calm two-way flow.
    out.push(...flows.stream(st, { id: 'rq', keys: x.REQ, from: ev.restored + 0.5, until: x.total, every: 1.6, speed: 700 }));
    out.push(...flows.stream(st, { id: 'rp', keys: x.REP, from: ev.restored + 1.3, until: x.total, every: 1.6, speed: 700, kind: 'reply' }));

    x.ev = ev;
    // activity blips, per frame
    x.blips = (f) => marks.filter(([, gg]) => gg >= x.OFF[f] && gg < x.OFF[f] + x.DUR[f])
      .map(([ref, gg]) => `blip('${ref}', ${x.geo.r3(gg - x.OFF[f])}${ref === 'rt.wan' && f < 7 ? ', C.line' : ''});`).join(' ');
    // a numbered check at a light: appears, looks (a seeking ring), resolves
    x.check = (n, ref, at, ok) => `tl.fromTo($('chip${n}'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, ${at});
    if ($('lead${n}')) tl.fromTo($('lead${n}'), { opacity: 0 }, { opacity: 1, duration: 0.35 }, ${at} + 0.1);
    tl.fromTo($('chip${n}-c'), { attr: { stroke: C.warn } }, { attr: { stroke: C.primary }, duration: 0.5 }, ${at});
    blink('${ref}', ${ok ? 'C.pos' : 'C.line'}, ${x.geo.r3(at + 0.25)}, 1, 0.3);
    chipFlip(${n}, ${ok}, ${x.geo.r3(at + 0.85)});`;
    return out;
  },

  sfx(x) {
    const s = [];
    s.push([2, 'click-soft', x.cue(2, 1, -0.05), 0.14], [2, 'click-soft', x.cue(2, 2, 0.85), 0.14]);
    s.push([3, 'error', x.ev.attempt - x.OFF[3] + 1.2, 0.11]);
    [2, 3, 4].forEach((i) => s.push([4, 'click-soft', x.cue(4, i, 0.85), 0.26]));
    s.push([4, 'error', x.cue(4, 5, 0.85), 0.11]);
    s.push([6, 'click', x.cue(6, 1, 0.87), 0.36]);                    // the connector seats
    s.push([6, 'ping', x.cue(6, 2, 0.0), 0.1]);                        // the WAN link comes up
    s.push([7, 'chime', x.ev.restored - x.OFF[7] + 0.35, 0.2]);        // only once the answer is home
    return s;
  },
};
