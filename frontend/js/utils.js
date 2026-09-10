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

/**
 * Subjects and departments in a Tanzanian secondary school, grouped as the
 * schools themselves group them.
 *
 * Typed freely, the same subject arrived as "Maths", "MATHEMATICS", "math" and
 * "Mathematics/Physics", which makes "how many science teachers are there"
 * unanswerable. One list, used by both the public registration form and the
 * school admin's add-teacher form, so the two can never drift apart.
 * "Other" stays, with a free-text box: a list that cannot express a real
 * teacher's post just gets the nearest wrong answer picked.
 */
const TEACHER_SUBJECTS = [
  ['Sciences', ['Mathematics', 'Basic Mathematics', 'Advanced Mathematics', 'Physics', 'Chemistry', 'Biology', 'Agriculture']],
  ['Languages', ['Kiswahili', 'English Language', 'English Literature', 'French', 'Arabic']],
  ['Humanities', ['History', 'Geography', 'Civics', 'General Studies', 'Divinity / Religious Studies']],
  ['Business & ICT', ['Computer Studies / ICT', 'Commerce', 'Book-keeping', 'Accountancy', 'Economics']],
  ['Vocational & Arts', ['Fine Art', 'Music', 'Physical Education', 'Home Economics', 'Technical Drawing']],
  ['School roles', ['Academic Master / Mistress', 'Head of Department', 'ICT Coordinator', 'Librarian', 'Laboratory Technician']]
];

/** The flat set, for deciding whether a stored value is a list value. */
const TEACHER_SUBJECT_VALUES = TEACHER_SUBJECTS.reduce((all, [, subjects]) => all.concat(subjects), []);

/**
 * <option>s for a subject picker, with `selected` preselected. A value that is
 * not on the list (an older record, or an "Other" entry) is kept as its own
 * option so opening the form never silently rewrites what is on file.
 */
function subjectOptions(selected) {
  const known = TEACHER_SUBJECT_VALUES.includes(selected);
  const groups = TEACHER_SUBJECTS.map(([group, subjects]) => `<optgroup label="${esc(group)}">` +
    subjects.map(s => `<option value="${esc(s)}"${s === selected ? ' selected' : ''}>${esc(s)}</option>`).join('') +
    '</optgroup>').join('');
  const custom = selected && !known
    ? `<option value="${esc(selected)}" selected>${esc(selected)}</option>`
    : '';
  return `<option value=""${selected ? '' : ' selected'}>Select subject or department…</option>${groups}${custom}<option value="__other">Other (type it in)…</option>`;
}

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
/**
 * How a ticket reached the system, when that changes what the engineer should
 * do. A machine-opened ticket has no reporter to call back, and an unverified
 * WhatsApp sender's identity has not been established — both worth knowing
 * before picking up the phone. Web reports are the norm and go unlabelled.
 */
/**
 * How this fault arrived, said plainly on the detail view.
 *
 * "Sender not verified" is not decoration: a phone number is not authentication,
 * so a fault filed from an unrecognised number may be about a school the caller
 * has nothing to do with. Whoever picks it up has to know that before they drive.
 */
const INTAKE_CHANNELS = {
  whatsapp: { icon: 'ti-brand-whatsapp', label: 'WhatsApp' },
  ussd:     { icon: 'ti-device-mobile-message', label: 'USSD (simu ya kawaida)' },
  sms:      { icon: 'ti-message-2', label: 'SMS' }
};

function intakeLabel(e) {
  if (e.auto_source) {
    return ' · <span style="color:var(--purple)"><i class="ti ti-activity-heartbeat" style="font-size:12px;vertical-align:-1px"></i> detected automatically</span>';
  }
  const channel = INTAKE_CHANNELS[e.intake_channel];
  if (!channel) return '';
  const unverified = String(e.reporter_role || '').endsWith('-unverified');
  const colour = unverified ? 'var(--amber)' : 'var(--green)';
  const suffix = unverified ? ' · sender not verified' : '';
  return ` · <span style="color:${colour}"><i class="ti ${channel.icon}" style="font-size:12px;vertical-align:-1px"></i> ${channel.label}${suffix}</span>`;
}

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

