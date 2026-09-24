/**
 * Verification — a client cannot choose the address it is recorded as (SEC-015, D28).
 *
 * Production's proxy passes a client-sent X-Forwarded-For through as the client
 * address (measured 2026-09-24). A clean request reaches the app with ONE
 * address; a request that sent its own reaches it with several. These checks
 * send the production shapes to the local server:
 *
 *   1. one address → attributed to it (unchanged behaviour);
 *   2. several → attributed to 0.0.0.0 and marked claimed, whatever they say;
 *   3. rotating made-up addresses on a rate-limited route no longer buys a
 *      fresh allowance each time — they share one bucket;
 *   4. the security event for a refused request records 0.0.0.0 with a
 *      constant flag, not the claim, and repeats with new claims fold into one row.
 *
 * Needs the local server. Removes the events it causes.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');
const securityEvents = require('../src/services/securityEvents');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3210';
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
// What production's proxy delivers when the client sent `X-Forwarded-For: <ip>`.
const claimed = (ip) => ({ 'X-Forwarded-For': `${ip}, ${ip},${ip}` });
const seenAs = async (headers = {}) => (await fetch(BASE + '/api/security/seen-as', { headers })).json();

(async () => {
  const [[base]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM security_events');
  try {
    console.log('\nAttribute one address is the proxy\'s; several are the client\'s claim');
    const clean = await seenAs({ 'X-Forwarded-For': '197.186.57.130' });
    ok('a single forwarded address is used as given (what the proxy writes for a clean request)', clean.ip === '197.186.57.130' && clean.claimed === false, clean);
    const forged = await seenAs(claimed('203.0.113.77'));
    ok('a client-supplied address is NOT believed — attributed to 0.0.0.0 and marked claimed', forged.ip === '0.0.0.0' && forged.claimed === true, forged);
    const forged2 = await seenAs({ 'X-Forwarded-For': '203.0.113.77, 198.51.100.9, 203.0.113.77, 198.51.100.9,203.0.113.77' });
    ok('a longer forged chain is not believed either', forged2.ip === '0.0.0.0', forged2);
    const direct = await seenAs();
    ok('a request with no header keeps its connection address', direct.ip !== '0.0.0.0' && direct.claimed === false, direct);

    console.log('\nLimits  made-up addresses share one allowance');
    // Registration allows 5 per 15 minutes per address. With a new made-up address
    // every time, the old code gave each attempt a fresh allowance and never refused.
    let refusedAt = 0;
    for (let i = 1; i <= 8 && !refusedAt; i++) {
      const r = await fetch(BASE + '/api/register/school-admin', { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...claimed(`198.51.100.${10 + i}`) }, body: '{}' });
      if (r.status === 429) refusedAt = i;
    }
    ok('rotating the claimed address is refused within the normal allowance (≤ 6 attempts)', refusedAt > 0 && refusedAt <= 6, refusedAt || 'never refused');

    console.log('\nEvidence the claim is flagged, not believed, and cannot bloat the table');
    for (const ip of ['203.0.113.1', '203.0.113.2', '203.0.113.3']) {
      await fetch(BASE + '/api/auth/profile', { headers: { ...claimed(ip), Authorization: 'Bearer not-a-token' } });
    }
    await securityEvents.flush();
    await new Promise(r => setTimeout(r, 2600));   // the server's recorder flushes every 2 s
    const [rows] = await pool.query(
      "SELECT source_ip, detail, count FROM security_events WHERE id > ? AND event_type = 'auth.token_rejected'", [base.m]);
    const claimedRows = rows.filter(r => r.source_ip === '0.0.0.0');
    ok('a refused request with a made-up address is recorded as 0.0.0.0', claimedRows.length >= 1, rows);
    ok('...flagged as claimed', claimedRows.length >= 1 && claimedRows.every(r => /"ip_claimed":true/.test(r.detail || '')));
    ok('...and none of the made-up addresses was stored anywhere', !rows.some(r => /203\.0\.113\.[123]/.test(String(r.source_ip) + (r.detail || ''))));
    ok('three different made-up addresses fold into ONE row (count 3)', claimedRows.length === 1 && claimedRows[0].count >= 3, claimedRows.map(r => r.count));
  } finally {
    // Everything this suite can cause: the unknown address, and the documentation
    // ranges (RFC 5737) it claims — which the unfixed code stored as if they were real.
    await pool.query("DELETE FROM security_events WHERE id > ? AND (source_ip IN ('0.0.0.0', '197.186.57.130') OR source_ip LIKE '203.0.113.%' OR source_ip LIKE '198.51.100.%')", [base.m]);
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed\n  events this suite caused removed`);
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async e => { console.error('\nSUITE ERROR:', e.message); try { await pool.end(); } catch (x) {} process.exitCode = 1; });
