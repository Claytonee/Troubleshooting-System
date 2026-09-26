// ── Episode 00, 3D-first: the whole film in ONE technical world (D40) ──────────────────────────────────
//
// Nothing here decides WHEN anything happens: every time comes from S, computed in the episode spec from
// the narration itself. This file decides WHAT the world does at time t, and it is a pure function of t —
// HyperFrames may ask for any frame, in any order, twice.
//
// Injected above this file: S (key times, seconds of film), NET (the school's network).

var T3 = OE3D.THREE, LED = OE3D.LED, track = OE3D.track;
var V = function (x, y, z) { return new T3.Vector3(x, y, z); };
var cl01 = function (u) { return Math.max(0, Math.min(1, u)); };
/** 0 before a, 1 between (with a fade f at each end), 0 after b. */
var win = function (t, a, b, f) { f = f || 0.32; return Math.min(cl01((t - a) / f), cl01((b - t) / f)); };

root.style.opacity = 1;                       // the world is the film: it is never handed over to a drawing

stage.technicalFloor();
var world = new OE3D.World(stage, NET);
var rig = new OE3D.CameraRig(stage, world);
var screen = world.device('monitor').root.getObjectByName('screen');
var paint = screen ? OE3D.screenPainter(screen, C) : function () {};
var FAULT = NET.fault;                        // which link is down, and which end of it a person can reach
var plug = world.plugs[FAULT.end];
var latch = plug.model.root.getObjectByName('plug_latch');
var LATCH0 = latch ? latch.rotation.x : 0;

// ── where labels may not go: the slate, the logo, the caption band ─────────────────────────────────────
var L = new OE3D.Labels(notes, stage, C, [[24, 20, 700, 136], [1540, 24, 1900, 124], [0, 858, 1920, 1080]]);

/** A device's top, in world space — computed once: nothing in this film moves except a plug and the light. */
function topOf(id, lift) {
  var b = world.bounds([id]), c = b.getCenter(V());
  return V(c.x, b.max.y + (lift === undefined ? 0.012 : lift), c.z);
}
var A = {
  computer: topOf('monitor'), sw: topOf('switch'), rt: topOf('router'), md: topOf('modem'), net: topOf('internet'),
  lan: world.port('router.lan1').pos.clone(), wan: world.port('router.wan').pos.clone(),
  pcLed: world.ledPos('computer.link'), swLed: world.ledPos('switch.p8'),
  lanLed: world.ledPos('router.lan1'), wanLed: world.ledPos('router.wan'),
};
var at = function (v) { return function () { return v; }; };

L.add('computer', { anchor: at(A.computer), title: 'COMPUTER', sub: 'where the lesson stopped', priority: 3, prefer: ['ur', 'u', 'ul'] });
L.add('switch', { anchor: at(A.sw), title: 'SWITCH', sub: "joins the school's computers", priority: 4, prefer: ['u', 'ur', 'ul'] });
L.add('router', { anchor: at(A.rt), title: 'ROUTER', sub: "the school's gateway", color: C.primaryText, priority: 5, prefer: ['u', 'ur', 'ul'] });
L.add('modem', { anchor: at(A.md), title: "PROVIDER'S MODEM", sub: 'not the school’s equipment', priority: 3, prefer: ['u', 'ur'] });
L.add('internet', { anchor: at(A.net), title: 'THE INTERNET', sub: 'somewhere that answers', priority: 2, prefer: ['ur', 'u', 'r'] });
L.add('lanports', { anchor: at(A.lan), title: 'LAN PORTS', sub: 'face the school', priority: 5, prefer: ['dl', 'l', 'ul'] });
L.add('wanport', { anchor: at(A.wan), title: 'WAN PORT', sub: 'faces the provider', color: C.primaryText, priority: 6, prefer: ['ur', 'r', 'dr'] });
// Left and up, over the router's own dark body: to the right of the WAN light is the provider's white
// modem, and red-on-white at the edge of frame is both ugly and unreadable (snapshot review, D40).
L.add('nolink', { anchor: at(A.wanLed), title: 'NO PHYSICAL LINK', sub: 'the WAN light never comes on', color: C.neg, priority: 8, prefer: ['ul', 'u', 'l', 'ur'] });
// On the cable itself, not on a point in mid-air between the two boxes: the leader has to land on the thing
// the label is about.
L.add('domain', { anchor: function () { var c = world.cable(FAULT.link); return c.curve ? c.curve.getPoint(0.5) : A.wan; }, title: 'FAULT DOMAIN', sub: "router WAN ↔ provider's modem", color: C.warn, priority: 7, prefer: ['u', 'ur', 'ul'] });
// The plug sits at the right of the macro frame, so a label offset to the right has nowhere to stand and
// was dropped every time: it goes left, across the router's face.
L.add('loose', { anchor: function () { return plug.model.world('tip'); }, title: 'WAN CABLE LOOSE', sub: 'not pushed home', color: C.neg, priority: 9, prefer: ['dl', 'l', 'ul', 'd'] });
L.add('linkup', { anchor: at(A.wanLed), title: 'WAN LINK UP', sub: 'the cable reaches both ends', color: C.pos, priority: 9, prefer: ['ul', 'l', 'u', 'dl'] });
L.add('verified', { anchor: at(A.rt), title: 'CONNECTIVITY VERIFIED', sub: 'a request went out and an answer came back', color: C.pos, priority: 9, prefer: ['u', 'ur'] });
L.add('k1', { anchor: at(A.pcLed), kind: 'status', n: 1, title: 'COMPUTER', priority: 6, prefer: ['ur', 'r', 'dr'] });
L.add('k2', { anchor: at(A.swLed), kind: 'status', n: 2, title: 'SWITCH PORT', priority: 6, prefer: ['ur', 'u', 'r'] });
L.add('k3', { anchor: at(A.lanLed), kind: 'status', n: 3, title: 'ROUTER LAN', priority: 6, prefer: ['dl', 'l', 'ul'] });
L.add('k4', { anchor: at(A.wanLed), kind: 'status', n: 4, title: 'ROUTER WAN', priority: 7, prefer: ['ur', 'r', 'u'] });

