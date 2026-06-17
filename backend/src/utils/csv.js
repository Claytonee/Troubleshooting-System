/**
 * Minimal, dependency-free CSV encoder (RFC 4180-ish).
 * @param {object[]} rows
 * @param {{key:string,label:string}[]} columns
 */
function toCsv(rows, columns) {
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(',')).join('\r\n');
  // Leading BOM so Excel opens UTF-8 (Swahili names) correctly.
  return '﻿' + header + '\r\n' + body + (rows.length ? '\r\n' : '');
}

module.exports = { toCsv };
