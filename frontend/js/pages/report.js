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
      <div class="card" style="position:relative;overflow:hidden">
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
          <div class="form-group full" id="report-guides"></div>
          <div class="form-group full" id="report-tried-note" style="display:none">
            <div style="font-size:12px;color:var(--text3);background:var(--bg3);border-radius:8px;padding:8px 11px">
              <i class="ti ti-info-circle" style="font-size:13px;color:var(--accent)"></i>
              Noted — the guide you tried will be attached, so whoever picks this up knows what has already been done.
            </div>
          </div>
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
          <button class="btn btn-primary" id="report-submit-btn" data-tip="${TIP.SUBMIT_REPORT}" onclick="ReportPage.submit()"><i class="ti ti-send"></i> Submit Report</button>
          <button class="btn btn-secondary" onclick="Router.navigate('report');App.loadAndRender()"><i class="ti ti-trash"></i> Clear</button>
        </div>
        <div class="upload-overlay" id="upload-overlay">
          <div class="upload-anim" aria-hidden="true">
            <svg viewBox="0 0 120 120" role="presentation">
              <circle class="ua-track" cx="60" cy="60" r="46"></circle>
              <circle class="ua-arc" cx="60" cy="60" r="46"></circle>
              <g transform="translate(27.6 26) scale(2.7)" fill="none" vector-effect="non-scaling-stroke">
                <path class="ua-cloud" d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1"></path>
                <g class="ua-arrow"><path d="M9 14.5l3 -3l3 3"></path><path d="M12 11.5l0 6.5"></path></g>
              </g>
            </svg>
          </div>
          <div class="upload-text">Submitting your report...</div>
          <div class="upload-sub">Uploading files to cloud</div>
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

  /**
   * "Try this first" — the guide, in the way, before the fault is filed.
   *
   * Five guides existed and nothing connected them to the moment a teacher was
   * about to report. An engineer drove out to restart a router while a guide
   * whose second step is "restart the router" sat two clicks away.
   *
   * Deliberately not a redirect and not a wall: three suggestions, collapsed,
   * with an explicit way past them. Deflection must never mean "harder to reach
   * a human" — the Report button stays exactly where it was.
   */
  let suggested = [], triedGuideId = null, openGuide = null;

  async function refreshSuggestions() {
    const category = Dropdown.getValue('f-category');
    const text = ($('f-title')?.value || '') + ' ' + ($('f-desc')?.value || '');
    if (!category && text.trim().length < 6) { suggested = []; return renderSuggestions(); }
    try {
      const r = await API.suggestGuides({ category: category || '', text: text.trim().slice(0, 200) });
      suggested = r.guides || [];
    } catch (e) { suggested = []; }
    renderSuggestions();
  }

  function renderSuggestions() {
    const slot = document.getElementById('report-guides');
    if (!slot) return;
    if (!suggested.length) { slot.innerHTML = ''; return; }

    slot.innerHTML = `
      <div style="background:rgba(54,217,204,.06);border:1px solid rgba(54,217,204,.22);border-radius:12px;padding:13px 15px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">
          <i class="ti ti-bulb" style="font-size:16px;color:var(--teal)"></i>
          <strong style="font-size:13px;color:var(--text)">Try this first</strong>
          <span style="font-size:11px;color:var(--text3)">— most of these are fixed in a few minutes</span>
        </div>
        ${suggested.map(g => `
          <div style="border-top:1px solid var(--border);padding:9px 0 0;margin-top:9px">
            <div style="display:flex;align-items:flex-start;gap:9px;cursor:pointer" onclick="ReportPage.toggleGuide(${g.id})">
              <i class="ti ${esc(g.icon || 'ti-tools')}" style="font-size:15px;color:var(--teal);margin-top:2px;flex-shrink:0"></i>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;color:var(--text);font-weight:500">${esc(g.title)}</div>
                <div style="font-size:11px;color:var(--text3)">${esc(g.category)} · ${g.steps.length} step${g.steps.length === 1 ? '' : 's'}</div>
              </div>
              <i class="ti ti-chevron-${openGuide === g.id ? 'up' : 'down'}" style="font-size:14px;color:var(--text3);flex-shrink:0"></i>
            </div>
            ${openGuide === g.id ? `
              <ol style="margin:9px 0 0 26px;padding:0;font-size:12px;color:var(--text2);line-height:1.75">
                ${g.steps.map(s => `<li style="margin-bottom:3px">${esc(s)}</li>`).join('')}
              </ol>
              <div style="display:flex;gap:8px;margin:11px 0 4px 26px;flex-wrap:wrap">
                <button type="button" class="btn btn-sm" style="background:var(--green);color:#fff"
                        onclick="ReportPage.guideFixedIt(${g.id})"><i class="ti ti-check"></i> This fixed it</button>
                <button type="button" class="btn btn-secondary btn-sm"
                        onclick="ReportPage.stillBroken(${g.id})">Still not fixed</button>
              </div>` : ''}
          </div>`).join('')}
      </div>`;
  }

  function toggleGuide(id) {
    openGuide = openGuide === id ? null : id;
    renderSuggestions();
  }

  /**
   * The fault that never had to be filed. Recorded explicitly, because a person
   * said so — inferring it from "they read the guide and did not file" would
   * count every interruption and every dead battery as a success.
   */
  async function guideFixedIt(id) {
    try {
      const r = await API.guideHelped(id, { category: Dropdown.getValue('f-category') || null });
      showToast(r.message || 'Good — nothing to report then.', 4000);
      Router.navigate(API.getUser()?.role === 'teacher' ? 'dashboard' : 'tracker');
      App.loadAndRender();
    } catch (e) { showToast(e.error || 'Could not record that'); }
  }

  /** They read it and it did not help. Remember which one, and get out of the way. */
  function stillBroken(id) {
    triedGuideId = id;
    openGuide = null;
    suggested = [];
    renderSuggestions();
    const note = document.getElementById('report-tried-note');
    if (note) note.style.display = '';
    const desc = $('f-desc');
    if (desc) desc.focus();
  }

  function onCategoryChange() {
    const cat = Dropdown.getValue('f-category');
    const opts = SUBCATS[cat] || [];
    Dropdown.updateItems('f-subcat', opts);
    refreshSuggestions();
  }

  /**
   * Shrinks a photo before it is queued.
   *
   * A phone camera here produces 3–5 MB per shot, and a queued report has to
   * sit on the device and then go up a link that just came back. 1600px on the
   * long edge at q0.72 keeps a cracked screen, a cable and a serial number
   * perfectly readable at a tenth of the bytes. Anything that is not an image,
   * or that fails to decode, is passed through untouched.
   */
  async function shrinkImage(file, maxEdge = 1600, quality = 0.72) {
    if (!file.type || !file.type.startsWith('image/') || file.type === 'image/gif') return file;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
      if (scale === 1 && file.size < 900 * 1024) { bmp.close && bmp.close(); return file; }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close && bmp.close();
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
      if (!blob || blob.size >= file.size) return file;    // never make it bigger
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      return new File([blob], name, { type: 'image/jpeg' });
    } catch (e) {
      return file;                                        // undecodable: keep the original
    }
  }

  /** What the user is told once a report has been queued with its photos. */
  function queuedMessage(kept, dropped) {
    const base = 'Saved on this device — no connection. It will file automatically when the network returns';
    if (!kept && !dropped) return base + '.';
    if (dropped.length) {
      return base + `, with ${kept} photo(s). ${dropped.map(f => f.name).join(', ')} ${dropped.length === 1 ? 'was' : 'were'} too large to keep — re-attach once it syncs.`;
    }
    return base + `, with ${kept} photo(s) kept.`;
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

    const btn = document.getElementById('report-submit-btn');
    const overlay = document.getElementById('upload-overlay');
    if (btn) btn.disabled = true;
    if (overlay) overlay.classList.add('active');

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('school_id', school_id);
      formData.append('category', category);
      if (subcat) formData.append('subcategory', subcat);
      formData.append('priority', priority);
      if (reporter) formData.append('reporter_name', reporter);
      if (role) formData.append('reporter_role', role);
      if ($('f-contact')) formData.append('reporter_contact', $('f-contact').value);
      if ($('f-location')) formData.append('location', $('f-location').value);
      if ($('f-affected')) formData.append('affected_devices', $('f-affected').value);
      selectedFiles.forEach(f => formData.append('attachments', f));

      // Sent with the request and again on any offline replay, so a reply lost
      // after the server committed cannot file this fault twice.
      const clientRef = Offline.newRef();
      formData.append('client_ref', clientRef);
      // Which guide was read and did not help. A guide that is tried and still
      // ends in a fault is the one worth rewriting.
      if (triedGuideId) formData.append('tried_guide_id', triedGuideId);

      const token = API.getToken();
      let resp;
      try {
        resp = await fetch('/api/errors', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
      } catch (netErr) {
        // Downscale first, then keep what fits the per-report budget. Both
        // numbers live in offline.js so the queue owns its own limits.
        const shrunk = [];
        for (const f of selectedFiles) shrunk.push(await shrinkImage(f));
        const { kept, dropped } = Offline.budgetFiles(shrunk);
        // The request never reached the server. Queue it rather than losing it
        // — this is the case the whole feature exists for, and it is the moment
        // a teacher is most likely to be reporting (docs/features/02-offline-pwa.md).
        await Offline.enqueue({
          client_ref: clientRef,
          kind: 'error.create',
          path: '/api/errors',
          label: title,
          files: kept,
          body: {
            title, description, school_id: Number(school_id), category,
            tried_guide_id: triedGuideId || null,
            subcategory: subcat || null, priority,
            reporter_name: reporter || null, reporter_role: role || null,
            reporter_contact: $('f-contact') ? $('f-contact').value : null,
            location: $('f-location') ? $('f-location').value : null,
            affected_devices: $('f-affected') ? $('f-affected').value : null
          }
        });
        selectedFiles = [];
        showToast(queuedMessage(kept.length, dropped), dropped.length ? 8000 : 6000);
        Router.navigate(API.getUser() && API.getUser().role === 'teacher' ? 'dashboard' : 'tracker');
        App.loadAndRender();
        return;
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Upload failed (status ' + resp.status + ')' }));
        throw err;
      }
      const res = await resp.json();
      selectedFiles = [];
      showToast(`${res.error_code} submitted successfully!`);
      const dest = API.getUser() && API.getUser().role === 'teacher' ? 'dashboard' : 'tracker';
      Router.navigate(dest);
      App.loadAndRender();
    } catch (e) {
      showToast(e.error || e.message || 'Failed to submit report');
      if (btn) btn.disabled = false;
      if (overlay) overlay.classList.remove('active');
    }
  }

  return { load, render, onCategoryChange, submit, handleFiles, handleDrop, removeFile,
    toggleGuide, guideFixedIt, stillBroken, refreshSuggestions };
})();
