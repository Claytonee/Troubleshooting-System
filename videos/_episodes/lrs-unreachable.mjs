/**
 * Episode 01 — LRS unreachable: "The lesson lives in the school".
 * Facts: explainer `lrs-or-internet` (two paths; the lesson continues while the LRS answers; an LRS that
 * does not answer means the lesson cannot run → report CRITICAL); guide #1. Routing: a teacher's critical
 * fault goes straight to the field engineer (errorController.create / intake.routeFor, D35).
 * Camera signature: the fork — it commits to one road, and the cut to the other lands the contrast.
 */
const WIDE = [1, 925, 473];          // the whole school and the world outside it
const END = [0.95, 885, 400];        // leaves the top band free for the lesson card

export default {
  slug: 'lrs-unreachable',
  kicker: 'Connectivity',
  title: 'The lesson lives in the school',
  category: 'Connectivity', subcategory: 'LRS unreachable',
  message: 'Quest runs from the LRS inside the school, not from the internet: if the LRS answers, the lesson runs; if it does not, report it as critical.',
  length: '40s',
  lesson: 'Internet down: teach on. LRS down: report it.',
  stageNote: 'Inside a dashed boundary ("inside the school"): tablet → WiFi → router, then the router forks. The lower road stays inside: switch → the LRS server. The upper road climbs out through the boundary to the internet provider and the internet.',
  creative: ['Signature: the fork. The router splits two roads; the camera commits to the inside road while the outside one breaks.', 'Requests travel blue, lesson content comes back green, and work waiting to sync queues amber at the router.', 'The report card is the app\'s own Report Error form, filled in the way this fault should be.'],
  facts: ['The lesson runs from the LRS; the internet is only for sync (explainer lrs-or-internet, scenes 2–4).', 'If Quest will not load at all, the LRS is the problem and the lesson cannot run: report it as CRITICAL (explainer, scene 6).', 'Checks: the LRS power light, its cable at the switch (link light), then open Quest on a tablet.', 'Do not unplug the LRS (a server switched off at the wall can lose data; the engineer decides).', 'A teacher\'s critical report goes straight to the field engineer (intake.routeFor).'],

  frames: [
    { id: '01-internet-down', title: 'The internet is down', pad: [0.7, 0.5],
      phrases: [['The internet is down.', 0.45], ['Can the lesson still run?', 0]],
      scene: 'Tight on a tablet that says No internet; one anchored pull-back to the whole school, dim, with the world outside it.', type: 'hook', persuasion: 'Rhetorical question', beat: 'Worry + curiosity', blueprint: 'zoom-out-workspace-reveal (Adapt)',
      timeline: (x) => `
    ${['rt', 'sw', 'lrs', 'isp', 'net'].map((k) => `dim('${k}', 0.35, 0);`).join(' ')}
    cam(10, ${x.st.scr.x}, ${x.st.scr.y}, 0);
    camKeys(${x.J(x.anchoredZoom(10, WIDE[0], x.st.scr, { x: WIDE[1], y: WIDE[2] }, 3.6))}, 0.05);
    tl.to($('tab-scr-offline'), { opacity: 0.4, duration: 0.08 }, 0.3); tl.to($('tab-scr-offline'), { opacity: 1, duration: 0.08 }, 0.4);` },

    { id: '02-two-roads', title: 'Two roads', pad: [0.3, 0.5],
      phrases: [['Your tablet reaches the router over WiFi.', 0.35], ['From there, two roads.', 0.45], ['One stays inside the school,', 0.3], ['to the LRS, where Quest lives.', 0.5], ['The other goes out to the internet,', 0.3], ['only to sync your work.', 0]],
      scene: 'WiFi carries a packet to the router; the router forks; the camera follows the inside road to the LRS, then climbs the outside road to the internet.', type: 'product_intro', persuasion: 'Progressive disclosure + comparison of two paths', beat: 'Clarity', blueprint: 'spatial-pan-stations (Adapt)',
      timeline: (x) => `
    ${['rt', 'sw', 'lrs', 'isp', 'net'].map((k) => `dim('${k}', 0.35, 0);`).join(' ')}
    cam(${WIDE.join(', ')}, 0);
    // "Your tablet reaches the router over WiFi."
    cam(1.55, 440, 600, ${x.c(0)}, 1.3);
    screen('tab', 'offline', 'lessonok', ${x.c(0)});
    show($('lab-tab'), ${x.c(0, 0.1)}, 0.5, { y: 10 });
    show($('air'), ${x.c(0, 0.2)}, 0.6); show($('wifi'), ${x.c(0, 0.2)}, 0.6);
    dim('rt', 1, ${x.c(0, 1.0)}, 0.35); led('rt.pwr', C.pos, ${x.c(0, 1.05)}); led('rt.wifi', C.pos, ${x.c(0, 1.1)});
    show($('lab-rt'), ${x.c(0, 1.1)}, 0.5, { y: 10 });
    // "From there, two roads." — the fork
    cam(1.3, 760, 560, ${x.c(1)}, 1.0);
    drawLink('LAN', ${x.c(1, 0.1)}, 0.6); drawLink('UPa', ${x.c(1, 0.1)}, 0.4); drawLink('UPb', ${x.c(1, 0.5)}, 0.35);
    // "One stays inside the school,"
    show($('bound'), ${x.c(2)}, 0.8);
    cam(1.25, 1010, 600, ${x.c(2)}, 1.2);
    dim('sw', 1, ${x.c(2, 0.3)}, 0.35); led('sw.pwr', C.pos, ${x.c(2, 0.3)}); led('sw.p7', C.pos, ${x.c(2, 0.4)});
    show($('lab-sw'), ${x.c(2, 0.35)}, 0.5, { y: 10 });
    drawLink('LRSC', ${x.c(2, 0.5)}, 0.6);
    // "to the LRS, where Quest lives."
    cam(1.5, 1330, 600, ${x.c(3)}, 1.2);
    dim('lrs', 1, ${x.c(3)}, 0.35); led('lrs.pwr', C.pos, ${x.c(3, 0.05)}); led('lrs.disk', C.pos, ${x.c(3, 0.15)}); led('lrs.net', C.pos, ${x.c(3, 0.25)});
    show($('lab-lrs'), ${x.c(3, 0.1)}, 0.5, { y: 10 });
    // "The other goes out to the internet,"
    cam(1.35, 1260, 320, ${x.c(4)}, 1.3);
    dim('isp', 1, ${x.c(4, 0.4)}, 0.35); show($('lab-isp'), ${x.c(4, 0.45)}, 0.5, { y: 10 });
    drawLink('NET', ${x.c(4, 0.8)}, 0.5); dim('net', 1, ${x.c(4, 1.2)}, 0.35); show($('lab-net'), ${x.c(4, 1.25)}, 0.5, { y: 10 });
    led('rt.wan', C.pos, ${x.c(4, 0.2)});
    // "only to sync your work."
    show($('sync'), ${x.c(5, 0.05)}, 0.5, { y: 8 });
    cam(${WIDE.join(', ')}, ${x.c(5, 0.1)}, 1.4, 'power3.inOut');` },

    { id: '03-lesson-carries-on', title: 'The lesson carries on', pad: [0.25, 0.5],
      phrases: [['So when the internet goes down,', 0.35], ['the lesson carries on.', 0.45], ['Work waits,', 0.3], ['and syncs later.', 0]],
      scene: 'The outside road snaps; the camera commits to the inside road where requests and lessons keep flowing; work to sync queues amber at the router.', type: 'benefit_highlight', persuasion: 'Counterexample + before/after', beat: 'Relief', blueprint: 'camera-journey (Adapt)',
      timeline: (x) => `
    ${x.allOn()}
    cam(${WIDE.join(', ')}, 0);
    var B = ${x.geo.r3(x.BREAK - x.off)};
    breakLink('UP', B); linkDark('NET', B + 0.1, 0.5);
    fade([$('dev-isp'), $('dev-net'), $('lab-isp'), $('lab-net'), $('sync')], 0.28, B + 0.1, 0.5);
    led('rt.wan', C.neg, B + 0.05);
    screen('tab', 'lessonok', 'lesson', B + 0.3);
    // "the lesson carries on." — the camera commits to the inside road
    cam(1.35, 900, 620, ${x.c(1)}, 1.4);
    for (var k = 0; k < 5; k++) { led('lrs.disk', C.line, ${x.c(1, 0.3)} + k * 0.5, 0.08); led('lrs.disk', C.pos, ${x.c(1, 0.5)} + k * 0.5, 0.08); }
    // "Work waits," — the queue at the router
    cam(1.8, 720, 575, ${x.c(2, -0.2)}, 1.1);
    show($('queue'), ${x.c(3, 0.1)}, 0.5, { y: 6 });` },

    { id: '04-lrs-stops', title: 'When the LRS stops answering', pad: [0.25, 0.6],
      phrases: [['But if the LRS stops answering,', 0.35], ['nothing loads.', 0.55], ['Check its power light,', 0.45], ['its cable at the switch,', 0.45], ['then Quest on a tablet.', 0]],
      scene: 'The LRS goes quiet and requests die at its door; the camera whips to the tablet (nothing loads) and back through the three checks.', type: 'feature_showcase', persuasion: 'Signposting + numbered enumeration', beat: 'Tension → focus', blueprint: 'agent-progress-theater (Adapt)',
      timeline: (x) => `
    ${x.allOn()} ${x.internetDown()}
    ${x.scr('lesson')} on($('queue'), 0);
    cam(1.8, 720, 575, 0);
    // "But if the LRS stops answering,"
    cam(1.55, 1330, 610, ${x.c(0)}, 1.1);
    var S = ${x.geo.r3(x.LRS_STOP - x.off)};
    led('lrs.net', C.line, S, 0.25); led('lrs.disk', C.line, S, 0.25);
    show($('silent'), S + 0.15, 0.4);
    // "nothing loads." — whip to the tablet
    cam(1.7, 320, 580, ${x.c(1, -0.15)}, 0.75, 'power3.inOut');
    screen('tab', 'lesson', 'fail', ${x.c(1, 0.2)});
    // "Check its power light,"
    cam(1.55, 1360, 560, ${x.c(2, -0.1)}, 0.8, 'power3.inOut');
    fade($('silent'), 0, ${x.c(2)}, 0.3);
    tl.fromTo($('chip1'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, ${x.c(2, 0.1)});
    chipFlip(1, true, ${x.c(2, 0.75)}); blink('lrs.pwr', C.pos, ${x.c(2, 0.6)}, 1);
    // "its cable at the switch,"
    cam(1.6, 1110, 610, ${x.c(3, -0.1)}, 0.8, 'power3.inOut');
    tl.fromTo($('chip2'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, ${x.c(3, 0.1)});
    chipFlip(2, true, ${x.c(3, 0.75)}); blink('sw.p7', C.pos, ${x.c(3, 0.6)}, 1);
    // "then Quest on a tablet."
    cam(1.6, 300, 560, ${x.c(4, -0.1)}, 0.9, 'power3.inOut');
    tl.fromTo($('chip3'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, ${x.c(4, 0.1)});
    chipFlip(3, false, ${x.c(4, 0.9)});
    tl.fromTo($('wontload'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, ${x.c(4, 1.0)});` },

    { id: '05-report-critical', title: 'Report it as critical', pad: [0.25, 2.0],
      phrases: [['Still nothing?', 0.4], ["Don't unplug it.", 0.4], ['Report it as critical:', 0.35], ['no LRS, no lesson.', 0]],
      scene: 'Pull back; a pointer says leave the LRS on; the app\'s Report Error card fills in Connectivity / LRS unreachable / CRITICAL; the lesson card lands.', type: 'cta', persuasion: 'Distillation + call to act', beat: 'Resolve', blueprint: 'camera-journey (Adapt)',
      timeline: (x) => `
    ${x.allOn()} ${x.internetDown()}
    ${x.scr('fail')} on($('queue'), 0);
    led('lrs.net', C.line, 0, 0); led('lrs.disk', C.line, 0, 0);
    chipSet(1, 'ok', 0); chipSet(2, 'ok', 0); chipSet(3, 'x', 0); on($('wontload'), 0);
    cam(1.6, 300, 560, 0);
    cam(${END.join(', ')}, ${x.c(0)}, 1.5, 'power3.inOut');
    // "Don't unplug it."
    tl.fromTo($('leaveon'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, ${x.c(1, 0.05)});
    // "Report it as critical:"
    fade([$('chip1'), $('chip2'), $('chip3'), $('wontload')], 0, ${x.c(2)}, 0.35);
    tl.fromTo($('card'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, ${x.c(2, 0.05)});
    tl.fromTo($('crit'), { scale: 1.25 }, { scale: 1, duration: 0.45, ease: 'power3.out', transformOrigin: '50% 50%' }, ${x.c(2, 0.55)});
    // "no LRS, no lesson."
    endCard(${x.c(3, 1.3)});` },
  ],

  stage(x) {
    const { Stage, LIB, geo, C, callout } = x;
    const st = new Stage();
    st.place('tab', LIB.tablet({ screens: ['offline', 'lessonok', 'lesson', 'fail'] }), { x: 250, y: 660, scale: 1.35 })
      .place('rt', LIB.router(), { x: 650, y: 640, scale: 1.35 })
      .place('sw', LIB.netSwitch(), { x: 1030, y: 640, scale: 1.2 })
      .place('lrs', LIB.lrs(), { x: 1400, y: 670, scale: 1.2 })
      .place('isp', LIB.isp(), { x: 1100, y: 330, scale: 1.0 })
      .place('net', LIB.cloud(), { x: 1600, y: 250, scale: 1.15 });
    const pt = (r) => st.pt(r), P = geo.P;
    const AIR0 = P(300, 594);
    st.link('LAN', geo.sag(pt('rt.out'), pt('sw.in'), 672))
      .link('LRSC', geo.sag(pt('sw.out'), pt('lrs.in'), 678))
      .link('NET', geo.ease(pt('isp.out'), pt('net.in'), 70));
    const GAP = st.splitLink('UP', geo.ease(pt('rt.out'), pt('isp.in'), 90));
    st.seg('air', AIR0, pt('rt.in')).seg('rt', pt('rt.in'), pt('rt.out')).seg('sw', pt('sw.in'), pt('sw.out'))
      .seg('lrsin', pt('lrs.in'), P(1400, 600))
      .seg('isp1', pt('isp.in'), pt('isp.mid')).seg('isp2', pt('isp.mid'), pt('isp.up')).seg('isp3', pt('isp.up'), pt('isp.out'))
      .seg('cl', pt('net.in'), pt('net.mid'));
    ['lrsin', 'LRSC', 'sw', 'LAN', 'rt', 'air'].forEach((k) => st.rev(k));
    // the queue: three spots stacked just up the broken road
    const q0 = pt('rt.out');
    [0, 1, 2].forEach((k) => st.seg(`q${k}`, q0, P(q0.x + 22 + k * 20, q0.y - 26 - k * 4)));

    st.label('tab', 250, 722, 'Tablet').label('rt', 650, 722, 'Router', 'two roads start here')
      .label('sw', 1030, 722, 'Switch').label('lrs', 1400, 734, 'LRS server', 'Quest lives here', 34, { passes: true })
      .label('isp', 1100, 398, 'Internet provider', '', 30, { passes: true }).label('net', 1600, 355, 'The internet', '', 30, { passes: true });
    st.chip(1, 1400, 478).chip(2, 1130, 566).chip(3, 250, 440);

    const muted = `style='font-family:"DM Sans";font-weight:600;font-size:17px;letter-spacing:2.8px'`;
    st.add((p) => `<g id="${p}bound" opacity="0"><rect x="120" y="420" width="1440" height="378" rx="28" fill="${C.primary}" fill-opacity="0.025" stroke="${C.primary}" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="10 9"/>
        <text x="150" y="780" ${muted} fill="${C.primary}">INSIDE THE SCHOOL</text></g>
      <path id="${p}air" opacity="0" d="M${AIR0.x},${AIR0.y} L${pt('rt.in').x},${pt('rt.in').y}" stroke="${C.primary}" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 10"/>
      <g id="${p}wifi" opacity="0" fill="none" stroke="${C.primary}" stroke-width="3" stroke-linecap="round">
        <path d="M312,566 q14,-14 28,0" stroke-opacity="0.9"/><path d="M304,556 q22,-22 44,0" stroke-opacity="0.6"/><path d="M296,546 q30,-30 60,0" stroke-opacity="0.35"/>
      </g>`, 'under');
    st.add((p) => `<g id="${p}sync" opacity="0" transform="translate(${GAP.x + 34},${GAP.y + 30})">
        <rect x="-8" y="-20" width="126" height="30" rx="15" fill="${C.bg}" stroke="${C.muted}" stroke-width="1.5"/>
        <text x="55" y="0.5" text-anchor="middle" style='font-family:"DM Sans";font-weight:600;font-size:16px' fill="${C.muted}">sync only</text></g>
      <g id="${p}queue" opacity="0"><text x="660" y="500" text-anchor="middle" style='font-family:"DM Sans";font-weight:600;font-size:18px' fill="${C.warn}">waiting to sync</text></g>
      <g id="${p}silent" opacity="0"><text x="1400" y="490" text-anchor="middle" style='font-family:"DM Sans";font-weight:700;font-size:22px;letter-spacing:2.5px' fill="${C.neg}">NO ANSWER</text></g>
      <text id="${p}wontload" x="250" y="392" text-anchor="middle" opacity="0" style='font-family:"DM Sans";font-weight:700;font-size:20px;letter-spacing:2.6px' fill="${C.neg}">WON'T LOAD</text>
      <g id="${p}card" opacity="0">
        <rect x="430" y="150" width="470" height="236" rx="16" fill="${C.surface}" stroke="${C.muted}" stroke-opacity="0.6" stroke-width="1.6"/>
        <circle cx="462" cy="186" r="6" fill="${C.neg}"/>
        <text x="478" y="193" style='font-family:"DM Sans";font-weight:700;font-size:22px' fill="${C.text}">Report Error</text>
        ${[['Category', 'Connectivity', 236], ['Sub-category', 'LRS unreachable', 276]].map(([k, v, y]) => `<text x="456" y="${y}" style='font-family:"DM Sans";font-weight:500;font-size:17px' fill="${C.muted}">${k}</text><text x="620" y="${y}" style='font-family:"DM Sans";font-weight:600;font-size:19px' fill="${C.text}">${v}</text>`).join('')}
        <text x="456" y="316" style='font-family:"DM Sans";font-weight:500;font-size:17px' fill="${C.muted}">Priority</text>
        <g transform="translate(676,310)"><g id="${p}crit"><rect x="-56" y="-17" width="112" height="30" rx="15" fill="${C.neg}"/><text y="4" text-anchor="middle" style='font-family:"DM Sans";font-weight:700;font-size:16px;letter-spacing:2px' fill="${C.bg}">CRITICAL</text></g></g>
        <text x="456" y="360" style='font-family:"DM Sans";font-weight:500;font-size:16px' fill="${C.pos}">Goes straight to your field engineer</text>
      </g>`);
    st.add(callout('leaveon', 'LEAVE IT ON', { x: 1640, y: 486 }, pt('lrs.led.pwr'), C.pos, 24));
    st.scr = P(250, 660 + 1.35 * -106);   // the "No internet" toast at the top of the tablet's screen

    x.scr = (name) => ['offline', 'lessonok', 'lesson', 'fail'].map((n) => `tl.set($('tab-scr-${n}'), { opacity: ${n === name ? 1 : 0} }, 0);`).join(' ');
    x.allOn = () => `${['tab', 'rt', 'sw', 'lrs', 'isp', 'net'].map((k) => `on($('lab-${k}'), 0);`).join(' ')} ${['LAN', 'LRSC', 'UPa', 'UPb', 'NET'].map((k) => `linkOn('${k}', 0);`).join(' ')}
    on($('bound'), 0); on($('air'), 0); on($('wifi'), 0); on($('sync'), 0); ${x.scr('lessonok')}
    led('rt.pwr', C.pos, 0, 0); led('rt.wifi', C.pos, 0, 0); led('rt.wan', C.pos, 0, 0); led('sw.pwr', C.pos, 0, 0); led('sw.p7', C.pos, 0, 0);
    led('lrs.pwr', C.pos, 0, 0); led('lrs.disk', C.pos, 0, 0); led('lrs.net', C.pos, 0, 0);`;
    x.internetDown = () => `breakLink('UP', 0, true); tl.set($('NET-lit'), { strokeDashoffset: $('NET-lit').getAttribute('data-len') }, 0);
    dim('isp', 0.28, 0); dim('net', 0.28, 0); tl.set([$('lab-isp'), $('lab-net'), $('sync')], { opacity: 0.28 }, 0); led('rt.wan', C.neg, 0, 0);`;
    x.BREAK = x.word(3, 'down') != null ? x.G(3, x.word(3, 'down')) : x.G(3, x.cue(3, 0, 1.2));
    x.LRS_STOP = x.G(4, x.cue(4, 0, 1.0));
    return st;
  },

  flows(x) {
    const { flows, st, G, cue } = x;
    const out = [];
    const hold = (pts, g) => { const q = pts[pts.length - 1]; pts.push({ g: +g.toFixed(3), x: q.x, y: q.y }); return pts; };
    const c = (i) => G(2, cue(2, i));
    // Lead A: over the air, waits at the router, then the inside road to the LRS.
    const A = flows.journey(st, [['air', c(0) + 0.3, c(0) + 1.3], ['rt', c(0) + 1.3, c(0) + 1.5]]);
    hold(A, c(2)); A.push(...flows.journey(st, [['LAN', c(2) + 0.5, c(2) + 1.1], ['sw', c(2) + 1.1, c(2) + 1.25], ['LRSC', c(2) + 1.25, c(3) + 0.1], ['lrsin', c(3) + 0.1, c(3) + 0.4]]).slice(1));
    out.push({ id: 'leadA', pts: A, end: 'arrive' });
    // Lead B: waits at the router, then the outside road.
    const B = flows.journey(st, [['air', c(1) - 0.2, c(1) + 0.8], ['rt', c(1) + 0.8, c(1) + 1.0]]);
    hold(B, c(4) + 0.2); B.push(...flows.journey(st, [['UPa', c(4) + 0.2, c(4) + 0.6], ['UPb', c(4) + 0.6, c(4) + 1.0], ['isp1', c(4) + 1.0, c(4) + 1.1], ['isp2', c(4) + 1.1, c(4) + 1.25], ['isp3', c(4) + 1.25, c(4) + 1.35], ['NET', c(4) + 1.35, c(5) + 0.1], ['cl', c(5) + 0.1, c(5) + 0.4]]).slice(1));
    out.push({ id: 'leadB', pts: B, end: 'arrive' });
    // The lesson: requests to the LRS, content back (green) while it answers.
    const REQ = ['air', 'rt', 'LAN', 'sw', 'LRSC', 'lrsin'], TO_DOOR = ['air', 'rt', 'LAN', 'sw', 'LRSC'];
    const toDoor = flows.routeLength(st, TO_DOOR);
    out.push(...flows.stream(st, { id: 'rq', keys: REQ, from: c(5), until: x.total, every: 0.55, speed: 540,
      cut: (g0) => (g0 + toDoor / 540 >= x.LRS_STOP ? [TO_DOOR, 'die'] : null) }));
    out.push(...flows.stream(st, { id: 'ct', keys: ['lrsin~', 'LRSC~', 'sw~', 'LAN~', 'rt~', 'air~'], from: c(5) + 0.3, until: x.LRS_STOP - 0.2, every: 0.55, speed: 540, kind: 'content' }));
    // Sync: an occasional trip out, until the road breaks.
    out.push(...flows.stream(st, { id: 'sy', keys: ['air', 'rt', 'UPa', 'UPb', 'isp1', 'isp2', 'isp3', 'NET', 'cl'], from: c(5) + 0.1, until: x.BREAK - 1.0, every: 1.1, speed: 560 }));
    // After the break: work waits at the router.
    const q0 = G(3, cue(3, 2, -1.0));
    [0, 1, 2].forEach((k) => out.push({ id: `q${k}`, kind: 'queued', end: 'stay', pts: flows.trip(st, ['air', 'rt', `q${k}`], q0 + k * 0.35, 420) }));
    return out;
  },

  sfx(x) {
    const s = [[1, 'whoosh-short', 0.45, 0.22]];
    [0, 2, 3, 4].forEach((i) => s.push([2, 'click-soft', x.cue(2, i, 0.1), 0.24]));
    s.push([3, 'error', x.BREAK - x.OFF[3] - 0.1, 0.22], [3, 'pop', x.cue(3, 3, 0.1), 0.18]);
    s.push([4, 'glitch-3', x.LRS_STOP - x.OFF[4], 0.16], [4, 'whoosh-short', x.cue(4, 1, -0.15), 0.18]);
    s.push([4, 'click-soft', x.cue(4, 2, 0.75), 0.28], [4, 'click-soft', x.cue(4, 3, 0.75), 0.28], [4, 'error', x.cue(4, 4, 0.9), 0.22]);
    s.push([5, 'notification', x.cue(5, 2, 0.05), 0.2]);
    return s;
  },
};