/**
 * The rectangle this panel may actually occupy: the viewport, narrowed by every
 * ancestor that clips.
 *
 * Placement used to be decided against `window.innerWidth` and the card's right
 * edge, which says nothing about whether the panel is *visible*. The report form's
 * card is `overflow:hidden` (the upload overlay needs it), so the side panel of the
 * one dropdown in the grid's right-hand column — Sub-category — opened 300px past
 * the card's edge, into nothing. Worse, focusing its search box made the browser
 * scroll that hidden card sideways to reach it: `card.scrollLeft` jumped to 300 and
 * the whole form slid out from under its own labels (reported 2026-09-10).
 */
function clipBox(el) {
  let box = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/^(visible)$/.test(cs.overflowX) && /^(visible)$/.test(cs.overflowY)) continue;
    const r = p.getBoundingClientRect();
    box = {
      left: Math.max(box.left, r.left), top: Math.max(box.top, r.top),
      right: Math.min(box.right, r.right), bottom: Math.min(box.bottom, r.bottom)
    };
  }
  return box;
}

const Dropdown = (() => {
  let openId = null;

  /**
   * What to run when a value is picked, keyed by dropdown id.
   *
   * `onSelect` used to be a *string* of JavaScript, stashed in `data-onselect`
   * and run with `eval()` inside a `catch (e) {}`. The Content-Security-Policy
   * this app sends is `script-src 'self' 'unsafe-inline'` — no `'unsafe-eval'` —
   * so every one of those calls threw `EvalError` and the empty catch ate it.
   * Silently: picking a Category never filled Sub-category, the inventory
   * filters never filtered, the week picker never changed the week (found
   * 2026-09-10). A function reference needs no eval and cannot be blocked.
   */
  const handlers = {};

  // .reg-dropdown.drop-side is 280px wide and sits 40px to the right of the field;
  // 220px is the panel at its tallest (search box + a full list).
  const SIDE_W = 280, SIDE_GAP = 40, PANEL_H = 220;


  function render(id, placeholder, items, opts = {}) {
    const defaultVal = opts.defaultValue || '';
    if (typeof opts.onSelect === 'function') {
      handlers[id] = opts.onSelect;
    } else {
      delete handlers[id];
      if (opts.onSelect) console.error(`Dropdown "${id}": onSelect must be a function — a string cannot be run under this CSP.`);
    }
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
      <input type="hidden" id="${id}" value="${esc(defaultVal)}">
      <div class="reg-select" id="${id}-trigger" onclick="Dropdown.toggle('${id}',event)">
        <span class="reg-select-text${hasDefault ? ' selected' : ''}" id="${id}-text" data-placeholder="${esc(placeholder)}">${placeholder}</span>
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
        if (triggerRect) {
          const clip = clipBox(dd);
          const fitsSide = triggerRect.right + SIDE_GAP + SIDE_W <= clip.right
                        && triggerRect.top + PANEL_H <= clip.bottom;
          const fitsBelow = triggerRect.bottom + 4 + PANEL_H <= clip.bottom;
          const fitsAbove = triggerRect.top - 4 - PANEL_H >= clip.top;
          if (fitsSide) dd.classList.add('drop-side');
          else if (!fitsBelow && fitsAbove) dd.classList.add('drop-up');
        }
      }
      const input = dd.querySelector('input[type="text"]');
      if (input) { input.value = ''; filter(id, ''); input.focus({ preventScroll: true }); }
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
    const fn = handlers[id];
    if (fn) fn(value, label);
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

/**
 * A date field that belongs to this system.
 *
 * `<input type="date">` renders whatever the operating system feels like: on
 * Windows Chrome a small light-grey calendar that ignores every variable in
 * `variables.css`, opens *outside* its own modal, and covers the rest of the
 * form behind it. On the Plan a visit modal that meant the calendar hid the
 * Notes field and the buttons — "I cannot see the part where I plan"
 * (reported 2026-09-10).
 *
 * So: our own calendar, in our own colours, that cannot escape the page.
 *
 * The value still lives in a **hidden input carrying the same `id` (and `name`)**
 * the native input had, so `document.getElementById('visit-date').value` and
 * `new FormData(form)` keep working untouched — the callers did not change.
 *
 * Two modes. `inline: true` draws the calendar in the flow of the form, for a
 * short modal where covering a field is the whole complaint. Otherwise it is a
 * popup, positioned `fixed` so no `overflow:hidden` ancestor can clip it, and
 * closed by a scroll rather than left floating away from its field.
 *
 * Dates are handled as `YYYY-MM-DD` strings and compared as strings, which for
 * that format is the same as comparing dates. Nothing here goes through
 * `new Date(iso)` and back: `toISOString()` is UTC, so in Tanzania (UTC+3) it
 * reports yesterday for the first three hours of every day.
 */
const DatePicker = (() => {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const state = {};
  let openId = null;

  const pad = n => String(n).padStart(2, '0');

  /** Today, from the local clock. Never `toISOString()` — see the note above. */
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** `days` from today, local. Used for "tomorrow" without a timezone bug. */
  function offset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parse(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
  }

  /** "Fri 11 Sept 2026" — the same shape the visit list already prints. */
  function format(iso) {
    const p = parse(iso);
    if (!p) return '';
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(p.y, p.m, p.d).getDay()];
    return `${dow} ${p.d} ${MON_SHORT[p.m]} ${p.y}`;
  }

  function render(id, opts = {}) {
    const value = opts.value || '';
    const p = parse(value) || parse(opts.min) || parse(today());
    state[id] = {
      y: p.y, m: p.m, value,
      min: opts.min || '', max: opts.max || '',
      clearable: opts.clearable !== false && !opts.required,
      inline: !!opts.inline,
      onChange: typeof opts.onChange === 'function' ? opts.onChange : null,
      view: 'days'
    };
    const nameAttr = opts.name ? ` name="${esc(opts.name)}"` : '';
    const hidden = `<input type="hidden" id="${id}"${nameAttr} value="${esc(value)}">`;

    if (state[id].inline) {
      return `<div class="dp dp-inline" data-datepicker="${id}">${hidden}
        <div class="dp-panel dp-static" id="${id}-panel">${panelHtml(id)}</div>
      </div>`;
    }
    return `<div class="dp" data-datepicker="${id}">${hidden}
      <div class="dp-field" id="${id}-field" onclick="DatePicker.toggle('${id}',event)">
        <span class="dp-text${value ? ' has' : ''}" id="${id}-text" data-placeholder="${esc(opts.placeholder || 'Choose a date')}">${value ? esc(format(value)) : esc(opts.placeholder || 'Choose a date')}</span>
        <i class="ti ti-calendar-event dp-icon"></i>
      </div>
      <div class="dp-panel" id="${id}-panel" style="display:none">${panelHtml(id)}</div>
    </div>`;
  }

  function panelHtml(id) {
    const s = state[id];
    if (!s) return '';
    return s.view === 'months' ? monthsHtml(id) : daysHtml(id);
  }

  function head(id, title, sub) {
    return `<div class="dp-head">
      <button type="button" class="dp-nav" onclick="DatePicker.step('${id}',-1,event)" title="Previous"><i class="ti ti-chevron-left"></i></button>
      <button type="button" class="dp-title" onclick="DatePicker.flip('${id}',event)">${esc(title)}<i class="ti ti-chevron-down" style="font-size:12px;margin-left:5px"></i></button>
      <button type="button" class="dp-nav" onclick="DatePicker.step('${id}',1,event)" title="Next"><i class="ti ti-chevron-right"></i></button>
    </div>${sub || ''}`;
  }

  function daysHtml(id) {
    const s = state[id];
    const sel = s.value || '';
    const now = today();
    const first = new Date(s.y, s.m, 1);
    const lead = (first.getDay() + 6) % 7;              // Monday-first: how the week is read here
    const start = new Date(s.y, s.m, 1 - lead);

    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const out = d.getMonth() !== s.m;
      const disabled = (s.min && iso < s.min) || (s.max && iso > s.max);
      const cls = ['dp-day', out ? 'other' : '', iso === now ? 'today' : '', iso === sel ? 'sel' : '', disabled ? 'dis' : ''].filter(Boolean).join(' ');
      cells += disabled
        ? `<span class="${cls}">${d.getDate()}</span>`
        : `<button type="button" class="${cls}" onclick="DatePicker.pick('${id}','${iso}',event)">${d.getDate()}</button>`;
    }

    const dow = `<div class="dp-dow">${DOW.map(d => `<span>${d}</span>`).join('')}</div>`;
    const todayBlocked = (s.min && now < s.min) || (s.max && now > s.max);
    return head(id, `${MONTHS[s.m]} ${s.y}`, dow) +
      `<div class="dp-grid">${cells}</div>
      <div class="dp-foot">
        ${s.clearable ? `<button type="button" class="dp-act" onclick="DatePicker.pick('${id}','',event)">Clear</button>` : '<span></span>'}
        ${todayBlocked ? '<span></span>' : `<button type="button" class="dp-act accent" onclick="DatePicker.pick('${id}','${now}',event)">Today</button>`}
      </div>`;
  }

  function monthsHtml(id) {
    const s = state[id];
    const sel = parse(s.value);
    const cells = MONTHS.map((name, i) => {
      // A month is out of range only when *every* day in it is.
      const last = new Date(s.y, i + 1, 0).getDate();
      const disabled = (s.min && `${s.y}-${pad(i + 1)}-${pad(last)}` < s.min) || (s.max && `${s.y}-${pad(i + 1)}-01` > s.max);
      const cls = ['dp-mon', sel && sel.y === s.y && sel.m === i ? 'sel' : '', disabled ? 'dis' : ''].filter(Boolean).join(' ');
      return disabled
        ? `<span class="${cls}">${MON_SHORT[i]}</span>`
        : `<button type="button" class="${cls}" onclick="DatePicker.setMonth('${id}',${i},event)">${MON_SHORT[i]}</button>`;
    }).join('');
    return head(id, String(s.y), '') + `<div class="dp-months">${cells}</div>`;
  }

  function repaint(id) {
    const panel = document.getElementById(id + '-panel');
    if (panel) panel.innerHTML = panelHtml(id);
  }

  /** Chevrons move a month in the day view, a year in the month view. */
  function step(id, dir, e) {
    if (e) e.stopPropagation();
    const s = state[id];
    if (!s) return;
    if (s.view === 'months') { s.y += dir; }
    else {
      s.m += dir;
      if (s.m < 0) { s.m = 11; s.y--; }
      else if (s.m > 11) { s.m = 0; s.y++; }
    }
    repaint(id);
  }

  function flip(id, e) {
    if (e) e.stopPropagation();
    const s = state[id];
    if (!s) return;
    s.view = s.view === 'months' ? 'days' : 'months';
    repaint(id);
  }

  function setMonth(id, m, e) {
    if (e) e.stopPropagation();
    const s = state[id];
    if (!s) return;
    s.m = m; s.view = 'days';
    repaint(id);
  }

  function pick(id, iso, e) {
    if (e) e.stopPropagation();
    const s0 = state[id];
    if (s0) s0.value = iso;
    const hidden = document.getElementById(id);
    const text = document.getElementById(id + '-text');
    if (hidden) hidden.value = iso;
    if (text) {
      text.textContent = iso ? format(iso) : (text.dataset.placeholder || 'Choose a date');
      text.classList.toggle('has', !!iso);
    }
    const s = state[id];
    if (s && iso) { const p = parse(iso); s.y = p.y; s.m = p.m; }
    if (s && s.inline) repaint(id); else close();
    if (s && s.onChange) s.onChange(iso);
  }

  /**
   * Anchored to the field and positioned `fixed`, so no clipping ancestor can
   * hide it — the failure that made the Sub-category dropdown drag its whole
   * form sideways. It flips above the field when there is no room below, and is
   * kept inside `clipBox` horizontally so it never hangs off a narrow phone.
   */
  function place(id) {
    const panel = document.getElementById(id + '-panel');
    const field = document.getElementById(id + '-field');
    if (!panel || !field) return;
    const f = field.getBoundingClientRect();
    // The panel is `fixed`, so no ancestor clips it and the viewport is the only
    // real constraint. Clamping to `clipBox` here would shove it sideways to fit
    // inside a modal it is entitled to overhang.
    const w = panel.offsetWidth || 268, h = panel.offsetHeight || 300;

    let left = f.left;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    if (left < 8) left = 8;

    const below = window.innerHeight - f.bottom;
    panel.style.left = Math.round(left) + 'px';
    if (below < h + 10 && f.top > h + 10) {
      panel.style.top = Math.round(f.top - h - 6) + 'px';
    } else {
      panel.style.top = Math.round(f.bottom + 6) + 'px';
    }
  }

  function toggle(id, e) {
    if (e) e.stopPropagation();
    const panel = document.getElementById(id + '-panel');
    if (!panel) return;
    const isOpen = panel.style.display === 'block';
    close();
    if (isOpen) return;
    const s = state[id];
    const el = document.getElementById(id);
    if (s && el) s.value = el.value;
    const cur = parse(el ? el.value : '');
    if (s && cur) { s.y = cur.y; s.m = cur.m; }
    if (s) s.view = 'days';
    repaint(id);
    panel.style.display = 'block';
    openId = id;
    place(id);
  }

  function close() {
    if (!openId) return;
    const panel = document.getElementById(openId + '-panel');
    if (panel && !(state[openId] && state[openId].inline)) panel.style.display = 'none';
    openId = null;
  }

  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  document.addEventListener('click', e => {
    if (!openId) return;
    const wrap = document.querySelector(`[data-datepicker="${openId}"]`);
    const panel = document.getElementById(openId + '-panel');
    if (wrap && !wrap.contains(e.target) && panel && !panel.contains(e.target)) close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // A fixed panel does not follow a scrolling form, so it closes instead of drifting.
  window.addEventListener('scroll', () => close(), true);
  window.addEventListener('resize', () => close());

  return { render, toggle, pick, step, flip, setMonth, close, getValue, format, today, offset };
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

/**
 * Password visibility toggle, for every password field in the app.
 *
 * There was no way to see what you had typed. On a cracked tablet screen in a
 * staffroom that means retyping a password until it takes, and it is the first
 * thing a teacher meets. `enhanceAll()` is idempotent and safe to call after
 * any render; a `focusin` fallback catches fields rendered by paths that forget
 * to call it.
 *
 * Toggling fires `pw:visibility` on the input (bubbling) so anything else on
 * the page can react without this module knowing about it.
 */
const PasswordField = (() => {
  function icon(visible) { return `<i class="ti ti-eye${visible ? '-off' : ''}"></i>`; }

  function toggle(input, btn) {
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    btn.innerHTML = icon(reveal);
    btn.classList.toggle('is-on', reveal);
    const label = reveal ? 'Hide password' : 'Show password';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    input.dispatchEvent(new CustomEvent('pw:visibility', { bubbles: true, detail: { visible: reveal } }));
    // Keep the caret where it was: switching type moves it to the end.
    const pos = input.value.length;
    input.focus();
    try { input.setSelectionRange(pos, pos); } catch (e) { /* type=email etc. */ }
  }

  function enhance(input) {
    if (!input || input.dataset.pwEnhanced) return;
    // A page that ships its own reveal button keeps it — two eyes on one field
    // is worse than none, and that is exactly what happened the first time.
    const sibling = input.parentElement && input.parentElement.querySelector('button');
    if (sibling && !sibling.classList.contains('pw-toggle')) { input.dataset.pwEnhanced = '1'; return; }
    input.dataset.pwEnhanced = '1';

    // The login page ships its own markup so the button is there before JS runs.
    let wrap = input.closest('.pw-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'pw-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    let btn = wrap.querySelector('.pw-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pw-toggle';
      btn.setAttribute('aria-label', 'Show password');
      btn.title = 'Show password';
      btn.innerHTML = icon(false);
      wrap.appendChild(btn);
    }
    if (!btn.dataset.bound) {
      btn.dataset.bound = '1';
      // mousedown would blur the field before the click lands, which loses the
      // caret position and any focus styling for a frame.
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', () => toggle(input, btn));
    }
  }

  function enhanceAll(root) {
    (root || document).querySelectorAll('input[type="password"]').forEach(enhance);
  }

  function init() {
    enhanceAll();
    // Anything rendered later: enhance it the moment it is used.
    document.addEventListener('focusin', e => {
      if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'password') enhance(e.target);
    });
  }

  return { init, enhance, enhanceAll };
})();