// ── the closing rule, drawn in the overlay (the only text that is not anchored to hardware) ────────────
var NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); (parent || notes).appendChild(e); return e; }
// It sits in the empty band above the hardware: written across the devices, it read as a caption stuck to the
// router (snapshot review, D40). Below is the caption band; left and right are the slate and the logo.
var card = svg('g', { opacity: 0 });
svg('rect', { x: 690, y: 322, width: 540, height: 3, fill: C.gold, rx: 1.5 }, card);
var rule1 = svg('text', { x: 960, y: 296, 'text-anchor': 'middle', 'font-family': 'DM Sans', 'font-weight': 700, 'font-size': 40, 'letter-spacing': 1.2, fill: C.text }, card);
rule1.textContent = 'Check the path in order.';
var rule2 = svg('text', { x: 960, y: 368, 'text-anchor': 'middle', 'font-family': 'DM Sans', 'font-weight': 500, 'font-size': 27, fill: C.muted }, card);
rule2.textContent = 'The first failed link shows you where to look.';

// ── the camera: semantic poses, and the order they are visited ─────────────────────────────────────────
var P = {
  screen: rig.devices(['monitor'], { yaw: -5, pitch: 6, fov: 26, fill: 0.78 }),
  desk: rig.devices(['monitor', 'computer'], { yaw: -9, pitch: 12, fov: 24, fill: 0.80 }),
  wide: rig.topology(),
  router: rig.device('router', { yaw: -22, pitch: 19, fov: 26, fill: 0.60 }),
  rtmd: rig.devices(['router', 'modem'], { yaw: -13, pitch: 17, fov: 19, fill: 0.74 }),
  pcPort: rig.port('computer.eth', { yaw: 27, pitch: 14, dist: 0.34, fov: 28 }),
  swPort: rig.port('switch.p8', { yaw: -16, pitch: 16, dist: 0.30, fov: 28 }),
  lanPort: rig.port('router.lan1', { yaw: -14, pitch: 15, dist: 0.26, fov: 28 }),
  wanPort: rig.port('router.wan', { yaw: -24, pitch: 15, dist: 0.22, fov: 28 }),
  // Aimed below the status row (which was cropping to half a word at the top of frame) and well off the
  // port’s axis: looked at end-on, a plug standing 6.5 mm proud is foreshortened to nothing, and the one
  // thing this shot has to show is that it is not in (snapshot review, D40).
  wanMac: rig.port('router.wan', { yaw: -46, pitch: 11, dist: 0.128, fov: 28, lift: -0.0075 }),
};
var SHOTS = [
  [0, P.screen], [S.sym1, P.screen], [S.sym1 + 1.5, P.desk, 'power2.inOut'],
  [S.follow, P.desk], [S.follow + 3.3, P.wide, 'power2.inOut'],
  [S.gateway, P.wide], [S.gateway + 2.3, P.router, 'power2.inOut'],
  [S.request - 1.5, P.router], [S.request - 0.1, P.wide, 'power2.inOut'],
  [S.stall - 1.8, P.wide], [S.stall + 0.4, P.rtmd, 'power2.inOut'],
  [S.check0, P.rtmd], [S.k1, P.pcPort, 'power2.inOut'],
  [S.k2 - 1.2, P.pcPort], [S.k2, P.swPort, 'power2.inOut'],
  [S.k3 - 1.0, P.swPort], [S.k3, P.lanPort, 'power2.inOut'],
  [S.k4 - 1.1, P.lanPort], [S.k4, P.wanPort, 'power2.inOut'],
  [S.domain - 1.4, P.wanPort], [S.domain + 0.5, P.rtmd, 'power2.inOut'],
  [S.cable, P.rtmd], [S.cable + 2.1, P.wanMac, 'power3.inOut'],
  [S.pullback, P.wanMac], [S.pullback + 2.9, P.wide, 'power2.inOut'],
];

