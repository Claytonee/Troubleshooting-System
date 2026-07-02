/**
 * Report Error Page
 */
const ReportPage = (() => {
  let schools = [];
  let openDropId = null;

  const ROLES = ['Teacher', 'School IT Coordinator', 'Head Teacher', 'Quest Coordinator', 'Student'];
  const PRIORITIES = [
    { value: 'critical', label: 'Critical', desc: 'School cannot operate', color: 'var(--red)' },
    { value: 'high', label: 'High', desc: 'Major disruption', color: 'var(--amber)' },
    { value: 'medium', label: 'Medium', desc: 'Partial disruption', color: 'var(--accent)' },
    { value: 'low', label: 'Low', desc: 'Minor issue', color: 'var(--green)' }
  ];

  async function load() {
    const user = API.getUser();
    if (user && user.role !== 'teacher') {
      try { schools = await API.getSchools(); } catch (e) { schools = []; }
    }
  }

  function dropdown(id, placeholder, items, opts = {}) {
    const defaultVal = opts.defaultValue || '';
    const itemsHtml = items.map(item => {
      const val = typeof item === 'object' ? item.value : item;
      const label = typeof item === 'object' ? item.label : item;
      const tag = typeof item === 'object' ? (item.tag || '') : '';
      const desc = typeof item === 'object' ? (item.desc || '') : '';
      return `<div class="reg-dropdown-item" data-value="${esc(val)}" onclick="ReportPage.selectItem('${id}', '${esc(val)}', '${esc(label)}')">
        <span class="reg-dropdown-name">${esc(label)}${desc ? `<span style="font-size:11px;color:var(--text3);margin-left:6px">${esc(desc)}</span>` : ''}</span>
        ${tag ? `<span class="reg-dropdown-zone">${esc(tag)}</span>` : ''}
      </div>`;
    }).join('');

    const hasDefault = !!defaultVal;
    return `<div style="position:relative">
      <input type="hidden" id="${id}" value="${esc(defaultVal)}">
      <div class="reg-select" id="${id}-trigger" onclick="ReportPage.toggleDrop('${id}', event)">
        <span class="reg-select-text${hasDefault ? ' selected' : ''}" id="${id}-text">${placeholder}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="reg-select-arrow"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="reg-dropdown" id="${id}-dd" style="display:none">
        <div class="reg-dropdown-search">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="Search..." oninput="ReportPage.filterDrop('${id}', this.value)">
        </div>
        <div class="reg-dropdown-list" id="${id}-list">${itemsHtml}</div>
      </div>
    </div>`;
  }

  function render() {
    const user = API.getUser();
    const isSchool = user && user.role === 'school';
    const isTeacher = user && user.role === 'teacher';
    const isFixed = isSchool || isTeacher;
    const userSchool = isFixed ? (schools.find(s => s.id === user.school_id) || { id: user.school_id, name: user.school_name || 'My School' }) : null;

    const categories = Object.keys(SUBCATS).map(c => c);

    const schoolField = isFixed && userSchool
      ? `<input type="text" value="${esc(userSchool.name)}" disabled><input type="hidden" id="f-school" value="${userSchool.id}">`
      : dropdown('f-school', 'Select school', schools.map(s => ({ value: s.id, label: s.name, tag: s.zone || '' })));

    const reporterField = isTeacher
      ? `<input type="text" value="${esc(user.full_name)}" disabled><input type="hidden" id="f-reporter" value="${esc(user.full_name)}">`
      : `<input id="f-reporter" type="text" placeholder="Full name">`;

    const roleField = isTeacher
      ? `<input type="text" value="Teacher" disabled><input type="hidden" id="f-role" value="Teacher">`
      : dropdown('f-role', 'Select role', ROLES);

    const categoryField = dropdown('f-category', 'Select category', categories);
    const subcatField = dropdown('f-subcat', 'Select sub-category', []);
    const priorityField = dropdown('f-priority', 'Medium — Partial disruption', PRIORITIES.map(p => ({ value: p.value, label: p.label, desc: '— ' + p.desc })), { defaultValue: 'medium' });

    return `
    <div class="section-header"><div>
      <div class="section-title">Report a Technical Error</div>
      <div class="section-sub">Submit a new issue for tracking and resolution</div>
    </div></div>
    <div class="report-layout" style="display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start">
      <div class="card">
        <div class="form-grid">
          <div class="form-group"><label>Reporting School *</label>${schoolField}</div>
          <div class="form-group"><label>Reported By *</label>${reporterField}</div>
          <div class="form-group"><label>Role</label>${roleField}</div>
          <div class="form-group"><label>Contact / Phone</label><input id="f-contact" type="text" placeholder="+255 __ ___ ____"></div>
          <div class="form-group"><label>Category *</label>${categoryField}</div>
          <div class="form-group"><label>Sub-category</label>${subcatField}</div>
          <div class="form-group"><label>Priority *</label>${priorityField}</div>
          <div class="form-group"><label>Affected Devices</label><input id="f-affected" type="text" placeholder="e.g. 12 tablets, 1 projector"></div>
          <div class="form-group full"><label>Error Title *</label><input id="f-title" type="text" placeholder="Brief description of the problem"></div>
          <div class="form-group full"><label>Detailed Description *</label><textarea id="f-desc" placeholder="When did it start? What were students/teachers doing? Any error messages?"></textarea></div>
          <div class="form-group"><label>Location</label><input id="f-location" type="text" placeholder="e.g. Computer Lab 1"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
          <button class="btn btn-primary" onclick="ReportPage.submit()"><i class="ti ti-send"></i> Submit Report</button>
          <button class="btn btn-secondary" onclick="Router.navigate('report');App.loadAndRender()"><i class="ti ti-trash"></i> Clear</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;position:sticky;top:76px;align-self:start">
        <div class="card"><div class="card-title">SLA Targets</div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;color:var(--text2)">
            <div style="display:flex;justify-content:space-between"><span><span class="dot dot-red" style="margin-right:6px"></span>Critical</span><b style="color:var(--red)">≤ 2 hours</b></div>
            <div style="display:flex;justify-content:space-between"><span><span class="dot dot-amber" style="margin-right:6px"></span>High</span><b style="color:var(--amber)">≤ 8 hours</b></div>
            <div style="display:flex;justify-content:space-between"><span><span class="dot dot-blue" style="margin-right:6px"></span>Medium</span><b>≤ 24 hours</b></div>
            <div style="display:flex;justify-content:space-between"><span><span class="dot dot-green" style="margin-right:6px"></span>Low</span><b style="color:var(--green)">≤ 72 hours</b></div>
          </div></div>
        <div class="card"><div class="card-title">Support Hotline</div>
          <div style="font-size:13px;color:var(--text2);line-height:1.9">
            <div><i class="ti ti-phone" style="margin-right:6px;color:var(--accent)"></i><b style="color:var(--text)">+255 658 066 983</b></div>
            <div><i class="ti ti-mail" style="margin-right:6px;color:var(--accent)"></i>support@opportunityeducation.or.tz</div>
            <div><i class="ti ti-clock" style="margin-right:6px;color:var(--text3)"></i>Mon–Fri 7:30–17:00</div>
          </div></div>
      </div>
    </div>`;
  }

  function toggleDrop(id, e) {
    e.stopPropagation();
    const dd = document.getElementById(id + '-dd');
    if (!dd) return;
    const isOpen = dd.style.display !== 'none';

    closeAllDropdowns();

    if (!isOpen) {
      dd.style.display = 'block';
      dd.classList.remove('drop-up', 'drop-side');
      openDropId = id;

      const card = dd.closest('.card');
      const cardRect = card ? card.getBoundingClientRect() : null;
      const spaceRight = cardRect ? window.innerWidth - cardRect.right : 0;

      if (spaceRight > 290) {
        dd.classList.add('drop-side');
      } else {
        const trigger = document.getElementById(id + '-trigger');
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 220) dd.classList.add('drop-up');
      }

      const input = dd.querySelector('input[type="text"]');
      if (input) { input.value = ''; filterDrop(id, ''); input.focus(); }
    }
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.reg-dropdown').forEach(d => d.style.display = 'none');
    openDropId = null;
  }

  function filterDrop(id, query) {
    const list = document.getElementById(id + '-list');
    if (!list) return;
    const q = query.toLowerCase();
    list.querySelectorAll('.reg-dropdown-item').forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(q) ? 'flex' : 'none';
    });
  }

  function selectItem(id, value, label) {
    const hidden = document.getElementById(id);
    const text = document.getElementById(id + '-text');
    if (hidden) hidden.value = value;
    if (text) { text.textContent = label; text.classList.add('selected'); }
    closeAllDropdowns();

    if (id === 'f-category') {
      updateSubcat(value);
    }
  }

  function updateSubcat(cat) {
    const opts = SUBCATS[cat] || [];
    const list = document.getElementById('f-subcat-list');
    const text = document.getElementById('f-subcat-text');
    const hidden = document.getElementById('f-subcat');
    if (list) {
      list.innerHTML = opts.map(o => `<div class="reg-dropdown-item" data-value="${esc(o)}" onclick="ReportPage.selectItem('f-subcat', '${esc(o)}', '${esc(o)}')"><span class="reg-dropdown-name">${esc(o)}</span></div>`).join('');
    }
    if (text) { text.textContent = opts.length ? 'Select sub-category' : 'No sub-categories'; text.classList.remove('selected'); }
    if (hidden) hidden.value = opts.length ? '' : '';
  }

  async function submit() {
    const school_id = document.getElementById('f-school') ? document.getElementById('f-school').value : '';
    const title = $('f-title').value.trim();
    const description = $('f-desc').value.trim();
    const category = document.getElementById('f-category') ? document.getElementById('f-category').value : '';

    if (!school_id || !title || !description || !category) {
      showToast('Please fill in all required (*) fields');
      return;
    }

    const reporter = document.getElementById('f-reporter') ? document.getElementById('f-reporter').value : '';
    const role = document.getElementById('f-role') ? document.getElementById('f-role').value : '';
    const priority = document.getElementById('f-priority') ? document.getElementById('f-priority').value : 'medium';
    const subcat = document.getElementById('f-subcat') ? document.getElementById('f-subcat').value : '';

    try {
      const res = await API.createError({
        title,
        description,
        school_id: parseInt(school_id),
        category,
        subcategory: subcat,
        priority: priority || 'medium',
        reporter_name: reporter,
        reporter_role: role,
        reporter_contact: $('f-contact').value,
        location: $('f-location').value,
        affected_devices: $('f-affected').value
      });
      showToast(`${res.error_code} submitted successfully!`);
      const dest = API.getUser() && API.getUser().role === 'teacher' ? 'dashboard' : 'tracker';
      Router.navigate(dest);
      App.loadAndRender();
    } catch (e) {
      showToast(e.error || 'Failed to submit report');
    }
  }

  document.addEventListener('click', (e) => {
    if (openDropId) {
      const dd = document.getElementById(openDropId + '-dd');
      const trigger = document.getElementById(openDropId + '-trigger');
      if (dd && trigger && !trigger.contains(e.target) && !dd.contains(e.target)) {
        closeAllDropdowns();
      }
    }
  });

  return { load, render, toggleDrop, filterDrop, selectItem, submit };
})();
