/**
 * Production watch — is the live site up, current and intact? (DECISIONS.md D30)
 *
 * Run every 30 minutes by .github/workflows/watch.yml. A failed run is emailed by
 * GitHub to the repository owner: an alarm that does not depend on the site it
 * is watching. The in-app bell cannot say "the app is down" — it is part of the app.
 *
 * Read-only: GET requests and one TLS handshake, nothing else. No credentials.
 *
 *   node scripts/watch-production.js [https://support.mkatolikikiganjani.com]
 *
 * Env: EXPECT_BUILD (short sha that should be running), EXPECT_BUILD_AGE (seconds
 * since that commit; a lag is tolerated for 20 minutes, the deploy's own time).
 */
const tls = require('tls');

const BASE = (process.argv[2] || process.env.WATCH_BASE || 'https://support.mkatolikikiganjani.com').replace(/\/$/, '');
const HOST = new URL(BASE).hostname;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function get(path, headers = {}, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + path, { headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
      return { status: r.status, headers: r.headers, json, text };
    } catch (e) { last = e; await sleep(15000); }   // a deploy restart takes seconds, not minutes
  }
  return { status: 0, error: last && last.message };
}

function certDaysLeft() {
  return new Promise((resolve) => {
    const s = tls.connect({ host: HOST, port: 443, servername: HOST, timeout: 20000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      resolve({ days: Math.floor((new Date(c.valid_to) - Date.now()) / 86400000), authorized: s.authorized, error: s.authorizationError });
    });
    s.on('error', (e) => resolve({ days: null, error: e.message }));
    s.on('timeout', () => { s.destroy(); resolve({ days: null, error: 'timeout' }); });
  });
}

(async () => {
  // 1. Up, and the database reachable.
  const health = await get('/api/health');
  check('Site answers /api/health', health.status === 200 && health.json && health.json.status === 'ok', health.status || health.error);
  if (!health.status) return report();   // unreachable after the retries: the rest would only repeat it
  const settings = await get('/api/settings');
  check('Database reachable (/api/settings)', settings.status === 200, settings.status || settings.error);

  // 2. Running the latest commit — a deploy that pulled files but never restarted is OPS-001.
  const running = health.json && health.json.build;
  const expect = (process.env.EXPECT_BUILD || '').slice(0, 7);
  if (expect && running) {
    const age = Number(process.env.EXPECT_BUILD_AGE || 0);
    const current = running.startsWith(expect);
    check('Running the latest commit', current || age < 20 * 60,
      current ? running : `running ${running}, latest ${expect}${age < 20 * 60 ? ' (deploy in progress)' : ` — ${Math.round(age / 60)} min behind: the deploy did not restart the app`}`);
  } else check('Running the latest commit', !!running, running ? `running ${running} (no expected commit given)` : 'build unknown');

  // 3. Certificate: valid, and not about to expire (Let's Encrypt renews at 30 days left).
  const cert = await certDaysLeft();
  check('TLS certificate valid', cert.authorized, cert.error || 'trusted');
  check('TLS certificate has 14+ days left', cert.days !== null && cert.days >= 14, cert.days === null ? cert.error : `${cert.days} days`);

  // 4. The security headers every page must carry.
  const home = await get('/');
  const h = home.headers || new Map();
  check('Page served', home.status === 200, home.status || home.error);
  check('HSTS header', /max-age=\d{7,}/.test(h.get ? h.get('strict-transport-security') || '' : ''), h.get && h.get('strict-transport-security'));
  check('Content-Security-Policy enforced', /default-src 'self'/.test(h.get ? h.get('content-security-policy') || '' : ''));
  check('Strict CSP reported (D24)', /script-src 'self'/.test(h.get ? h.get('content-security-policy-report-only') || '' : ''));
  check('X-Content-Type-Options nosniff', (h.get && h.get('x-content-type-options')) === 'nosniff');

  // 5. The doors that must stay shut.
  const ov = await get('/api/security/overview');
  check('Security Overview refuses anonymous callers (401)', ov.status === 401, ov.status);
  const errs = await get('/api/errors');
  check('Fault list refuses anonymous callers (401)', errs.status === 401, errs.status);

  // 6. SEC-015: a forged address must not be believed (0.0.0.0 until the host is fixed).
  const forged = '203.0.113.77';
  const seen = await get('/api/security/seen-as', { 'X-Forwarded-For': forged });
  const ip = seen.json && seen.json.ip;
  check('A forged client address is not believed (SEC-015)', seen.status === 200 && ip && ip !== forged,
    ip === '0.0.0.0' ? 'recorded as unknown (host still trusts the header)' : ip ? `recorded as ${ip} (host fixed)` : seen.status);

  report();
})().catch(e => { console.error('watch failed to run:', e.message); process.exitCode = 1; });

function report() {
  const failed = results.filter(r => !r.ok);
  const lines = results.map(r => `| ${r.ok ? '✅' : '❌'} | ${r.name} | ${r.detail.replace(/\|/g, '/')} |`);
  const md = [`### Production watch — ${BASE}`, '', `${results.length - failed.length}/${results.length} checks passed · ${new Date().toISOString()}`, '',
    '| | Check | Detail |', '|---|---|---|', ...lines].join('\n');
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  process.exitCode = failed.length ? 1 : 0;
}
