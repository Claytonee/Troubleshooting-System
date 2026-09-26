/**
 * OE3D — the explainer engine's 3D layer (hybrid 2D + real hardware, D39).
 *
 * One small system, proved on one sequence before it grows:
 *   HardwareStage   renderer, studio light, ground shadow, camera rig, projection for callouts
 *   HardwareModel   a loaded GLB: named anchors (anchor_port_wan …), LEDs driven by STATE
 *   Cable           a tube generated between anchors, so it follows the layout
 *   track / ease    keyframed values as a pure function of time
 *
 * Determinism: nothing here reads a clock. A frame calls stage.render() with state computed from
 * the HyperFrames timeline's time, so any frame can be rendered in any order.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export { THREE };

/**
 * LED states. Colours follow common network-equipment convention; what each MEANS is documented in
 * hardware-3d/README.md and must be checked against the real device before a model-specific film.
 */
export const LED = {
  OFF: null,
  POWER_ON: { color: 0x3dff8a, blink: 0 },   // green, steady: powered
  LINK_DOWN: null,                            // unlit: no cable, or no link partner
  LINK_UP: { color: 0x3dff8a, blink: 0 },     // green, steady: link established
  ACTIVITY: { color: 0x3dff8a, blink: 1 },    // green, flickering: frames passing
  WARNING: { color: 0xffa81f, blink: 0 },     // amber: connecting / degraded (e.g. obtaining an address)
  FAULT: { color: 0xff3a4c, blink: 0 },       // red: no service
};

/** Deterministic flicker for ACTIVITY: a fixed pattern keyed on time, never random. */
const flicker = (t) => { const k = Math.floor(t * 14); return ((k * 2654435761) >>> 0) % 5 === 0 ? 0.25 : 1; };

/** Soft round halo so a lit 2 mm LED still reads on a phone. Drawn once, procedurally. */
function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class HardwareModel {
  constructor(root, stage) {
    this.root = root; this.stage = stage; this.leds = {};
    root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      if (o.isMesh && /^led_/.test(o.name)) {
        o.material = o.material.clone();
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: stage.halo, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
        halo.scale.setScalar(0.0075); halo.renderOrder = 10;
        this.leds[o.name.slice(4)] = { mesh: o, halo, base: o.material.color.clone() };
      }
    });
    // halos live on the anchors, just in front of each light
    for (const [id, l] of Object.entries(this.leds)) {
      // Flush with the light and drawn without the depth test: a halo that intersects the panel is cut
      // into a wedge, and one lifted clear of it drifts beside its light at an angle. Nothing ever
      // stands in front of a front-panel light in these shots; a scene that needs that sets depthTest.
      const a = this.anchor('led_' + id); (a || l.mesh).add(l.halo);
      l.halo.position.set(0, 0, 0.0012); l.halo.material.depthTest = false;
    }
  }
  anchor(name) { return this.root.getObjectByName('anchor_' + name) || null; }
  /** state: one of LED.*; level 0..1 fades it (for a light coming up); t drives ACTIVITY. */
  led(id, state, t = 0, level = 1) {
    const l = this.leds[id]; if (!l) throw new Error(`OE3D: no LED "${id}"`);
    const m = l.mesh.material;
    if (!state || level <= 0) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 0; m.color.copy(l.base); l.halo.material.opacity = 0; return; }
    const k = level * (state.blink ? flicker(t) : 1);
    m.emissive.setHex(state.color); m.emissiveIntensity = 2.6 * k;
    m.color.setHex(state.color).multiplyScalar(0.35);
    l.halo.material.color.setHex(state.color); l.halo.material.opacity = 0.85 * k;
  }
  world(name) { const a = this.anchor(name); return a ? a.getWorldPosition(new THREE.Vector3()) : null; }
}

