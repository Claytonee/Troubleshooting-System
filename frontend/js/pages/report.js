/**
 * Report Error Page
 */
const ReportPage = (() => {
  let schools = [];

  const ROLES = ['Teacher', 'School IT Coordinator', 'Head Teacher', 'Quest Coordinator', 'Student'];
  const PRIORITIES = [
    { value: 'critical', label: 'Critical', desc: '— School cannot operate' },
    { value: 'high', label: 'High', desc: '— Major disruption' },
    { value: 'medium', label: 'Medium', desc: '— Partial disruption' },
    { value: 'low', label: 'Low', desc: '— Minor issue' }
  ];

  async function load() {
    const user = API.getUser();
    if (user && user.role !== 'teacher') {
      try { schools = await API.getSchools(); } catch (e) { schools = []; }
    }
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
      : Dropdown.render('f-school', 'Select school', schools.map(s => ({ value: s.id, label: s.name, tag: s.zone || '' })));

    const reporterField = isTeacher
      ? `<input type="text" value="${esc(user.full_name)}" disabled><input type="hidden" id="f-reporter" value="${esc(user.full_name)}">`
      : `<input id="f-reporter" type="text" placeholder="Full name">`;

    const roleField = isTeacher
      ? `<input type="text" value="Teacher" disabled><input type="hidden" id="f-role" value="Teacher">`
      : Dropdown.render('f-role', 'Select role', ROLES);

    const categoryField = Dropdown.render('f-category', 'Select category', categories, { onSelect: "ReportPage.onCategoryChange()" });
    const subcatField = Dropdown.render('f-subcat', 'Select sub-category', []);
    const priorityField = Dropdown.render('f-priority', 'Medium — Partial disruption', PRIORITIES, { defaultValue: 'medium' });

    return `
    <div class="section-header"><div>
      <div class="section-title">Report a Technical Error</div>
      <div class="section-sub">Submit a new issue for tracking and resolution</div>
    </div></div>
    <div class="report-layout">
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
          <button class="btn btn-primary" data-tip="${TIP.SUBMIT_REPORT}" onclick="ReportPage.submit()"><i class="ti ti-send"></i> Submit Report</button>
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

  function onCategoryChange() {
    const cat = Dropdown.getValue('f-category');
    const opts = SUBCATS[cat] || [];
    Dropdown.updateItems('f-subcat', opts);
  }

  async function submit() {
    const school_id = Dropdown.getValue('f-school') || ($('f-school') ? $('f-school').value : '');
    const title = $('f-title').value.trim();
    const description = $('f-desc').value.trim();
    const category = Dropdown.getValue('f-category');

    if (!school_id || !title || !description || !category) {
      showToast('Please fill in all required (*) fields');
      return;
    }

    const reporter = $('f-reporter') ? $('f-reporter').value : '';
    const role = Dropdown.getValue('f-role') || ($('f-role') ? $('f-role').value : '');
    const priority = Dropdown.getValue('f-priority') || 'medium';
    const subcat = Dropdown.getValue('f-subcat');

    try {
      const res = await API.createError({
        title,
        description,
        school_id: parseInt(school_id),
        category,
        subcategory: subcat,
        priority,
        reporter_name: reporter,
        reporter_role: role,
        reporter_contact: $('f-contact') ? $('f-contact').value : '',
        location: $('f-location') ? $('f-location').value : '',
        affected_devices: $('f-affected') ? $('f-affected').value : ''
      });
      showToast(`${res.error_code} submitted successfully!`);
      const dest = API.getUser() && API.getUser().role === 'teacher' ? 'dashboard' : 'tracker';
      Router.navigate(dest);
      App.loadAndRender();
    } catch (e) {
      showToast(e.error || 'Failed to submit report');
    }
  }

  return { load, render, onCategoryChange, submit };
})();
