const FollowUpPage = (() => {
  let errors = [], team = [], comms = [];

  async function load() {
    try {
      const [errData, teamData, commData] = await Promise.all([
        API.getErrors({ status: 'open,progress,escalated' }),
        API.getTeam(),
        API.getCommunications()
      ]);
      errors = errData.errors || errData || [];
      team = teamData || [];
      comms = commData || [];
    } catch (e) { errors = []; team = []; comms = []; }
  }

  function render() {
    const pending = errors.filter(e => e.status !== 'resolved');
    const breaches = pending.filter(e => slaState(e) === 'breach');

    const errorCards = pending.length ? pending.map((e, i) => {
      const breach = slaState(e) === 'breach';
      const border = breach ? 'var(--red)' : e.status === 'escalated' ? 'var(--purple)' : 'var(--amber)';
      const badge = breach ? '<span class="badge badge-red">SLA Breach</span>'
        : e.status === 'escalated' ? '<span class="badge badge-purple">Escalated</span>'
        : `<span class="badge badge-amber">${STAT[e.status]?.label || e.status}</span>`;
      return `<div style="background:var(--bg3);border-radius:var(--radius);padding:14px 16px;margin-bottom:8px;border-left:3px solid ${border}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="error-id">${e.error_code}</span>
            <span style="font-weight:500;font-size:13px">${esc(e.title)} — ${esc(e.school_name)}</span>
          </div>${badge}
        </div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:10px">Age ${ageStr(e.hours_open)} · assigned to ${esc(e.assigned_name || 'unassigned')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="ErrorDetailModal.open(${e.id})"><i class="ti ti-eye"></i> View</button>
          ${e.status !== 'escalated' ? `<button class="btn btn-danger btn-sm" onclick="FollowUpPage.escalate(${e.id})"><i class="ti ti-arrow-up"></i> Escalate</button>` : ''}
          <button class="btn btn-success btn-sm" onclick="FollowUpPage.resolve(${e.id})"><i class="ti ti-check"></i> Resolve</button>
        </div>
      </div>`;
    }).join('') : '<div class="empty"><i class="ti ti-circle-check"></i>Nothing overdue — all issues within SLA</div>';

    const teamCards = team.map(t => {
      const load = errors.filter(e => e.assigned_to === t.id && e.status !== 'resolved').length;
      const st = { active: ['badge-green', 'Active'], onsite: ['badge-amber', 'On Site'], remote: ['badge-gray', 'Remote'] }[t.status] || ['badge-gray', t.status];
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="av" style="background:${t.color}22;color:${t.color}">${initials(t.full_name)}</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:500">${esc(t.full_name)}</div><div style="font-size:11px;color:var(--text3)">${esc(t.zone || '')} · ${load} open</div></div>
        <span class="badge ${st[0]}">${st[1]}</span>
      </div>`;
    }).join('') || '<div class="empty">No team members</div>';

    const commCards = comms.slice(0, 8).map(c => `
      <div style="background:var(--bg3);border-radius:6px;padding:10px 12px;margin-bottom:6px">
        <div style="font-weight:500;color:var(--text);margin-bottom:3px;font-size:12px">${esc(c.school_name || '')} · ${relTime(c.created_at)}</div>
        <div style="font-size:12px;color:var(--text2)">${esc(c.note)} <span style="color:var(--text3)">— ${esc(c.recorded_by)}</span></div>
      </div>
    `).join('') || '<div class="empty" style="padding:20px 0"><i class="ti ti-messages"></i>No notes yet</div>';

    return `
    <div class="section-header">
      <div><div class="section-title">Follow-Up Center</div><div class="section-sub">Open issues needing action + communication log</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start">
      <div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-title">Issues Requiring Action (${pending.length})</div>
          ${errorCards}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;position:sticky;top:20px">
        <div class="card">
          <div class="card-title">Field Team / Sub-Admins</div>
          ${teamCards}
        </div>
        <div class="card">
          <div class="card-title">Communication Log</div>
          ${commCards}
        </div>
      </div>
    </div>`;
  }

  async function escalate(id) {
    try {
      await API.updateErrorStatus(id, 'escalated');
      showToast('Escalated');
      await load(); App.render();
    } catch (e) { showToast('Failed'); }
  }

  async function resolve(id) {
    try {
      await API.updateErrorStatus(id, 'resolved');
      showToast('Resolved');
      await load(); App.render();
    } catch (e) { showToast('Failed'); }
  }

  return { load, render, escalate, resolve };
})();
