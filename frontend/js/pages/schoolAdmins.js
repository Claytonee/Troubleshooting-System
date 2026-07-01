/**
 * School Admins Page (platform-admin only)
 * Full CRUD for school-level admin accounts (role 'school', linked to a school).
 */
const SchoolAdminsPage = (() => {
  let admins = [];
  let schools = [];
  let pendingRegs = [];
  let rejectedRegs = [];
  let search = '';
  let filter = 'all'; // all, active, pending, rejected

  async function load() {
    try {
      const token = API.getToken();
      const headers = { 'Authorization': `Bearer ${token}` };
      const [adminsRes, schoolsRes] = await Promise.all([
        API.getSchoolAdmins(),
        API.getSchools().catch(() => [])
      ]);
      admins = adminsRes;
      schools = schoolsRes;

      // Load pending/rejected registrations
      try {
        const pendRes = await fetch('/api/register/approvals/pending', { headers });
        pendingRegs = pendRes.ok ? await pendRes.json() : [];
      } catch (e) { pendingRegs = []; }
      try {
        const allRes = await fetch('/api/register/approvals', { headers });
        if (allRes.ok) {
          const allRegs = await allRes.json();
          rejectedRegs = allRegs.filter(r => r.status === 'rejected');
        } else { rejectedRegs = []; }
      } catch (e) { rejectedRegs = []; }
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

    const stats = {
      total: admins.length,
      active: admins.filter(a => a.status === 'active').length,
      pending: pendingRegs.length,
      rejected: rejectedRegs.length
    };

    let content = '';
    if (filter === 'pending') {
      content = renderPendingList(term);
    } else if (filter === 'rejected') {
      content = renderRejectedList(term);
    } else {
      content = renderAdminsList(term);
    }

    return `
    <div class="sa-page">
      <div class="section-header" style="flex-shrink:0">
        <div>
          <div class="section-title">School Admins</div>
          <div class="section-sub">Manage school-level administrator accounts &amp; approvals</div>
        </div>
        <button class="btn btn-primary" onclick="SchoolAdminsPage.openCreate()"><i class="ti ti-user-plus"></i> Add School Admin</button>
      </div>

      <div class="sa-toolbar">
        <div class="tab-row" style="padding:0;border-bottom:none">
          <button class="tab-btn ${filter === 'all' ? 'active' : ''}" onclick="SchoolAdminsPage.setFilter('all')">All Active (${stats.active})</button>
          <button class="tab-btn ${filter === 'pending' ? 'active' : ''}" onclick="SchoolAdminsPage.setFilter('pending')">Pending ${stats.pending > 0 ? `<span class="notif-badge-inline">${stats.pending}</span>` : `(${stats.pending})`}</button>
          <button class="tab-btn ${filter === 'rejected' ? 'active' : ''}" onclick="SchoolAdminsPage.setFilter('rejected')">Rejected (${stats.rejected})</button>
        </div>
        <input type="text" placeholder="Search by name, email or school..." value="${esc(search)}"
          oninput="SchoolAdminsPage.setSearch(this.value)" class="sa-search">
      </div>

      <div class="sa-list">
        ${content}
      </div>
    </div>`;
  }

  function renderAdminsList(term) {
    const filtered = !term ? admins : admins.filter(a =>
      (a.full_name || '').toLowerCase().includes(term) ||
      (a.username || '').toLowerCase().includes(term) ||
      (a.email || '').toLowerCase().includes(term) ||
      (a.school_name || '').toLowerCase().includes(term)
    );

    if (!filtered.length) return `<div class="empty"><i class="ti ti-user-shield"></i>${admins.length ? 'No school admins match your search' : 'No school admins yet — add one to get started'}</div>`;

    return filtered.map(a => {
      const st = statusBadge(a.status);
      const color = a.color || '#2dd98a';
      return `<div class="sa-row">
        <div class="av" style="width:40px;height:40px;font-size:13px;background:${color}22;color:${color};flex-shrink:0">${initials(a.full_name || '?')}</div>
        <div style="flex:1;min-width:160px">
          <div style="font-weight:600;font-size:13px">${esc(a.full_name)} <span class="badge ${st[0]}" style="margin-left:6px">${st[1]}</span></div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">@${esc(a.username)} · ${esc(a.email)}</div>
        </div>
        <div style="min-width:140px;font-size:11px;color:var(--text2)">
          <div><i class="ti ti-school" style="margin-right:4px;color:var(--accent)"></i>${a.school_name ? esc(a.school_name) : '<span style="color:var(--amber)">Unassigned</span>'}</div>
          <div style="margin-top:2px"><i class="ti ti-phone" style="margin-right:4px;color:var(--text3)"></i>${esc(a.phone || '—')}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-secondary btn-sm" onclick="SchoolAdminsPage.openEdit(${a.id})"><i class="ti ti-edit"></i> Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="SchoolAdminsPage.resetPassword(${a.id})"><i class="ti ti-key"></i></button>
          <button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:rgba(255,82,99,0.3)" onclick="SchoolAdminsPage.remove(${a.id})"><i class="ti ti-trash"></i></button>
        </div>
      </div>`;
    }).join('');
  }

  function renderPendingList(term) {
    const filtered = !term ? pendingRegs : pendingRegs.filter(r =>
      (r.full_name || '').toLowerCase().includes(term) ||
      (r.email || '').toLowerCase().includes(term) ||
      (r.school_name || '').toLowerCase().includes(term)
    );

    if (!filtered.length) return '<div class="empty"><i class="ti ti-clock"></i>No pending registration requests</div>';

    return filtered.map(r => `
      <div class="sa-row sa-row-pending">
        <div class="av" style="width:40px;height:40px;font-size:13px;background:rgba(245,166,35,0.12);color:var(--amber);flex-shrink:0">${initials(r.full_name || '?')}</div>
        <div style="flex:1;min-width:160px">
          <div style="font-weight:600;font-size:13px">${esc(r.full_name)} <span class="badge badge-amber" style="margin-left:6px">Pending</span></div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${esc(r.email)} · ${esc(r.phone || '')}</div>
          ${r.title ? `<div style="font-size:11px;color:var(--text3);margin-top:1px">Role: ${esc(r.title)}</div>` : ''}
        </div>
        <div style="min-width:140px;font-size:11px;color:var(--text2)">
          <div><i class="ti ti-school" style="margin-right:4px;color:var(--accent)"></i>${esc(r.school_name || 'Unknown')}</div>
          <div style="margin-top:2px;color:var(--text3)"><i class="ti ti-clock" style="margin-right:4px"></i>${timeAgo(r.created_at)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-sm" style="background:var(--green);color:#fff;border:none" onclick="SchoolAdminsPage.approveReg(${r.id})"><i class="ti ti-check"></i> Approve</button>
          <button class="btn btn-sm" style="background:var(--red);color:#fff;border:none" onclick="SchoolAdminsPage.rejectReg(${r.id})"><i class="ti ti-x"></i> Reject</button>
        </div>
      </div>
    `).join('');
  }

  function renderRejectedList(term) {
    const filtered = !term ? rejectedRegs : rejectedRegs.filter(r =>
      (r.full_name || '').toLowerCase().includes(term) ||
      (r.email || '').toLowerCase().includes(term) ||
      (r.school_name || '').toLowerCase().includes(term)
    );

    if (!filtered.length) return '<div class="empty"><i class="ti ti-user-x"></i>No rejected registrations</div>';

    return filtered.map(r => `
      <div class="sa-row sa-row-rejected">
        <div class="av" style="width:40px;height:40px;font-size:13px;background:rgba(255,82,99,0.1);color:var(--red);flex-shrink:0">${initials(r.full_name || '?')}</div>
        <div style="flex:1;min-width:160px">
          <div style="font-weight:600;font-size:13px">${esc(r.full_name)} <span class="badge badge-red" style="margin-left:6px">Rejected</span></div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${esc(r.email)} · ${esc(r.phone || '')}</div>
        </div>
        <div style="min-width:140px;font-size:11px;color:var(--text2)">
          <div><i class="ti ti-school" style="margin-right:4px;color:var(--accent)"></i>${esc(r.school_name || 'Unknown')}</div>
          <div style="margin-top:2px;color:var(--text3)">Reason: ${esc(r.rejection_reason || 'None given')}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-secondary btn-sm" onclick="SchoolAdminsPage.approveReg(${r.id})"><i class="ti ti-check"></i> Approve</button>
        </div>
      </div>
    `).join('');
  }

  function setFilter(f) {
    filter = f;
    search = '';
    App.render();
  }

  function setSearch(v) {
    search = v;
    const main = document.querySelector('main');
    if (main) main.innerHTML = render();
    const box = main && main.querySelector('input[placeholder^="Search by name"]');
    if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
  }

  async function approveReg(id) {
    if (!confirm('Approve this registration? The user will be able to sign in.')) return;
    try {
      const token = API.getToken();
      const res = await fetch(`/api/register/approvals/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        showToast('Registration approved — account is now active');
        await load(); App.render();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to approve');
      }
    } catch (e) { showToast('Network error'); }
  }

  async function rejectReg(id) {
    const reason = prompt('Rejection reason (will be shown to applicant):');
    if (reason === null) return;
    try {
      const token = API.getToken();
      const res = await fetch(`/api/register/approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Registration not approved' })
      });
      if (res.ok) {
        showToast('Registration rejected');
        await load(); App.render();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to reject');
      }
    } catch (e) { showToast('Network error'); }
  }

  function timeAgo(date) {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
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

  return { load, render, setFilter, setSearch, openCreate, openEdit, submitCreate, submitEdit, resetPassword, remove, approveReg, rejectReg };
})();
