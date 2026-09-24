/**
 * The endpoint inventory (docs/engineering/security-program/API_SECURITY_MATRIX.md),
 * generated from the routers so it cannot quietly drift from the code.
 *
 *   node scripts/api-matrix.js --check   exit 1 if a route, its auth or its role gate
 *                                         differs from the committed matrix
 *   node scripts/api-matrix.js --write   regenerate the table, keeping every Notes cell
 *
 * An inventory nobody can trust is worse than none: NIST CSF 2.0 "Identify" is only
 * met while this check passes. Run from backend/.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const DOC = path.join(__dirname, '..', '..', 'docs', 'engineering', 'security-program', 'API_SECURITY_MATRIX.md');

function scan() {
  const server = fs.readFileSync(path.join(SRC, 'server.js'), 'utf8');
  const mounts = {};
  for (const m of server.matchAll(/app\.use\('([^']+)',\s*(\w+)\)/g)) mounts[m[2]] = m[1];
  const reqs = {};
  for (const m of server.matchAll(/const (\w+) = require\('\.\/routes\/(\w+)'\)/g)) reqs[m[2]] = m[1];

  const rows = [];
  for (const f of fs.readdirSync(path.join(SRC, 'routes'))) {
    const base = mounts[reqs[f.replace('.js', '')]];
    if (!base) continue;
    const src = fs.readFileSync(path.join(SRC, 'routes', f), 'utf8');
    const re = /router\.(get|post|put|patch|delete)\('([^']+)'([\s\S]*?)(?=\nrouter\.|\nmodule\.exports)/g;
    let m;
    while ((m = re.exec(src))) {
      const [, method, p, rest] = m;
      const before = src.slice(0, m.index);
      const useAuth = /router\.use\([^)]*authenticate/.test(before);
      const own = (rest.match(/authorize\(([^)]*)\)/) || [])[1];
      const inherited = (before.match(/router\.use\([^)]*authorize\(([^)]*)\)/g) || []).pop();
      let roles = own ? own : inherited ? inherited.match(/authorize\(([^)]*)\)/)[1]
        : (/router\.use\(adminOnly\)/.test(before) ? "'admin'" : null);
      roles = roles ? roles.replace(/'/g, '').replace(/\s/g, '') : null;
      let auth = (/authenticate/.test(rest) || useAuth) ? 'JWT' : '—';
      const key = rest.match(/requireSecret\('(\w+)'/);
      if (key) auth = 'key: ' + key[1];
      if (/requireInventoryWrite/.test(rest)) roles = (roles ? roles + ' ' : '') + 'inventory-write capability';
      const full = (base + (p === '/' ? '' : p)).replace(/\/\//g, '/');
      rows.push({ method: method.toUpperCase(), route: full, auth, gate: roles || (auth === 'JWT' ? 'any signed-in' : 'public') });
    }
  }
  // Declared in server.js rather than a router.
  rows.push({ method: 'GET', route: '/api/health', auth: '—', gate: 'public' });
  rows.push({ method: 'POST', route: '/api/deploy', auth: 'HMAC: WEBHOOK_SECRET', gate: 'GitHub webhook' });
  rows.sort((a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method));
  return rows;
}

/** Rows of the committed table: method, route, auth, gate, notes. */
function parseDoc(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^\| (GET|POST|PUT|PATCH|DELETE) \| `([^`]+)` \| ([^|]*) \| ([^|]*) \| (.*) \|$/);
    if (m) out.push({ method: m[1], route: m[2], auth: m[3].trim(), gate: m[4].trim(), notes: m[5].trim() });
  }
  return out;
}

const k = r => `${r.method} ${r.route}`;
const sig = r => `${r.auth} | ${r.gate}`;

function main() {
  const mode = process.argv[2];
  const code = scan();
  const md = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
  const doc = parseDoc(md);
  const docBy = new Map(doc.map(r => [k(r), r]));
  const codeBy = new Map(code.map(r => [k(r), r]));

  if (mode === '--write') {
    const head = md.split(/\r?\n\| Method \| Route/)[0].replace(/\*\*\d+ endpoints\.\*\*/, `**${code.length} endpoints.**`);
    const tail = md.includes('\n## Public surface') ? md.slice(md.indexOf('\n## Public surface')) : '';
    const table = ['| Method | Route | Auth | Role gate | Notes |', '|---|---|---|---|---|']
      .concat(code.map(r => `| ${r.method} | \`${r.route}\` | ${r.auth} | ${r.gate} | ${(docBy.get(k(r)) || {}).notes || ''} |`));
    fs.writeFileSync(DOC, head.replace(/\s*$/, '\n\n') + table.join('\n') + '\n' + tail);
    console.log(`API_SECURITY_MATRIX.md written: ${code.length} endpoints.`);
    return;
  }

  const problems = [];
  for (const r of code) {
    const d = docBy.get(k(r));
    if (!d) problems.push(`NEW, not in the matrix:  ${k(r)}  [${sig(r)}]`);
    else if (sig(d) !== sig(r)) problems.push(`CHANGED: ${k(r)}  matrix [${sig(d)}]  code [${sig(r)}]`);
  }
  for (const d of doc) if (!codeBy.has(k(d))) problems.push(`GONE from the code:     ${k(d)}`);
  const claimed = (md.match(/\*\*(\d+) endpoints\.\*\*/) || [])[1];
  if (claimed && Number(claimed) !== code.length) problems.push(`Header says ${claimed} endpoints; the code has ${code.length}.`);

  if (problems.length) {
    console.log(`API matrix is out of date (${problems.length}):\n  ` + problems.join('\n  '));
    console.log('\nReview each change for its security gate, then: node scripts/api-matrix.js --write');
    process.exitCode = 1;
  } else {
    console.log(`API matrix matches the code: ${code.length} endpoints.`);
  }
}

main();
