/**
 * Episode 00, 3D-FIRST — "How a school connects" rebuilt inside one continuous technical world (D40).
 *
 * Same topic, same script, same voice, same length as the directed 2D film (how-a-school-connects) and the
 * hybrid (how-a-school-connects-3d): this exists so the three production systems can be compared frame for
 * frame, not so the series gains an episode.
 *
 *   IF IT PHYSICALLY EXISTS, MODEL IT.  IF IT COMMUNICATES INFORMATION, OVERLAY IT.
 *   IF IT REPRESENTS DATA FLOW, ILLUMINATE THE PATH.
 *
 * So: no drawn hardware anywhere. Every device is a real model from the OE hardware library, standing in one
 * space; 2D is used only for what is information and not an object — the labels, the status list, the closing
 * rule, the captions. There is no hand-over between a diagram and a photograph, because there is no diagram:
 * the system view and the WAN close-up are the same world, and only the camera changes.
 *
 * The frames beneath this film are empty. The picture is one Three.js layer that runs its whole length
 * (lib/hardware-layer.mjs), and the timeline lives here, in Node: every key time below is derived from the
 * narration, and the scene (how-a-school-connects-world.scene.js) only executes it.
 */
import { LOGO_DARK } from '../_engine/lib/frame.mjs';
import { hardwareLayer } from '../_engine/lib/hardware-layer.mjs';
import { SCHOOL_NETWORK, MODELS, REQUEST, RESPONSE, FAULT, verdicts } from '../_engine/lib/school-network.mjs';
import { C } from '../_engine/lib/palette.mjs';
import { readFileSync } from 'node:fs';

const SCENE = readFileSync(new URL('./how-a-school-connects-world.scene.js', import.meta.url), 'utf8');

/**
 * Every moment of the film, in seconds, taken from the voice — never typed in by hand. The scene is a
 * function of these: change the narration and the picture follows it.
 */
function keys(x) {
  const g = (f, i, plus = 0) => +(x.OFF[f] + x.cue(f, i, plus)).toFixed(3);
  const word = (f, w, fallback) => { const v = x.word(f, w); return v === null ? fallback : +(x.OFF[f] + v).toFixed(3); };
  const S = {
    sym1: g(1, 1),                       // "the computer can't tell you where" — the camera leaves the screen
    follow: g(2, 0), sw: g(2, 1), rt: g(2, 2), gateway: g(2, 3), lan: g(2, 4), wan: g(2, 5),
    request: g(3, 0), stall: g(3, 1), nolink: g(3, 2, -0.45),
    check0: g(4, 0), k1: g(4, 2), k2: g(4, 3), k3: g(4, 4), k4: g(4, 5), first: g(4, 6),
    domain: g(5, 0), cable: g(5, 3),
    loose: g(6, 0),
    seat: word(6, 'clicks', g(6, 1, 1.25)),   // the connector goes home on the word
  };
  S.linkUp = +Math.max(S.seat + 1.05, g(6, 2)).toFixed(3);   // auto-negotiation takes a moment: never instant
  S.online = g(6, 3, 0.55);
  S.pullback = g(7, 0); S.test = g(7, 2); S.reply = g(7, 3);
  S.verified = +(S.reply + 2.25).toFixed(3);
  S.rule = g(8, 0); S.end = x.total;
  return S;
}

