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
    if (data.type === 'subadmin') return renderSubadmin();

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
        <td class="hide-mobile" style="font-size:12px;color:var(--text2)">${esc(e.school_name)}</td>
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
        <thead><tr><th></th><th>Error</th><th class="hide-mobile">School</th><th>Status</th><th>Age</th></tr></thead>
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
      // Clickable: a teacher had no way to open their own fault once it was
      // resolved — the row was the whole record they could see.
      return `<tr style="cursor:pointer" onclick="ErrorDetailModal.open(${e.id})">
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
    <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:10px">My Recent Reports
      <span style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0;color:var(--accent);cursor:pointer" onclick="Router.navigate('tracker');App.loadAndRender()">See all, including resolved →</span>
    </div>
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

  function renderSubadmin() {
    const user = API.getUser();
    const { my_queue, stats, my_schools, recent_activity, checkins } = data;
    const queueCount = parseInt(stats.queue_count) || 0;
    const dueSoon = parseInt(stats.due_soon) || 0;
    const overdue = parseInt(stats.overdue) || 0;
    const resolvedWeek = parseInt(stats.resolved_week) || 0;
    const totalResolved = parseInt(stats.total_resolved) || 0;
    const resolvedSla = parseInt(stats.resolved_within_sla) || 0;
    const totalWithSla = parseInt(stats.total_with_sla) || 0;
    // With nothing measurable this used to claim 100% — a fabricated pass. Show
    // a dash instead, and only colour the ring once there is something to judge.
    const slaPct = totalWithSla > 0 ? Math.round(resolvedSla / totalWithSla * 100) : null;
    const schoolCount = my_schools.length;
    const checkinDone = checkins.done || 0;
    const checkinTotal = checkins.total || 0;
    const checkinPct = checkinTotal > 0 ? Math.round(checkinDone / checkinTotal * 100) : 0;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const urgentCount = overdue + dueSoon;

    // Priority task cards
    const taskCards = (my_queue || []).slice(0, 5).map(e => {
      const pri = PRI[e.priority] || PRI.medium;
      const breach = e.sla_breached == 1;
      const minsLeft = e.sla_minutes_left;
      let slaTag = '';
      let slaBg = '';
      if (breach) { slaTag = 'OVERDUE'; slaBg = 'var(--red)'; }
      else if (minsLeft != null && minsLeft <= 120) { slaTag = `${Math.max(0, Math.round(minsLeft / 60))}h left`; slaBg = 'var(--amber)'; }
      else if (minsLeft != null && minsLeft <= 480) { slaTag = `${Math.round(minsLeft / 60)}h left`; slaBg = 'var(--text3)'; }
      const priColors = { critical: 'var(--red)', high: 'var(--amber)', medium: 'var(--accent)', low: 'var(--green)' };
      const priColor = priColors[e.priority] || 'var(--accent)';

      return `<div class="sa-task-card" style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid ${priColor};border-radius:10px;padding:14px 16px;cursor:pointer;transition:border-color .15s" onclick="ErrorDetailModal.open(${e.id})">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span class="error-id" style="font-size:11px">${e.error_code}</span>
          ${slaTag ? `<span style="font-size:9px;padding:2px 7px;border-radius:4px;background:${slaBg}18;color:${slaBg};font-weight:600;letter-spacing:.3px">${slaTag}</span>` : ''}
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text1);margin-bottom:5px;line-height:1.3">${esc(e.title)}</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text3)">
          <span><i class="ti ti-school" style="font-size:11px;margin-right:3px"></i>${esc(e.school_name)}</span>
          <span style="color:var(--border)">|</span>
          <span>${ageStr(e.hours_open)}</span>
        </div>
      </div>`;
    }).join('');

    const emptyQueue = `<div style="text-align:center;padding:40px 20px">
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(45,217,138,.08);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
        <i class="ti ti-circle-check" style="font-size:28px;color:var(--green)"></i>
      </div>
      <div style="font-size:14px;font-weight:500;color:var(--text1);margin-bottom:4px">All clear!</div>
      <div style="font-size:12px;color:var(--text3)">No errors in your queue right now</div>
    </div>`;

    // School health cards
    const schoolCards = (my_schools || []).slice(0, 6).map(s => {
      const health = s.critical_errors > 0 ? 'red' : s.open_errors > 0 ? 'amber' : 'green';
      const healthColor = health === 'red' ? 'var(--red)' : health === 'amber' ? 'var(--amber)' : 'var(--green)';
      const healthLabel = health === 'red' ? 'Critical' : health === 'amber' ? 'Issues' : 'Healthy';
      return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;cursor:pointer;display:flex;align-items:center;gap:10px" onclick="Router.navigate('schools');App.loadAndRender()">
        <div style="width:36px;height:36px;border-radius:8px;background:${healthColor}12;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ti-building" style="font-size:16px;color:${healthColor}"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</div>
          <div style="font-size:10px;color:var(--text3)">${esc(s.zone || 'No zone')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;font-weight:600;color:${healthColor}">${s.open_errors}</div>
          <div style="font-size:9px;color:var(--text3)">${healthLabel}</div>
        </div>
      </div>`;
    }).join('');

    const emptySchools = `<div style="text-align:center;padding:30px 20px">
      <i class="ti ti-school" style="font-size:24px;color:var(--text3);margin-bottom:8px"></i>
      <div style="font-size:12px;color:var(--text3)">No schools assigned yet</div>
    </div>`;

    // Activity timeline
    const timeline = (recent_activity || []).map(a => {
      return `<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:6px;height:6px;border-radius:50%;background:var(--accent);margin-top:6px;flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-size:12px;color:var(--text2);line-height:1.4">${esc((a.note || '').substring(0, 100))}${(a.note || '').length > 100 ? '...' : ''}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px"><span class="error-id">${a.error_code}</span> · ${esc(a.recorded_by)} · ${relTime(a.created_at)}</div>
        </div>
      </div>`;
    }).join('') || '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text3)">No recent activity</div>';

    // SLA ring SVG
    const slaRingPct = (slaPct || 0) * 2.136;
    const slaColor = slaPct === null ? 'var(--text3)'
      : slaPct >= 80 ? 'var(--green)' : slaPct >= 60 ? 'var(--amber)' : 'var(--red)';

    return `
  <div class="section-header">
    <div>
      <div class="section-title">${greeting}, ${esc((user.full_name || '').split(' ')[0])}</div>
      <div class="section-sub">${urgentCount > 0 ? `<span style="color:var(--amber)">${urgentCount} urgent</span> · ` : ''}${queueCount} in queue · Week ${checkins.current_week || ''}</div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button style="padding:8px 16px;font-size:12px;background:rgba(79,124,255,.12);color:var(--accent);border:1px solid rgba(79,124,255,.25);border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px" onclick="Router.navigate('tracker');App.loadAndRender()"><i class="ti ti-list-check" style="font-size:13px"></i> All Errors</button>
      <button style="padding:8px 16px;font-size:12px;background:rgba(54,217,204,.12);color:var(--teal);border:1px solid rgba(54,217,204,.25);border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px" onclick="Router.navigate('schools');App.loadAndRender()"><i class="ti ti-school" style="font-size:13px"></i> My Schools</button>
    </div>
  </div>

  ${overdue > 0 ? `<div class="alert-banner">
    <i class="ti ti-clock-exclamation"></i>
    <div class="alert-banner-text"><strong>${overdue} error${overdue > 1 ? 's' : ''} overdue</strong> — SLA breached, needs immediate action</div>
    <button style="padding:6px 14px;font-size:11px;background:rgba(255,82,99,.12);color:var(--red);border:1px solid rgba(255,82,99,.25);border-radius:7px;cursor:pointer;white-space:nowrap" onclick="Router.navigate('tracker');App.loadAndRender()">View Now</button>
  </div>` : ''}

  <div class="sa-metrics" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px">
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px;display:flex;align-items:center;gap:16px">
      <div style="position:relative;width:56px;height:56px;flex-shrink:0">
        <svg viewBox="0 0 80 80" style="width:100%;height:100%;transform:rotate(-90deg)">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg4)" stroke-width="5"/>
          <circle cx="40" cy="40" r="34" fill="none" stroke="${slaColor}" stroke-width="5" stroke-dasharray="${slaRingPct} 213.6" stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${slaColor}">${slaPct === null ? '&mdash;' : slaPct + '%'}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">SLA Compliance</div>
        <div style="font-size:13px;font-weight:500;color:var(--text1);margin-top:2px">${totalWithSla > 0 ? `${resolvedSla}/${totalWithSla} on time` : 'nothing timed yet'}</div>
      </div>
    </div>

    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px;display:flex;align-items:center;gap:16px">
      <div style="width:56px;height:56px;border-radius:12px;background:rgba(45,217,138,.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="ti ti-trophy" style="font-size:24px;color:var(--green)"></i>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Resolved</div>
        <div style="font-size:22px;font-weight:700;color:var(--green);line-height:1">${resolvedWeek}</div>
        <div style="font-size:10px;color:var(--text3)">this week · ${totalResolved} total</div>
      </div>
    </div>

    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px;display:flex;align-items:center;gap:16px">
      <div style="position:relative;width:56px;height:56px;flex-shrink:0">
        <svg viewBox="0 0 80 80" style="width:100%;height:100%;transform:rotate(-90deg)">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg4)" stroke-width="5"/>
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--purple)" stroke-width="5" stroke-dasharray="${checkinPct * 2.136} 213.6" stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--purple)">${checkinPct}%</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Check-Ins</div>
        <div style="font-size:13px;font-weight:500;color:var(--text1);margin-top:2px">${checkinDone}/${checkinTotal} done</div>
      </div>
    </div>
  </div>

  <div class="sa-layout" style="display:grid;grid-template-columns:1fr 340px;gap:14px;align-items:start">
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="card" style="padding:16px 18px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="font-size:13px;font-weight:600;color:var(--text1)"><i class="ti ti-urgent" style="font-size:14px;color:var(--red);margin-right:6px"></i>My Queue <span style="font-size:11px;font-weight:400;color:var(--text3)">${queueCount} errors</span></div>
          <a style="font-size:11px;color:var(--accent);cursor:pointer" onclick="Router.navigate('tracker');App.loadAndRender()">View all →</a>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">${taskCards || emptyQueue}</div>
        ${(my_queue || []).length > 5 ? `<div style="text-align:center;padding-top:12px"><a style="font-size:11px;color:var(--accent);cursor:pointer" onclick="Router.navigate('tracker');App.loadAndRender()">+${my_queue.length - 5} more errors →</a></div>` : ''}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="card" style="padding:16px 18px">
        <div style="font-size:13px;font-weight:600;color:var(--text1);margin-bottom:12px"><i class="ti ti-building" style="font-size:14px;color:var(--teal);margin-right:6px"></i>My Schools <span style="font-size:11px;font-weight:400;color:var(--text3)">${schoolCount}</span></div>
        <div style="display:flex;flex-direction:column;gap:8px">${schoolCards || emptySchools}</div>
      </div>
      <div class="card" style="padding:16px 18px">
        <div style="font-size:13px;font-weight:600;color:var(--text1);margin-bottom:10px"><i class="ti ti-activity" style="font-size:14px;color:var(--purple);margin-right:6px"></i>Recent Activity</div>
        <div style="display:flex;flex-direction:column">${timeline}</div>
      </div>
    </div>
  </div>`;
  }

  return { load, render };
})();
