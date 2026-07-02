const DashboardPage = (() => {
  let data = null;

  async function load() {
    try {
      data = await API.getDashboard();
    } catch (e) {
      data = null;
    }
  }

  function render() {
    if (!data) return '<div class="empty"><i class="ti ti-loader"></i>Loading dashboard...</div>';

    if (data.type === 'teacher') return renderTeacher();

    const { schools_total, schools_healthy, errors, recent_errors, checkins, category_breakdown } = data;
    const user = API.getUser();
    const open = parseInt(errors.open_count) || 0;
    const crit = parseInt(errors.critical_open) || 0;
    const inProg = parseInt(errors.in_progress) || 0;
    const resolved24 = parseInt(errors.resolved_24h) || 0;
    const slaBreaches = (recent_errors || []).filter(e => slaState(e) === 'breach').length;
    const checkinDone = checkins.done || 0;
    const checkinTotal = checkins.total || 0;
    const checkinDue = checkinTotal - checkinDone;
    const checkinPct = checkinTotal > 0 ? Math.round(checkinDone / checkinTotal * 100) : 0;

    const roleLabel = user ? (user.role === 'admin' ? 'System Admin — all schools' : user.role === 'subadmin' ? 'Field Engineer' : 'School') : '';
    const critSchools = [...new Set((recent_errors || []).filter(e => e.priority === 'critical' && e.status !== 'resolved').map(e => esc(e.school_name)))];

    const catRows = (category_breakdown || []).map(c => {
      const m = CAT_META[c.category] || CAT_META.Other;
      const pct = Math.round(c.count / Math.max(1, open) * 100);
      return `<div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span><i class="ti ${m.ic}" style="font-size:13px;vertical-align:-2px;margin-right:5px;color:${m.color}"></i>${c.category}</span>
        <span style="color:var(--text2)">${c.count} open</span></div>
        <div class="progress"><div class="progress-fill" style="width:${pct}%;background:${m.color}"></div></div></div>`;
    }).join('') || '<div class="empty" style="padding:20px 0"><i class="ti ti-circle-check"></i>No open issues</div>';

    const errorRows = (recent_errors || []).slice(0, 6).map(e => {
      const pri = PRI[e.priority] || PRI.medium;
      const stat = STAT[e.status] || STAT.open;
      const breach = slaState(e) === 'breach';
      return `<tr style="cursor:pointer" onclick="ErrorDetailModal.open(${e.id})">
        <td><span class="dot ${pri.dot}"></span></td>
        <td><span style="font-size:12px;font-weight:500">${esc(e.title)}</span><br><span class="error-id">${e.error_code}</span></td>
        <td style="font-size:12px;color:var(--text2)">${esc(e.school_name)}</td>
        <td><span class="badge ${stat.badge}">${stat.label}</span></td>
        <td style="font-size:12px;color:${breach ? 'var(--red)' : 'var(--text3)'}">${ageStr(e.hours_open)}</td></tr>`;
    }).join('') || '<tr><td colspan="5"><div class="empty" style="padding:20px 0"><i class="ti ti-circle-check"></i>No active errors</div></td></tr>';

    return `
  <div class="section-header">
    <div>
      <div class="section-title">System Overview</div>
      <div class="section-sub">${esc(roleLabel)} · Term 2 · 2026</div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-secondary btn-sm" onclick="Router.navigate('report');App.loadAndRender()"><i class="ti ti-plus"></i> New Report</button>
      <button class="btn btn-primary btn-sm" onclick="Router.navigate('followup');App.loadAndRender()"><i class="ti ti-headset"></i> Support Queue</button>
    </div>
  </div>

  ${crit > 0 ? `<div class="alert-banner">
    <i class="ti ti-alert-triangle"></i>
    <div class="alert-banner-text"><strong>${crit} Critical Error${crit > 1 ? 's' : ''}</strong> need immediate attention — ${critSchools.slice(0, 3).join(', ')}${critSchools.length > 3 ? ' +' + (critSchools.length - 3) : ''}.</div>
    <button class="btn btn-danger btn-sm" onclick="Router.navigate('tracker');App.loadAndRender()">View</button>
  </div>` : ''}

  <div class="stats-grid">
    <div class="stat-card r"><div class="stat-label">Open Errors</div><div class="stat-val" style="color:var(--red)">${open}</div><div class="stat-sub">${crit} critical · ${slaBreaches} SLA breach</div></div>
    <div class="stat-card a"><div class="stat-label">In Progress</div><div class="stat-val" style="color:var(--amber)">${inProg}</div><div class="stat-sub">being worked on now</div></div>
    <div class="stat-card g"><div class="stat-label">Resolved (24h)</div><div class="stat-val" style="color:var(--green)">${resolved24}</div><div class="stat-sub"><span class="stat-trend trend-up"><i class="ti ti-check" style="font-size:10px"></i>recently closed</span></div></div>
    <div class="stat-card t"><div class="stat-label">Schools Healthy</div><div class="stat-val" style="color:var(--teal)">${schools_healthy}<span style="font-size:16px;color:var(--text3)">/${schools_total}</span></div><div class="stat-sub">${schools_total - schools_healthy} need attention</div></div>
    <div class="stat-card"><div class="stat-label">Week ${checkins.current_week || 4} Check-Ins</div><div class="stat-val">${checkinDone}<span style="font-size:16px;color:var(--text3)">/${checkinTotal}</span></div><div class="stat-sub" style="cursor:pointer;color:var(--accent)" onclick="Router.navigate('weekly');App.loadAndRender()">${checkinDue} still due →</div></div>
  </div>

  <div class="two-col" style="align-items:start">
    <div class="card">
      <div class="card-title">Active Priorities <a style="font-size:11px;color:var(--accent);cursor:pointer;text-transform:none;letter-spacing:0" onclick="Router.navigate('tracker');App.loadAndRender()">View all</a></div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Error</th><th>School</th><th>Status</th><th>Age</th></tr></thead>
        <tbody>${errorRows}</tbody>
      </table></div>
    </div>

    <div class="card">
      <div class="card-title">Open Errors by Category</div>
      <div style="display:flex;flex-direction:column;gap:12px">${catRows}</div>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        <div class="card-title" style="margin-bottom:12px"><i class="ti ti-clipboard-check" style="font-size:15px;color:var(--purple);margin-right:6px"></i> Weekly Check-ins</div>
        <div style="display:flex;align-items:center;gap:16px">
          <div style="position:relative;width:60px;height:60px;flex-shrink:0">
            <svg viewBox="0 0 80 80" style="width:100%;height:100%;transform:rotate(-90deg)">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg4)" stroke-width="6"/>
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--purple)" stroke-width="6" stroke-dasharray="${checkinPct * 2.136} 213.6" stroke-linecap="round"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--purple)">${checkinPct}%</div>
          </div>
          <div>
            <div style="font-size:16px;font-weight:700">${checkinDone} <span style="font-size:12px;font-weight:400;color:var(--text3)">of ${checkinTotal}</span></div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px">${checkinDue} schools due</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  }

  function renderTeacher() {
    const user = API.getUser();
    const { school, my_errors, recent_errors, guides_available } = data;
    const total = parseInt(my_errors.total) || 0;
    const open = parseInt(my_errors.open_count) || 0;
    const resolved = parseInt(my_errors.resolved_count) || 0;

    const errorRows = (recent_errors || []).map(e => {
      const pri = PRI[e.priority] || PRI.medium;
      const stat = STAT[e.status] || STAT.open;
      return `<tr>
        <td><span class="dot ${pri.dot}"></span></td>
        <td><span style="font-size:12px;font-weight:500">${esc(e.title)}</span><br><span class="error-id">${e.error_code}</span></td>
        <td><span style="font-size:11px;color:var(--text3)">${e.category}</span></td>
        <td><span class="badge ${stat.badge}">${stat.label}</span></td>
        <td style="font-size:12px;color:var(--text3)">${ageStr(e.hours_open)}</td></tr>`;
    }).join('') || '<tr><td colspan="5"><div class="empty" style="padding:20px 0"><i class="ti ti-circle-check"></i>No errors reported yet</div></td></tr>';

    return `
  <div class="section-header">
    <div>
      <div class="section-title">My Dashboard</div>
      <div class="section-sub">Teacher · ${school ? esc(school.name) : 'Unassigned'}</div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-primary btn-sm" onclick="Router.navigate('report');App.loadAndRender()"><i class="ti ti-plus"></i> Report Error</button>
    </div>
  </div>

  <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
    <div class="stat-card r"><div class="stat-label">Open Issues</div><div class="stat-val" style="color:var(--red)">${open}</div><div class="stat-sub">awaiting resolution</div></div>
    <div class="stat-card g"><div class="stat-label">Resolved</div><div class="stat-val" style="color:var(--green)">${resolved}</div><div class="stat-sub">issues fixed</div></div>
    <div class="stat-card"><div class="stat-label">Total Reported</div><div class="stat-val">${total}</div><div class="stat-sub">all time</div></div>
    <div class="stat-card t"><div class="stat-label">Guides Available</div><div class="stat-val" style="color:var(--teal)">${guides_available}</div><div class="stat-sub" style="cursor:pointer;color:var(--accent)" onclick="Router.navigate('troubleshoot');App.loadAndRender()">Browse guides →</div></div>
  </div>

  <div class="card">
    <div class="card-title">My Recent Reports</div>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Error</th><th>Category</th><th>Status</th><th>Age</th></tr></thead>
      <tbody>${errorRows}</tbody>
    </table></div>
  </div>

  <div class="two-col" style="align-items:start">
    <div class="card" style="text-align:center;padding:32px 20px">
      <i class="ti ti-book-2" style="font-size:36px;color:var(--teal);margin-bottom:12px"></i>
      <div style="font-size:14px;font-weight:500;margin-bottom:6px">Troubleshooting Guides</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Find step-by-step solutions for common issues</div>
      <button class="btn btn-secondary btn-sm" onclick="Router.navigate('troubleshoot');App.loadAndRender()">Open Guides</button>
    </div>
    <div class="card" style="text-align:center;padding:32px 20px">
      <i class="ti ti-files" style="font-size:36px;color:var(--accent);margin-bottom:12px"></i>
      <div style="font-size:14px;font-weight:500;margin-bottom:6px">Resource Library</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Manuals, guides, and reference documents</div>
      <button class="btn btn-secondary btn-sm" onclick="Router.navigate('manuals');App.loadAndRender()">Browse Resources</button>
    </div>
  </div>`;
  }

  return { load, render };
})();