export default {
  slug: 'how-a-school-connects-world',
  kicker: 'Connectivity',
  title: 'Follow the signal',
  category: 'Connectivity', subcategory: 'No internet access',
  message: 'When the internet stops, follow the signal from the computer outwards and check each link in order: the first failed link is where to investigate; fix it there, then prove it with a round trip.',
  length: '72s',
  direction: 'video-direction-3d.md',   // the shared direction describes the drawing; this film has none
  blankFrames: true,          // the picture is one full-length 3D layer; the frames beneath carry nothing
  stageNote: 'One technical tabletop, seen from many distances: the desktop (monitor + tower, its network port on the back), an 8-port switch, the school router (LAN 1–4 | WAN, status lights), the provider\'s modem, and the internet as a matte globe. Real patch cables run between real ports. The camera is the only thing that changes scale.',
  creative: [
    'ONE WORLD: the system view, the port inspection and the repair are the same objects, the same light, the same space — the camera carries the explanation, not a cut to another style.',
    'THE PATH IS LIT, NOT DOTTED: data is a travelling light inside the cable itself. Nothing floats above the hardware.',
    'THE HARDWARE FAILS BEFORE THE TEXT SAYS SO: the light pushes into the WAN cable twice, dies, and the WAN light stays dark — only then is anything written on screen.',
    'PHYSICAL LINK IS NOT THE SAME AS SERVICE: the provider\'s modem keeps its LINK and INTERNET lights the whole film; only its LAN light, the one facing the loose cable, is dark.',
  ],
  facts: [
    "A port's link light is lit when a working cable connects both ends; unlit means no link (RJ45 behaviour).",
    "The router's INTERNET light fails when its WAN side has no link; the provider modem's LAN light is also off, because the cable reaches neither end.",
    'Check order computer → switch → router LAN → router WAN finds the first failed link (guide #1: lights, cable, then provider).',
    'A fix is verified by a request that gets an answer, not by a green light alone.',
    'A generic unmanaged switch auto-negotiates any port, so the router may use any of the eight: no port is labelled "uplink".',
  ],

  /** The 2D stage is empty: this film has no drawing. Everything is in the 3D layer. */
  stage: () => ({ svg: () => '' }),

  frames: [
    { id: '01-symptom', title: 'The symptom', pad: [0.9, 0.5],
      phrases: [['The internet has stopped at school.', 0.55], ["The computer can't tell you where.", 0]],
      scene: 'The real screen, filling the frame: No internet, this page can\'t be reached. The camera eases back to the whole desktop — monitor and tower — still telling us nothing about where it broke.',
      type: 'hook', persuasion: 'Pain validation', beat: 'Recognition', blueprint: '3D macro → medium pull-back',
      shots: 'screen (fov 26) → desk. No labels: the screen is the message.' },

    { id: '02-follow-the-signal', title: 'Follow the signal', pad: [0.3, 0.45],
      phrases: [['So follow the signal.', 0.5], ["The switch joins the school's computers", 0.2], ['and passes their traffic to the router,', 0.35], ["the school's gateway.", 0.5], ['Its LAN ports face the school.', 0.4], ['Its WAN port faces the provider.', 0]],
      scene: 'The camera pulls back off the desk until the whole path stands in one near-orthographic view: computer, switch, router, the provider\'s modem, the internet. A light leaves the computer and runs along the cable into the switch. Each device is named as the narration reaches it; then the camera moves in on the router and its two kinds of port are named where they are.',
      type: 'education', persuasion: 'Mental model', beat: 'Orientation', blueprint: 'pull-back reveal → dolly to hero',
      shots: 'desk → topology (near-ortho, 8° lens) → router medium. Labels: COMPUTER · SWITCH · ROUTER · PROVIDER\'S MODEM · THE INTERNET, then LAN PORTS / WAN PORT.' },

    { id: '03-no-way-out', title: 'No way out', pad: [0.25, 0.6],
      phrases: [['Every request leaves through it.', 0.45], ["This one doesn't get out.", 1.0], ['Nothing gets past the router.', 0]],
      scene: 'A request runs from the computer through the switch into the router. At the WAN it pushes a few centimetres into the cable, fades, tries again, and dies. The WAN light never comes on and the cable beyond stays dark.',
      type: 'problem', persuasion: 'Demonstration', beat: 'Tension', blueprint: 'signal stall at a physical boundary',
      shots: 'chain (computer → router) → router + modem. One label, late: NO PHYSICAL LINK.' },

    { id: '04-check-in-order', title: 'Check in order', pad: [0.3, 0.8],
      phrases: [['Check the path in order,', 0.3], ['from the computer outwards.', 0.5], ["The computer's link light: on.", 0.55], ['The switch port: on.', 0.5], ["The router's LAN port: on.", 0.5], ['Its WAN port: off.', 0.75], ['The first failed link.', 0]],
      scene: 'The camera travels the path in the order a person checks it: behind the computer to its network port, to the switch port, to the router\'s LAN port, to its WAN port. Each stop carries a small numbered status beside the light it is reading — three verified, the fourth failed.',
      type: 'education', persuasion: 'Method', beat: 'Diagnosis', blueprint: 'lateral track along the chain, status overlays',
      shots: 'computer.eth → switch.p8 → router.lan1 → router.wan. Four status labels, anchored to the lights.' },

    { id: '05-fault-domain', title: 'The fault domain', pad: [0.3, 0.55],
      phrases: [['So the fault is between the router', 0.2], ["and the provider's modem.", 0.55], ['Start with what you can check yourself:', 0.35], ['the cable.', 0]],
      scene: 'The camera holds the router and the provider\'s modem together; everything else in the world goes quiet. One label names the region: FAULT DOMAIN, router WAN ↔ provider\'s modem. Then the camera begins to move in on the cable itself.',
      type: 'education', persuasion: 'Narrowing', beat: 'Isolation', blueprint: 'emphasis by dimming, one bracket label',
      shots: 'router + modem, held; the push toward the WAN port begins on "the cable".' },

    { id: '06-the-fix', title: 'The fix', pad: [0.3, 0.6],
      phrases: [['It has worked loose.', 0.55], ['Push it in until it clicks.', 0.7], ['The WAN light comes on,', 0.35], ['and the router is back online.', 0]],
      scene: 'The WAN port fills the frame: the connector stands proud of the port and sags, because nothing is holding it. It straightens, goes in, the latch presses and springs into its notch — a click. The WAN light stays dark for a moment while the link negotiates, then comes on and flickers with traffic; the router\'s INTERNET light goes from red through amber to green.',
      type: 'feature_showcase', persuasion: 'Demonstration on the object', beat: 'Resolve (deliberate)', blueprint: 'mechanical insert, then state change',
      shots: 'WAN macro (11 cm), held through the repair. Labels: WAN CABLE LOOSE, then WAN LINK UP.' },

    { id: '07-verify', title: 'Verify', pad: [0.3, 2.9],
      phrases: [["Don't assume it's fixed.", 0.45], ['Test it:', 0.4], ['a request goes out,', 0.5], ['and an answer comes back.', 0]],
      scene: 'The camera pulls back to the whole path. A request runs out through the switch, the router, the modem, to the internet — and an answer comes back along the same cables, the other way. Only when it is home does anything claim success.',
      type: 'proof', persuasion: 'Verification', beat: 'Proof', blueprint: 'request and response along the lit path',
      shots: 'WAN macro → topology. Label: CONNECTIVITY VERIFIED, after the answer arrives.' },

    { id: '08-restore', title: 'Restore', pad: [0.3, 2.6],
      phrases: [['Check the path in order.', 0.55], ['The first failed link shows you where to look.', 0]],
      scene: 'The whole network stands calm, every light as it should be, one quiet round trip still running. The rule is written under it.',
      type: 'cta', persuasion: 'Rule to remember', beat: 'Landing', blueprint: 'hold wide, one line of text',
      shots: 'topology, held. The closing rule over a gold rule.' },
  ].map((f) => ({ ...f, timeline: () => '' })),   // the frames are empty: the picture is the 3D layer

  /** One layer, the length of the film: the world itself. */
  layers(x) {
    const S = keys(x);
    // verdicts come from the graph and the fault, not from four decisions typed into the scene
    const net = { ...SCHOOL_NETWORK, request: REQUEST, response: RESPONSE, fault: FAULT, verdicts: verdicts() };
    return [{
      id: 'world', start: 0, dur: x.total,
      html: hardwareLayer({
        id: 'world', dur: x.total, bg: C.bg, C, logo: LOGO_DARK, models: MODELS,
        slate: { kicker: 'Connectivity', title: 'Follow the signal' },
        scene: `var S = ${JSON.stringify(S)}, NET = ${JSON.stringify(net)};\n${SCENE}`,
      }),
    }];
  },

  sfx(x) {
    const S = keys(x), local = (t, f) => +(t - x.OFF[f]).toFixed(3);
    return [
      [2, 'click-soft', local(S.sw, 2) - 0.05, 0.13],
      [2, 'click-soft', local(S.rt, 2) - 0.05, 0.13],
      [3, 'error', local(S.stall, 3) + 1.15, 0.11],
      [4, 'click-soft', local(S.k1, 4) + 0.55, 0.24],
      [4, 'click-soft', local(S.k2, 4) + 0.5, 0.24],
      [4, 'click-soft', local(S.k3, 4) + 0.5, 0.24],
      [4, 'error', local(S.k4, 4) + 0.55, 0.11],
      [6, 'click', local(S.seat, 6), 0.36],            // the connector seats
      [6, 'ping', local(S.linkUp, 6) + 0.05, 0.1],     // the WAN link comes up
      [7, 'chime', local(S.verified, 7) + 0.1, 0.2],   // only once the answer is home
    ];
  },
};
