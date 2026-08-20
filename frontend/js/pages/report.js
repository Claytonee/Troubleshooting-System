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
          <div class="form-group full">
            <label>Attachments <span style="font-weight:400;color:var(--text3)">(images, audio, video, documents — max 5 files)</span></label>
            <div id="attach-zone" style="border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:border-color .15s" onclick="document.getElementById('f-attach').click()" ondragover="event.preventDefault();this.style.borderColor='var(--accent)'" ondragleave="this.style.borderColor='var(--border)'" ondrop="event.preventDefault();this.style.borderColor='var(--border)';ReportPage.handleDrop(event)">
              <i class="ti ti-cloud-upload" style="font-size:24px;color:var(--text3)"></i>
              <div style="font-size:12px;color:var(--text3);margin-top:6px">Click or drag files here</div>
            </div>
            <input type="file" id="f-attach" multiple accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt" style="display:none" onchange="ReportPage.handleFiles(this.files)">
            <div id="attach-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>
          </div>
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

  let selectedFiles = [];

  function handleFiles(fileList) {
    const newFiles = Array.from(fileList);
    if (selectedFiles.length + newFiles.length > 5) {
      showToast('Maximum 5 files allowed');
      return;
    }
    selectedFiles = selectedFiles.concat(newFiles);
    renderFileList();
  }

  function handleDrop(e) {
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function removeFile(idx) {
    selectedFiles.splice(idx, 1);
    renderFileList();
  }

  function renderFileList() {
    const el = document.getElementById('attach-list');
    if (!el) return;
    el.innerHTML = selectedFiles.map((f, i) => {
      const icon = f.type.startsWith('image/') ? 'ti-photo' : f.type.startsWith('audio/') ? 'ti-music' : f.type.startsWith('video/') ? 'ti-video' : 'ti-file';
      const size = f.size < 1024 * 1024 ? (f.size / 1024).toFixed(0) + ' KB' : (f.size / (1024 * 1024)).toFixed(1) + ' MB';
      return `<div style="display:flex;align-items:center;gap:6px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px">
        <i class="ti ${icon}" style="color:var(--accent)"></i>
        <span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</span>
        <span style="color:var(--text3)">${size}</span>
        <i class="ti ti-x" style="cursor:pointer;color:var(--red);margin-left:4px" onclick="event.stopPropagation();ReportPage.removeFile(${i})"></i>
      </div>`;
    }).join('');
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
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('school_id', parseInt(school_id));
      formData.append('category', category);
      if (subcat) formData.append('subcategory', subcat);
      formData.append('priority', priority);
      if (reporter) formData.append('reporter_name', reporter);
      if (role) formData.append('reporter_role', role);
      if ($('f-contact')) formData.append('reporter_contact', $('f-contact').value);
      if ($('f-location')) formData.append('location', $('f-location').value);
      if ($('f-affected')) formData.append('affected_devices', $('f-affected').value);
      selectedFiles.forEach(f => formData.append('attachments', f));

      const token = API.getToken();
      const resp = await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw err;
      }
      const res = await resp.json();
      selectedFiles = [];
      showToast(`${res.error_code} submitted successfully!`);
      const dest = API.getUser() && API.getUser().role === 'teacher' ? 'dashboard' : 'tracker';
      Router.navigate(dest);
      App.loadAndRender();
    } catch (e) {
      showToast(e.error || 'Failed to submit report');
    }
  }

  return { load, render, onCategoryChange, submit, handleFiles, handleDrop, removeFile };
})();
