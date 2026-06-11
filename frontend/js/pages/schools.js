/**
 * Schools Page
 */
const SchoolsPage = (() => {
  let schools = [];
  let selectedId = null;
  let detail = null;

  async function load() {
    try { schools = await API.getSchools(); } catch (e) { schools = []; }
    if (selectedId) {
      try { detail = await API.getSchool(selectedId); } catch (e) { detail = null; }
    }
  }

  function select(id) { selectedId = id; App.loadAndRender(); }
  function back() { selectedId = null; detail = null; App.render(); }

  function render() {
    if (selectedId && detail) return renderDetail();
    return `
    <div class="section-header"><div><div class="section-title">School Profiles</div><div class="section-sub">${schools.length} schools</div></div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px">
      ${schools.map(s => {
        const hasIssues = s.open_errors > 0;
        const badge = hasIssues ? 'badge-amber' : 'badge-green';
        const label = hasIssues ? 'Issues' : 'Healthy';
        return `<div class="school-card" style="align-items:flex-start;flex-direction:column;gap:12px" onclick="SchoolsPage.select(${s.id})">
          <div style="display:flex;align-items:center;gap:12px;width:100%">
            <div class="school-avatar" style="background:${hasIssues ? 'rgba(245,166,35,0.2)' : 'rgba(45,217,138,0.12)'};color:${hasIssues ? 'var(--amber)' : 'var(--green)'}">${initials(s.name)}</div>
            <div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</div><div style="font-size:11px;color:var(--text3)">${esc(s.zone)} · ${s.students} students</div></div>
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

  function renderDetail() {
    const s = detail;
    const hasIssues = (s.errors || []).filter(e => e.status !== 'resolved').length > 0;
    return `
    <div class="section-header">
      <button class="btn btn-secondary btn-sm" onclick="SchoolsPage.back()"><i class="ti ti-arrow-left"></i> Schools</button>
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="detail-hero">
        <div class="school-avatar" style="background:${hasIssues ? 'rgba(245,166,35,0.2)' : 'rgba(45,217,138,0.12)'};color:${hasIssues ? 'var(--amber)' : 'var(--green)'}">${initials(s.name)}</div>
        <div style="flex:1">
          <div style="font-size:20px;font-weight:600">${esc(s.name)}</div>
          <div style="font-size:13px;color:var(--text3)">${esc(s.zone)} · ${s.students} students · ${s.tablets} tablets</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;border-top:1px solid var(--border);padding-top:16px;font-size:12px">
        <div><div style="color:var(--text3);font-size:11px">SUB-ADMIN</div><div style="font-weight:500">${esc(s.admin_name || 'Unassigned')}</div></div>
        <div><div style="color:var(--text3);font-size:11px">CONTACT</div><div style="font-weight:500">${esc(s.contact_name || '—')}</div><div style="color:var(--text3)">${esc(s.contact_role || '')}</div></div>
        <div><div style="color:var(--text3);font-size:11px">ISP</div><div style="font-weight:500">${esc(s.isp || '—')}</div></div>
        <div><div style="color:var(--text3);font-size:11px">LRS IP</div><div style="font-weight:500">${esc(s.lrs_ip || '—')}</div></div>
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

  return { load, render, select, back };
})();
