/**
 * Pre-push gate. Run before every push to origin — a push to origin is a
 * production deploy (the cPanel webhook tracks it).
 *
 *   cd backend && VERIFY_BASE=http://localhost:3210 node scripts/prepush.js
 *   add --quick to run only the static checks and the security suites
 *
 * 1. Every backend and frontend .js file parses (node --check).
 * 2. sw.js VERSION equals every ?v= in index.html (a mismatch strands clients on a half-old shell).
 * 3. The endpoint inventory matches the routers (api-matrix --check).
 * 4. npm audit: no high or critical advisories in production dependencies.
 * 5. The verification suites, one by one, against the server at VERIFY_BASE.
 *
 * Exit 0 only if everything passed. Suites listed in KNOWN_SKIP are skipped with the
 * reason printed, never silently: each one points at an open issue.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
const quick = process.argv.includes('--quick');

// Skipped suites and why. Remove an entry the day its issue is fixed.
const KNOWN_SKIP = {
  'verify-trends.js': 'needs a school with no faults; skips itself on the seeded data (it changes nothing)'
};
const QUICK = ['verify-frontend-safety.js', 'verify-security-boundaries.js', 'verify-role-matrix.js'];

const results = [];
const step = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '  ok  ' : '  FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

function jsFiles(dir, skip = []) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return (e.name === 'node_modules' || skip.includes(e.name)) ? [] : jsFiles(p, skip);
    return e.name.endsWith('.js') ? [p] : [];
  });
}

(async () => {
  // Highest incident id before the suites run: an exact cutoff, no clocks involved.
  let incidentBaseline = null;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
    try {
      require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
      const pool = require('../src/config/database');
      const [[r]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM security_incidents');
      incidentBaseline = Number(r.m);
    } catch (e) { incidentBaseline = null; }
  }
  console.log('\n1. Syntax');
  const files = [...jsFiles(path.join(ROOT, 'backend', 'src')), ...jsFiles(path.join(ROOT, 'backend', 'scripts')),
    ...jsFiles(path.join(ROOT, 'frontend', 'js'), ['vendor']), path.join(ROOT, 'frontend', 'sw.js')];
  const bad = files.filter(f => spawnSync(process.execPath, ['--check', f]).status !== 0);
  step(`${files.length} files parse`, !bad.length, bad.map(f => path.relative(ROOT, f)).join(', '));

  console.log('\n2. Asset version');
  const sw = fs.readFileSync(path.join(ROOT, 'frontend', 'sw.js'), 'utf8').match(/const VERSION = 'v(\d+)'/);
  const html = fs.readFileSync(path.join(ROOT, 'frontend', 'index.html'), 'utf8');
  const qs = [...new Set([...html.matchAll(/\?v=(\d+)/g)].map(m => m[1]))];
  step('sw.js VERSION matches every ?v= in index.html', sw && qs.length === 1 && qs[0] === sw[1], `sw v${sw && sw[1]}, index ${qs.map(v => 'v' + v).join('/')}`);

  console.log('\n3. Endpoint inventory');
  const m = spawnSync(process.execPath, [path.join(__dirname, 'api-matrix.js'), '--check'], { encoding: 'utf8' });
  step('API_SECURITY_MATRIX.md matches the routers', m.status === 0, (m.stdout || '').trim().split('\n')[0]);

  console.log('\n4. Dependencies');
  // A newly published advisory must stop the next push, not wait for someone to look.
  // High and critical fail the gate; moderate and low are reported.
  // npm's own CLI script run by this node — no shell, so no argument is ever
  // re-parsed by one (spawning npm.cmd needs shell:true on Windows).
  const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const auditArgs = ['audit', '--omit=dev', '--json'];
  const audit = fs.existsSync(npmCli)
    ? spawnSync(process.execPath, [npmCli, ...auditArgs], { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 120000 })
    : spawnSync('npm', auditArgs, { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 120000 });
  try {
    const v = JSON.parse(audit.stdout || '{}').metadata.vulnerabilities;
    const serious = (v.high || 0) + (v.critical || 0);
    step('npm audit: no high or critical advisories', serious === 0,
      `critical ${v.critical || 0}, high ${v.high || 0}, moderate ${v.moderate || 0}, low ${v.low || 0}`);
  } catch (e) {
    step('npm audit: no high or critical advisories', false, 'audit did not run: ' + (audit.stderr || e.message).slice(0, 120));
  }

  console.log(`\n5. Suites against ${BASE}`);
  try {
    const r = await fetch(BASE + '/api/health');
    step('server is up', r.ok, `build ${(await r.json()).build}`);
  } catch (e) {
    step('server is up', false, e.message);
  }
  const suites = fs.readdirSync(__dirname).filter(f => /^verify-.*\.js$/.test(f) && f !== 'verify-backup-restore.js')
    .filter(f => !quick || QUICK.includes(f));
  for (const s of suites) {
    if (KNOWN_SKIP[s]) { console.log(`  skip  ${s} — ${KNOWN_SKIP[s]}`); continue; }
    const t = Date.now();
    const r = spawnSync(process.execPath, [path.join(__dirname, s)], {
      cwd: path.join(__dirname, '..'), env: { ...process.env, VERIFY_BASE: BASE }, encoding: 'utf8', timeout: 300000
    });
    const summary = ((r.stdout || '').match(/(\d+) passed, (\d+) failed/) || [])[0] || 'no summary';
    const failed = (r.stdout || '').split('\n').filter(l => l.includes('FAIL')).slice(0, 3).map(l => l.trim());
    step(s, r.status === 0, `${summary} (${((Date.now() - t) / 1000).toFixed(0)} s)${failed.length ? ' · ' + failed.join(' · ') : ''}`);
  }

  // The suites trip the detection rules on purpose (forged webhooks, wrong passwords)
  // from this machine, and the server's own scheduler opens incidents about the
  // loopback address. True detection, but test noise: remove what this run caused.
  // Only ever against a local server — never another database.
  if (incidentBaseline !== null) {
    try {
      const pool = require('../src/config/database');
      const [inc] = await pool.query(
        "SELECT id FROM security_incidents WHERE subject IN ('::1', '127.0.0.1', '::ffff:127.0.0.1') AND id > ?", [incidentBaseline]);
      if (inc.length) {
        await pool.query(`DELETE FROM admin_notifications WHERE type = 'security_incident'
            AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.incident_id')) AS UNSIGNED) IN (?)`, [inc.map(i => i.id)]);
        await pool.query('DELETE FROM security_incidents WHERE id IN (?)', [inc.map(i => i.id)]);
        console.log(`  note  removed ${inc.length} incident(s) the suites caused about this machine's own address`);
      }
      await pool.end();
    } catch (e) { console.log('  note  could not tidy test incidents: ' + e.message); }
  }

  const failedSteps = results.filter(r => !r.ok);
  console.log(`\n${'='.repeat(60)}\n  ${results.length - failedSteps.length}/${results.length} checks passed${failedSteps.length ? ' — DO NOT PUSH' : ' — clear to push'}`);
  process.exitCode = failedSteps.length ? 1 : 0;
})();
