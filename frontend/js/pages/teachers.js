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
        <button class="btn btn-primary btn-sm" data-tip="${TIP.GENERATE_LINK}" onclick="TeachersPage.openGenerateModal()"><i class="ti ti-link"></i> Generate Registration Link</button>
        <button class="btn btn-sm" data-tip="${TIP.ADD_TEACHER}" onclick="TeachersPage.showAddModal()"><i class="ti ti-plus"></i> Add Teacher</button>
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
    const keyHolders = teachers.filter(t => t.can_manage_inventory);
    return `
    <div style="background:var(--bg1);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:flex-start;gap:10px">
      <i class="ti ti-device-tablet" style="font-size:16px;color:${keyHolders.length ? 'var(--teal)' : 'var(--text3)'};margin-top:1px"></i>
      <div style="font-size:12px;color:var(--text2);line-height:1.5">
        <strong style="color:var(--text)">Tablet inventory</strong> is read-only for teachers.
        ${keyHolders.length
          ? `${keyHolders.map(t => esc(t.full_name)).join(', ')} can add and edit devices${keyHolders.length === 1 && keyHolders[0].inventory_granted_at ? ` (since ${new Date(keyHolders[0].inventory_granted_at).toLocaleDateString()})` : ''}.`
          : 'Give one teacher edit access with the tablet button below, and take it back when their turn is over.'}
      </div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Name</th><th class="hide-mobile">Email</th><th class="hide-mobile">Subject</th><th>Status</th><th>Inventory</th><th>Actions</th></tr></thead>
      <tbody>
        ${teachers.map(t => `<tr>
          <td><strong>${esc(t.full_name)}</strong></td>
          <td class="hide-mobile">${esc(t.email)}</td>
          <td class="hide-mobile">${esc(t.subject || '—')}</td>
          <td><span class="badge-${t.status === 'active' ? 'green' : t.status === 'suspended' ? 'red' : 'gray'}">${t.status}</span></td>
          <td>
            ${t.can_manage_inventory
              ? `<span class="badge-teal" data-tip="Can add, edit and re-assign this school's tablets${t.inventory_granted_by_name ? ' · granted by ' + esc(t.inventory_granted_by_name) : ''}">Can edit</span>`
              : `<span style="font-size:11px;color:var(--text3)">Read-only</span>`}
          </td>
          <td>
            ${t.status === 'active' ? `<button class="btn-icon" data-tip="${t.can_manage_inventory ? 'Take back inventory edit access' : 'Let this teacher manage the tablet inventory'}" data-tip-color="${t.can_manage_inventory ? 'red' : 'teal'}" onclick="TeachersPage.setInventoryAccess(${t.id}, ${t.can_manage_inventory ? 'false' : 'true'})"><i class="ti ti-device-tablet${t.can_manage_inventory ? '-off' : ''}" style="color:${t.can_manage_inventory ? 'var(--teal)' : 'inherit'}"></i></button>` : ''}
            ${t.status === 'active' ? `<button class="btn-icon" data-tip="${TIP.SUSPEND}" onclick="TeachersPage.updateStatus(${t.id},'suspended')"><i class="ti ti-ban"></i></button>` : ''}
            ${t.status === 'suspended' ? `<button class="btn-icon" data-tip="${TIP.REACTIVATE}" onclick="TeachersPage.updateStatus(${t.id},'active')"><i class="ti ti-check"></i></button>` : ''}
            <button class="btn-icon" data-tip="${TIP.DELETE}" data-tip-color="red" onclick="TeachersPage.deleteTeacher(${t.id})"><i class="ti ti-trash"></i></button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  /**
   * Grant or revoke a teacher's inventory write access.
   *
   * `granted` is sent explicitly rather than toggled server-side, so a retry on
   * a bad connection cannot land in the opposite state from the one the school
   * admin clicked.
   */
  async function setInventoryAccess(id, granted) {
    const t = (Array.isArray(teachers) ? teachers : []).find(x => x.id === id);
    const name = t ? t.full_name : 'this teacher';
    if (!confirm(granted
      ? `Let ${name} add and edit tablets in the inventory?`
      : `Take back ${name}'s inventory edit access? They keep read-only access.`)) return;
    try {
      const token = API.getToken();
      const res = await fetch(`/api/register/teachers/${id}/inventory-access`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ granted })
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message); await load(); App.render(); }
      else showToast(data.error || 'Could not change inventory access');
    } catch (e) { showToast('Network error'); }
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
            <button class="btn btn-sm" data-tip="${TIP.APPROVE}" data-tip-color="green" style="background:var(--green);color:#fff" onclick="TeachersPage.approveTeacher(${t.teacher_id})">Approve</button>
            <button class="btn btn-sm" data-tip="${TIP.REJECT}" data-tip-color="red" style="background:var(--red);color:#fff" onclick="TeachersPage.rejectTeacher(${t.teacher_id})">Reject</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  function renderLinks() {
    if (!Array.isArray(links) || !links.length) return '<div class="empty-state"><i class="ti ti-link-off" style="font-size:32px;opacity:.4;display:block;margin-bottom:8px"></i>No registration links generated yet.<br><span style="font-size:12px;color:var(--text3)">Click "Generate Registration Link" to create one.</span></div>';
    return `<div style="display:flex;flex-direction:column;gap:12px">
      ${links.map(l => {
        const expired = new Date(l.expires_at) < new Date();
        const full = l.use_count >= l.max_uses;
        const active = l.is_active && !expired && !full;
        const statusLabel = active ? 'Active' : expired ? 'Expired' : full ? 'Full' : 'Deactivated';
        const statusColor = active ? 'green' : 'red';
        const expires = new Date(l.expires_at);
        const created = new Date(l.created_at);
        const daysLeft = Math.max(0, Math.ceil((expires - Date.now()) / (1000 * 60 * 60 * 24)));
        const usePct = Math.round((l.use_count / l.max_uses) * 100);
        const fullUrl = `${window.location.origin}/register/teacher/${l.token}`;
        return `
        <div style="background:var(--bg1);border:1px solid var(--border);border-radius:10px;padding:16px;border-left:3px solid var(--${statusColor})">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span class="badge-${statusColor}">${statusLabel}</span>
            <span style="font-size:11px;color:var(--text3)">Created ${timeAgo(l.created_at)}</span>
          </div>
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 10px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <code style="flex:1;font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fullUrl}</code>
            ${active ? `<button class="btn-icon" data-tip="${TIP.COPY_LINK}" onclick="TeachersPage.copyLink('${l.token}')" style="flex-shrink:0"><i class="ti ti-copy"></i></button>` : ''}
          </div>
          <div class="teachers-link-stats" style="gap:12px;margin-bottom:${active ? '12px' : '0'}">
            <div>
              <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Usage</div>
              <div style="font-size:14px;font-weight:600;color:var(--text)">${l.use_count}<span style="font-size:11px;color:var(--text3);font-weight:400">/${l.max_uses}</span></div>
              <div style="margin-top:4px;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden"><div style="height:100%;width:${usePct}%;background:var(--${usePct >= 90 ? 'red' : usePct >= 60 ? 'amber' : 'green'});border-radius:2px"></div></div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">${active ? 'Expires in' : 'Expired'}</div>
              <div style="font-size:14px;font-weight:600;color:${active ? 'var(--text)' : 'var(--red)'}">${active ? daysLeft + 'd' : expired ? 'Expired' : '—'}</div>
              <div style="font-size:11px;color:var(--text3)">${expires.toLocaleDateString()}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Created</div>
              <div style="font-size:14px;font-weight:600;color:var(--text)">${created.toLocaleDateString(undefined, {day:'numeric',month:'short'})}</div>
              <div style="font-size:11px;color:var(--text3)">${created.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>
          ${l.is_active && !expired ? `<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">
            <button class="btn btn-sm" data-tip="Change how many teachers this link may admit" onclick="TeachersPage.openCapModal(${l.id})"><i class="ti ti-users"></i> Change limit</button>
            <button class="btn btn-sm" data-tip="${TIP.DEACTIVATE_LINK}" data-tip-color="red" style="background:var(--red);color:#fff" onclick="TeachersPage.deactivateLink(${l.id})"><i class="ti ti-link-off"></i> Deactivate</button>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  function setTab(t) { tab = t; App.render(); }

  /**
   * Ask how many teachers the link should admit before creating it.
   *
   * It used to be hardcoded at 50 for every school. A link shared in a staff
   * WhatsApp group can travel, and 50 slots at a school with 12 teachers is 38
   * openings nobody is watching — so the person who knows the staff list sets
   * the number.
   */
  function openGenerateModal() {
    const suggested = Math.max(1, (Array.isArray(teachers) ? teachers.length : 0) + 5);
    Modal.open('Generate Registration Link', `
      <form onsubmit="TeachersPage.generateLink(event)">
        <div class="form-group">
          <label>How many teachers may register with this link?</label>
          <input type="number" id="gen-max-uses" class="form-control" min="1" max="500" step="1"
                 value="${suggested}" required>
          <div style="font-size:11px;color:var(--text3);margin-top:6px">
            The link stops accepting registrations once the limit is reached, and expires after 7 days either way.
            ${Array.isArray(teachers) && teachers.length ? `You currently have ${teachers.length} teacher(s) on file.` : ''}
          </div>
        </div>
        <div style="background:rgba(79,124,255,0.06);border:1px solid rgba(79,124,255,0.15);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--text2);display:flex;align-items:flex-start;gap:8px">
          <i class="ti ti-info-circle" style="color:var(--accent);flex-shrink:0;margin-top:1px"></i>
          <span>Every teacher who registers still needs your approval before they can sign in.</span>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:14px"><i class="ti ti-link"></i> Generate Link</button>
      </form>
    `, '');
  }

  async function generateLink(e) {
    if (e) e.preventDefault();
    const maxUses = Number(document.getElementById('gen-max-uses')?.value || 50);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 500) {
      showToast('Enter a whole number between 1 and 500');
      return;
    }
    try {
      const token = API.getToken();
      const res = await fetch('/api/register/teacher-links', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_uses: maxUses })
      });
      const data = await res.json();
      if (res.ok) {
        const fullUrl = `${window.location.origin}/register/teacher/${data.token}`;
        await navigator.clipboard.writeText(fullUrl).catch(() => {});
        showLinkModal(fullUrl, data);
        tab = 'links';
        await load();
      } else {
        showToast(data.error || 'Failed');
      }
    } catch (e) { showToast('Network error'); }
  }

  function showLinkModal(url, data) {
    const expires = new Date(data.expires_at);
    const daysLeft = Math.ceil((expires - Date.now()) / (1000 * 60 * 60 * 24));
    Modal.open('Registration Link Generated', `
      <div style="text-align:center;margin-bottom:16px">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(45,217,138,0.12);display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px">
          <i class="ti ti-check" style="font-size:24px;color:var(--green)"></i>
        </div>
        <div style="font-size:13px;color:var(--text2)">Link created and copied to clipboard</div>
      </div>
      <div style="background:var(--bg1);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px">
        <div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Registration URL</div>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="text" value="${url}" readonly style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:11px;font-family:var(--mono);color:var(--text);outline:none" id="gen-link-url">
          <button class="btn btn-sm" data-tip="${TIP.COPY_LINK}" onclick="TeachersPage.copyGenerated()" style="white-space:nowrap"><i class="ti ti-copy"></i> Copy</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div style="background:var(--bg1);border:1px solid var(--border);border-radius:8px;padding:12px">
          <div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Expires in</div>
          <div style="font-size:18px;font-weight:600;color:var(--text)">${daysLeft} days</div>
          <div style="font-size:11px;color:var(--text3)">${expires.toLocaleDateString()} ${expires.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <div style="background:var(--bg1);border:1px solid var(--border);border-radius:8px;padding:12px">
          <div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Max Uses</div>
          <div style="font-size:18px;font-weight:600;color:var(--text)">${data.max_uses}</div>
          <div style="font-size:11px;color:var(--text3)">teachers can register</div>
        </div>
      </div>
      <div style="background:rgba(79,124,255,0.06);border:1px solid rgba(79,124,255,0.15);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--text2);display:flex;align-items:flex-start;gap:8px">
        <i class="ti ti-info-circle" style="color:var(--accent);flex-shrink:0;margin-top:1px"></i>
        <span>Share this link with teachers. They'll fill a registration form and await your approval before gaining access.</span>
      </div>
    `, '<button class="btn btn-primary" onclick="Modal.close()">Done</button>');
  }

  function copyGenerated() {
    const input = document.getElementById('gen-link-url');
    if (input) {
      navigator.clipboard.writeText(input.value).then(() => showToast('Link copied!')).catch(() => showToast('Copy failed'));
    }
  }

  function copyLink(token) {
    const url = `${window.location.origin}/register/teacher/${token}`;
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!')).catch(() => showToast('Copy failed'));
  }

  /**
   * Raise (or lower) the cap on a link that is already circulating.
   *
   * The alternative is deactivating it and sending a new URL to everyone, which
   * in practice means the teachers who kept the old one quietly cannot register.
   */
  function openCapModal(id) {
    const link = (Array.isArray(links) ? links : []).find(l => l.id === id);
    if (!link) return;
    Modal.open('Registration limit', `
      <form onsubmit="TeachersPage.saveCap(event, ${id})">
        <div class="form-group">
          <label>Maximum teachers for this link</label>
          <input type="number" id="cap-max-uses" class="form-control" min="${Math.max(1, link.use_count)}" max="500" step="1"
                 value="${link.max_uses}" required>
          <div style="font-size:11px;color:var(--text3);margin-top:6px">
            ${link.use_count} teacher(s) have already registered through this link, so the limit cannot go below ${Math.max(1, link.use_count)}.
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:12px">Save limit</button>
      </form>
    `, '');
  }

  async function saveCap(e, id) {
    e.preventDefault();
    const max_uses = Number(document.getElementById('cap-max-uses')?.value);
    try {
      const token = API.getToken();
      const res = await fetch(`/api/register/teacher-links/${id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_uses })
      });
      const data = await res.json();
      if (res.ok) { Modal.close(); showToast(data.message || 'Limit updated'); await load(); App.render(); }
      else showToast(data.error || 'Could not update the limit');
    } catch (err) { showToast('Network error'); }
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
    Modal.open('Add Teacher', `
      <form onsubmit="TeachersPage.submitAdd(event)">
        <div class="form-group"><label>Full Name *</label><input type="text" id="add-t-name" required class="form-control"></div>
        <div class="form-group"><label>Email *</label><input type="email" id="add-t-email" required class="form-control"></div>
        <div class="form-group"><label>Phone</label><input type="tel" id="add-t-phone" class="form-control"></div>
        <div class="form-group"><label>Subject / Department</label>
          <select id="add-t-subject" class="form-control" onchange="TeachersPage.onSubjectChange()">${subjectOptions('')}</select>
          <input type="text" id="add-t-subject-other" class="form-control" placeholder="Type the subject or department" style="margin-top:8px" hidden></div>
        <div class="form-group"><label>Employee ID</label><input type="text" id="add-t-empid" class="form-control"></div>
        <button type="submit" class="btn btn-primary" data-tip="${TIP.ADD_TEACHER}" style="width:100%;margin-top:12px">Add Teacher</button>
      </form>
    `, '');
  }

  async function submitAdd(e) {
    e.preventDefault();
    const body = {
      full_name: document.getElementById('add-t-name').value.trim(),
      email: document.getElementById('add-t-email').value.trim(),
      phone: document.getElementById('add-t-phone').value.trim(),
      subject: subjectValue(),
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
        Modal.close();
        showToast(data.temporary_password ? `Teacher added! Temp password: ${data.temporary_password}` : 'Teacher added!');
        await load(); App.render();
      } else {
        showToast(data.error || 'Failed');
      }
    } catch (e) { showToast('Network error'); }
  }

  /** "Other" reveals a text box. Same behaviour as the public form on purpose. */
  function onSubjectChange() {
    const sel = document.getElementById('add-t-subject');
    const other = document.getElementById('add-t-subject-other');
    if (!sel || !other) return;
    const isOther = sel.value === '__other';
    other.hidden = !isOther;
    if (isOther) other.focus(); else other.value = '';
  }

  function subjectValue() {
    const sel = document.getElementById('add-t-subject');
    if (!sel) return '';
    if (sel.value !== '__other') return sel.value;
    return (document.getElementById('add-t-subject-other')?.value || '').trim();
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

  return { load, render, afterRender, setTab, openGenerateModal, generateLink, copyLink, copyGenerated,
    openCapModal, saveCap, deactivateLink, approveTeacher, rejectTeacher, updateStatus, setInventoryAccess,
    deleteTeacher, showAddModal, submitAdd, onSubjectChange };
})();
