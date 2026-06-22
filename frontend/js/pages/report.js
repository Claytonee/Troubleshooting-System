/**
 * Report Error Page
 */
const ReportPage = (() => {
  let schools = [];

  async function load() {
    try { schools = await API.getSchools(); } catch (e) { schools = []; }
  }

  function render() {
    const user = API.getUser();
    const isSchool = user && user.role === 'school';
    const userSchool = isSchool ? schools.find(s => s.id === user.school_id) : null;

    return `
    <div class="section-header"><div>
      <div class="section-title">Report a Technical Error</div>
      <div class="section-sub">Submit a new issue for tracking and resolution</div>
    </div></div>
    <div style="display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start">
      <div class="card">
        <div class="form-grid">
          <div class="form-group"><label>Reporting School *</label>
            ${isSchool && userSchool
              ? `<input type="text" value="${esc(userSchool.name)}" disabled><input type="hidden" id="f-school" value="${userSchool.id}">`
              : `<select id="f-school"><option value="">— Select school —</option>${schools.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>`
            }</div>
          <div class="form-group"><label>Reported By *</label><input id="f-reporter" type="text" placeholder="Full name"></div>
          <div class="form-group"><label>Role</label><select id="f-role">
            <option>Teacher</option><option>School IT Coordinator</option><option>Head Teacher</option><option>Quest Coordinator</option><option>Student</option></select></div>
          <div class="form-group"><label>Contact / Phone</label><input id="f-contact" type="text" placeholder="+255 __ ___ ____"></div>
          <div class="form-group"><label>Category *</label><select id="f-category" onchange="ReportPage.updateSubcat()">
            <option value="">— Select —</option>${Object.keys(SUBCATS).map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
          <div class="form-group"><label>Sub-category</label><select id="f-subcat"><option value="">— Select category first —</option></select></div>
          <div class="form-group"><label>Priority *</label><select id="f-priority">
            <option value="critical">Critical — School cannot operate</option>
            <option value="high">High — Major disruption</option>
            <option value="medium" selected>Medium — Partial disruption</option>
            <option value="low">Low — Minor issue</option></select></div>
          <div class="form-group"><label>Affected Devices</label><input id="f-affected" type="text" placeholder="e.g. 12 tablets, 1 projector"></div>
          <div class="form-group full"><label>Error Title *</label><input id="f-title" type="text" placeholder="Brief description of the problem"></div>
          <div class="form-group full"><label>Detailed Description *</label><textarea id="f-desc" placeholder="When did it start? What were students/teachers doing? Any error messages?"></textarea></div>
          <div class="form-group"><label>Location</label><input id="f-location" type="text" placeholder="e.g. Computer Lab 1"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
          <button class="btn btn-primary" onclick="ReportPage.submit()"><i class="ti ti-send"></i> Submit Report</button>
          <button class="btn btn-secondary" onclick="Router.navigate('report')"><i class="ti ti-trash"></i> Clear</button>
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

  function updateSubcat() {
    const cat = $('f-category').value;
    const opts = SUBCATS[cat] || [];
    $('f-subcat').innerHTML = opts.length ? opts.map(o => `<option>${esc(o)}</option>`).join('') : '<option value="">— Select category first —</option>';
  }

  async function submit() {
    const school_id = $('f-school').value;
    const title = $('f-title').value.trim();
    const description = $('f-desc').value.trim();
    const category = $('f-category').value;

    if (!school_id || !title || !description || !category) {
      showToast('Please fill in all required (*) fields');
      return;
    }

    try {
      const res = await API.createError({
        title,
        description,
        school_id: parseInt(school_id),
        category,
        subcategory: $('f-subcat').value,
        priority: $('f-priority').value,
        reporter_name: $('f-reporter').value,
        reporter_role: $('f-role').value,
        reporter_contact: $('f-contact').value,
        location: $('f-location').value,
        affected_devices: $('f-affected').value
      });
      showToast(`${res.error_code} submitted successfully!`);
      Router.navigate('tracker');
    } catch (e) {
      showToast(e.error || 'Failed to submit report');
    }
  }

  return { load, render, updateSubcat, submit };
})();
