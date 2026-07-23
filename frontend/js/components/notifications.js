/**
 * Notifications Module
 * Bell dropdown with real-time notification items for admins
 */
const Notifications = (() => {
  let items = [];
  let isOpen = false;

  function toggle() {
    isOpen = !isOpen;
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = isOpen ? 'block' : 'none';
    if (isOpen) refresh();
  }

  function close() {
    isOpen = false;
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = 'none';
  }

  async function refresh() {
    items = [];
    const user = API.getUser();
    const token = API.getToken();
    if (!user || !token) return;

    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      // Admin: pending registration approvals
      if (user.role === 'admin') {
        const res = await fetch('/api/register/approvals/pending', { headers });
        if (res.ok) {
          const pending = await res.json();
          pending.forEach(r => {
            items.push({
              type: 'approval',
              icon: 'ti-user-plus',
              color: 'var(--amber)',
              title: `${r.full_name} wants to register`,
              sub: `${r.school_name || 'Unknown school'} · ${timeAgo(r.created_at)}`,
              action: () => { close(); Router.navigate('approvals'); App.loadAndRender(); }
            });
          });
        }

        // Appeals
        const appRes = await fetch('/api/register/approvals/appeals', { headers });
        if (appRes.ok) {
          const appeals = await appRes.json();
          appeals.filter(a => a.status === 'pending').forEach(a => {
            items.push({
              type: 'appeal',
              icon: 'ti-message-report',
              color: 'var(--purple)',
              title: `Appeal from ${a.full_name}`,
              sub: `"${truncate(a.message, 40)}" · ${timeAgo(a.created_at)}`,
              action: () => { close(); Router.navigate('approvals'); App.loadAndRender(); }
            });
          });
        }

        // Contact update notifications
        const notifRes = await fetch('/api/schools/notifications', { headers });
        if (notifRes.ok) {
          const notifs = await notifRes.json();
          notifs.filter(n => !n.is_read).forEach(n => {
            items.push({
              type: 'contact_update',
              icon: 'ti-address-book',
              color: 'var(--teal)',
              title: n.title,
              sub: `${n.message} · ${timeAgo(n.created_at)}`,
              notifId: n.id,
              action: () => {
                close();
                fetch(`/api/schools/notifications/${n.id}/read`, { method: 'PATCH', headers });
                const meta = typeof n.meta === 'string' ? JSON.parse(n.meta) : n.meta;
                if (meta && meta.school_id) { Router.navigate('schools'); SchoolsPage.select(meta.school_id); }
              }
            });
          });
        }
      }

      // Sub-admin: assigned errors
      if (user.role === 'subadmin') {
        const assignRes = await fetch('/api/schools/notifications', { headers });
        if (assignRes.ok) {
          const notifs = await assignRes.json();
          notifs.filter(n => !n.is_read && n.type === 'error_assigned').forEach(n => {
            const meta = typeof n.meta === 'string' ? JSON.parse(n.meta) : n.meta;
            items.push({
              type: 'error_assigned',
              icon: 'ti-alert-circle',
              color: 'var(--amber)',
              title: n.title,
              sub: `${n.message ? truncate(n.message, 50) : ''} · ${timeAgo(n.created_at)}`,
              notifId: n.id,
              action: () => {
                close();
                fetch(`/api/schools/notifications/${n.id}/read`, { method: 'PATCH', headers });
                if (meta && meta.error_id) {
                  Router.navigate('tracker');
                  App.loadAndRender().then(() => {
                    if (typeof ErrorDetailModal !== 'undefined') ErrorDetailModal.open(meta.error_id);
                  });
                }
              }
            });
          });
        }
      }

      // School admin: pending teacher approvals
      if (user.role === 'school') {
        const res = await fetch('/api/register/teacher-approvals/pending', { headers });
        if (res.ok) {
          const pending = await res.json();
          pending.forEach(t => {
            items.push({
              type: 'teacher',
              icon: 'ti-users-group',
              color: 'var(--teal)',
              title: `${t.full_name} wants to join`,
              sub: `Teacher registration · ${timeAgo(t.created_at)}`,
              action: () => { close(); Router.navigate('teachers'); App.loadAndRender(); }
            });
          });
        }
      }

      // Critical errors (all roles)
      const dashRes = await fetch('/api/dashboard', { headers });
      if (dashRes.ok) {
        const d = await dashRes.json();
        const crit = parseInt(d.errors.critical_open) || 0;
        if (crit > 0) {
          items.push({
            type: 'critical',
            icon: 'ti-alert-triangle',
            color: 'var(--red)',
            title: `${crit} critical error${crit > 1 ? 's' : ''} open`,
            sub: 'Requires immediate attention',
            action: () => { close(); Router.navigate('tracker'); App.loadAndRender(); }
          });
        }
      }
    } catch (e) {}

    renderPanel();
    updateBadge();
  }

  function renderPanel() {
    const body = document.getElementById('notif-panel-body');
    const countEl = document.getElementById('notif-panel-count');
    if (!body) return;

    if (countEl) countEl.textContent = items.length;

    if (!items.length) {
      body.innerHTML = '<div class="notif-empty"><i class="ti ti-bell-off" style="font-size:24px;color:var(--text3);margin-bottom:8px"></i><div>No notifications</div></div>';
      return;
    }

    body.innerHTML = items.map((item, i) => `
      <div class="notif-item" onclick="Notifications.handleClick(${i})">
        <div class="notif-item-icon" style="color:${item.color};background:${item.color}15">
          <i class="${item.icon}"></i>
        </div>
        <div class="notif-item-content">
          <div class="notif-item-title">${item.title}</div>
          <div class="notif-item-sub">${item.sub}</div>
        </div>
      </div>
    `).join('');
  }

  function updateBadge() {
    const dot = document.getElementById('notif-dot');
    const count = document.getElementById('notif-count');
    const total = items.length;

    if (dot) dot.style.display = total > 0 ? 'block' : 'none';
    if (count) {
      count.textContent = total > 9 ? '9+' : total;
      count.style.display = total > 0 ? 'flex' : 'none';
    }
  }

  function handleClick(index) {
    if (items[index] && items[index].action) items[index].action();
  }

  function viewAll() {
    close();
    Router.navigate('followup');
    App.loadAndRender();
  }

  function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  // Close on outside click
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('notif-wrapper');
    if (wrapper && !wrapper.contains(e.target) && isOpen) {
      close();
    }
  });

  return { toggle, close, refresh, handleClick, viewAll };
})();
