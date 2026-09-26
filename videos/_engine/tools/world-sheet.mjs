/**
 * The world QA sheet (D40): shoot the 3D world's key views before any film is built on it.
 *
 *     node _engine/tools/world-sheet.mjs            → _engine/.scratch/world-sheet/sheet.jpg (+ the PNGs)
 *
 * It renders the real runtime — the real bundle, the real GLBs, the real scene configuration
 * (lib/school-network.mjs) — in headless Chrome, at the frame size the film uses, and tiles the views into
 * one sheet. A fault in the library, the anchors, the cable routing, the lighting or the camera grammar shows
 * up here, where it costs one minute, instead of after a fifteen-minute render.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHOOL_NETWORK, MODELS } from '../lib/school-network.mjs';
import { C } from '../lib/palette.mjs';

const ENGINE = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ENGINE, '.scratch', 'world-sheet');
const FFMPEG_DIR = process.env.OE_FFMPEG_DIR || 'C:/Users/clayt/tools/ffmpeg-n8.1-latest-win64-gpl-8.1/bin';
const env = { ...process.env, PATH: `${FFMPEG_DIR}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Each view: what it must prove. The name is printed on the sheet. */
const VIEWS = [
  ['1-topology', 'system view - near-orthographic - every device and every cable'],
  ['2-signal', 'a request in flight: the light is IN the cable, not above it'],
  ['3-medium', 'switch to router: ports have places; the LEDs read'],
  ['4-router', 'the same router, closer: no style break, only the camera'],
  ['5-wan', 'WAN port close-up: the plug is visibly not seated'],
  ['6-rear', "the computer's rear port: link light, where it really is"],
  ['7-computer', 'the desktop: the symptom is on its screen'],
  ['8-provider', "the provider's modem and where the line goes"],
  ['9-tower', 'the computer from behind: what the rear-port shot is cut out of'],
];

// ── the page ───────────────────────────────────────────────────────────────────
function page() {
  return `<!doctype html><meta charset="utf-8"><title>OE world sheet</title>
<style>html,body{margin:0;background:${C.bg}}canvas{display:block;width:1920px;height:1080px}</style>
<canvas id="c" width="1920" height="1080"></canvas>
<script>
window.__errs = [];
addEventListener('error', (e) => window.__errs.push(String(e.message)));
addEventListener('unhandledrejection', (e) => window.__errs.push('promise: ' + (e.reason && e.reason.message || e.reason)));
</script>
<script src="three-oe3d.js"></script>
<script>
const SPEC = ${JSON.stringify(SCHOOL_NETWORK)}, MODELS = ${JSON.stringify(MODELS)}, C = ${JSON.stringify(C)}, LED = OE3D.LED;
let stage, world, rig, paint = () => {};
window.ready = (async () => {
  stage = new OE3D.HardwareStage(document.getElementById('c'));
  stage.technicalFloor();
  await Promise.all(Object.entries(MODELS).map(([k, u]) => stage.load(k, u)));
  world = new OE3D.World(stage, SPEC);
  rig = new OE3D.CameraRig(stage, world);
  paint = OE3D.screenPainter(world.device('monitor').root.getObjectByName('screen'), C);
  window.world = world; window.rig = rig; window.stage = stage;
  return true;
})();

/** The healthy-but-for-the-WAN state the film opens on. */
function baseState() {
  world.plug('router.wan', { out: 0.0065, droop: 7 });
  world.update();
  world.emphasis({ monitor: 1, computer: 1, switch: 1, router: 1, modem: 1, internet: 1, 'pc-sw': 1, 'sw-rt': 1, 'rt-md': 1, 'md-net': 1 });
  world.led('computer.power', LED.POWER_ON); world.led('computer.link', LED.LINK_UP); world.led('computer.act', LED.ACTIVITY, 0.2);
  world.led('switch.power', LED.POWER_ON); world.led('switch.p1', LED.LINK_UP); world.led('switch.p8', LED.LINK_UP);
  world.led('router.power', LED.POWER_ON); world.led('router.wifi', LED.LINK_UP); world.led('router.lan', LED.LINK_UP);
  world.led('router.lan1', LED.LINK_UP); world.led('router.internet', LED.FAULT); world.led('router.wan', LED.LINK_DOWN);
  world.led('modem.power', LED.POWER_ON); world.led('modem.link', LED.LINK_UP); world.led('modem.internet', LED.LINK_UP); world.led('modem.lan', LED.LINK_DOWN);
  for (const c of ['pc-sw', 'sw-rt', 'rt-md', 'md-net']) world.cable(c).clearPulses();
}

const POSE = {
  '1-topology': () => rig.topology(),
  '2-signal': () => rig.topology(),
  '3-medium': () => rig.devices(['switch', 'router'], { yaw: -14, pitch: 18 }),
  '4-router': () => rig.device('router', { yaw: -26, pitch: 20 }),
  '5-wan': () => rig.port('router.wan', { yaw: -30, pitch: 17, dist: 0.115 }),
  '6-rear': () => rig.port('computer.eth', { yaw: 26, pitch: 14, dist: 0.17 }),
  '7-computer': () => rig.devices(['monitor', 'computer'], { yaw: -8, pitch: 12, fill: 0.78 }),
  '8-provider': () => rig.devices(['modem', 'internet'], { yaw: -10, pitch: 16, fill: 0.7 }),
  '9-tower': () => rig.device('computer', { yaw: 118, pitch: 16, fill: 0.72 }),
};

window.shoot = async function (name) {
  await window.ready;
  baseState();
  paint('noinet');
  if (name === '2-signal') {
    const sch = OE3D.schedule(world, [['pc-sw', 1], ['sw-rt', 1]], 0);
    OE3D.drawPulse(world, sch, sch.legs[1].t0 + (sch.legs[1].t1 - sch.legs[1].t0) * 0.55, 0, OE3D.SIGNAL.REQUEST, 1);
  }
  if (name === '5-wan') world.emphasis({ monitor: 0, computer: 0, switch: 0.25, modem: 0.5, internet: 0, 'pc-sw': 0.25, 'sw-rt': 0.3 });
  if (name === '6-rear') world.emphasis({ switch: 0.45, router: 0.3, modem: 0.15, internet: 0, 'sw-rt': 0.3, 'rt-md': 0.2, 'md-net': 0.15 });

  OE3D.shoot(stage, world, rig, POSE[name]());
  stage.render();
  return document.getElementById('c').toDataURL('image/png');
};

/**
 * What is that? Shoot a view, then ask what the pixel at (x, y) is actually showing — object name and
 * material. Guessing at a bright shape from a JPEG wastes more time than the raycast costs.
 */
window.probe = async function (name, x, y) {
  await window.shoot(name);
  const T = OE3D.THREE, r = new T.Raycaster();
  r.setFromCamera(new T.Vector2((x / 1920) * 2 - 1, -((y / 1080) * 2 - 1)), stage.camera);
  return r.intersectObjects(stage.scene.children, true).slice(0, 3)
    .map((h) => h.object.name + ' [' + (h.object.material && h.object.material.name) + '] at ' + h.distance.toFixed(3) + 'm');
};
</script>`;
}

