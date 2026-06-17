/**
 * School Admins Page (platform-admin only)
 * Full CRUD for school-level admin accounts (role 'school', linked to a school).
 */
const SchoolAdminsPage = (() => {
  let admins = [];
  let schools = [];
  let search = '';

  async function load() {
    try {
      [admins, schools] = await Promise.all([
        API.getSchoolAdmins(),
        API.getSchools().catch(() => [])
      ]);
    } catch (e) { admins = []; }
  }

  function statusBadge(status) {
    const map = {
      active: ['badge-green', 'Active'],
      inactive: ['badge-gray', 'Inactive'],
      onsite: ['badge-amber', 'On Site'],
      remote: ['badge-gray', 'Remote']
    };
    return map[status] || ['badge-gray', '—'];
  }

  function schoolOptions(selectedId) {
    const opts = schools.map(s =>
      `<option value="${s.id}" ${String(s.id) === String(selectedId) ? 'selected' : ''}>${esc(s.name)}${s.zone ? ' · ' + esc(s.zone) : ''}</option>`
    ).join('');
    return `<option value="">— Select a school —</option>${opts}`;
  }

  function render() {
    const term = search.trim().toLowerCase();
    const filtered = !term ? admins : admins.filter(a =>
      (a.full_name || '').toLowerCase().includes(term) ||
      (a.username || '').toLowerCase().includes(term) ||
      (a.email || '').toLowerCase().includes(term) ||
      (a.school_name || '').toLowerCase().includes(term)
    );

    const stats = {
      total: admins.length,
      active: admins.filter(a => a.status === 'active').length,
      unassigned: admins.filter(a => !a.school_id).length
    };

    const rows = filtered.length ? filtered.map(a => {
      const st = statusBadge(a.status);
      const color = a.color || '#2dd98a';
      return `<div class="card" style="padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div class="av" style="width:42px;height:42px;font-size:14px;background:${color}22;color:${color};flex-shrink:0">${initials(a.full_name || '?')}</div>
          <div style="flex:1;min-width:180px">
            <div style="font-weight:600;font-size:14px">${esc(a.full_name)} <span class="badge ${st[0]}" style="margin-left:6px">${st[1]}</span></div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px">@${esc(a.username)} · ${esc(a.email)}</div>
          </div>
          <div style="min-width:160px;font-size:12px;color:var(--text2)">
            <div><i class="ti ti-school" style="margin-right:6px;color:var(--accent)"></i>${a.school_name ? esc(a.school_name) : '<span style="color:var(--amber)">No school assigned</span>'}</div>
            <div><i class="ti ti-phone" style="margin-right:6px;color:var(--text3)"></i>${esc(a.phone || '—')}</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px" onclick="SchoolAdminsPage.openEdit(${a.id})"><i class="ti ti-edit"></i> Edit</button>
            <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px" onclick="SchoolAdminsPage.resetPassword(${a.id})"><i class="ti ti-key"></i> Password</button>
            <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;color:var(--red);border-color:rgba(255,82,99,0.3)" onclick="SchoolAdminsPage.remove(${a.id})"><i class="ti ti-trash"></i> Delete</button>
          </div>
        </div>
      </div>`;
    }).join('') : `<div class="empty"><i class="ti ti-user-shield"></i>${admins.length ? 'No school admins match your search' : 'No school admins yet — add one to get started'}</div>`;

    return `
    <div class="section-header">
      <div>
        <div class="section-title">School Admins</div>
        <div class="section-sub">Manage school-level administrator accounts &amp; their school assignment</div>
      </div>
      <button class="btn btn-primary" onclick="SchoolAdminsPage.openCreate()"><i class="ti ti-user-plus"></i> Add School Admin</button>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(3, 1fr)">
      <div class="stat-card"><div class="stat-label">Total School Admins</div><div class="stat-val">${stats.total}</div><div class="stat-sub">all schools</div></div>
      <div class="stat-card t"><div class="stat-label">Active</div><div class="stat-val" style="color:var(--green)">${stats.active}</div><div class="stat-sub">can sign in</div></div>
      <div class="stat-card a"><div class="stat-label">Unassigned</div><div class="stat-val" style="color:var(--amber)">${stats.unassigned}</div><div class="stat-sub">no school linked</div></div>
    </div>

    <div style="margin-bottom:16px">
      <input type="text" placeholder="Search by name, username, email or school..." value="${esc(search)}"
        oninput="SchoolAdminsPage.setSearch(this.value)" style="width:100%;max-width:420px;padding:9px 12px">
    </div>

    ${rows}`;
  }

  function setSearch(v) {
    search = v;
    // Re-render only the list area without rebuilding focus-stealing input would be ideal;
    // simple full re-render keeps logic clear for this admin tool.
    const main = document.querySelector('main');
    if (main) main.innerHTML = render();
    // Restore focus + caret to the search box.
    const box = main && main.querySelector('input[placeholder^="Search by name"]');
    if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
  }

  function formBody(a) {
    a = a || {};
    return `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="form-group">
          <label>Full Name <span style="color:var(--red)">*</span></label>
          <input type="text" id="sa-name" value="${esc(a.full_name || '')}" placeholder="e.g. Eliya Mushi">
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div class="form-group" style="flex:1;min-width:160px">
            <label>Username <span style="color:var(--red)">*</span></label>
            <input type="text" id="sa-username" value="${esc(a.username || '')}" placeholder="e.g. emushi" ${a.id ? 'disabled title="Username cannot be changed"' : ''}>
          </div>
          <div class="form-group" style="flex:1;min-width:160px">
            <label>Phone</label>
            <input type="text" id="sa-phone" value="${esc(a.phone || '')}" placeholder="+255 ...">
          </div>
        </div>
        <div class="form-group">
          <label>Email <span style="color:var(--red)">*</span></label>
          <input type="email" id="sa-email" value="${esc(a.email || '')}" placeholder="name@school.org">
        </div>
        <div class="form-group">
          <label>Assigned School <span style="color:var(--red)">*</span></label>
          <select id="sa-school">${schoolOptions(a.school_id)}</select>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div class="form-group" style="flex:1;min-width:160px">
            <label>Status</label>
            <select id="sa-status">
              <option value="active" ${a.status === 'active' || !a.status ? 'selected' : ''}>Active</option>
              <option value="inactive" ${a.status === 'inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
          <div class="form-group" style="flex:1;min-width:160px">
            <label>Title</label>
            <input type="text" id="sa-title" value="${esc(a.title || 'School Administrator')}" placeholder="School Administrator">
          </div>
        </div>
        ${a.id ? '' : `
        <div class="form-group">
          <label>Initial Password</label>
          <input type="text" id="sa-password" placeholder="Leave blank for default: changeme123">
          <div style="font-size:11px;color:var(--text3);margin-top:4px">The admin should change this after first login.</div>
        </div>`}
      </div>`;
  }

  function openCreate() {
    if (!schools.length) { showToast('Add a school first before creating school admins'); return; }
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" id="sa-submit" onclick="SchoolAdminsPage.submitCreate()"><i class="ti ti-user-plus"></i> Create</button>`;
    Modal.open('Add School Admin', formBody(), footer);
  }

  function openEdit(id) {
    const a = admins.find(x => x.id === id);
    if (!a) return;
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" id="sa-submit" onclick="SchoolAdminsPage.submitEdit(${id})"><i class="ti ti-check"></i> Save Changes</button>`;
    Modal.open('Edit School Admin', formBody(a), footer);
  }

  function collect() {
    return {
      full_name: document.getElementById('sa-name').value.trim(),
      username: (document.getElementById('sa-username').value || '').trim(),
      email: document.getElementById('sa-email').value.trim(),
      phone: document.getElementById('sa-phone').value.trim(),
      school_id: document.getElementById('sa-school').value || null,
      status: document.getElementById('sa-status').value,
      title: document.getElementById('sa-title').value.trim()
    };
  }

  function validateForm(d, isCreate) {
    if (!d.full_name) return 'Full name is required';
    if (isCreate && d.username.length < 3) return 'Username must be at least 3 characters';
    if (!d.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return 'A valid email is required';
    if (!d.school_id) return 'Please assign a school';
    return null;
  }

  async function submitCreate() {
    const d = collect();
    const err = validateForm(d, true);
    if (err) { showToast(err); return; }
    const pw = document.getElementById('sa-password').value.trim();
    if (pw) d.password = pw;

    const btn = document.getElementById('sa-submit');
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Creating...';
    try {
      await API.createSchoolAdmin(d);
      Modal.close();
      showToast('School admin created');
      await load(); App.render();
    } catch (e) {
      showToast(e.error || 'Could not create school admin');
      btn.disabled = false; btn.innerHTML = '<i class="ti ti-user-plus"></i> Create';
    }
  }

  async function submitEdit(id) {
    const d = collect();
    const err = validateForm(d, false);
    if (err) { showToast(err); return; }

    const btn = document.getElementById('sa-submit');
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Saving...';
    try {
      await API.updateSchoolAdmin(id, d);
      Modal.close();
      showToast('School admin updated');
      await load(); App.render();
    } catch (e) {
      showToast(e.error || 'Could not update school admin');
      btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Save Changes';
    }
  }

  async function resetPassword(id) {
    const a = admins.find(x => x.id === id);
    if (!a) return;
    const pw = prompt(`Set a new password for ${a.full_name} (min 6 characters):`);
    if (pw === null) return;
    if (pw.trim().length < 6) { showToast('Password must be at least 6 characters'); return; }
    try {
      await API.resetSchoolAdminPassword(id, pw.trim());
      showToast('Password reset');
    } catch (e) { showToast(e.error || 'Could not reset password'); }
  }

  async function remove(id) {
    const a = admins.find(x => x.id === id);
    if (!a) return;
    if (!confirm(`Delete school admin "${a.full_name}" permanently? This cannot be undone.`)) return;
    try {
      await API.deleteSchoolAdmin(id);
      showToast('School admin deleted');
      await load(); App.render();
    } catch (e) { showToast(e.error || 'Could not delete school admin'); }
  }

  return { load, render, setSearch, openCreate, openEdit, submitCreate, submitEdit, resetPassword, remove };
})();
