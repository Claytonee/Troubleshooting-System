const TeachersPage = (() => {
  let teachers = [];
  let pendingTeachers = [];
  let links = [];
  let tab = 'teachers'; // teachers, pending, links

  async function load() {
    try {
      const token = API.getToken();
      const headers = { 'Authorization': `Bearer ${token}` };
      const [tRes, pRes, lRes] = await Promise.all([
        fetch('/api/register/teachers', { headers }),
        fetch('/api/register/teacher-approvals/pending', { headers }),
        fetch('/api/register/teacher-links', { headers })
      ]);
      teachers = await tRes.json();
      pendingTeachers = await pRes.json();
      links = await lRes.json();
    } catch (e) { teachers = []; pendingTeachers = []; links = []; }
  }

  function render() {
    const activeCount = Array.isArray(teachers) ? teachers.filter(t => t.status === 'active').length : 0;
    const suspendedCount = Array.isArray(teachers) ? teachers.filter(t => t.status === 'suspended').length : 0;
    const pendingCount = Array.isArray(pendingTeachers) ? pendingTeachers.length : 0;

    return `
    <div class="section-header">
      <div>
        <div class="section-title">Teacher Management</div>
        <div class="section-sub">Manage teachers, approvals, and registration links</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="TeachersPage.generateLink()"><i class="ti ti-link"></i> Generate Registration Link</button>
        <button class="btn btn-sm" onclick="TeachersPage.showAddModal()"><i class="ti ti-plus"></i> Add Teacher</button>
      </div>
    </div>
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card g"><div class="stat-label">Active</div><div class="stat-val" style="color:var(--green)">${activeCount}</div><div class="stat-sub">teachers</div></div>
      <div class="stat-card a"><div class="stat-label">Pending</div><div class="stat-val" style="color:var(--amber)">${pendingCount}</div><div class="stat-sub">awaiting approval</div></div>
      <div class="stat-card r"><div class="stat-label">Suspended</div><div class="stat-val" style="color:var(--red)">${suspendedCount}</div><div class="stat-sub">teachers</div></div>
    </div>
    <div class="card">
      <div class="tab-row" style="margin-bottom:16px">
        <button class="tab-btn ${tab === 'teachers' ? 'active' : ''}" onclick="TeachersPage.setTab('teachers')">Teachers (${Array.isArray(teachers) ? teachers.length : 0})</button>
        <button class="tab-btn ${tab === 'pending' ? 'active' : ''}" onclick="TeachersPage.setTab('pending')">Pending (${pendingCount})</button>
        <button class="tab-btn ${tab === 'links' ? 'active' : ''}" onclick="TeachersPage.setTab('links')">Reg. Links (${Array.isArray(links) ? links.length : 0})</button>
      </div>
      ${tab === 'teachers' ? renderTeachers() : tab === 'pending' ? renderPending() : renderLinks()}
    </div>`;
  }

  function renderTeachers() {
    if (!Array.isArray(teachers) || !teachers.length) return '<div class="empty-state">No teachers registered yet</div>';
    return `<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${teachers.map(t => `<tr>
          <td><strong>${esc(t.full_name)}</strong></td>
          <td>${esc(t.email)}</td>
          <td>${esc(t.subject || '—')}</td>
          <td><span class="badge-${t.status === 'active' ? 'green' : t.status === 'suspended' ? 'red' : 'gray'}">${t.status}</span></td>
          <td>
            ${t.status === 'active' ? `<button class="btn-icon" title="Suspend" onclick="TeachersPage.updateStatus(${t.id},'suspended')"><i class="ti ti-ban"></i></button>` : ''}
            ${t.status === 'suspended' ? `<button class="btn-icon" title="Reactivate" onclick="TeachersPage.updateStatus(${t.id},'active')"><i class="ti ti-check"></i></button>` : ''}
            <button class="btn-icon" title="Delete" onclick="TeachersPage.deleteTeacher(${t.id})"><i class="ti ti-trash"></i></button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  function renderPending() {
    if (!Array.isArray(pendingTeachers) || !pendingTeachers.length) return '<div class="empty-state">No pending teacher registrations</div>';
    return `<div class="approval-list">
      ${pendingTeachers.map(t => `
        <div class="approval-item">
          <div class="approval-info">
            <div class="approval-name">${esc(t.full_name)}</div>
            <div class="approval-meta">${esc(t.email)} &middot; ${esc(t.phone || 'No phone')}</div>
            ${t.subject ? `<div class="approval-meta"><strong>Subject:</strong> ${esc(t.subject)}</div>` : ''}
            <div class="approval-meta" style="color:var(--text3)">Registered ${timeAgo(t.created_at)}</div>
          </div>
          <div class="approval-actions">
            <button class="btn btn-sm" style="background:var(--green);color:#fff" onclick="TeachersPage.approveTeacher(${t.teacher_id})">Approve</button>
            <button class="btn btn-sm" style="background:var(--red);color:#fff" onclick="TeachersPage.rejectTeacher(${t.teacher_id})">Reject</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  function renderLinks() {
    if (!Array.isArray(links) || !links.length) return '<div class="empty-state">No registration links generated yet</div>';
    return `<div class="approval-list">
      ${links.map(l => {
        const expired = new Date(l.expires_at) < new Date();
        const full = l.use_count >= l.max_uses;
        const active = l.is_active && !expired && !full;
        return `
        <div class="approval-item">
          <div class="approval-info">
            <div class="approval-name" style="font-family:var(--mono);font-size:11px">${window.location.origin}/register/teacher/${l.token.substring(0, 12)}...</div>
            <div class="approval-meta">Uses: ${l.use_count}/${l.max_uses} &middot; Expires: ${new Date(l.expires_at).toLocaleDateString()}</div>
            <div class="approval-meta"><span class="badge-${active ? 'green' : 'red'}">${active ? 'Active' : expired ? 'Expired' : full ? 'Full' : 'Deactivated'}</span></div>
          </div>
          <div class="approval-actions">
            ${active ? `
              <button class="btn btn-sm" onclick="TeachersPage.copyLink('${l.token}')">Copy Link</button>
              <button class="btn btn-sm" style="background:var(--red);color:#fff" onclick="TeachersPage.deactivateLink(${l.id})">Deactivate</button>
            ` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function setTab(t) { tab = t; App.render(); }

  async function generateLink() {
    try {
      const token = API.getToken();
      const res = await fetch('/api/register/teacher-links', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_uses: 50 })
      });
      const data = await res.json();
      if (res.ok) {
        const fullUrl = `${window.location.origin}/register/teacher/${data.token}`;
        await navigator.clipboard.writeText(fullUrl).catch(() => {});
        showToast('Registration link generated and copied!');
        await load(); App.render();
      } else {
        showToast(data.error || 'Failed');
      }
    } catch (e) { showToast('Network error'); }
  }

  function copyLink(token) {
    const url = `${window.location.origin}/register/teacher/${token}`;
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!')).catch(() => showToast('Copy failed'));
  }

  async function deactivateLink(id) {
    if (!confirm('Deactivate this link?')) return;
    try {
      const token = API.getToken();
      await fetch(`/api/register/teacher-links/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showToast('Link deactivated');
      await load(); App.render();
    } catch (e) { showToast('Failed'); }
  }

  async function approveTeacher(id) {
    try {
      const token = API.getToken();
      const res = await fetch(`/api/register/teacher-approvals/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { showToast('Teacher approved'); await load(); App.render(); }
      else { const d = await res.json(); showToast(d.error || 'Failed'); }
    } catch (e) { showToast('Network error'); }
  }

  async function rejectTeacher(id) {
    if (!confirm('Reject this teacher registration?')) return;
    try {
      const token = API.getToken();
      const res = await fetch(`/api/register/teacher-approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { showToast('Teacher rejected'); await load(); App.render(); }
      else { const d = await res.json(); showToast(d.error || 'Failed'); }
    } catch (e) { showToast('Network error'); }
  }

  async function updateStatus(id, status) {
    const action = status === 'suspended' ? 'suspend' : 'reactivate';
    if (!confirm(`${action} this teacher?`)) return;
    try {
      const token = API.getToken();
      const res = await fetch(`/api/register/teachers/${id}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) { showToast(`Teacher ${action}d`); await load(); App.render(); }
    } catch (e) { showToast('Failed'); }
  }

  async function deleteTeacher(id) {
    if (!confirm('Permanently remove this teacher? This cannot be undone.')) return;
    try {
      const token = API.getToken();
      const res = await fetch(`/api/register/teachers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { showToast('Teacher removed'); await load(); App.render(); }
    } catch (e) { showToast('Failed'); }
  }

  function showAddModal() {
    Modal.show('Add Teacher', `
      <form onsubmit="TeachersPage.submitAdd(event)">
        <div class="form-group"><label>Full Name *</label><input type="text" id="add-t-name" required class="form-control"></div>
        <div class="form-group"><label>Email *</label><input type="email" id="add-t-email" required class="form-control"></div>
        <div class="form-group"><label>Phone</label><input type="tel" id="add-t-phone" class="form-control"></div>
        <div class="form-group"><label>Subject</label><input type="text" id="add-t-subject" class="form-control" placeholder="e.g. Mathematics"></div>
        <div class="form-group"><label>Employee ID</label><input type="text" id="add-t-empid" class="form-control"></div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:12px">Add Teacher</button>
      </form>
    `);
  }

  async function submitAdd(e) {
    e.preventDefault();
    const body = {
      full_name: document.getElementById('add-t-name').value.trim(),
      email: document.getElementById('add-t-email').value.trim(),
      phone: document.getElementById('add-t-phone').value.trim(),
      subject: document.getElementById('add-t-subject').value.trim(),
      employee_id: document.getElementById('add-t-empid').value.trim()
    };
    try {
      const token = API.getToken();
      const res = await fetch('/api/register/teachers', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        Modal.hide();
        showToast(data.temporary_password ? `Teacher added! Temp password: ${data.temporary_password}` : 'Teacher added!');
        await load(); App.render();
      } else {
        showToast(data.error || 'Failed');
      }
    } catch (e) { showToast('Network error'); }
  }

  function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function afterRender() {}

  return { load, render, afterRender, setTab, generateLink, copyLink, deactivateLink, approveTeacher, rejectTeacher, updateStatus, deleteTeacher, showAddModal, submitAdd };
})();