// ── a browser ──────────────────────────────────────────────────────────────────
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => { try { return existsSync(p); } catch { return false; } });

async function browser(url) {
  if (!CHROME) throw new Error('no Chrome or Edge found: set CHROME_PATH');
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = join(OUT, '.chrome');
  // SwiftShader: the sheet must render the same on a laptop with a GPU and on a machine without one.
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--disable-lcd-text', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--user-data-dir=${profile}`, '--window-size=1920,1080', url], { stdio: 'ignore' });
  let target = null;
  for (const until = Date.now() + 60000; !target && Date.now() < until;) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) })).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
    if (!target) await sleep(250);
  }
  if (!target) { proc.kill(); throw new Error('the browser did not start'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  let id = 0; const waiting = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  return {
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      const ex = r.result && r.result.exceptionDetails;
      if (ex) throw new Error('page: ' + (ex.exception?.description || ex.text));
      return r.result?.result?.value;
    },
    close() { try { ws.close(); } catch { /* closing */ } proc.kill(); },
  };
}

// ── run ────────────────────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets', 'hw3d'), { recursive: true });
copyFileSync(join(ENGINE, 'shared', 'three-oe3d.js'), join(OUT, 'three-oe3d.js'));
const glbs = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? glbs(join(dir, e.name)) : /\.web\.glb$/.test(e.name) ? [join(dir, e.name)] : []));
for (const f of glbs(join(ENGINE, 'hardware-3d'))) copyFileSync(f, join(OUT, 'assets', 'hw3d', basename(f)));
writeFileSync(join(OUT, 'index.html'), page());

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = createServer((req, res) => {
  const f = join(OUT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  let body = null;
  try { body = readFileSync(f); } catch { res.writeHead(404); res.end('no'); return; }   // read first: writeHead cannot be taken back
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const page_ = await browser(url);
try {
  for (let i = 0; i < 200; i++) {                       // the page has to load before it has a promise to await
    if (await page_.eval('document.readyState === "complete" && typeof window.ready !== "undefined"')) break;
    await sleep(100);
  }
  const errs = () => page_.eval('JSON.stringify(window.__errs || ["no page"])');
  let ok = false;
  try { ok = await page_.eval('window.ready'); } catch (e) { throw new Error(`the world did not build — ${e.message}\n  page errors: ${await errs()}`); }
  if (!ok) throw new Error('the world did not build — page errors: ' + await errs());
  for (const e of (process.argv.slice(2).filter((a) => a.startsWith('--eval=')))) {
    await page_.eval('window.ready');
    console.log('  eval: ' + JSON.stringify(await page_.eval(e.slice(7))));
  }
  for (const p of (process.argv.slice(2).filter((a) => a.startsWith('--probe=')))) {
    const [name, x, y] = p.slice(8).split(',');
    console.log(`  probe ${name} (${x},${y}): ` + JSON.stringify(await page_.eval(`window.probe("${name}", ${x}, ${y})`)));
  }
  for (const [name] of VIEWS) {
    const data = await page_.eval(`window.shoot(${JSON.stringify(name)})`);
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
    console.log(`  ${name}.png`);
  }
} finally { page_.close(); server.close(); }

// one sheet, labelled
const COLS = 4;
const label = VIEWS.map(([n, why], i) => `[${i}:v]scale=700:-1,drawtext=text='${n} - ${why.replace(/[':]/g, '')}':x=10:y=6:fontsize=17:fontcolor=white:box=1:boxcolor=0x0f1117cc:boxborderw=5[v${i}]`).join(';');
const layout = VIEWS.map((_, i) => {
  const c = i % COLS, r = Math.floor(i / COLS);
  const x = c === 0 ? '0' : [...Array(c)].map((_, k) => `w${k}`).join('+');
  const y = r === 0 ? '0' : [...Array(r)].map((_, k) => `h${k * COLS}`).join('+');
  return `${x}_${y}`;
}).join('|');
execFileSync('ffmpeg', ['-y', '-v', 'error', ...VIEWS.flatMap(([n]) => ['-i', join(OUT, `${n}.png`)]),
  '-filter_complex', `${label};${VIEWS.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${VIEWS.length}:layout=${layout}[o]`,
  '-map', '[o]', join(OUT, 'sheet.jpg')], { env });
console.log(`\n  sheet → ${join(OUT, 'sheet.jpg')}`);
