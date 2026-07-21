/**
 * Schools Page
 */
const SchoolsPage = (() => {
  let schools = [];
  let team = [];
  let selectedId = null;
  let detail = null;
  let schoolForms = [];

  function isAdmin() { const u = API.getUser(); return u && u.role === 'admin'; }
  function isSchoolAdmin() { const u = API.getUser(); return u && u.role === 'school'; }
  function canEditSchool() { return isAdmin() || isSchoolAdmin(); }

  async function load() {
    try { schools = await API.getSchools(); } catch (e) { schools = []; }
    if (isAdmin()) { try { team = await API.getTeam(); } catch (e) { team = []; } }
    if (selectedId) {
      try {
        detail = await API.getSchool(selectedId);
        schoolForms = detail.forms || [];
      } catch (e) { detail = null; schoolForms = []; }
    }
  }

  function select(id) { selectedId = id; App.loadAndRender(); }
  function back() { selectedId = null; detail = null; App.render(); }

  function render() {
    if (selectedId && detail) return renderDetail();
    return `
    <div class="section-header">
      <div><div class="section-title">School Profiles</div><div class="section-sub">${schools.length} schools</div></div>
      ${isAdmin() ? `<div style="display:flex;gap:10px">
        <button class="btn btn-secondary" onclick="SchoolsPage.openImportCSV()"><i class="ti ti-file-import"></i> Import CSV</button>
        <button class="btn btn-primary" data-tip="${TIP.ADD_SCHOOL}" onclick="SchoolsPage.openCreate()"><i class="ti ti-plus"></i> Add School</button>
      </div>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px">
      ${schools.map(s => {
        const hasIssues = s.open_errors > 0;
        const badge = hasIssues ? 'badge-amber' : 'badge-green';
        const label = hasIssues ? 'Issues' : 'Healthy';
        return `<div class="school-card" style="align-items:flex-start;flex-direction:column;gap:12px" onclick="SchoolsPage.select(${s.id})">
          <div style="display:flex;align-items:center;gap:12px;width:100%">
            <div class="school-avatar" style="background:${hasIssues ? 'rgba(245,166,35,0.2)' : 'rgba(45,217,138,0.12)'};color:${hasIssues ? 'var(--amber)' : 'var(--green)'}">${initials(s.name)}</div>
            <div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</div><div style="font-size:11px;color:var(--text3)">${esc(s.zone || '—')} · ${s.students} students</div></div>
            <span class="badge ${badge}">${label}</span>
          </div>
          <div style="display:flex;gap:14px;font-size:11px;color:var(--text3);width:100%;border-top:1px solid var(--border);padding-top:10px">
            <span><i class="ti ti-device-tablet" style="vertical-align:-2px"></i> ${s.tablets}</span>
            <span><i class="ti ti-bug" style="vertical-align:-2px"></i> ${s.open_errors} open</span>
            <span style="margin-left:auto"><i class="ti ti-user-shield" style="vertical-align:-2px"></i> ${esc(s.admin_name || '—')}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function contactLine(icon, text, scheme) {
    if (!text) return '';
    const inner = `<i class="ti ${icon}" style="font-size:14px;color:var(--text3);width:16px;text-align:center"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(text)}</span>`;
    if (scheme) {
      return `<a href="${scheme}${esc(text)}" style="display:flex;align-items:center;gap:8px;color:var(--text2);text-decoration:none;transition:color .15s" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text2)'">${inner}</a>`;
    }
    return `<div style="display:flex;align-items:center;gap:8px;color:var(--text2)">${inner}</div>`;
  }

  function personCard(icon, color, label, name, lines) {
    const body = lines.filter(Boolean).join('');
    return `<div class="card" style="padding:16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:13px">
        <div style="width:42px;height:42px;border-radius:11px;background:${color}1f;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ${icon}" style="font-size:21px;color:${color}"></i></div>
        <div style="min-width:0">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;font-weight:600">${label}</div>
          <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name || 'Not set')}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px">${body || '<span style="color:var(--text3);font-size:12px">No details on file</span>'}</div>
    </div>`;
  }

  function detailItem(icon, label, value, mono) {
    return `<div style="display:flex;align-items:flex-start;gap:11px">
      <i class="ti ${icon}" style="font-size:17px;color:var(--text3);margin-top:1px"></i>
      <div style="min-width:0"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">${label}</div>
      <div style="font-weight:500;${mono ? 'font-family:var(--mono);font-size:12px' : ''}">${esc(value || '—')}</div></div>
    </div>`;
  }

  function renderDetail() {
    const s = detail;
    const openCount = (s.errors || []).filter(e => e.status !== 'resolved').length;
    const hasIssues = openCount > 0;
    const statusBadge = hasIssues
      ? `<span class="badge badge-amber">${openCount} open issue${openCount > 1 ? 's' : ''}</span>`
      : `<span class="badge badge-green">Healthy</span>`;

    return `
    <div class="section-header">
      <div style="display:flex;align-items:center;gap:14px">
        <button class="btn btn-secondary btn-sm" onclick="SchoolsPage.back()" style="padding:6px 10px"><i class="ti ti-arrow-left"></i></button>
        <div class="school-avatar" style="width:36px;height:36px;font-size:13px;border-radius:10px;background:rgba(79,124,255,0.16);color:var(--accent)">${initials(s.name)}</div>
        <div style="min-width:0">
          <div class="section-title" style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</div>
          <div class="section-sub" style="margin:0">${esc(s.zone || '—')} · <span style="font-family:var(--mono);font-size:10px">${esc(s.code)}</span> · ${statusBadge}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        ${canEditSchool() ? `<button class="btn btn-secondary btn-sm" onclick="SchoolsPage.openEdit(${s.id})"><i class="ti ti-edit"></i> Edit</button>` : ''}
        ${isAdmin() ? `<button class="btn btn-secondary btn-sm" data-tip="${TIP.DELETE}" data-tip-color="red" style="color:var(--red);border-color:rgba(255,82,99,0.3)" onclick="SchoolsPage.remove(${s.id})"><i class="ti ti-trash"></i> Delete</button>` : ''}
      </div>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">Students</div><div class="stat-val">${s.students || 0}</div></div>
      <div class="stat-card t"><div class="stat-label">Tablets</div><div class="stat-val" style="color:var(--teal)">${s.tablets || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Routers</div><div class="stat-val">${s.routers || 0}</div></div>
      <div class="stat-card ${hasIssues ? 'a' : 'g'}"><div class="stat-label">Open Issues</div><div class="stat-val" style="color:${hasIssues ? 'var(--amber)' : 'var(--green)'}">${openCount}</div></div>
    </div>

    ${schoolForms.length ? `
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="card-title" style="margin:0">Form-Level Breakdown</div>
        ${canEditSchool() ? `<button class="btn btn-secondary btn-sm" onclick="SchoolsPage.openEditForms(${s.id})"><i class="ti ti-edit"></i> Edit</button>` : ''}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Form</th><th style="text-align:center">Students</th><th style="text-align:center">Tablets</th><th style="text-align:center">Ratio</th></tr></thead>
        <tbody>${schoolForms.map(f => {
          const ratio = f.tablets > 0 ? (f.students / f.tablets).toFixed(1) : '—';
          const ratioColor = f.tablets > 0 && f.students / f.tablets > 3 ? 'var(--red)' : f.tablets > 0 && f.students / f.tablets > 2 ? 'var(--amber)' : 'var(--green)';
          return `<tr>
            <td style="font-weight:500">${esc(f.form_name)}</td>
            <td style="text-align:center">${f.students}</td>
            <td style="text-align:center">${f.tablets}</td>
            <td style="text-align:center;color:${ratioColor};font-weight:500">${ratio}${ratio !== '—' ? ':1' : ''}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>` : (canEditSchool() ? `
    <div class="card" style="margin-bottom:16px;padding:16px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:13px;color:var(--text3)"><i class="ti ti-school" style="vertical-align:-2px;margin-right:6px"></i>No form-level data yet</div>
      <button class="btn btn-secondary btn-sm" onclick="SchoolsPage.openEditForms(${s.id})"><i class="ti ti-plus"></i> Add Form Data</button>
    </div>` : '')}

    <div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin:4px 2px 11px">Key Contacts</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-bottom:18px">
      ${personCard('ti-user', 'var(--accent)', 'Contact Person', s.contact_name, [
        contactLine('ti-briefcase', s.contact_role),
        contactLine('ti-phone', s.contact_phone, 'tel:'),
        contactLine('ti-mail', s.contact_email, 'mailto:')
      ])}
      ${personCard('ti-device-laptop', 'var(--purple)', 'IT Personnel', s.it_name, [
        contactLine('ti-mail', s.it_email, 'mailto:')
      ])}
      ${personCard('ti-school', 'var(--teal)', 'Coordinator', s.coordinator_name, [
        contactLine('ti-mail', s.coordinator_email, 'mailto:')
      ])}
    </div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-title">School Details</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:18px 16px;font-size:13px">
        ${detailItem('ti-map-pin', 'Region', s.zone)}
        ${detailItem('ti-wifi', 'ISP', s.isp)}
        ${detailItem('ti-router', 'LRS IP', s.lrs_ip, true)}
        ${detailItem('ti-user-shield', 'Sub-Admin', s.admin_name || 'Unassigned')}
      </div>
    </div>

    <div class="two-col" style="align-items:start">
      <div class="card">
        <div class="card-title">Error History (${(s.errors || []).length})</div>
        ${(s.errors || []).length ? `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Issue</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>${(s.errors || []).map(e => `<tr>
            <td><span class="error-id">${e.error_code}</span></td>
            <td style="font-size:12px">${esc(e.title)}</td>
            <td><span class="badge ${(PRI[e.priority] || PRI.medium).badge}">${(PRI[e.priority] || PRI.medium).label}</span></td>
            <td><span class="badge ${(STAT[e.status] || STAT.open).badge}">${(STAT[e.status] || STAT.open).label}</span></td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty"><i class="ti ti-circle-check"></i>No issues reported</div>'}
      </div>
      <div class="card">
        <div class="card-title">Communications</div>
        ${(s.communications || []).length ? `<div style="display:flex;flex-direction:column;gap:8px;font-size:12px">
          ${(s.communications || []).map(c => `<div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><div style="font-weight:500;color:var(--text);margin-bottom:3px">${esc(c.recorded_by)} · ${relTime(c.created_at)}</div><div style="color:var(--text2)">${esc(c.note)}</div></div>`).join('')}
        </div>` : '<div class="empty" style="padding:20px 0"><i class="ti ti-messages"></i>No communications</div>'}
      </div>
    </div>`;
  }


  function formBody(s) {
    s = s || {};
    const forms = s.forms || schoolForms || [];
    const defaultForms = forms.length ? forms : [
      { form_name: 'Form 1', students: 0, tablets: 0 },
      { form_name: 'Form 2', students: 0, tablets: 0 },
      { form_name: 'Form 3', students: 0, tablets: 0 },
      { form_name: 'Form 4', students: 0, tablets: 0 }
    ];
    const grp = (inner) => `<div style="display:flex;gap:12px;flex-wrap:wrap">${inner}</div>`;
    const fg = (label, html, flex) => `<div class="form-group" style="flex:${flex || 1};min-width:160px">${label}${html}</div>`;
    const adminItems = [{ value: '', label: 'Unassigned' }, ...team.map(t => ({ value: t.id, label: t.full_name, tag: t.zone || '' }))];
    const currentAdmin = team.find(t => String(t.id) === String(s.assigned_admin_id));
    return `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="form-group">
          <label>School Name <span style="color:var(--red)">*</span></label>
          <input type="text" id="sc-name" value="${esc(s.name || '')}" placeholder="e.g. Kilema Secondary">
        </div>
        ${grp(
          fg('<label>Region</label>', `<input type="text" id="sc-zone" value="${esc(s.zone || '')}" placeholder="e.g. Rombo">`) +
          fg('<label>ISP</label>', `<input type="text" id="sc-isp" value="${esc(s.isp || '')}" placeholder="e.g. Vodacom Fibre">`)
        )}

        <div style="font-size:11px;font-weight:600;color:var(--text3);margin-top:6px;letter-spacing:.4px">FORM-LEVEL DATA</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:2px">Students and tablets per form/class level</div>
        <div id="sc-forms-list" style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;gap:10px;font-size:10px;color:var(--text3);padding:0 0 2px 0">
            <span style="flex:1.2">Form</span><span style="flex:1">Students</span><span style="flex:1">Tablets</span>
          </div>
          ${defaultForms.map(f => `<div class="form-row" style="display:flex;gap:10px;align-items:center">
            <input type="text" class="frm-name" value="${esc(f.form_name || '')}" readonly style="flex:1.2;min-width:80px;background:var(--bg3)">
            <input type="number" class="frm-students" value="${f.students || 0}" min="0" onchange="SchoolsPage.updateFormTotals()" style="flex:1;min-width:60px">
            <input type="number" class="frm-tablets" value="${f.tablets || 0}" min="0" onchange="SchoolsPage.updateFormTotals()" style="flex:1;min-width:60px">
          </div>`).join('')}
        </div>
        <div id="sc-forms-totals" style="display:flex;gap:10px;padding:8px 0 0;border-top:1px solid var(--border);font-size:12px;font-weight:600">
          <span style="flex:1.2;color:var(--text3)">TOTAL</span>
          <span id="sc-total-students" style="flex:1;color:var(--accent)">${defaultForms.reduce((s,f) => s + (f.students||0), 0)}</span>
          <span id="sc-total-tablets" style="flex:1;color:var(--teal)">${defaultForms.reduce((s,f) => s + (f.tablets||0), 0)}</span>
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);margin-top:6px;letter-spacing:.4px">SCHOOL ADMIN</div>
        ${grp(
          fg('<label>Contact Name</label>', `<input type="text" id="sc-cname" value="${esc(s.contact_name || '')}" placeholder="e.g. Head Teacher name">`) +
          fg('<label>Role</label>', `<input type="text" id="sc-crole" value="${esc(s.contact_role || '')}" placeholder="e.g. Head Teacher">`)
        )}
        ${grp(
          fg('<label>Phone</label>', `<input type="text" id="sc-cphone" value="${esc(s.contact_phone || '')}" placeholder="+255 ...">`) +
          fg('<label>Email</label>', `<input type="email" id="sc-cemail" value="${esc(s.contact_email || '')}" placeholder="school@example.com">`)
        )}

        ${isAdmin() ? `<div class="form-group">
          <label>Assigned Sub-Admin (Field Engineer)</label>
          ${Dropdown.render('sc-admin', currentAdmin ? currentAdmin.full_name : 'Unassigned', adminItems, { defaultValue: s.assigned_admin_id || '' })}
        </div>` : ''}
      </div>`;
  }

  function openCreate() {
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" id="sc-submit" onclick="SchoolsPage.submitCreate()"><i class="ti ti-plus"></i> Create School</button>`;
    Modal.open('Add School Profile', formBody(), footer, true);
  }

  function openEdit(id) {
    const s = detail && detail.id === id ? detail : schools.find(x => x.id === id);
    if (!s) return;
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" id="sc-submit" onclick="SchoolsPage.submitEdit(${id})"><i class="ti ti-check"></i> Save Changes</button>`;
    Modal.open('Edit School Profile', formBody(s), footer, true);
  }

  function updateFormTotals() {
    const rows = document.querySelectorAll('#sc-forms-list .form-row');
    let totalStudents = 0, totalTablets = 0;
    rows.forEach(row => {
      totalStudents += parseInt(row.querySelector('.frm-students').value) || 0;
      totalTablets += parseInt(row.querySelector('.frm-tablets').value) || 0;
    });
    const sEl = document.getElementById('sc-total-students');
    const tEl = document.getElementById('sc-total-tablets');
    if (sEl) sEl.textContent = totalStudents;
    if (tEl) tEl.textContent = totalTablets;
  }

  function addFormRowInModal() {
    const list = document.getElementById('sc-forms-list');
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'form-row';
    div.style.cssText = 'display:flex;gap:10px;align-items:center';
    div.innerHTML = `
      <input type="text" class="frm-name" value="" placeholder="Form name" style="flex:1.2;min-width:80px">
      <input type="number" class="frm-students" value="0" min="0" style="flex:1;min-width:60px">
      <input type="number" class="frm-tablets" value="0" min="0" style="flex:1;min-width:60px">
      <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;color:var(--red)" onclick="this.parentElement.remove()"><i class="ti ti-x"></i></button>`;
    list.appendChild(div);
  }

  function collectForms() {
    const rows = document.querySelectorAll('#sc-forms-list .form-row');
    const forms = [];
    rows.forEach(row => {
      const name = row.querySelector('.frm-name').value.trim();
      const students = parseInt(row.querySelector('.frm-students').value) || 0;
      const tablets = parseInt(row.querySelector('.frm-tablets').value) || 0;
      if (name) forms.push({ form_name: name, students, tablets });
    });
    return forms;
  }

  function collect() {
    const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const forms = collectForms();
    const totalStudents = forms.reduce((s, f) => s + f.students, 0);
    const totalTablets = forms.reduce((s, f) => s + f.tablets, 0);
    const data = {
      name: val('sc-name'), zone: val('sc-zone'), tablets: totalStudents > 0 ? totalTablets : 0, students: totalStudents,
      isp: val('sc-isp'), contact_name: val('sc-cname'), contact_role: val('sc-crole'),
      contact_phone: val('sc-cphone'), contact_email: val('sc-cemail'),
      forms
    };
    if (isAdmin()) data.assigned_admin_id = Dropdown.getValue('sc-admin') || null;
    return data;
  }

  function validEmail(e) { return !e || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }

  function validate(d) {
    if (!d.name) return 'School name is required';
    if (d.contact_email && !validEmail(d.contact_email)) return 'Contact email is invalid';
    return null;
  }

  async function submitCreate() {
    const d = collect();
    const err = validate(d); if (err) { showToast(err); return; }
    const btn = document.getElementById('sc-submit');
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Creating...';
    try {
      const result = await API.createSchool(d);
      if (d.forms.length && result.id) {
        await API.saveSchoolForms(result.id, d.forms);
      }
      Modal.close(); showToast('School profile created');
      await load(); App.render();
    } catch (e) {
      showToast(e.error || 'Could not create school');
      btn.disabled = false; btn.innerHTML = '<i class="ti ti-plus"></i> Create School';
    }
  }

  async function submitEdit(id) {
    const d = collect();
    const err = validate(d); if (err) { showToast(err); return; }
    const btn = document.getElementById('sc-submit');
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Saving...';
    try {
      await API.updateSchool(id, d);
      if (d.forms.length) {
        await API.saveSchoolForms(id, d.forms);
      }
      Modal.close(); showToast('School profile updated');
      await load(); App.render();
    } catch (e) {
      showToast(e.error || 'Could not update school');
      btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Save Changes';
    }
  }

  async function remove(id) {
    const s = detail && detail.id === id ? detail : schools.find(x => x.id === id);
    if (!confirm(`Delete "${s ? s.name : 'this school'}" and all its errors/check-ins? This cannot be undone.`)) return;
    try {
      await API.deleteSchool(id);
      showToast('School deleted');
      selectedId = null; detail = null;
      await load(); App.render();
    } catch (e) { showToast(e.error || 'Could not delete school'); }
  }

  // --- Form-Level Editing ---
  function openEditForms(schoolId) {
    const existing = schoolForms.length ? schoolForms : [
      { form_name: 'Form 1', students: 0, tablets: 0 },
      { form_name: 'Form 2', students: 0, tablets: 0 },
      { form_name: 'Form 3', students: 0, tablets: 0 },
      { form_name: 'Form 4', students: 0, tablets: 0 }
    ];
    const body = `
      <div style="margin-bottom:12px;font-size:12px;color:var(--text3)">Set the number of students and tablets for each form/class level.</div>
      <div id="forms-list" style="display:flex;flex-direction:column;gap:8px">
        ${existing.map((f, i) => formRow(f, i)).join('')}
      </div>
      <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="SchoolsPage.addFormRow()"><i class="ti ti-plus"></i> Add Form</button>`;
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" id="forms-submit" onclick="SchoolsPage.submitForms(${schoolId})"><i class="ti ti-check"></i> Save</button>`;
    Modal.open('Form-Level Breakdown', body, footer);
  }

  function formRow(f, i) {
    return `<div class="form-row" style="display:flex;gap:10px;align-items:center">
      <input type="text" class="frm-name" value="${esc(f.form_name || '')}" placeholder="Form name" style="flex:1.2;min-width:100px">
      <input type="number" class="frm-students" value="${f.students || 0}" min="0" placeholder="Students" style="flex:1;min-width:80px">
      <input type="number" class="frm-tablets" value="${f.tablets || 0}" min="0" placeholder="Tablets" style="flex:1;min-width:80px">
      <button class="btn btn-secondary btn-sm" style="padding:4px 8px;color:var(--red)" onclick="this.parentElement.remove()"><i class="ti ti-x"></i></button>
    </div>`;
  }

  function addFormRow() {
    const list = document.getElementById('forms-list');
    if (!list) return;
    const div = document.createElement('div');
    div.innerHTML = formRow({ form_name: '', students: 0, tablets: 0 }, list.children.length);
    list.appendChild(div.firstElementChild);
  }

  async function submitForms(schoolId) {
    const rows = document.querySelectorAll('#forms-list .form-row');
    const forms = [];
    rows.forEach(row => {
      const name = row.querySelector('.frm-name').value.trim();
      const students = parseInt(row.querySelector('.frm-students').value) || 0;
      const tablets = parseInt(row.querySelector('.frm-tablets').value) || 0;
      if (name) forms.push({ form_name: name, students, tablets });
    });
    const btn = document.getElementById('forms-submit');
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Saving...';
    try {
      await API.saveSchoolForms(schoolId, forms);
      Modal.close(); showToast('Form data saved');
      await load(); App.render();
    } catch (e) {
      showToast(e.error || 'Could not save form data');
      btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Save';
    }
  }

  // --- CSV Bulk Import ---
  function openImportCSV() {
    const body = `
      <div style="margin-bottom:14px;font-size:13px;color:var(--text2)">
        Upload a CSV file with school data. The first row must be headers.
      </div>
      <div style="margin-bottom:14px">
        <button class="btn btn-secondary btn-sm" onclick="SchoolsPage.downloadTemplate()"><i class="ti ti-download"></i> Download CSV Template</button>
      </div>
      <div class="form-group">
        <label>Select CSV File</label>
        <input type="file" id="csv-file" accept=".csv" style="padding:8px">
      </div>
      <div id="csv-preview" style="display:none;margin-top:12px">
        <div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:6px">PREVIEW</div>
        <div id="csv-preview-content" style="max-height:200px;overflow-y:auto;font-size:12px;background:var(--bg3);border-radius:8px;padding:10px;border:1px solid var(--border)"></div>
      </div>`;
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" id="csv-submit" onclick="SchoolsPage.submitCSV()"><i class="ti ti-file-import"></i> Import</button>`;
    Modal.open('Import Schools from CSV', body, footer, true);

    setTimeout(() => {
      const fileInput = document.getElementById('csv-file');
      if (fileInput) fileInput.addEventListener('change', previewCSV);
    }, 100);
  }

  function downloadTemplate() {
    const headers = 'name,region,isp,tablets,students,contact_name,contact_role,contact_phone,contact_email,form_1_students,form_1_tablets,form_2_students,form_2_tablets,form_3_students,form_3_tablets,form_4_students,form_4_tablets';
    const example = 'Kilema Secondary,Rombo,Vodacom,120,450,John Doe,Head Teacher,+255712345678,john@school.tz,120,30,110,30,115,30,105,30';
    const csv = headers + '\n' + example;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'schools_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function previewCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.trim().split('\n');
      const preview = document.getElementById('csv-preview');
      const content = document.getElementById('csv-preview-content');
      if (!preview || !content) return;
      preview.style.display = 'block';
      const count = lines.length - 1;
      content.innerHTML = `<div style="margin-bottom:8px;font-weight:500;color:var(--text)">${count} school${count !== 1 ? 's' : ''} found</div>` +
        lines.slice(0, 6).map((l, i) => `<div style="color:${i === 0 ? 'var(--accent)' : 'var(--text2)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i === 0 ? '<b>' : ''}${esc(l)}${i === 0 ? '</b>' : ''}</div>`).join('') +
        (lines.length > 6 ? `<div style="color:var(--text3)">... and ${lines.length - 6} more</div>` : '');
    };
    reader.readAsText(file);
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });

      const school = {
        name: obj.name || obj.school_name || '',
        zone: obj.region || obj.zone || '',
        isp: obj.isp || '',
        tablets: obj.tablets || '0',
        students: obj.students || '0',
        contact_name: obj.contact_name || '',
        contact_role: obj.contact_role || '',
        contact_phone: obj.contact_phone || '',
        contact_email: obj.contact_email || '',
        it_name: obj.it_name || '',
        it_email: obj.it_email || '',
        coordinator_name: obj.coordinator_name || '',
        coordinator_email: obj.coordinator_email || '',
        forms: []
      };

      for (let i = 1; i <= 6; i++) {
        const st = parseInt(obj[`form_${i}_students`]) || 0;
        const tb = parseInt(obj[`form_${i}_tablets`]) || 0;
        if (st || tb) school.forms.push({ form_name: `Form ${i}`, students: st, tablets: tb });
      }

      return school;
    });
  }

  async function submitCSV() {
    const fileInput = document.getElementById('csv-file');
    if (!fileInput || !fileInput.files[0]) { showToast('Please select a CSV file'); return; }
    const btn = document.getElementById('csv-submit');
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Importing...';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = parseCSV(ev.target.result);
        if (!parsed.length) { showToast('No valid data found in CSV'); btn.disabled = false; btn.innerHTML = '<i class="ti ti-file-import"></i> Import'; return; }
        const result = await API.bulkImportSchools(parsed);
        Modal.close();
        showToast(`Imported ${result.created} school${result.created !== 1 ? 's' : ''}${result.errors.length ? ` (${result.errors.length} errors)` : ''}`);
        await load(); App.render();
      } catch (e) {
        showToast(e.error || 'Import failed');
        btn.disabled = false; btn.innerHTML = '<i class="ti ti-file-import"></i> Import';
      }
    };
    reader.readAsText(fileInput.files[0]);
  }

  return { load, render, select, back, openCreate, openEdit, submitCreate, submitEdit, remove,
    updateFormTotals, addFormRowInModal, openEditForms, addFormRow, submitForms, openImportCSV, downloadTemplate, submitCSV };
})();
