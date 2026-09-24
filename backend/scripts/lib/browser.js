/**
 * A real browser for the verification suites: headless Chrome or Edge driven
 * over the DevTools protocol, with no npm dependency (Node's own fetch and
 * WebSocket). Used where only a rendered page can answer the question —
 * "is this bubble inside the screen on a phone?" is not something an API call
 * can tell you.
 *
 * find() returns null when no browser is installed; suites then say so and
 * skip their browser half rather than fail, so the gate still runs on a
 * server with no desktop.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function find() {
  if (typeof WebSocket === 'undefined') return null;       // Node < 22
  return CANDIDATES.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } }) || null;
}

/**
 * Returns null ONLY when no browser is installed. A browser that is installed
 * but will not start is an error: a suite that quietly skipped its browser half
 * would report green having checked nothing (it did, once, during development).
 */
async function launch() {
  const exe = find();
  if (!exe) return null;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await start(exe, 9300 + Math.floor(Math.random() * 600)); }
    catch (e) { lastErr = e; await sleep(500); }
  }
  throw new Error(`browser installed at ${exe} but would not start: ${lastErr && lastErr.message}`);
}

async function start(exe, port) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qft-verify-'));
  const args = ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', `--user-data-dir=${profile}`];
  // GitHub's Ubuntu runners restrict the user namespaces Chrome's sandbox needs.
  // Only there: a throwaway CI machine loading our own local pages.
  if (process.env.CI) args.push('--no-sandbox');
  const proc = spawn(exe, [...args, 'about:blank'], { stdio: 'ignore' });
  // By the clock, not by attempts, and each attempt bounded: on a loaded machine
  // Chrome was seen listening (stderr said so) while /json/list took over 5 s to answer.
  let target;
  const until = Date.now() + 60000;
  while (!target && Date.now() < until) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) })).json()).find(t => t.type === 'page'); }
    catch (e) { /* not listening yet, or slow to answer */ }
    if (!target) await sleep(250);
  }
  if (!target) { proc.kill(); throw new Error(`no page target on port ${port} after 60 s`); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  let id = 0;
  const waiting = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  const page = {
    send,
    /** Evaluate an expression (may be async) in the page; returns its JSON value. */
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.result && r.result.exceptionDetails) throw new Error('page: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
      return r.result && r.result.result ? r.result.result.value : undefined;
    },
    async size(width, height) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    },
    /** A real page load (not a hash change), then wait for the document. */
    async load(url) {
      // Right after Page.navigate the OLD document still answers "complete", so
      // mark it first and wait for a document without the mark. Without this a
      // suite's next step ran against the page that was about to be replaced.
      try { await page.eval('window.__verifyStale = true'); } catch (e) { /* about:blank */ }
      await send('Page.navigate', { url });
      for (let i = 0; i < 150; i++) {
        await sleep(100);
        try { if (await page.eval("!window.__verifyStale && document.readyState === 'complete'")) break; } catch (e) { /* navigating */ }
      }
    },
    /** Poll an expression until it is truthy; returns its value or null. */
    async waitFor(expr, ms = 6000) {
      const until = Date.now() + ms;
      for (;;) {
        let v = null;
        try { v = await page.eval(expr); } catch (e) { v = null; }
        if (v || Date.now() > until) return v || null;
        await sleep(100);
      }
    },
    async key(key, code = key, keyCode = 0) {
      for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: keyCode });
    },
    async screenshot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    },
    async close() {
      try { ws.close(); } catch (e) {}
      proc.kill();
      await sleep(300);
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  return page;
}

module.exports = { find, launch, sleep };