// ── the signal: every schedule is laid out once, then drawn at time t ──────────────────────────────────
var FAST = { speed: 1.25, dwell: 0.1 };
var sFollow = OE3D.schedule(world, [['pc-sw', 1], ['sw-rt', 1]], S.follow + 0.35, FAST);
var sTry = OE3D.schedule(world, [['pc-sw', 1], ['sw-rt', 1]], S.request + 0.15, FAST);
var sReq = OE3D.schedule(world, NET.request, S.test + 0.2, FAST);
var sRep = OE3D.schedule(world, NET.response, S.reply + 0.15, FAST);
var LOOP = [];                                     // the healthy system, still working, to the last frame
for (var q = 0; q < 6; q++) {
  var t0 = S.verified - 0.9 + q * 2.6;
  LOOP.push([OE3D.schedule(world, NET.request, t0, FAST), OE3D.schedule(world, NET.response, t0 + 1.9, FAST)]);
}

// ── emphasis: what the shot is about is lit; the rest goes quiet ───────────────────────────────────────
var EM = {
  monitor: [[0, 1], [S.request, 0.5], [S.pullback, 1]],
  computer: [[0, 1], [S.request, 0.62], [S.domain, 0.3], [S.pullback, 1]],
  switch: [[0, 0.55], [S.follow + 1.6, 1], [S.domain, 0.3], [S.pullback, 1]],
  router: [[0, 0.55], [S.follow + 2.2, 1]],
  modem: [[0, 0.5], [S.follow + 2.8, 1], [S.check0, 0.45], [S.domain, 1], [S.cable + 1.8, 0.3], [S.pullback, 1]],
  internet: [[0, 0.45], [S.follow + 3.2, 0.9], [S.check0, 0.35], [S.domain, 0.3], [S.pullback, 0.9]],
  'pc-sw': [[0, 0.7], [S.follow + 1.6, 1], [S.domain, 0.3], [S.pullback, 1]],
  'sw-rt': [[0, 0.7], [S.follow + 2.2, 1], [S.domain, 0.35], [S.pullback, 1]],
  'rt-md': [[0, 0.7], [S.follow + 2.8, 1]],
  'md-net': [[0, 0.6], [S.follow + 3.2, 0.9], [S.domain, 0.45], [S.pullback, 0.9]],
};

