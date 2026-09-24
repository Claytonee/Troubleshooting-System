/**
 * Can this checkout boot? Asked by POST /api/deploy after `git reset --hard <new>`
 * and `npm install`, BEFORE the running process exits to let the host start the
 * new build (DECISIONS.md D23).
 *
 * Two questions, both answerable without starting a second server:
 *  1. does every file under src/ parse (`node --check`)?
 *  2. does every dependency in package.json resolve from this directory?
 *
 * If either fails the deploy rolls back to the previous commit and keeps the old
 * process serving: a half-broken build never gets the chance to take the site down.
 *
 * It does not prove the app runs — a bad database migration or a thrown error at
 * boot would still get past it. It catches the failures a deploy actually
 * produces: a syntax error, a missing file, a dependency npm could not install.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : jsFiles(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}

/** @returns {{ ok: boolean, checked: number, problems: string[] }} */
function preflight(backendDir) {
  const problems = [];
  const src = path.join(backendDir, 'src');
  let files = [];
  try { files = jsFiles(src); } catch (e) { problems.push(`cannot read ${src}: ${e.message}`); }
  if (!files.includes(path.join(src, 'server.js'))) problems.push('src/server.js is missing');

  // Compiled in-process with CommonJS module semantics (what node --check does),
  // without running a line of it: spawning one process per file took 16 s for 78.
  for (const f of files) {
    try {
      vm.compileFunction(fs.readFileSync(f, 'utf8'), ['exports', 'require', 'module', '__filename', '__dirname'], { filename: f });
    } catch (e) {
      problems.push(`${path.relative(backendDir, f)} does not parse: ${e.name}: ${e.message}`);
    }
  }

  let deps = {};
  try { deps = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8')).dependencies || {}; }
  catch (e) { problems.push(`package.json unreadable: ${e.message}`); }
  for (const name of Object.keys(deps)) {
    try { require.resolve(name, { paths: [backendDir] }); }
    catch (e) { problems.push(`dependency "${name}" cannot be resolved`); }
  }

  return { ok: problems.length === 0, checked: files.length, problems };
}

module.exports = { preflight };
