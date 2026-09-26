/**
 * The school's network, as a semantic scene — not a pile of coordinates (D40).
 *
 *   computer.eth → switch.p1 → (switch.p8) → router.lan1 → (router.wan) → modem.lan → (modem.line) → internet.in
 *
 * One definition, used by the film, by the world QA sheet, and by anything that later wants to ask
 * "which link failed?" — the troubleshooting order IS the order of `CHAIN` below. Positions are metres on
 * the table; a device's front faces +Z (the camera) unless it is turned.
 *
 * The computer stands side-on (turned a quarter to the left), because its network port is on the BACK: turned
 * this way the port faces the switch, its cable is visible in the system view, and a camera move to the right
 * shows the port itself rather than the back of a box.
 */

/** GLB files, as the film copies them into its own assets/hw3d/. */
export const MODELS = {
  monitor: 'assets/hw3d/monitor.web.glb',
  tower: 'assets/hw3d/tower.web.glb',
  switch: 'assets/hw3d/switch.web.glb',
  router: 'assets/hw3d/router.web.glb',
  modem: 'assets/hw3d/modem.web.glb',
  internet: 'assets/hw3d/internet.web.glb',
  plug: 'assets/hw3d/rj45-plug.web.glb',
};

const Q = Math.PI / 2;

export const SCHOOL_NETWORK = {
  devices: {
    monitor: { asset: 'monitor', position: [-0.86, 0, 0.14], rotationY: 0.10 },
    computer: { asset: 'tower', position: [-0.60, 0, -0.22], rotationY: -Q },
    switch: { asset: 'switch', position: [-0.16, 0, 0.03], rotationY: 0 },
    router: { asset: 'router', position: [0.15, 0, 0.00], rotationY: 0 },
    modem: { asset: 'modem', position: [0.45, 0, 0.03], rotationY: 0 },
    internet: { asset: 'internet', position: [0.76, 0, 0.00], rotationY: 0 },
  },
  connections: [
    { id: 'pc-sw', from: 'computer.eth', to: 'switch.p1', kind: 'patch', sag: 0.05 },
    { id: 'sw-rt', from: 'switch.p8', to: 'router.lan1', kind: 'patch', sag: 0.05 },
    { id: 'rt-md', from: 'router.wan', to: 'modem.lan', kind: 'patch', sag: 0.05 },
    { id: 'md-net', from: 'modem.line', to: 'internet.in', kind: 'line', sag: 0.07 },
  ],
};

/**
 * The path a request takes, in the order a person checks it. Each step names the link light that proves it,
 * so "check in order" and the signal tracer read the SAME list — they cannot drift apart.
 */
export const CHAIN = [
  { id: 'pc-sw', leg: ['pc-sw', 1], device: 'computer', led: 'computer.link', label: 'COMPUTER', note: "The computer's link light" },
  { id: 'sw-rt', leg: ['sw-rt', 1], device: 'switch', led: 'switch.p8', label: 'SWITCH', note: 'The switch port' },
  { id: 'rt-lan', leg: null, device: 'router', led: 'router.lan1', label: 'ROUTER LAN', note: "The router's LAN port" },
  { id: 'rt-md', leg: ['rt-md', 1], device: 'router', led: 'router.wan', label: 'ROUTER WAN', note: 'Its WAN port' },
];

/** Request: computer → internet. Response: the same legs, reversed. */
export const REQUEST = [['pc-sw', 1], ['sw-rt', 1], ['rt-md', 1], ['md-net', 1]];
export const RESPONSE = [['md-net', -1], ['rt-md', -1], ['sw-rt', -1], ['pc-sw', -1]];

/**
 * The fault this episode acts out, as data rather than as a decision repeated through the film: which link
 * is down, which end of it a person can see and reach, and what kind of failure it is. The scene reads this
 * to know where the signal stalls, which plug is not seated, and where the fault domain is.
 *
 * It is the seed of the troubleshooting engine (D40): given a failing link, the world can already work out
 * which checks pass, where the light stops, and which region to isolate. A second episode — a switch fault,
 * a dead port — should need a different FAULT and a different script, not a different scene.
 */
export const FAULT = {
  link: 'rt-md',              // the connection that is down
  end: 'router.wan',          // the port a person can see and reach
  kind: 'loose-connector',    // physical: the plug is not pushed home
  service_beyond: 'up',       // the provider's own line and service are healthy — this is not an outage
};

/** The checks in CHAIN that pass, given FAULT: everything before the failing link. */
export function verdicts(fault = FAULT) {
  const i = CHAIN.findIndex((c) => c.leg && c.leg[0] === fault.link);
  return CHAIN.map((c, k) => (i < 0 || k < i ? 'ok' : k === i ? 'x' : null));
}
