/**
 * Utility Functions
 */
function $(id) { return document.getElementById(id); }
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c])); }
function initials(n) { return n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

function ageStr(hours) {
  if (hours == null) return '—';
  const h = parseFloat(hours);
  if (h < 1) return Math.round(h * 60) + 'm';
  if (h < 24) return Math.round(h) + 'h';
  const d = Math.floor(h / 24), rem = Math.round(h % 24);
  return d + 'd' + (rem ? (' ' + rem + 'h') : '');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function relTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (diff < 1) return Math.max(1, Math.round(diff * 60)) + 'm ago';
  if (diff < 24) return Math.round(diff) + 'h ago';
  return Math.round(diff / 24) + 'd ago';
}

/**
 * TIP — Centralized tooltip text constants.
 * Format: "Title · Description" — the title renders bold, description lighter.
 * Usage: data-tip="${TIP.RESOLVE}" or data-tip="${TIP.custom('Title','desc')}"
 * Rule: Only add tooltips to buttons that NEED extra explanation — not obvious ones.
 */
const TIP = {
  // Destructive / consequential actions
  RESOLVE: 'Resolve · Mark this error as fixed — the reporter will be notified',
  ESCALATE: 'Escalate · Forward to the next support level for immediate help',
  ESCALATE_OE: 'Escalate to OE · Forward this error to Opportunity Education platform team for immediate support',
  DELETE: 'Delete · Permanently remove this item — this cannot be undone',
  SUSPEND: 'Suspend · Temporarily disable this account',
  REACTIVATE: 'Reactivate · Restore access for this account',
  DEACTIVATE_LINK: 'Deactivate · Disable this registration link permanently',
  REJECT: 'Reject · Deny access — the user will be notified',
  APPROVE: 'Approve · Grant access — the user can sign in immediately',
  // Actions that benefit from explanation
  EXPORT_CSV: 'Export · Download filtered data as a CSV spreadsheet',
  SUBMIT_REPORT: 'Submit · Send this error for tracking and automatic assignment',
  CHECKIN: 'Check-In · Fill the weekly health report for this school',
  SUBMIT_CHECKIN: 'Submit · Save this weekly check-in report',
  GENERATE_LINK: 'Generate Link · Create a self-registration URL for teachers',
  COPY_LINK: 'Copy · Copy this link to your clipboard',
  ADD_SCHOOL: 'Add School · Register a new school profile in the system',
  ADD_ADMIN: 'Add Admin · Create a new school administrator account',
  ADD_TEACHER: 'Add Teacher · Register a new teacher manually',
  UPLOAD: 'Upload · Add a new file to the resource library',
  ADD_GUIDE: 'Add Guide · Create a new step-by-step troubleshooting guide',
  EDIT_GUIDE: 'Edit Guide · Update this guide\'s title, category, or steps',
  PREVIEW: 'Preview · View this file inline without downloading',
  DOWNLOAD: 'Download · Save this file to your device',
  SAVE_BRANDING: 'Save · Apply your branding customizations system-wide',
  RESET_BRANDING: 'Reset · Restore all branding to default settings',
  RESET_PROGRESS: 'Reset · Start this guide from the beginning',
  ESCALATE_ISSUE: 'Escalate Issue · Email the support team that this guide didn\'t solve your problem',
  NEW_CHAT: 'New Chat · Start a fresh AI conversation',

  custom(title, desc) { return `${title} · ${desc}`; }
};

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

/**
 * SLA state of one error: 'met' | 'breach' | 'ok' | 'unknown'.
 *
 * A resolved error is judged on its own timestamps — closing it a week after
 * the target is a breach, not a pass. It previously returned 'met' for every
 * resolved error unconditionally, which made a missed target impossible to see
 * and left 'breach' reachable only for still-open errors.
 */
function slaState(error) {
  if (error.status === 'resolved') {
    if (!error.resolved_at || !error.sla_due_at) return 'unknown';
    return new Date(error.resolved_at) <= new Date(error.sla_due_at) ? 'met' : 'breach';
  }
  // Prefer the authoritative breach flag computed by the backend (sla_due_at vs now).
  if (error.sla_breached != null) return Number(error.sla_breached) ? 'breach' : 'ok';
  // Fallback heuristic for payloads that don't include sla_breached.
  return parseFloat(error.hours_open) > (SLA[error.priority] || 24) ? 'breach' : 'ok';
}

/** @param {number} [ms] hold longer for messages that carry an instruction. */
function showToast(msg, ms) {
  const t = $('toast');
  $('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), ms || 3200);
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

const Dropdown = (() => {
  let openId = null;

  function render(id, placeholder, items, opts = {}) {
    const defaultVal = opts.defaultValue || '';
    const onSelect = opts.onSelect || '';
    const itemsHtml = items.map(item => {
      const val = typeof item === 'object' ? item.value : item;
      const label = typeof item === 'object' ? item.label : item;
      const tag = typeof item === 'object' ? (item.tag || '') : '';
      const desc = typeof item === 'object' ? (item.desc || '') : '';
      return `<div class="reg-dropdown-item" data-value="${esc(val)}" onclick="Dropdown.select('${id}','${esc(String(val)).replace(/'/g, "\\'")}','${esc(label).replace(/'/g, "\\'")}')">
        <span class="reg-dropdown-name">${esc(label)}${desc ? `<span style="font-size:11px;color:var(--text3);margin-left:6px">${esc(desc)}</span>` : ''}</span>
        ${tag ? `<span class="reg-dropdown-zone">${esc(tag)}</span>` : ''}
      </div>`;
    }).join('');

    const hasDefault = !!defaultVal;
    return `<div style="position:relative" data-dropdown="${id}">
      <input type="hidden" id="${id}" value="${esc(defaultVal)}"${onSelect ? ` data-onselect="${esc(onSelect)}"` : ''}>
      <div class="reg-select" id="${id}-trigger" onclick="Dropdown.toggle('${id}',event)">
        <span class="reg-select-text${hasDefault ? ' selected' : ''}" id="${id}-text">${placeholder}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="reg-select-arrow"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="reg-dropdown" id="${id}-dd" style="display:none">
        <div class="reg-dropdown-search">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="Search..." oninput="Dropdown.filter('${id}',this.value)">
        </div>
        <div class="reg-dropdown-list" id="${id}-list">${itemsHtml}</div>
      </div>
    </div>`;
  }

  function toggle(id, e) {
    e.stopPropagation();
    const dd = document.getElementById(id + '-dd');
    if (!dd) return;
    const isOpen = dd.style.display !== 'none';
    closeAll();
    if (!isOpen) {
      dd.style.display = 'block';
      dd.classList.remove('drop-up', 'drop-side');
      openId = id;
      const trigger = document.getElementById(id + '-trigger');
      const triggerRect = trigger ? trigger.getBoundingClientRect() : null;
      const inModal = !!dd.closest('.modal');

      if (inModal && triggerRect) {
        dd.style.position = 'fixed';
        dd.style.width = triggerRect.width + 'px';
        dd.style.left = triggerRect.left + 'px';
        if (window.innerHeight - triggerRect.bottom < 220) {
          dd.style.top = 'auto';
          dd.style.bottom = (window.innerHeight - triggerRect.top + 4) + 'px';
        } else {
          dd.style.top = (triggerRect.bottom + 4) + 'px';
          dd.style.bottom = 'auto';
        }
      } else {
        dd.style.position = '';
        dd.style.width = '';
        dd.style.left = '';
        dd.style.top = '';
        dd.style.bottom = '';
        const card = dd.closest('.card') || dd.closest('.form-grid');
        const cardRect = card ? card.getBoundingClientRect() : null;
        const spaceRight = cardRect ? window.innerWidth - cardRect.right : 0;
        if (spaceRight > 290) {
          dd.classList.add('drop-side');
        } else if (triggerRect && window.innerHeight - triggerRect.bottom < 220) {
          dd.classList.add('drop-up');
        }
      }
      const input = dd.querySelector('input[type="text"]');
      if (input) { input.value = ''; filter(id, ''); input.focus(); }
    }
  }

  function closeAll() {
    document.querySelectorAll('.reg-dropdown').forEach(d => {
      d.style.display = 'none';
      d.style.position = '';
      d.style.width = '';
      d.style.left = '';
      d.style.top = '';
      d.style.bottom = '';
    });
    openId = null;
  }

  function filter(id, query) {
    const list = document.getElementById(id + '-list');
    if (!list) return;
    const q = query.toLowerCase();
    list.querySelectorAll('.reg-dropdown-item').forEach(item => {
      item.style.display = item.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
    });
  }

  function select(id, value, label) {
    const hidden = document.getElementById(id);
    const text = document.getElementById(id + '-text');
    if (hidden) hidden.value = value;
    if (text) { text.textContent = label; text.classList.add('selected'); }
    closeAll();
    if (hidden && hidden.dataset.onselect) {
      try { eval(hidden.dataset.onselect); } catch (e) {}
    }
  }

  function updateItems(id, items) {
    const list = document.getElementById(id + '-list');
    const text = document.getElementById(id + '-text');
    const hidden = document.getElementById(id);
    if (!list) return;
    list.innerHTML = items.map(item => {
      const val = typeof item === 'object' ? item.value : item;
      const label = typeof item === 'object' ? item.label : item;
      const tag = typeof item === 'object' ? (item.tag || '') : '';
      return `<div class="reg-dropdown-item" data-value="${esc(val)}" onclick="Dropdown.select('${id}','${esc(String(val)).replace(/'/g, "\\'")}','${esc(label).replace(/'/g, "\\'")}')">
        <span class="reg-dropdown-name">${esc(label)}</span>
        ${tag ? `<span class="reg-dropdown-zone">${esc(tag)}</span>` : ''}
      </div>`;
    }).join('');
    if (text) { text.textContent = items.length ? text.dataset.placeholder || 'Select...' : 'None available'; text.classList.remove('selected'); }
    if (hidden) hidden.value = '';
  }

  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  document.addEventListener('click', (e) => {
    if (openId) {
      const dd = document.getElementById(openId + '-dd');
      const trigger = document.getElementById(openId + '-trigger');
      if (dd && trigger && !trigger.contains(e.target) && !dd.contains(e.target)) closeAll();
    }
  });

  return { render, toggle, filter, select, closeAll, updateItems, getValue };
})();

const Tooltip = (() => {
  let activeEl = null;
  let tipEl = null;

  function show(target) {
    if (activeEl === target) return;
    hide();
    const text = target.getAttribute('data-tip');
    if (!text) return;
    activeEl = target;

    tipEl = document.createElement('div');
    tipEl.className = 'tooltip-card';
    const color = target.getAttribute('data-tip-color') || '';
    if (color) tipEl.classList.add('tip-' + color);

    const parts = text.split(' · ');
    if (parts.length > 1) {
      tipEl.innerHTML = `<div class="tip-title">${esc(parts[0])}</div><div class="tip-desc">${esc(parts.slice(1).join(' · '))}</div>`;
    } else {
      tipEl.innerHTML = `<div class="tip-desc">${esc(text)}</div>`;
    }

    document.body.appendChild(tipEl);
    position(target);
    requestAnimationFrame(() => tipEl && tipEl.classList.add('visible'));
  }

  function position(target) {
    if (!tipEl) return;
    const r = target.getBoundingClientRect();
    const tw = tipEl.offsetWidth;
    const th = tipEl.offsetHeight;
    let top = r.top - th - 12;
    let left = r.left + (r.width / 2) - (tw / 2);
    if (top < 8) top = r.bottom + 12;
    if (left < 8) left = 8;
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    tipEl.style.top = top + 'px';
    tipEl.style.left = left + 'px';
  }

  function hide() {
    if (tipEl) { tipEl.remove(); tipEl = null; }
    activeEl = null;
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el) show(el); else hide();
  });
  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el && !el.contains(e.relatedTarget)) hide();
  });
  document.addEventListener('scroll', hide, true);

  return { show, hide };
})();
