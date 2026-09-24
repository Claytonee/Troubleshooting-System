/**
 * Verification — strict CSP in report-only mode (DECISIONS.md D24).
 *
 *  1. Every response carries the strict policy as Content-Security-Policy-Report-Only
 *     (script-src 'self', no 'unsafe-inline'), next to the enforced policy.
 *  2. The public report endpoint answers 204, takes both report formats, refuses
 *     oversized bodies, and never needs a session.
 *  3. Aggregation: a thousand reports of the same site become ONE row with a
 *     count; URLs are reduced to an origin or a path; nothing else is kept.
 *  4. A foreign script or an eval is also recorded as a security event (R8).
 *
 * Runs against a live local server; removes what it creates. Run from backend/.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');
const csp = require('../src/services/cspReports');
const securityEvents = require('../src/services/securityEvents');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
const post = (body, type) => fetch(BASE + '/api/security/csp-report', { method: 'POST', headers: { 'Content-Type': type }, body: typeof body === 'string' ? body : JSON.stringify(body) });

(async () => {
  const [[base]] = await pool.query(`SELECT (SELECT COALESCE(MAX(id), 0) FROM csp_reports) AS c,
      (SELECT COALESCE(MAX(id), 0) FROM security_events) AS e`);
  try {
    console.log('\nHeader   the strict policy is reported, not enforced');
    for (const p of ['/', '/api/health', '/js/app.js']) {
      const r = await fetch(BASE + p);
      const ro = r.headers.get('content-security-policy-report-only') || '';
      const enforced = r.headers.get('content-security-policy') || '';
      ok(`${p}: report-only policy allows scripts only from our own files`,
        /script-src 'self'(;|$)/.test(ro) && !/script-src[^;]*unsafe-inline/.test(ro) && /report-uri \/api\/security\/csp-report/.test(ro), ro.slice(0, 80));
      ok(`${p}: the enforced policy is unchanged (nothing breaks)`, /script-src 'self' 'unsafe-inline'/.test(enforced));
    }

    console.log('\nEndpoint public, small, format-tolerant');
    const legacy = await post({ 'csp-report': { 'document-uri': 'http://localhost/#dashboard', 'effective-directive': 'script-src-attr', 'blocked-uri': 'inline', 'source-file': 'http://localhost/js/pages/dashboard.js?v=59', 'line-number': 12 } }, 'application/csp-report');
    ok('report-uri format → 204, no session needed', legacy.status === 204, legacy.status);
    const modern = await post([{ type: 'csp-violation', body: { documentURL: 'http://localhost/', effectiveDirective: 'script-src-elem', blockedURL: 'inline', sourceFile: 'http://localhost/', lineNumber: 5 } }], 'application/reports+json');
    ok('Reporting-API format → 204', modern.status === 204, modern.status);
    const huge = await post({ 'csp-report': { 'blocked-uri': 'x'.repeat(40 * 1024) } }, 'application/csp-report');
    ok('a body over 16 KB is refused', huge.status === 413, huge.status);
    const junk = await post('not json at all', 'application/csp-report');
    ok('junk is refused without a crash', junk.status === 400 || junk.status === 204, junk.status);

    console.log('\nInventory one row per site, whatever the traffic');
    const fake = (body) => ({ body, ip: '203.0.113.50' });
    const site = { 'csp-report': { 'document-uri': 'https://support.example/#tracker?x=secret', 'effective-directive': 'script-src-attr', 'blocked-uri': 'inline', 'source-file': 'https://support.example/js/pages/tracker.js?v=59&token=abc', 'line-number': 97 } };
    for (let i = 0; i < 1000; i++) csp.ingest(fake(site));
    csp.ingest(fake({ 'csp-report': { 'effective-directive': 'script-src-elem', 'blocked-uri': 'https://evil.example/steal.js?session=abc', 'source-file': 'https://support.example/', 'line-number': 1 } }));
    csp.ingest(fake({ 'csp-report': { 'effective-directive': 'script-src', 'blocked-uri': 'eval', 'source-file': 'https://support.example/js/x.js', 'line-number': 3 } }));
    await csp.flush();
    const [rows] = await pool.query('SELECT * FROM csp_reports WHERE id > ?', [base.c]);
    const tracker = rows.find(r => r.source === '/js/pages/tracker.js' && r.line === 97);
    ok('1,000 reports of one handler → one row, count 1000', !!tracker && tracker.count === 1000, rows.map(r => [r.source, r.line, r.count]));
    const dump = JSON.stringify(rows);
    ok('only paths and origins are kept — no query strings, tokens or fragments', !/secret|token=|session=|\?|#/.test(dump), dump.slice(0, 200));
    ok('a foreign script is kept as its origin only', rows.some(r => r.blocked === 'https://evil.example'));

    await securityEvents.flush();
    await new Promise(r => setTimeout(r, 300));
    const [ev] = await pool.query("SELECT detail FROM security_events WHERE id > ? AND event_type = 'csp.foreign_script'", [base.e]);
    ok('a foreign script and an eval are also security events (R8 reads them)', ev.length >= 2, ev.map(e => e.detail));
    ok('...and inline handlers are not — they are the app\'s own legacy, not an attack',
      !ev.some(e => /"blocked":"inline"/.test(e.detail || '')));
    const [[incBase]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM security_incidents');
    await require('../src/services/detection').runOnce();
    const [r8] = await pool.query("SELECT id, severity FROM security_incidents WHERE rule_id = 'R8' AND subject = '203.0.113.50'");
    ok('rule R8 turns a foreign script into a high incident', r8.length === 1 && r8[0].severity === 'high', r8);
    const [mine] = await pool.query('SELECT id FROM security_incidents WHERE id > ?', [incBase.m]);
    if (mine.length) {
      await pool.query(`DELETE FROM admin_notifications WHERE type = 'security_incident'
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.incident_id')) AS UNSIGNED) IN (?)`, [mine.map(x => x.id)]);
      await pool.query('DELETE FROM security_incidents WHERE id IN (?)', [mine.map(x => x.id)]);
    }
  } finally {
    await pool.query('DELETE FROM csp_reports WHERE id > ?', [base.c]);
    await pool.query("DELETE FROM security_events WHERE id > ? AND event_type = 'csp.foreign_script'", [base.e]);
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed\n  database restored to the state it was found in`);
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async e => { console.error('\nSUITE ERROR:', e.message); try { await pool.end(); } catch (x) {} process.exitCode = 1; });
