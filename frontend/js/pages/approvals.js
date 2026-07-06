const ApprovalsPage = (() => {
  let requests = [];
  let appeals = [];
  let tab = 'pending'; // pending, all, appeals

  async function load() {
    try {
      const token = API.getToken();
      const headers = { 'Authorization': `Bearer ${token}` };
      const [reqRes, appRes] = await Promise.all([
        fetch('/api/register/approvals/pending', { headers }),
        fetch('/api/register/approvals/appeals', { headers })
      ]);
      requests = await reqRes.json();
      appeals = await appRes.json();
    } catch (e) { requests = []; appeals = []; }
  }

  function render() {
    const pendingCount = requests.length;
    const appealCount = appeals.filter(a => a.status === 'pending').length;

    return `
    <div class="section-header">
      <div>
        <div class="section-title">Registration Approvals</div>
        <div class="section-sub">Review and manage registration requests</div>
      </div>
    </div>
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card a">
        <div class="stat-label">Pending</div>
        <div class="stat-val" style="color:var(--amber)">${pendingCount}</div>
        <div class="stat-sub">Awaiting review</div>
      </div>
      <div class="stat-card g">
        <div class="stat-label">Appeals</div>
        <div class="stat-val" style="color:var(--purple)">${appealCount}</div>
        <div class="stat-sub">Need attention</div>
      </div>
    </div>
    <div class="card">
      <div class="tab-row" style="margin-bottom:16px">
        <button class="tab-btn ${tab === 'pending' ? 'active' : ''}" onclick="ApprovalsPage.setTab('pending')">Pending (${pendingCount})</button>
        <button class="tab-btn ${tab === 'appeals' ? 'active' : ''}" onclick="ApprovalsPage.setTab('appeals')">Appeals (${appealCount})</button>
      </div>
      ${tab === 'pending' ? renderPending() : renderAppeals()}
    </div>`;
  }

  function renderPending() {
    if (!requests.length) return '<div class="empty-state">No pending registrations</div>';
    return `<div class="approval-list">
      ${requests.map(r => `
        <div class="approval-item">
          <div class="approval-info">
            <div class="approval-name">${esc(r.full_name)}</div>
            <div class="approval-meta">${esc(r.email)} &middot; ${esc(r.phone || 'No phone')}</div>
            <div class="approval-meta"><strong>School:</strong> ${esc(r.school_name || 'Unknown')} (${esc(r.school_zone || '')})</div>
            ${r.title ? `<div class="approval-meta"><strong>Role:</strong> ${esc(r.title)}</div>` : ''}
            <div class="approval-meta" style="color:var(--text3)">Submitted ${timeAgo(r.created_at)}</div>
          </div>
          <div class="approval-actions">
            <button class="btn btn-sm" data-tip="${TIP.APPROVE}" data-tip-color="green" style="background:var(--green);color:#fff" onclick="ApprovalsPage.approve(${r.id})">Approve</button>
            <button class="btn btn-sm" data-tip="${TIP.REJECT}" data-tip-color="red" style="background:var(--red);color:#fff" onclick="ApprovalsPage.reject(${r.id})">Reject</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  function renderAppeals() {
    const pending = appeals.filter(a => a.status === 'pending');
    if (!pending.length) return '<div class="empty-state">No pending appeals</div>';
    return `<div class="approval-list">
      ${pending.map(a => `
        <div class="approval-item">
          <div class="approval-info">
            <div class="approval-name">${esc(a.full_name)}</div>
            <div class="approval-meta">${esc(a.email)} &middot; School: ${esc(a.school_name || 'Unknown')}</div>
            <div class="approval-msg">"${esc(a.message)}"</div>
            <div class="approval-meta" style="color:var(--text3)">Appeal submitted ${timeAgo(a.created_at)}</div>
          </div>
          <div class="approval-actions">
            <button class="btn btn-sm" data-tip="${TIP.APPROVE}" data-tip-color="green" style="background:var(--green);color:#fff" onclick="ApprovalsPage.approveFromAppeal(${a.request_id})">Approve</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  function setTab(t) { tab = t; App.render(); }

  async function approve(id) {
    if (!confirm('Approve this registration?')) return;
    try {
      const token = API.getToken();
      const res = await fetch(`/api/register/approvals/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        showToast('Registration approved');
        await load(); App.render();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed');
      }
    } catch (e) { showToast('Network error'); }
  }

  async function reject(id) {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      const token = API.getToken();
      const res = await fetch(`/api/register/approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        showToast('Registration rejected');
        await load(); App.render();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed');
      }
    } catch (e) { showToast('Network error'); }
  }

  async function approveFromAppeal(requestId) {
    await approve(requestId);
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

  return { load, render, afterRender, setTab, approve, reject, approveFromAppeal };
})();
