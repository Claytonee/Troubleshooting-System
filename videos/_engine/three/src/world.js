/**
 * OE3D World — the 3D-first technical world (D40).
 *
 *   IF IT PHYSICALLY EXISTS, MODEL IT.  IF IT COMMUNICATES INFORMATION, OVERLAY IT.
 *   IF IT REPRESENTS DATA FLOW, ILLUMINATE THE PATH.
 *
 * World        devices placed from the hardware library, addressed by id; ports by "device.port"
 * Graph        connections between ports → cables with plugs at both ends, generated from anchors + normals
 * Signal       a luminous pulse travelling INSIDE a cable (a shader on a sheath around it): direction,
 *              request/response colour, stall + retry at a failed link. No floating particles.
 * CameraRig    semantic poses — topology(), devices(ids), device(id), port(ref) — interpolated in pose space
 * Emphasis     dim what is not the subject, instead of adding clutter
 * Labels       screen-space callouts anchored to world points, placed to avoid each other, the screen
 *              furniture, the captions and the focal device; a label that cannot be placed is hidden
 *
 * Everything is a pure function of the time the caller passes: no clock, no animation loop.
 */
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = (u) => Math.max(0, Math.min(1, u));

// ── emphasis: per-instance materials that can be dimmed ────────────────────────────────────────────────────
function ownMaterials(root) {
  const mats = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.userData.base = o.material.color.clone();
    o.material.userData.baseOpacity = o.material.opacity;
    mats.push(o.material);
  });
  return mats;
}
function dimMaterials(mats, level) {
  const f = 0.22 + 0.78 * clamp01(level);
  for (const m of mats) {
    if (m.userData.led) continue;                       // LEDs are dimmed through their state
    m.color.copy(m.userData.base).multiplyScalar(f);
  }
}

