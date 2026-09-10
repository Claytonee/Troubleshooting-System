/**
 * Verification — the frontend cannot execute strings, and the shell version is coherent. 2026-09-10.
 *
 * Written after a school administrator reported the Report Error form's
 * Sub-category field "breaking the layout". Two defects sat underneath it, and
 * the second had been invisible for months:
 *
 *   1. `Dropdown.select()` ran its `onSelect` with `eval(hidden.dataset.onselect)`
 *      inside a bare `catch (e) {}`. This app sends
 *      `script-src 'self' 'unsafe-inline'` — no `'unsafe-eval'` — so every one
 *      of those calls threw `EvalError` and the empty catch swallowed it.
 *      Choosing a Category never populated Sub-category; the inventory filters
 *      never filtered; the week picker never changed the week. Nothing logged.
 *   2. Placement escaped its own card, which is `overflow:hidden`, and focusing
 *      the panel's search box made the browser scroll that card sideways —
 *      dragging the whole form out from under its labels.
 *
 * Defect 1 is the dangerous kind: a feature that is wired, shipped, and dead.
 * A string handler cannot be caught by any test that only runs the backend, so
 * it is caught here, by reading the source.
 *
 * Run from backend/:  node scripts/verify-frontend-safety.js
 */
const fs = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname, '..', '..', 'frontend');
const SERVER = path.join(__dirname, '..', 'src', 'server.js');

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return jsFiles(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}

function rel(p) { return path.relative(FRONTEND, p).replace(/\\/g, '/'); }

/**
 * Comments out, code only.
 *
 * The first run of this suite failed on its own explanation: the word `eval(`
 * appears in the comment above the fix that removed it. A guard that cannot
 * tell prose from code teaches people to delete the prose.
 *
 * Block comments go entirely; line comments only when the line is nothing but
 * a comment, so a `//` inside a URL in a string survives.
 */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
}

(function main() {
  const files = jsFiles(path.join(FRONTEND, 'js')).concat([path.join(FRONTEND, 'sw.js')]);
  const sources = files.map(f => ({ f, s: code(fs.readFileSync(f, 'utf8')) }));

  console.log('\nThe CSP forbids executing strings');
  const server = code(fs.readFileSync(SERVER, 'utf8'));
  ok("script-src still has no 'unsafe-eval' (this whole suite is why)",
    /scriptSrc:\s*\[[^\]]*\]/.test(server) && !/scriptSrc:\s*\[[^\]]*unsafe-eval/.test(server));

  // `eval(` and `new Function(` are both blocked outright; setTimeout/setInterval
  // with a string argument is the same trap wearing a different hat.
  const evalHits = sources.filter(({ s }) => /(^|[^.\w])eval\s*\(/.test(s) || /new\s+Function\s*\(/.test(s))
    .map(({ f }) => rel(f));
  ok('no eval() or new Function() anywhere in the frontend', evalHits.length === 0, evalHits);

  const timerStringHits = sources.filter(({ s }) => /set(Timeout|Interval)\s*\(\s*['"`]/.test(s)).map(({ f }) => rel(f));
  ok('no setTimeout/setInterval called with a string', timerStringHits.length === 0, timerStringHits);

  console.log('\nEvery dropdown handler is a function, not a string');
  const stringOnSelect = sources
    .filter(({ s }) => /onSelect:\s*['"`]/.test(s))
    .map(({ f }) => rel(f));
  ok('no onSelect passed as a string', stringOnSelect.length === 0, stringOnSelect);

  const utils = sources.find(({ f }) => rel(f) === 'js/utils.js').s;
  ok('Dropdown.render registers function handlers', /handlers\[id\]\s*=\s*opts\.onSelect/.test(utils));
  ok('Dropdown.select calls the handler directly', /const fn = handlers\[id\];/.test(utils));
  ok('a string handler is reported, never swallowed', /console\.error\(`Dropdown/.test(utils));
  ok('data-onselect is gone from the rendered markup', !/data-onselect/.test(utils));

  console.log('\nThe dropdown panel stays where it can be seen');
  ok('placement is measured against a clipping box, not the window',
    /function clipBox\(el\)/.test(utils) && /const clip = clipBox\(dd\);/.test(utils));
  ok('drop-side is used only when the panel fits inside that box',
    /fitsSide\s*=\s*triggerRect\.right \+ SIDE_GAP \+ SIDE_W <= clip\.right/.test(utils));
  ok('focusing the search box cannot scroll an ancestor',
    /\.focus\(\{ preventScroll: true \}\)/.test(utils) && !/[^t]\.focus\(\)/.test(utils.split('function toggle')[1].split('function closeAll')[0]));
  ok('the field keeps its own placeholder when its options change',
    /data-placeholder="\$\{esc\(placeholder\)\}"/.test(utils) && /text\.dataset\.placeholder/.test(utils));

  console.log('\nThe shell version is coherent');
  // Bumping sw.js's VERSION without the ?v= query (or the reverse) leaves clients
  // on half an old shell — the exact failure CLAUDE.md warns about, unenforced until now.
  const sw = fs.readFileSync(path.join(FRONTEND, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(FRONTEND, 'index.html'), 'utf8');
  const swVersion = (sw.match(/const VERSION = '(v\d+)'/) || [])[1];
  const queries = [...new Set([...html.matchAll(/\?v=(\d+)/g)].map(m => 'v' + m[1]))];
  ok('sw.js declares a VERSION', !!swVersion, swVersion);
  ok('index.html stamps exactly one asset version', queries.length === 1, queries);
  ok('the two agree', swVersion && queries[0] === swVersion, { swVersion, queries });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
