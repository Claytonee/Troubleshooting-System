/**
 * Utility Functions
 */
function $(id) { return document.getElementById(id); }
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function initials(n) { return n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

function ageStr(hours) {
  if (hours == null) return '—';
  const h = parseFloat(hours);
  if (h < 1) return Math.round(h * 60) + 'm';
  if (h < 24) return Math.round(h) + 'h';
  const d = Math.floor(h / 24), rem = Math.round(h % 24);
  return d + 'd' + (rem ? (' ' + rem + 'h') : '');
}

function relTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (diff < 1) return Math.max(1, Math.round(diff * 60)) + 'm ago';
  if (diff < 24) return Math.round(diff) + 'h ago';
  return Math.round(diff / 24) + 'd ago';
}

const PRI = {
  critical: { label: 'Critical', badge: 'badge-red', dot: 'dot-red' },
  high: { label: 'High', badge: 'badge-amber', dot: 'dot-amber' },
  medium: { label: 'Medium', badge: 'badge-blue', dot: 'dot-blue' },
  low: { label: 'Low', badge: 'badge-green', dot: 'dot-green' }
};

const STAT = {
  open: { label: 'Open', badge: 'badge-red' },
  progress: { label: 'In Progress', badge: 'badge-amber' },
  escalated: { label: 'Escalated', badge: 'badge-purple' },
  resolved: { label: 'Resolved', badge: 'badge-green' }
};

// SLA response/resolution targets in HOURS — must match backend config/schemaExtensions.js
const SLA = { critical: 4, high: 24, medium: 72, low: 168 };

const CAT_META = {
  Connectivity: { ic: 'ti-wifi-off', color: 'var(--amber)' },
  Hardware: { ic: 'ti-device-laptop', color: 'var(--red)' },
  Platform: { ic: 'ti-apps', color: 'var(--accent)' },
  Power: { ic: 'ti-bolt', color: 'var(--purple)' },
  Accounts: { ic: 'ti-user-x', color: 'var(--teal)' },
  Other: { ic: 'ti-dots', color: 'var(--text2)' }
};

const SUBCATS = {
  Connectivity: ['WiFi router down', 'Slow internet', 'No internet access', 'LRS unreachable', 'Switch fault'],
  Hardware: ['Tablet not charging', 'Tablet screen broken', "Laptop won't start", 'Projector fault', 'Keyboard/mouse', 'Printer issue'],
  Platform: ['Quest login failure', 'Quest app crash', 'Slow platform', 'Content not loading', 'Teacher dashboard error'],
  Power: ['No electricity', 'Generator failure', 'Socket fault', 'UPS/battery backup', 'Surge damage'],
  Accounts: ['Student login', 'Teacher login', 'Password reset', 'Account locked', 'New account needed'],
  Other: ['Other issue']
};

function slaState(error) {
  if (error.status === 'resolved') return 'met';
  // Prefer the authoritative breach flag computed by the backend (sla_due_at vs now).
  if (error.sla_breached != null) return Number(error.sla_breached) ? 'breach' : 'ok';
  // Fallback heuristic for payloads that don't include sla_breached.
  return parseFloat(error.hours_open) > (SLA[error.priority] || 24) ? 'breach' : 'ok';
}

function showToast(msg) {
  const t = $('toast');
  $('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3200);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
