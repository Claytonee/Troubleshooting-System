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
      <button class="btn btn-secondary btn-sm" onclick="SchoolsPage.back()"><i class="ti ti-arrow-left"></i> Schools</button>
      ${isAdmin() ? `<div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="SchoolsPage.openEdit(${s.id})"><i class="ti ti-edit"></i> Edit</button>
        <button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:rgba(255,82,99,0.3)" onclick="SchoolsPage.remove(${s.id})"><i class="ti ti-trash"></i> Delete</button>
      </div>` : ''}
    </div>

    <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
      <div style="display:flex;align-items:center;gap:18px;padding:22px 24px;background:rgba(79,124,255,0.06);border-bottom:1px solid var(--border)">
        <div class="school-avatar" style="width:58px;height:58px;font-size:22px;border-radius:15px;background:rgba(79,124,255,0.16);color:var(--accent)">${initials(s.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:22px;font-weight:700;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</div>
          <div style="font-size:13px;color:var(--text3);margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span><i class="ti ti-map-pin" style="vertical-align:-2px"></i> ${esc(s.zone || '—')}</span>
            <span style="font-family:var(--mono);font-size:11px;background:var(--bg4);padding:2px 7px;border-radius:5px">${esc(s.code)}</span>
          </div>
        </div>
        ${statusBadge}
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);padding:16px 18px;gap:12px">
        <div class="stat-card"><div class="stat-label">Students</div><div class="stat-val">${s.students || 0}</div></div>
        <div class="stat-card t"><div class="stat-label">Tablets</div><div class="stat-val" style="color:var(--teal)">${s.tablets || 0}</div></div>
        <div class="stat-card"><div class="stat-label">Routers</div><div class="stat-val">${s.routers || 0}</div></div>
        <div class="stat-card ${hasIssues ? 'a' : 'g'}"><div class="stat-label">Open Issues</div><div class="stat-val" style="color:${hasIssues ? 'var(--amber)' : 'var(--green)'}">${openCount}</div></div>
      </div>
    </div>

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
          fg('<label>ISP</label>', `<input type="text" id="sc-isp" value="${esc(s.isp || '')}" placeholder="e.g. Vodacom Fibre">`)
        )}
        ${grp(
          fg('<label>Number of Tablets</label>', `<input type="number" id="sc-tablets" min="0" value="${s.tablets != null ? s.tablets : 0}">`) +
          fg('<label>Number of Students</label>', `<input type="number" id="sc-students" min="0" value="${s.students != null ? s.students : 0}">`)
        )}

        <div style="font-size:11px;font-weight:600;color:var(--text3);margin-top:6px;letter-spacing:.4px">SCHOOL CONTACT</div>
        ${grp(
          fg('<label>Contact Name</label>', `<input type="text" id="sc-cname" value="${esc(s.contact_name || '')}" placeholder="e.g. Head Teacher name">`) +
          fg('<label>Role</label>', `<input type="text" id="sc-crole" value="${esc(s.contact_role || '')}" placeholder="e.g. Head Teacher">`)
        )}
        ${grp(
          fg('<label>Phone</label>', `<input type="text" id="sc-cphone" value="${esc(s.contact_phone || '')}" placeholder="+255 ...">`) +
          fg('<label>Email</label>', `<input type="email" id="sc-cemail" value="${esc(s.contact_email || '')}" placeholder="school@example.com">`)
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
      assigned_admin_id: document.getElementById('sc-admin').value || null
    };
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
