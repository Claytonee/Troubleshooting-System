/**
 * Verification — fault codes are unique and never reissued (INT-001).
 *
 * Every intake path used MAX(number)+1: two reports at the same moment got the
 * same code, and deleting the newest fault handed its code to the next one
 * (QFT-0379 was issued three times on 2026-09-24). This drives the real API:
 * 25 reports at once, then a delete and a new report.
 *
 * Runs against a live local server; removes every row it creates. Run from backend/.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
async function api(method, p, { token, body } = {}) {
  const res = await fetch(BASE + '/api' + p, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null; try { json = await res.json(); } catch (e) {}
  return { status: res.status, body: json };
}
const login = async (u, p) => (await fixtures.signIn(u, p, BASE)).token;

(async () => {
  const fx = await fixtures.ensure();
  const [[{ maxNotif }]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS maxNotif FROM admin_notifications');
  const pa = await fixtures.ensurePlatformAdmin();
  const teacher = await login(fx.teacher.username, fx.password);
  const admin = await login(pa.username, pa.password);

  try {
    console.log('\nINT-001  fault codes are unique and never reissued');
    const src = path.join(__dirname, '..', 'src');
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    const minters = walk(src).filter(f => f.endsWith('.js') && !f.endsWith('errorCodes.js')
      && /MAX\(CAST\(SUBSTRING\(error_code/.test(fs.readFileSync(f, 'utf8')));
    ok('no intake path computes MAX()+1 any more — one sequence issues every code', minters.length === 0, minters.map(f => path.relative(src, f)));

    const [idx] = await pool.query("SHOW INDEX FROM errors WHERE Key_name = 'uq_errors_code'");
    ok('errors.error_code carries a unique index', idx.length === 1 && Number(idx[0].Non_unique) === 0, idx.length);

    const burst = await Promise.all(Array.from({ length: 25 }, (_, i) => api('POST', '/errors', { token: teacher, body: {
      title: 'zzverify integrity ' + i, school_id: fx.school.id, category: 'Other', priority: 'low', description: 'fixture'
    } })));
    const codes = burst.map(r => r.body && r.body.error_code);
    ok('25 reports filed at the same moment all succeed', burst.every(r => r.status === 201), burst.map(r => r.status).filter(s => s !== 201));
    ok('...and every one got a different code', new Set(codes).size === 25, codes);

    const ids = burst.map(r => r.body && r.body.id).filter(Boolean);
    const [[newest]] = await pool.query('SELECT id, error_code FROM errors WHERE id IN (?) ORDER BY id DESC LIMIT 1', [ids]);
    const del = await api('DELETE', `/errors/${newest.id}`, { token: admin });
    ok('platform admin deletes the newest fault', del.status === 200, del.status);
    const after = await api('POST', '/errors', { token: teacher, body: {
      title: 'zzverify integrity after delete', school_id: fx.school.id, category: 'Other', priority: 'low', description: 'fixture'
    } });
    ok('the next report does NOT reuse the deleted fault\'s code', after.status === 201 && after.body.error_code !== newest.error_code,
      { deleted: newest.error_code, next: after.body && after.body.error_code });
    const nums = codes.concat(after.body.error_code).map(c => Number(String(c).slice(4)));
    ok('numbering simply continues (QFT-0 + a rising number)', nums.every(n => Number.isInteger(n) && n > 240)
      && Number(String(after.body.error_code).slice(4)) > Math.max(...nums.slice(0, -1)), nums);
  } finally {
    await pool.query(
      `DELETE FROM admin_notifications WHERE id > ? AND (title LIKE '%zzverify%' OR message LIKE '%zzverify%'
         OR CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.school_id')) AS UNSIGNED) = ?)`, [maxNotif, fx.school.id]);
    await fixtures.cleanup();
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed\n  database restored to the state it was found in`);
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async e => { console.error('\nSUITE ERROR:', e.message); try { await fixtures.cleanup(); await pool.end(); } catch (x) {} process.exitCode = 1; });