return function (t) {
  // ── the WAN plug: 6.5 mm out and drooping, straightened, then pushed home; the latch springs in ──────
  var out = track([[S.seat - 1.05, 0.0065], [S.seat - 0.55, 0.0058, 'power2.out'], [S.seat, 0, 'power3.in']], t);
  var droop = track([[S.seat - 1.05, -7], [S.seat - 0.55, 0, 'power2.inOut']], t);
  world.plug(FAULT.end, { out: out, droop: droop });
  if (latch) {
    var press = track([[S.seat - 0.35, 0], [S.seat - 0.07, 1, 'power1.in'], [S.seat, 0, 'power4.out']], t);
    latch.rotation.x = LATCH0 * (1 - 0.7 * press);
  }
  world.update();

  // ── lights. The provider's side is healthy throughout: only the cable to the router is out ──────────
  var up = cl01((t - S.linkUp) / 0.18);
  world.led('computer.power', LED.POWER_ON); world.led('computer.link', LED.LINK_UP);
  world.led('computer.act', LED.ACTIVITY, t);
  world.led('switch.power', LED.POWER_ON);
  world.led('switch.p1', LED.ACTIVITY, t); world.led('switch.p8', LED.ACTIVITY, t + 0.31);
  world.led('router.power', LED.POWER_ON); world.led('router.wifi', LED.LINK_UP); world.led('router.lan', LED.LINK_UP);
  world.led('router.lan1', LED.ACTIVITY, t + 0.17);
  world.led('router.lan2', LED.LINK_DOWN); world.led('router.lan3', LED.LINK_DOWN); world.led('router.lan4', LED.LINK_DOWN);
  world.led('router.wan', t < S.linkUp + 0.85 ? LED.LINK_UP : LED.ACTIVITY, t, up);
  // Red until the WAN link is actually up, then amber while it gets itself an address, then green. Seating
  // the plug does not make the router online: that is the distinction this film is about.
  world.led('router.internet', t < S.linkUp ? LED.FAULT : t < S.online ? LED.WARNING : LED.LINK_UP);
  world.led('modem.power', LED.POWER_ON);
  world.led('modem.link', LED.LINK_UP);            // the provider's line is synchronised: this is not an outage
  world.led('modem.internet', LED.LINK_UP);        // and the service beyond it is up
  world.led('modem.lan', t < S.linkUp + 0.85 ? LED.LINK_UP : LED.ACTIVITY, t + 0.11, up);

  // ── emphasis ─────────────────────────────────────────────────────────────────────────────────────────
  var levels = {};
  for (var id in EM) levels[id] = track(EM[id], t);
  var tint = cl01((t - S.verified) / 0.8);
  world.emphasis(levels, { 'pc-sw': tint, 'sw-rt': tint, 'rt-md': tint, 'md-net': tint });

  // ── the camera, and everything that scales with it ───────────────────────────────────────────────────
  var pose = rig.at(SHOTS, t, OE3D.ease);
  OE3D.shoot(stage, world, rig, pose);

  // ── the signal ───────────────────────────────────────────────────────────────────────────────────────
  world.cable('pc-sw').clearPulses(); world.cable('sw-rt').clearPulses();
  world.cable('rt-md').clearPulses(); world.cable('md-net').clearPulses();
  if (t < S.check0) {
    OE3D.drawPulse(world, sFollow, t, 0, OE3D.SIGNAL.REQUEST, win(t, S.follow, S.gateway, 0.4));
    OE3D.drawPulse(world, sTry, t, 0, OE3D.SIGNAL.REQUEST, 1);
    // It reaches the WAN and cannot leave: attempts into the cable, each dying a few centimetres in. The
    // third is timed to "nothing gets past the router" — without it the picture is still for four seconds
    // while the narration is making exactly this point.
    OE3D.drawStall(world, FAULT.link, 1, t, sTry.end + 0.08, { tries: 2, reach: 0.11, gap: 0.15 });
    OE3D.drawStall(world, FAULT.link, 1, t, S.nolink + 0.5, { tries: 1, reach: 0.11 });
  }
  if (t > S.test - 0.3) {
    OE3D.drawPulse(world, sReq, t, 0, OE3D.SIGNAL.REQUEST, 1);
    OE3D.drawPulse(world, sRep, t, 1, OE3D.SIGNAL.RESPONSE, 1);
    for (var i = 0; i < LOOP.length; i++) {
      OE3D.drawPulse(world, LOOP[i][0], t, 0, OE3D.SIGNAL.REQUEST, 0.75);
      OE3D.drawPulse(world, LOOP[i][1], t, 1, OE3D.SIGNAL.RESPONSE, 0.75);
    }
  }

  // ── what the screen says ─────────────────────────────────────────────────────────────────────────────
  paint(t < S.online + 1.2 ? 'noinet' : 'ok');

  // ── labels: shown when the narration is on them, and only where they fit ─────────────────────────────
  var vis = {
    computer: win(t, S.follow + 0.5, S.gateway + 0.6),
    switch: win(t, S.sw, S.gateway + 0.6),
    router: win(t, S.rt, S.gateway + 0.9),
    modem: win(t, S.rt + 1.1, S.gateway + 0.6),
    internet: win(t, S.rt + 1.6, S.gateway + 0.6),
    lanports: win(t, S.lan, S.request - 1.2),
    wanport: win(t, S.wan, S.request - 1.2),
    nolink: win(t, S.nolink, S.check0 - 0.4),
    k1: win(t, S.k1 - 0.25, S.domain - 0.6), k2: win(t, S.k2 - 0.25, S.domain - 0.6),
    k3: win(t, S.k3 - 0.25, S.domain - 0.6), k4: win(t, S.k4 - 0.25, S.domain - 0.6),
    domain: win(t, S.domain + 0.3, S.cable + 1.4),
    loose: win(t, S.loose + 0.35, S.seat - 0.25),
    linkup: win(t, S.linkUp + 0.35, S.pullback - 0.2),
    verified: win(t, S.verified - 0.8, S.rule - 0.25),   // it makes way for the closing rule: one message at a time
  };
  // Which check passes is not decided here: it follows from the graph and the failing link (NET.verdicts).
  var V4 = NET.verdicts;
  L.layout(vis, {
    k1: t > S.k1 + 0.55 ? V4[0] : null, k2: t > S.k2 + 0.5 ? V4[1] : null,
    k3: t > S.k3 + 0.5 ? V4[2] : null, k4: t > S.k4 + 0.55 ? V4[3] : null,
  }, [OE3D.screenBox(stage, world, 'router', 8)]);
  card.setAttribute('opacity', win(t, S.rule, S.end + 1, 0.5).toFixed(3));

  stage.render();
};
