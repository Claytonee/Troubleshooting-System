/**
 * Verification — the deploy preflight (DECISIONS.md D23).
 *
 * POST /api/deploy rolls back instead of restarting when the new checkout would
 * not boot. The webhook itself cannot be exercised locally (it would
 * `git reset --hard` the working copy), so this proves its decision function on
 * real directories: the actual backend, and throwaway copies broken on purpose.
 * Needs no server and no database. Run from backend/.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { preflight } = require('../src/services/deployPreflight');

const BACKEND = path.join(__dirname, '..');
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}

/** A copy of backend/src + package.json, with node_modules linked rather than copied. */
function copyBackend() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-'));
  fs.cpSync(path.join(BACKEND, 'src'), path.join(dir, 'src'), { recursive: true });
  fs.copyFileSync(path.join(BACKEND, 'package.json'), path.join(dir, 'package.json'));
  // Resolution walks up from the directory, so point it at the real dependencies.
  fs.symlinkSync(path.join(BACKEND, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
  return dir;
}

const t0 = Date.now();
const real = preflight(BACKEND);
ok(`the real backend passes (${real.checked} files, ${((Date.now() - t0) / 1000).toFixed(1)} s)`, real.ok, real.problems);

const tmp = [];
try {
  const a = copyBackend(); tmp.push(a);
  ok('a faithful copy passes', preflight(a).ok, preflight(a).problems);

  const b = copyBackend(); tmp.push(b);
  fs.appendFileSync(path.join(b, 'src', 'controllers', 'errorController.js'), '\nfunction broken( {\n');
  const rb = preflight(b);
  ok('a syntax error anywhere under src/ fails it', !rb.ok && rb.problems.some(p => /errorController\.js does not parse/.test(p)), rb.problems);

  const c = copyBackend(); tmp.push(c);
  fs.unlinkSync(path.join(c, 'src', 'server.js'));
  const rc = preflight(c);
  ok('a missing server.js fails it', !rc.ok && rc.problems.some(p => /server\.js is missing/.test(p)), rc.problems);

  const d = copyBackend(); tmp.push(d);
  const pkg = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8'));
  pkg.dependencies['zz-not-installed-package'] = '^1.0.0';
  fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify(pkg));
  const rd = preflight(d);
  ok('a dependency npm could not install fails it', !rd.ok && rd.problems.some(p => /zz-not-installed-package/.test(p)), rd.problems);

  const e = copyBackend(); tmp.push(e);
  fs.writeFileSync(path.join(e, 'package.json'), '{ not json');
  const re = preflight(e);
  ok('an unreadable package.json fails it', !re.ok && re.problems.some(p => /package\.json unreadable/.test(p)), re.problems);
} finally {
  for (const d of tmp) {
    try { fs.unlinkSync(path.join(d, 'node_modules')); } catch (x) { try { fs.rmdirSync(path.join(d, 'node_modules')); } catch (y) {} }
    fs.rmSync(d, { recursive: true, force: true });
  }
}

// The route must use it, roll back on failure, and restart only on success.
const server = fs.readFileSync(path.join(BACKEND, 'src', 'server.js'), 'utf8');
const deploy = server.slice(server.indexOf("app.post('/api/deploy'"), server.indexOf("app.get('*'"));
ok('the deploy route runs the preflight', /require\('\.\/services\/deployPreflight'\)\.preflight\(backendDir\)/.test(deploy));
ok('a failed preflight resets to the previous commit', /if \(!check\.ok\) \{[\s\S]*?git\(`reset --hard \$\{previous\}`\)/.test(deploy));
const failBlock = deploy.slice(deploy.indexOf('if (!check.ok)'), deploy.indexOf('}', deploy.indexOf("status: 'rolled_back'")));
ok('a failed preflight never exits the process', !/process\.exit/.test(failBlock));
ok('the process exits only after answering', deploy.indexOf('process.exit(0)') > deploy.indexOf("status: 'deployed'"));

console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
