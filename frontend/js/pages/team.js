/**
 * Team (Sub-Admins) Page
 */
const TeamPage = (() => {
  let team = [];

  function isAdmin() { const u = API.getUser(); return u && u.role === 'admin'; }

  async function load() {
    try { team = await API.getTeam(); } catch (e) { team = []; }
  }

  function render() {
    const admin = isAdmin();
    return `
    <div class="section-header">
      <div><div class="section-title">Sub-Admins</div><div class="section-sub">Field engineers & their assigned schools</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
      ${team.map(t => {
        const st = { active: ['badge-green', 'Active'], onsite: ['badge-amber', 'On Site'], remote: ['badge-gray', 'Remote'] }[t.status] || ['badge-gray', '—'];
        return `<div class="card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <div class="av" style="width:44px;height:44px;font-size:15px;background:${t.color}22;color:${t.color}">${initials(t.full_name)}</div>
            <div style="flex:1"><div style="font-weight:600;font-size:15px">${esc(t.full_name)}</div><div style="font-size:12px;color:var(--text3)">${esc(t.title || 'Field Engineer')}</div></div>
            <span class="badge ${st[0]}">${st[1]}</span>
          </div>
          <div style="display:flex;gap:10px;margin-bottom:14px">
            <div style="flex:1;background:var(--bg3);border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:600">${t.school_count}</div><div style="font-size:10px;color:var(--text3)">SCHOOLS</div></div>
            <div style="flex:1;background:var(--bg3);border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:600;color:${t.open_errors ? 'var(--amber)' : 'var(--green)'}">${t.open_errors}</div><div style="font-size:10px;color:var(--text3)">OPEN ISSUES</div></div>
          </div>
          <div style="margin-top:10px;font-size:12px;color:var(--text2);line-height:1.9">
            <div><i class="ti ti-mail" style="margin-right:6px;color:var(--accent)"></i>${esc(t.email)}</div>
            <div><i class="ti ti-phone" style="margin-right:6px;color:var(--accent)"></i>${esc(t.phone || '—')}</div>
            <div><i class="ti ti-map-pin" style="margin-right:6px;color:var(--text3)"></i>${esc(t.zone || '—')}</div>
          </div>
          ${admin ? `<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px;display:flex;justify-content:flex-end">
            <button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:rgba(255,82,99,0.3)" onclick="TeamPage.remove(${t.id})"><i class="ti ti-trash"></i> Delete</button>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  async function remove(id) {
    const t = team.find(x => x.id === id);
    if (!t) return;
    const warn = t.school_count > 0
      ? `\n\nTheir ${t.school_count} assigned school(s) will become Unassigned.`
      : '';
    if (!confirm(`Delete sub-admin "${t.full_name}"?${warn}\n\nThis cannot be undone.`)) return;
    try {
      await API.removeTeamMember(id);
      showToast('Sub-admin deleted');
      await load();
      App.render();
    } catch (e) { showToast(e.error || 'Could not delete sub-admin'); }
  }

  return { load, render, remove };
})();
