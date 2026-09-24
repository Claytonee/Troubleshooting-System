const crypto = require('crypto');

/**
 * Two-step sign-in — TOTP (RFC 6238) on Node's own crypto. SEC-007, DECISIONS.md D4.
 *
 * No dependency: TOTP is HMAC-SHA1 over a 30-second counter (RFC 4226 dynamic
 * truncation), and base32 is RFC 4648. The implementation is checked against the
 * RFC 6238 appendix B test vectors in verify-mfa.js, not just against itself.
 *
 * The shared secret is encrypted at rest with AES-256-GCM, so a leaked database
 * or a downloaded backup (RECOVERY.md encourages monthly downloads) does not also
 * hand out everyone's second factor. The key is MFA_ENCRYPTION_KEY when set,
 * otherwise derived from JWT_SECRET with HKDF — and rotating JWT_SECRET then means
 * re-enrolling, which INCIDENT_RESPONSE.md says.
 */

const STEP = 30;          // seconds per code
const DIGITS = 6;
const WINDOW = 1;         // accept one step either side: phone clocks drift
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('invalid base32');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** HOTP (RFC 4226) for one counter value. `algo` is for the RFC 6238 vectors only. */
function hotp(key, counter, digits = DIGITS, algo = 'sha1') {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac(algo, key).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

const stepAt = (ms = Date.now()) => Math.floor(ms / 1000 / STEP);

/** 20 random bytes (160 bits, RFC 4226's recommendation), base32 for the authenticator. */
function generateSecret() { return base32Encode(crypto.randomBytes(20)); }

/** The otpauth:// URI an authenticator app reads from the QR code. */
function otpauthUri(secret, account, issuer = 'OE Technical Support') {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}

/**
 * Check a code. Returns the time step it matched, or null. The caller stores
 * that step and refuses any code at or before it next time — a code works once.
 */
function verify(secret, code, lastStep = null, now = Date.now()) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const key = base32Decode(secret);
  const current = stepAt(now);
  for (let d = -WINDOW; d <= WINDOW; d++) {
    const step = current + d;
    if (lastStep != null && step <= Number(lastStep)) continue;          // replay
    const expected = hotp(key, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return step;
  }
  return null;
}

// ---- secret at rest ---------------------------------------------------------
function key() {
  const explicit = process.env.MFA_ENCRYPTION_KEY;
  if (explicit) return crypto.createHash('sha256').update(explicit).digest();
  if (!process.env.JWT_SECRET) throw new Error('MFA needs MFA_ENCRYPTION_KEY or JWT_SECRET');
  return Buffer.from(crypto.hkdfSync('sha256', process.env.JWT_SECRET, 'oe-mfa-salt', 'mfa-secret-v1', 32));
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

function decrypt(blob) {
  const [v, iv, tag, enc] = String(blob || '').split('.');
  if (v !== 'v1') throw new Error('unknown secret format');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}

// ---- recovery codes -----------------------------------------------------------
/** Ten one-time codes like "k7m2-9xq4-p3w8". High entropy, so SHA-256 is the right hash. */
function recoveryCodes(n = 10) {
  const alpha = 'abcdefghjkmnpqrstuvwxyz23456789';     // no 0/o, 1/l/i
  return Array.from({ length: n }, () => {
    const b = crypto.randomBytes(12);
    const s = Array.from(b, x => alpha[x % alpha.length]).join('');
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
  });
}
const hashCode = (code) => crypto.createHash('sha256').update(String(code).toLowerCase().replace(/[^a-z0-9]/g, '')).digest('hex');

module.exports = {
  generateSecret, otpauthUri, verify, encrypt, decrypt, recoveryCodes, hashCode,
  // for the RFC test vectors and tests
  hotp, base32Encode, base32Decode, stepAt, STEP
};