export class Cable {
  /** A patch cable drawn as a tube through points (world); rebuilt when its ends move. */
  constructor(stage, { radius = 0.003, color = 0x123fa0 } = {}) {
    this.stage = stage; this.radius = radius;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0 }));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    stage.scene.add(this.mesh); this.key = '';
  }
  set(points) {
    const key = points.map((p) => p.toArray().map((v) => v.toFixed(5)).join(',')).join(';');
    if (key === this.key) return; this.key = key;
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.TubeGeometry(curve, 96, this.radius, 16, false);
  }
}

export class HardwareStage {
  constructor(canvas, { width = 1920, height = 1080 } = {}) {
    this.w = width; this.h = height;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1); this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, width / height, 0.005, 20);
    this.halo = haloTexture();
    this.loader = new GLTFLoader(); this.loader.setMeshoptDecoder(MeshoptDecoder);

    // Studio light: a soft room for reflections, a key for form, a rim so a dark device separates
    // from the dark ground. Product visualisation, not drama: ports must stay readable.
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;   // lower: the room's ceiling panel drew a hard white line along the top bevel
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-0.35, 0.6, 0.55);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -0.0004;
    Object.assign(key.shadow.camera, { left: -0.4, right: 0.4, top: 0.4, bottom: -0.4, near: 0.05, far: 3 });
    this.scene.add(key); this.key = key;
    const rim = new THREE.DirectionalLight(0xb9ccff, 1.4); rim.position.set(0.5, 0.35, -0.6); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(0.6, 0.15, 0.7); this.scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.38 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground); this.ground = ground;
    this.models = {};
  }
  load(name, url) {
    return new Promise((res, rej) => this.loader.load(url, (g) => { this.models[name] = g.scene; res(g.scene); }, undefined, rej));
  }
  /** A placed instance of a loaded model (clone), wrapped for anchors and LEDs. */
  place(name, { position = [0, 0, 0], rotation = [0, 0, 0] } = {}) {
    const root = this.models[name].clone(true);
    root.position.fromArray(position); root.rotation.fromArray(rotation);
    this.scene.add(root);
    return new HardwareModel(root, this);
  }
  /** Camera rig: orbit about a target. yaw/pitch in degrees, dist in metres, fov in degrees. */
  rig({ tx, ty, tz, yaw = 0, pitch = 0, dist = 0.5, fov = 30 }) {
    const c = this.camera, y = THREE.MathUtils.degToRad(yaw), p = THREE.MathUtils.degToRad(pitch);
    c.fov = fov; c.updateProjectionMatrix();
    c.position.set(tx + dist * Math.sin(y) * Math.cos(p), ty + dist * Math.sin(p), tz + dist * Math.cos(y) * Math.cos(p));
    c.lookAt(tx, ty, tz);
    c.updateMatrixWorld();
  }
  /** World point → canvas pixels, for callouts drawn in the page. */
  project(v) { const q = v.clone().project(this.camera); return { x: (q.x + 1) / 2 * this.w, y: (1 - q.y) / 2 * this.h, behind: q.z > 1 }; }
  render() { this.scene.updateMatrixWorld(true); this.renderer.render(this.scene, this.camera); }
}

/**
 * track(keys, t): keys = [[t0, value], [t1, value, ease?], …] → value at t (numbers, or arrays of
 * numbers). Each segment eases with its own ease name (GSAP's, via gsap.parseEase when present).
 */
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i], [t0, v0] = keys[i - 1];
    if (t <= t1) {
      const u = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      const k = ease(e || 'power2.inOut')(u);
      return Array.isArray(v0) ? v0.map((a, j) => a + (v1[j] - a) * k) : v0 + (v1 - v0) * k;
    }
  }
  return keys[keys.length - 1][1];
}
const EASES = {};
export function ease(name) {
  if (EASES[name]) return EASES[name];
  const g = typeof window !== 'undefined' && window.gsap && window.gsap.parseEase ? window.gsap.parseEase(name) : null;
  return (EASES[name] = g || ((u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2)));
}
