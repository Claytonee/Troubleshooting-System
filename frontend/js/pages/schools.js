/**
 * Schools Page
 */
const SchoolsPage = (() => {
  let schools = [];
  let team = [];
  let selectedId = null;
  let detail = null;

  function isAdmin() { const u = API.getUser(); return u && u.role === 'admin'; }

  async function load() {
    try { schools = await API.getSchools(); } catch (e) { schools = []; }
    if (isAdmin()) { try { team = await API.getTeam(); } catch (e) { team = []; } }
    if (selectedId) {
      try { detail = await API.getSchool(selectedId); } catch (e) { detail = null; }
    }
  }

  function select(id) { selectedId = id; App.loadAndRender(); }
  function back() { selectedId = null; detail = null; App.render(); }

  function render() {
    if (selectedId && detail) return renderDetail();
    return `
    <div class="section-header">
      <div><div class="section-title">School Profiles</div><div class="section-sub">${schools.length} schools</div></div>
      ${isAdmin() ? `<button class="btn btn-primary" onclick="SchoolsPage.openCreate()"><i class="ti ti-plus"></i> Add School Profile</button>` : ''}
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

  function field(label, value, sub) {
    return `<div><div style="color:var(--text3);font-size:11px">${label}</div><div style="font-weight:500">${esc(value || '—')}</div>${sub ? `<div style="color:var(--text3)">${esc(sub)}</div>` : ''}</div>`;
  }

  function renderDetail() {
    const s = detail;
    const hasIssues = (s.errors || []).filter(e => e.status !== 'resolved').length > 0;
    return `
    <div class="section-header">
      <button class="btn btn-secondary btn-sm" onclick="SchoolsPage.back()"><i class="ti ti-arrow-left"></i> Schools</button>
      ${isAdmin() ? `<div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="SchoolsPage.openEdit(${s.id})"><i class="ti ti-edit"></i> Edit</button>
        <button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:rgba(255,82,99,0.3)" onclick="SchoolsPage.remove(${s.id})"><i class="ti ti-trash"></i> Delete</button>
      </div>` : ''}
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="detail-hero">
        <div class="school-avatar" style="background:${hasIssues ? 'rgba(245,166,35,0.2)' : 'rgba(45,217,138,0.12)'};color:${hasIssues ? 'var(--amber)' : 'var(--green)'}">${initials(s.name)}</div>
        <div style="flex:1">
          <div style="font-size:20px;font-weight:600">${esc(s.name)}</div>
          <div style="font-size:13px;color:var(--text3)">${esc(s.zone || '—')} · ${s.students} students · ${s.tablets} tablets</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;border-top:1px solid var(--border);padding-top:16px;font-size:12px">
        ${field('REGION', s.zone)}
        ${field('TABLETS', String(s.tablets))}
        ${field('SUB-ADMIN', s.admin_name || 'Unassigned')}
        ${field('ISP', s.isp)}
        ${field('CONTACT', s.contact_name, s.contact_role)}
        ${field('CONTACT PHONE', s.contact_phone)}
        ${field('CONTACT EMAIL', s.contact_email)}
        ${field('IT PERSONNEL', s.it_name, s.it_email)}
        ${field('COORDINATOR', s.coordinator_name, s.coordinator_email)}
        ${field('LRS IP', s.lrs_ip)}
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

  function adminOptions(selected) {
    const opts = team.map(t => `<option value="${t.id}" ${String(t.id) === String(selected) ? 'selected' : ''}>${esc(t.full_name)}</option>`).join('');
    return `<option value="">— Unassigned —</option>${opts}`;
  }

  function formBody(s) {
    s = s || {};
    const grp = (inner) => `<div style="display:flex;gap:12px;flex-wrap:wrap">${inner}</div>`;
    const fg = (label, html, flex) => `<div class="form-group" style="flex:${flex || 1};min-width:160px">${label}${html}</div>`;
    return `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="form-group">
          <label>School Name <span style="color:var(--red)">*</span></label>
          <input type="text" id="sc-name" value="${esc(s.name || '')}" placeholder="e.g. Kilema Secondary">
        </div>
        ${grp(
          fg('<label>Region</label>', `<input type="text" id="sc-zone" value="${esc(s.zone || '')}" placeholder="e.g. Rombo">`) +
          fg('<label>Number of Tablets</label>', `<input type="number" id="sc-tablets" min="0" value="${s.tablets != null ? s.tablets : 0}">`)
        )}
        ${grp(
          fg('<label>Students</label>', `<input type="number" id="sc-students" min="0" value="${s.students != null ? s.students : 0}">`) +
          fg('<label>ISP</label>', `<input type="text" id="sc-isp" value="${esc(s.isp || '')}" placeholder="e.g. Vodacom Fibre">`)
        )}

        <div style="font-size:11px;font-weight:600;color:var(--text3);margin-top:6px;letter-spacing:.4px">CONTACT INFO</div>
        ${grp(
          fg('<label>Contact Name</label>', `<input type="text" id="sc-cname" value="${esc(s.contact_name || '')}">`) +
          fg('<label>Contact Role</label>', `<input type="text" id="sc-crole" value="${esc(s.contact_role || '')}" placeholder="e.g. Head Teacher">`)
        )}
        ${grp(
          fg('<label>Contact Phone</label>', `<input type="text" id="sc-cphone" value="${esc(s.contact_phone || '')}" placeholder="+255 ...">`) +
          fg('<label>Contact Email</label>', `<input type="email" id="sc-cemail" value="${esc(s.contact_email || '')}" placeholder="name@school.org">`)
        )}

        <div style="font-size:11px;font-weight:600;color:var(--text3);margin-top:6px;letter-spacing:.4px">IT PERSONNEL</div>
        ${grp(
          fg('<label>IT Personnel Name</label>', `<input type="text" id="sc-itname" value="${esc(s.it_name || '')}">`) +
          fg('<label>IT Personnel Email</label>', `<input type="email" id="sc-itemail" value="${esc(s.it_email || '')}" placeholder="it@school.org">`)
        )}

        <div style="font-size:11px;font-weight:600;color:var(--text3);margin-top:6px;letter-spacing:.4px">COORDINATOR</div>
        ${grp(
          fg('<label>Coordinator Name</label>', `<input type="text" id="sc-coname" value="${esc(s.coordinator_name || '')}">`) +
          fg('<label>Coordinator Email</label>', `<input type="email" id="sc-coemail" value="${esc(s.coordinator_email || '')}" placeholder="coordinator@school.org">`)
        )}

        <div class="form-group">
          <label>Assigned Sub-Admin (Field Engineer)</label>
          <select id="sc-admin">${adminOptions(s.assigned_admin_id)}</select>
        </div>
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

  function collect() {
    const num = (id) => parseInt(document.getElementById(id).value, 10) || 0;
    const val = (id) => document.getElementById(id).value.trim();
    return {
      name: val('sc-name'), zone: val('sc-zone'), tablets: num('sc-tablets'), students: num('sc-students'),
      isp: val('sc-isp'), contact_name: val('sc-cname'), contact_role: val('sc-crole'),
      contact_phone: val('sc-cphone'), contact_email: val('sc-cemail'),
      it_name: val('sc-itname'), it_email: val('sc-itemail'),
      coordinator_name: val('sc-coname'), coordinator_email: val('sc-coemail'),
      assigned_admin_id: document.getElementById('sc-admin').value || null
    };
  }

  function validEmail(e) { return !e || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }

  function validate(d) {
    if (!d.name) return 'School name is required';
    if (!validEmail(d.contact_email)) return 'Contact email is invalid';
    if (!validEmail(d.it_email)) return 'IT personnel email is invalid';
    if (!validEmail(d.coordinator_email)) return 'Coordinator email is invalid';
    return null;
  }

  async function submitCreate() {
    const d = collect();
    const err = validate(d); if (err) { showToast(err); return; }
    const btn = document.getElementById('sc-submit');
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Creating...';
    try {
      await API.createSchool(d);
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

  return { load, render, select, back, openCreate, openEdit, submitCreate, submitEdit, remove };
})();