// ── the signal tracer ──────────────────────────────────────────────────────────────────────────────────────
const SIGNAL_VERT = `varying float vU; void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SIGNAL_FRAG = `
  uniform float uHead; uniform float uLen; uniform float uDir; uniform vec3 uColor; uniform float uAlpha;
  varying float vU;
  void main() {
    float d = (uHead - vU) * uDir;                 // distance behind the head, along the direction of travel
    if (d < 0.0 || d > uLen) discard;
    float k = 1.0 - d / uLen;                      // 1 at the head, 0 at the end of the tail
    float tip = smoothstep(uLen * 0.10, 0.0, d);   // a bright leading edge: direction you can read
    gl_FragColor = vec4(uColor * (0.55 + 0.9 * k + 1.3 * tip), (0.18 + 0.82 * pow(k, 1.4)) * uAlpha);
  }`;
function signalMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: SIGNAL_VERT, fragmentShader: SIGNAL_FRAG, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uHead: { value: -1 }, uLen: { value: 0.1 }, uDir: { value: 1 }, uColor: { value: new THREE.Color(0x6f98ff) }, uAlpha: { value: 0 } },
  });
}
export const SIGNAL = { REQUEST: 0x6f98ff, RESPONSE: 0x39e39a, VERIFIED: 0x2dd98a };

// ── cables ─────────────────────────────────────────────────────────────────────────────────────────────────
class Cable {
  constructor(world, conn) {
    this.world = world; this.conn = conn; this.id = conn.id;
    this.radius = conn.kind === 'line' ? 0.0019 : 0.0026;      // Cat5e patch ≈ 5.2 mm; the provider line thinner
    const color = conn.kind === 'line' ? 0x16181d : 0x4d556a;  // calm neutral grey; the provider's line black
    this.mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0 });
    this.mat.userData.base = this.mat.color.clone();
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.sig = [signalMaterial(), signalMaterial()];           // two sheaths: a request and a response may overlap
    this.sheaths = this.sig.map((m) => { const s = new THREE.Mesh(new THREE.BufferGeometry(), m); s.renderOrder = 5; return s; });
    world.stage.scene.add(this.mesh); this.sheaths.forEach((s) => world.stage.scene.add(s));
    this.key = ''; this.length = 0; this.tint = 0; this.tintColor = new THREE.Color(SIGNAL.VERIFIED);
  }
  setPath(points) {
    const key = points.map((p) => p.toArray().map((v) => v.toFixed(5)).join(',')).join(';');
    if (key === this.key && this.sigKey === this.world.sigK) return;
    this.key = key; this.sigKey = this.world.sigK;
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    this.length = this.curve.getLength();
    const seg = Math.max(64, Math.round(this.length * 220));
    this.mesh.geometry.dispose(); this.mesh.geometry = new THREE.TubeGeometry(this.curve, seg, this.radius, 14, false);
    this.sheaths.forEach((s) => { s.geometry.dispose(); s.geometry = new THREE.TubeGeometry(this.curve, seg, this.radius * 1.42 * this.world.sigK, 12, false); });
  }
  /** slot 0|1; head 0..1 along the cable FROM its `from` end; dir +1 (from→to) or -1; lenM metres of tail. */
  pulse(slot, head, dir, color, alpha, lenM = 0.14) {
    const u = this.sig[slot].uniforms;
    u.uHead.value = head; u.uDir.value = dir; u.uLen.value = this.length ? Math.min(0.9, lenM / this.length) : 0.1;
    u.uColor.value.setHex(color); u.uAlpha.value = alpha;
  }
  clearPulses() { this.sig.forEach((m) => { m.uniforms.uAlpha.value = 0; }); }
  /** level 0..1 of emphasis; tint 0..1 of "verified" green in the jacket. */
  look(level, tint = 0) {
    const f = 0.28 + 0.72 * clamp01(level);
    this.mat.color.copy(this.mat.userData.base).lerp(this.tintColor, 0.55 * tint).multiplyScalar(f);
    this.mat.emissive.copy(this.tintColor).multiplyScalar(0.18 * tint * f);
  }
}

// ── the world ──────────────────────────────────────────────────────────────────────────────────────────────
export class World {
  /**
   * @param stage   HardwareStage (lights, renderer, loader)
   * @param spec    { devices: { id: { asset, position:[x,y,z], rotationY } }, connections: [{ id, from:'a.port', to:'b.port', kind }] }
   */
  constructor(stage, spec) {
    this.stage = stage; this.devices = {}; this.cables = {}; this.plugs = {};
    this.sigK = 1;                                       // how wide the travelling light is, relative to its cable
    for (const [id, d] of Object.entries(spec.devices)) {
      const m = stage.place(d.asset, { position: d.position, rotation: [0, d.rotationY || 0, 0] });
      m.mats = ownMaterials(m.root);
      for (const l of Object.values(m.leds)) l.mesh.material.userData.led = true;
      m.id = id; this.devices[id] = m;
    }
    this.conns = spec.connections;
    for (const c of this.conns) {
      this.cables[c.id] = new Cable(this, c);
      if (c.kind !== 'line') for (const end of ['from', 'to']) {
        const plug = stage.place('plug'); plug.mats = ownMaterials(plug.root);
        this.plugs[c[end]] = { model: plug, out: 0, droop: 0, conn: c };
      }
    }
    this.focus = null;
    this.update();
  }
  device(id) { const d = this.devices[id]; if (!d) throw new Error(`OE3D World: no device "${id}"`); return d; }
  /** A port: world position, outward normal, and where its cable leaves. ref = "router.wan". */
  port(ref) {
    const [id, p] = ref.split('.'); const d = this.device(id);
    const a = d.anchor('port_' + p); if (!a) throw new Error(`OE3D World: ${id} has no port "${p}"`);
    a.updateWorldMatrix(true, false);
    const pos = a.getWorldPosition(V()), normal = V(0, 0, 1).applyQuaternion(a.getWorldQuaternion(new THREE.Quaternion())).normalize();
    return { pos, normal, quat: a.getWorldQuaternion(new THREE.Quaternion()) };
  }
  led(ref, state, t = 0, level = 1) { const [id, l] = ref.split('.'); this.device(id).led(l, state, t, level); }
  ledPos(ref) { const [id, l] = ref.split('.'); return this.device(id).world('led_' + l); }
  /** A plug's state: out (metres backed out of its port) and droop (degrees). ref = the port it belongs in. */
  plug(ref, { out = 0, droop = 0 } = {}) { const p = this.plugs[ref]; p.out = out; p.droop = droop; }

  /** Place every plug at its port (backed out along the normal if loose) and route every cable between them. */
  update() {
    const tmpQ = new THREE.Quaternion();
    for (const [ref, p] of Object.entries(this.plugs)) {
      const port = this.port(ref), r = p.model.root;
      r.position.copy(port.pos).addScaledVector(port.normal, p.out);
      r.quaternion.copy(port.quat);
      if (p.droop) { tmpQ.setFromAxisAngle(V(1, 0, 0), THREE.MathUtils.degToRad(p.droop)); r.quaternion.multiply(tmpQ); }
      r.updateMatrixWorld(true);
    }
    for (const c of this.conns) this.cables[c.id].setPath(this.route(c));
  }
  /** The cable's path: out of each plug along its port's normal, down to the table, across, up to the other. */
  route(c) {
    const end = (ref) => {
      const port = this.port(ref), plug = this.plugs[ref];
      const start = plug ? plug.model.world('cable') : port.pos.clone().addScaledVector(port.normal, 0.004);
      const n = port.normal.clone(); if (plug && plug.droop) n.applyAxisAngle(V(1, 0, 0), 0);
      return { start, n };
    };
    const a = end(c.from), b = end(c.to), r = this.cables[c.id].radius, floor = r + 0.0004;
    const out = (e, d) => e.start.clone().addScaledVector(e.n, d);
    const drop = (e, d) => { const p = out(e, d); p.y = Math.max(floor, Math.min(p.y, e.start.y) * 0.25 + floor); return p; };
    const a1 = out(a, 0.022), b1 = out(b, 0.022);
    const a2 = drop(a, 0.07), b2 = drop(b, 0.07);
    a2.y = floor; b2.y = floor;
    const mid = a2.clone().lerp(b2, 0.5); mid.z = Math.max(a2.z, b2.z) + (c.sag ?? 0.06); mid.y = floor;
    return [a.start, a1, a2, mid, b2, b1, b.start];
  }
  cable(id) { return this.cables[id]; }
  /**
   * How wide the travelling light is, relative to the cable it runs in. In the system view a 5 mm cable is two
   * pixels wide and a pulse inside it is invisible — the light has to be a little larger than its cable, or the
   * film's one idea about data never reaches the screen (world sheet, D40). Rebuilds only on a real change.
   */
  signalWidth(k) { if (Math.abs(k - this.sigK) / this.sigK < 0.08) return; this.sigK = k; this.update(); }

  /** Emphasis: { deviceId: 0..1, cableId: 0..1 }; anything unnamed keeps its last level. */
  emphasis(levels, tints = {}) {
    for (const [id, lv] of Object.entries(levels)) {
      if (this.devices[id]) { const d = this.devices[id]; d.level = lv; dimMaterials(d.mats, lv); }
      if (this.cables[id]) {
        this.cables[id].level = lv; this.cables[id].look(lv, tints[id] || 0);
        for (const [ref, p] of Object.entries(this.plugs)) if (p.conn.id === id) dimMaterials(p.model.mats, lv);
      }
    }
  }
  /** World bounds of devices (for framing). */
  bounds(ids) {
    const box = new THREE.Box3();
    for (const id of ids) box.expandByObject(this.device(id).root);
    return box;
  }
}

// ── signals along routes ───────────────────────────────────────────────────────────────────────────────────
/**
 * A route is a list of legs: [cableId, dir] (dir +1 = the cable's from→to). Timing: legs at `speed` m/s with
 * `dwell` seconds inside each device between legs. Returns { legs:[{cable, dir, t0, t1}], end }.
 */
export function schedule(world, legs, t0, { speed = 1.6, dwell = 0.12 } = {}) {
  const out = []; let t = t0;
  for (const [id, dir] of legs) { const c = world.cable(id), d = c.length / speed; out.push({ cable: id, dir, t0: t, t1: t + d }); t += d + dwell; }
  return { legs: out, end: t - dwell };
}
/** Light a scheduled pulse at time t (slot 0|1). A leg after its end holds a short afterglow. */
export function drawPulse(world, sched, t, slot, color, alpha = 1) {
  for (const L of sched.legs) {
    const c = world.cable(L.cable);
    if (t < L.t0 || t > L.t1 + 0.25) continue;
    const u = clamp01((t - L.t0) / (L.t1 - L.t0));
    const fade = t > L.t1 ? 1 - (t - L.t1) / 0.25 : 1;
    const head = L.dir > 0 ? u : 1 - u;
    c.pulse(slot, head + (L.dir > 0 ? 0.0 : 0), L.dir, color, alpha * fade * (t > L.t1 ? 0.6 : 1));
  }
}
/**
 * A pulse that cannot cross a failed link: it pushes a few centimetres into the cable, fails, and retries.
 * leg: [cableId, dir]; returns true while visible.
 */
export function drawStall(world, cableId, dir, t, t0, { tries = 2, reach = 0.05, gap = 0.55, color = SIGNAL.REQUEST } = {}) {
  const c = world.cable(cableId);
  for (let k = 0; k < tries; k++) {
    const a = t0 + k * (0.5 + gap), u = (t - a) / 0.5;
    if (u < 0 || u > 1) continue;
    const push = Math.sin(Math.min(1, u * 1.4) * Math.PI / 2) * (reach / c.length);    // eases out to the reach…
    const alpha = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45;                                    // …and dies there
    c.pulse(0, dir > 0 ? push : 1 - push, dir, color, alpha, reach * 0.9);
    return true;
  }
  return false;
}

// ── the camera rig: semantic poses ─────────────────────────────────────────────────────────────────────────
/** A pose: { target:[x,y,z], yaw, pitch (degrees), dist (m), fov (degrees) }. */
export class CameraRig {
  constructor(stage, world) { this.stage = stage; this.world = world; this.aspect = stage.w / stage.h; }
  /** Frame a box so it fills `fill` of the frame (width or height, whichever binds). */
  frameBox(box, { yaw = 0, pitch = 10, fov = 30, fill = 0.8, lift = 0 } = {}) {
    const size = box.getSize(V()), c = box.getCenter(V());
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const needW = (Math.hypot(size.x * Math.cos(THREE.MathUtils.degToRad(yaw)), size.z * Math.sin(THREE.MathUtils.degToRad(yaw))) / fill) / (vh * this.aspect);
    const needH = (size.y / fill) / vh;
    return { target: [c.x, c.y + lift, c.z], yaw, pitch, dist: Math.max(needW, needH, 0.05), fov };
  }
  /** The system view: every device, near-orthographic (a long lens from far away), slightly elevated. */
  topology(opts = {}) { return this.frameBox(this.world.bounds(Object.keys(this.world.devices)), { yaw: 0, pitch: 22, fov: 8, fill: 0.94, ...opts }); }
  devices(ids, opts = {}) { return this.frameBox(this.world.bounds(ids), { pitch: 12, fov: 20, fill: 0.72, ...opts }); }
  device(id, opts = {}) { return this.frameBox(this.world.bounds([id]), { pitch: 14, fov: 30, fill: 0.62, ...opts }); }
  /** Look into a port along its normal (turned by yaw/pitch), from dist metres. */
  port(ref, { yaw = 0, pitch = 10, dist = 0.14, fov = 30, lift = 0.004 } = {}) {
    const p = this.world.port(ref), base = Math.atan2(p.normal.x, p.normal.z) * 180 / Math.PI;
    return { target: [p.pos.x, p.pos.y + lift, p.pos.z], yaw: base + yaw, pitch, dist, fov };
  }
  /** Interpolate two poses: target linearly, distance geometrically, angles and lens smoothly. */
  static mix(a, b, u) {
    const L = (x, y) => x + (y - x) * u;
    let dy = b.yaw - a.yaw; while (dy > 180) dy -= 360; while (dy < -180) dy += 360;
    return { target: a.target.map((v, i) => L(v, b.target[i])), yaw: a.yaw + dy * u, pitch: L(a.pitch, b.pitch),
      dist: Math.exp(L(Math.log(a.dist), Math.log(b.dist))), fov: L(a.fov, b.fov) };
  }
  /** shots: [[t, pose, ease?], …] — the pose at t (held before the first and after the last). */
  at(shots, t, ease) {
    if (t <= shots[0][0]) return shots[0][1];
    for (let i = 1; i < shots.length; i++) {
      if (t <= shots[i][0]) { const [t0, a] = shots[i - 1], [t1, b, e] = shots[i]; return CameraRig.mix(a, b, ease(e || 'power2.inOut')(t1 === t0 ? 1 : (t - t0) / (t1 - t0))); }
    }
    return shots[shots.length - 1][1];
  }
  apply(pose) { const [tx, ty, tz] = pose.target; this.stage.rig({ tx, ty, tz, yaw: pose.yaw, pitch: pose.pitch, dist: pose.dist, fov: pose.fov }); }
}

/**
 * Take the shot: apply the pose AND everything that must scale with it — the shadow camera, how far the floor
 * reaches, how big a halo is, how wide the travelling light is. One call, because a shot that sets the camera
 * and forgets one of these looks wrong in a way that is hard to name (world sheet, D40).
 *
 * `span` is how many metres of the world the frame covers at the target: the one number all of them scale by.
 */
export function shoot(stage, world, rig, pose) {
  rig.apply(pose);
  const span = 2 * pose.dist * Math.tan(THREE.MathUtils.degToRad(pose.fov) / 2);
  stage.shadowFit(pose.target, Math.max(0.055, span));
  stage.floorReach({ grid: Math.max(0.55, span * 2.2), far: Math.max(1.1, span * 9) });
  stage.haloScale(THREE.MathUtils.clamp(span * 1.9, 0.22, 2.2));
  world.signalWidth(THREE.MathUtils.clamp(span * 1.6, 1.6, 6));   // floor raised: at medium range a pulse in a 5 mm cable was a pale sheen
  // A close-up has no room left in frame for the floor, the other devices or the far wall to bounce light
  // back: charcoal plastic at 4% albedo then renders as a black field with a lit port in it (the computer's
  // rear-port shot, render review D40). The fill rises as the shot tightens, and only then.
  stage.fill.intensity = 0.68 + 0.55 * THREE.MathUtils.clamp((0.3 - span) / 0.3, 0, 1);
  return span;
}

// ── screen-space labels with collision avoidance ───────────────────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg';
export class Labels {
  /**
   * @param svg     the overlay <svg> (1920×1080)
   * @param stage   for projection
   * @param zones   rectangles no label may enter: [x0,y0,x1,y1] (slate, logo, captions, margins)
   */
  constructor(svg, stage, C, zones) { this.svg = svg; this.stage = stage; this.C = C; this.zones = zones; this.items = []; }
  el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); (parent || this.svg).appendChild(e); return e; }
  /**
   * spec: { anchor: () => Vector3, title, sub, color, priority (higher wins), kind: 'tag'|'status',
   *         n (status number), verdict: 'ok'|'x'|null, prefer: ['ur','ul','r','l','dr','dl','u','d'] }
   */
  add(id, spec) {
    const C = this.C, g = this.el('g', { opacity: 0 });
    const line = this.el('path', { fill: 'none', stroke: C.muted, 'stroke-width': 2, 'stroke-dasharray': '5 6' }, g);
    const ring = this.el('circle', { r: 7, fill: 'none', stroke: C.text, 'stroke-width': 2 }, g);
    const box = this.el('g', {}, g);
    const it = { id, spec, g, line, ring, box, placed: null };
    if (spec.kind === 'status') {
      it.num = this.el('circle', { r: 20, fill: C.bg, stroke: C.primary, 'stroke-width': 2.8 }, box);
      it.numT = this.el('text', { 'text-anchor': 'middle', 'font-family': 'DM Mono', 'font-size': 23, 'font-weight': 500, fill: C.text }, box); it.numT.textContent = spec.n;
      // 26 px, not 20: at 640x360 a 20 px label is under 7 px and unreadable, and these four are the
      // whole point of the check sequence (small-screen review, D40).
      it.t1 = this.el('text', { 'font-family': 'DM Sans', 'font-weight': 600, 'font-size': 26, 'letter-spacing': 1.8, fill: C.muted }, box); it.t1.textContent = spec.title;
      it.ok = this.el('g', { opacity: 0 }, box); it.x = this.el('g', { opacity: 0 }, box);
      this.el('path', { d: 'M0,8 l6,6 l10,-12', fill: 'none', stroke: C.pos, 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, it.ok);
      const okT = this.el('text', { x: 28, y: 17, 'font-family': 'DM Sans', 'font-weight': 700, 'font-size': 27, 'letter-spacing': 2, fill: C.pos }, it.ok); okT.textContent = 'VERIFIED';
      this.el('path', { d: 'M1,3 l11,11 M12,3 l-11,11', fill: 'none', stroke: C.neg, 'stroke-width': 3.2, 'stroke-linecap': 'round' }, it.x);
      const xT = this.el('text', { x: 28, y: 17, 'font-family': 'DM Sans', 'font-weight': 700, 'font-size': 27, 'letter-spacing': 2, fill: C.neg }, it.x); xT.textContent = 'FAILED';
      it.w = 66 + Math.max(spec.title.length * 16.1, 186); it.h = 78;
    } else {
      it.t1 = this.el('text', { 'font-family': 'DM Sans', 'font-weight': 700, 'font-size': 30, 'letter-spacing': 2.8, fill: spec.color || C.text }, box); it.t1.textContent = spec.title;
      it.t2 = this.el('text', { 'font-family': 'DM Sans', 'font-weight': 500, 'font-size': 24, fill: C.muted }, box); it.t2.textContent = spec.sub || '';
      it.w = Math.max(spec.title.length * 21.5, (spec.sub || '').length * 12.4); it.h = spec.sub ? 66 : 36;
    }
    this.items.push(it); return it;
  }
  /** Lay out every label for this frame. vis: id → opacity (0 hides); state: id → verdict for status labels. */
  layout(vis, verdicts = {}, avoid = []) {
    // A "keep off the subject" box that covers most of the frame keeps off everything: in the macro shots every
    // label was silently dropped, which is exactly the failure this class is supposed to prevent (D40). A box
    // that large is not information — the subject IS the frame — so it is ignored.
    avoid = avoid.filter((z) => (z[2] - z[0]) * (z[3] - z[1]) < 0.42 * 1920 * 1080);
    const placed = [];
    // Two rings: close beside the anchor, and — when nothing close fits — further out on a longer leader.
    // With one ring a label near a big device had nowhere to stand and was dropped, which is a worse answer
    // than a longer leader line (snapshot review, D40).
    const NEAR = { ur: [70, -90], ul: [-70, -90], r: [90, -10], l: [-90, -10], dr: [70, 80], dl: [-70, 80], u: [0, -120], d: [0, 110] };
    const FAR = { ur: [170, -210], ul: [-170, -210], r: [230, -10], l: [-230, -10], dr: [170, 190], dl: [-170, 190], u: [0, -250], d: [0, 240] };
    const hit = (r, s) => !(r[2] < s[0] || r[0] > s[2] || r[3] < s[1] || r[1] > s[3]);
    const items = this.items.slice().sort((a, b) => (b.spec.priority || 0) - (a.spec.priority || 0));
    for (const it of items) {
      const o = vis[it.id] || 0;
      it.g.setAttribute('opacity', o.toFixed(3));
      if (o <= 0.001) continue;
      const p = this.stage.project(it.spec.anchor());
      if (p.behind || p.x < 20 || p.x > 1900 || p.y < 20 || p.y > 1060) { it.g.setAttribute('opacity', 0); continue; }
      let best = null;
      const sides = it.spec.prefer || ['ur', 'ul', 'r', 'l', 'dr', 'dl', 'u', 'd'];
      const tries = [...sides.map((k) => [k, NEAR]), ...sides.map((k) => [k, FAR])];
      for (const [k, OFF] of tries) {
        const [dx, dy] = OFF[k], left = dx < 0 || (dx === 0 && false);
        const x0 = left ? p.x + dx - it.w : dx === 0 ? p.x - it.w / 2 : p.x + dx;
        const y0 = dy < 0 ? p.y + dy - it.h : p.y + dy;
        const r = [x0 - 12, y0 - 12, x0 + it.w + 12, y0 + it.h + 12];
        if (r[0] < 30 || r[2] > 1890 || r[1] < 30 || r[3] > 1050) continue;
        if (this.zones.some((z) => hit(r, z)) || avoid.some((z) => hit(r, z)) || placed.some((z) => hit(r, z))) continue;
        best = { k, x0, y0, left, r }; break;
      }
      if (!best) { it.g.setAttribute('opacity', 0); continue; }       // fewer labels, never colliding ones
      placed.push(best.r);
      const { x0, y0, left } = best;
      it.ring.setAttribute('cx', p.x.toFixed(1)); it.ring.setAttribute('cy', p.y.toFixed(1));
      const ex = left ? x0 + it.w : x0, ey = y0 + (best.k[0] === 'd' ? 0 : it.h * 0.55);
      it.line.setAttribute('d', `M${p.x.toFixed(1)},${p.y.toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)}`);
      if (it.spec.kind === 'status') {
        it.box.setAttribute('transform', `translate(${x0.toFixed(1)},${y0.toFixed(1)})`);
        it.num.setAttribute('cx', 20); it.num.setAttribute('cy', 32); it.numT.setAttribute('x', 20); it.numT.setAttribute('y', 40);
        it.t1.setAttribute('x', 52); it.t1.setAttribute('y', 24);
        const v = verdicts[it.id];
        it.ok.setAttribute('opacity', v === 'ok' ? 1 : 0); it.x.setAttribute('opacity', v === 'x' ? 1 : 0);
        // The verdict clears the title's descender box: at 26 px they were close enough for the layout
        // check to call it an overlap (D40).
        it.ok.setAttribute('transform', 'translate(52,44)'); it.x.setAttribute('transform', 'translate(52,44)');
        it.num.setAttribute('stroke', v === 'ok' ? this.C.pos : v === 'x' ? this.C.neg : this.C.primary);
      } else {
        const a = left ? 'end' : 'start', tx = left ? x0 + it.w : x0;
        it.t1.setAttribute('x', tx.toFixed(1)); it.t1.setAttribute('y', (y0 + 28).toFixed(1)); it.t1.setAttribute('text-anchor', a);
        it.t2.setAttribute('x', tx.toFixed(1)); it.t2.setAttribute('y', (y0 + 60).toFixed(1)); it.t2.setAttribute('text-anchor', a);
      }
    }
  }
}

/** The projected screen rectangle of a device (to keep labels off the subject). */
export function screenBox(stage, world, id, pad = 10) {
  const b = world.bounds([id]), pts = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(stage.project(V(x, y, z)));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}

/** The monitor's picture, drawn on a canvas: 'noinet' | 'ok'. */
export function screenPainter(mesh, C) {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  let last = '';
  return function paint(state) {
    if (state === last) return; last = state;
    g.fillStyle = '#0c0e13'; g.fillRect(0, 0, 1280, 720);
    g.fillStyle = '#1a1e29'; g.fillRect(0, 0, 1280, 64);                           // browser chrome
    for (let i = 0; i < 3; i++) { g.fillStyle = '#3a4052'; g.beginPath(); g.arc(34 + i * 30, 32, 9, 0, 7); g.fill(); }
    g.fillStyle = '#262b39'; g.beginPath(); g.roundRect(150, 16, 980, 32, 16); g.fill();
    g.fillStyle = '#8b92a8'; g.font = '500 20px "DM Sans", sans-serif'; g.fillText('support.school.ac.tz', 176, 39);
    if (state === 'noinet') {
      g.strokeStyle = '#9ba1b5'; g.lineWidth = 9;
      g.beginPath(); g.arc(640, 300, 78, 0, 7); g.stroke();
      g.beginPath(); g.ellipse(640, 300, 34, 78, 0, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(562, 300); g.lineTo(718, 300); g.stroke();
      g.strokeStyle = C.neg; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); g.moveTo(565, 212); g.lineTo(715, 388); g.stroke();
      g.fillStyle = '#eef0f5'; g.font = '700 64px "DM Sans", sans-serif'; g.textAlign = 'center'; g.fillText('No internet', 640, 480);
      g.fillStyle = '#9ba1b5'; g.font = '400 34px "DM Sans", sans-serif'; g.fillText("This page can't be reached", 640, 536); g.textAlign = 'start';
    } else {
      g.fillStyle = C.primary; g.fillRect(60, 104, 1160, 70);
      g.fillStyle = '#eef0f5'; g.font = '700 34px "DM Sans", sans-serif'; g.fillText('Lesson 4 · Forces and motion', 90, 150);
      g.fillStyle = '#232838'; g.fillRect(60, 206, 520, 400);
      for (let i = 0; i < 6; i++) { g.fillStyle = '#232838'; g.fillRect(620, 214 + i * 60, 600 - (i % 3) * 120, 22); }
    }
    tex.needsUpdate = true;
  };
}
