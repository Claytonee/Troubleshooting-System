/**
 * Team (Sub-Admins) Page
 */
const TeamPage = (() => {
  let team = [];

  async function load() {
    try { team = await API.getTeam(); } catch (e) { team = []; }
  }

  function render() {
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
        </div>`;
      }).join('')}
    </div>`;
  }

  return { load, render };
})();
