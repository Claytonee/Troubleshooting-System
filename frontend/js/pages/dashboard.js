/**
 * Dashboard Page — Premium Design
 */
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

    const { schools_total, schools_healthy, errors, recent_errors, checkins, category_breakdown } = data;
    const user = API.getUser();
    const open = parseInt(errors.open_count) || 0;
    const crit = parseInt(errors.critical_open) || 0;
    const inProg = parseInt(errors.in_progress) || 0;
    const resolved24 = parseInt(errors.resolved_24h) || 0;
    const total = parseInt(errors.total) || 0;
    const resolveRate = total > 0 ? Math.round((total - open) / total * 100) : 100;
    const healthPct = schools_total > 0 ? Math.round(schools_healthy / schools_total * 100) : 100;
    const checkinPct = checkins.total > 0 ? Math.round((checkins.done || 0) / checkins.total * 100) : 0;

    const h = new Date().getHours();
    const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const name = user ? user.full_name : '';

    const catItems = (category_breakdown || []).slice(0, 5).map((c, i) => {
      const m = CAT_META[c.category] || CAT_META.Other;
      const pct = Math.round(c.count / Math.max(1, open) * 100);
      return `<div class="dcat-row" style="animation-delay:${i * 60}ms">
        <div class="dcat-dot" style="background:${m.color}"></div>
        <span class="dcat-label">${c.category}</span>
        <div class="dcat-track"><div class="dcat-bar" style="width:${pct}%;background:linear-gradient(90deg, ${m.color}, ${m.color}88)"></div></div>
        <span class="dcat-val">${c.count}</span>
      </div>`;
    }).join('') || '<div class="empty" style="padding:24px 0;font-size:12px"><i class="ti ti-circle-check"></i>No open issues</div>';

    const errorRows = (recent_errors || []).slice(0, 5).map((e, i) => {
      const pri = PRI[e.priority] || PRI.medium;
      const stat = STAT[e.status] || STAT.open;
      const breach = slaState(e) === 'breach';
      return `<div class="derr-item" onclick="ErrorDetailModal.open(${e.id})" style="animation-delay:${i * 50}ms">
        <span class="dot ${pri.dot}"></span>
        <div class="derr-body">
          <div class="derr-title">${esc(e.title)}</div>
          <div class="derr-sub">${e.error_code} · ${esc(e.school_name)} · <span class="${breach ? 'derr-breach' : ''}">${ageStr(e.hours_open)}</span></div>
        </div>
        <span class="badge ${stat.badge}">${stat.label}</span>
      </div>`;
    }).join('') || '<div class="empty" style="padding:30px 0"><i class="ti ti-circle-check"></i>All clear</div>';

    return `
    <div class="dh-sticky-top">
      <div class="dh-welcome">
        <div>
          <div class="dh-greeting">${greeting}, <strong>${esc(name)}</strong></div>
          <div class="dh-sub">Here's your support system overview for today</div>
        </div>
        <div class="dh-actions">
          <button class="btn btn-secondary btn-sm" onclick="Router.navigate('tracker');App.loadAndRender()"><i class="uil uil-list-ul"></i> Tracker</button>
          <button class="btn btn-primary btn-sm" onclick="Router.navigate('report');App.loadAndRender()"><i class="uil uil-plus"></i> New Report</button>
        </div>
      </div>
      ${crit > 0 ? `<div class="dh-alert">
        <div class="dh-alert-icon"><i class="uil uil-exclamation-octagon"></i></div>
        <div class="dh-alert-body"><strong>${crit} Critical</strong> error${crit > 1 ? 's' : ''} need immediate attention</div>
        <button class="btn btn-danger btn-sm" onclick="Router.navigate('tracker');App.loadAndRender()">View →</button>
      </div>` : ''}
    </div>

    <div class="dh-kpis">
      <div class="dh-kpi kpi-red">
        <div class="kpi-top">
          <div class="kpi-icon"><i class="uil uil-exclamation-triangle"></i></div>
          <div class="kpi-badge">${crit} critical</div>
        </div>
        <div class="kpi-val">${open}</div>
        <div class="kpi-label">Open Errors</div>
        <div class="kpi-glow"></div>
      </div>
      <div class="dh-kpi kpi-amber">
        <div class="kpi-top">
          <div class="kpi-icon"><i class="uil uil-sync"></i></div>
          <div class="kpi-badge">active</div>
        </div>
        <div class="kpi-val">${inProg}</div>
        <div class="kpi-label">In Progress</div>
        <div class="kpi-glow"></div>
      </div>
      <div class="dh-kpi kpi-green">
        <div class="kpi-top">
          <div class="kpi-icon"><i class="uil uil-check-circle"></i></div>
          <div class="kpi-badge">${resolveRate}% rate</div>
        </div>
        <div class="kpi-val">${resolved24}</div>
        <div class="kpi-label">Resolved 24h</div>
        <div class="kpi-glow"></div>
      </div>
      <div class="dh-kpi kpi-teal">
        <div class="kpi-top">
          <div class="kpi-icon"><i class="uil uil-building"></i></div>
          <div class="kpi-badge">${healthPct}% healthy</div>
        </div>
        <div class="kpi-val">${schools_healthy}<span class="kpi-of">/${schools_total}</span></div>
        <div class="kpi-label">Schools OK</div>
        <div class="kpi-glow"></div>
      </div>
    </div>

    <div class="dh-panels">
      <div class="dh-panel dh-panel-main">
        <div class="dp-head">
          <div class="dp-title"><i class="uil uil-fire" style="color:var(--red)"></i> Active Priorities</div>
          <a class="dp-link" onclick="Router.navigate('tracker');App.loadAndRender()">View all →</a>
        </div>
        <div class="derr-list">${errorRows}</div>
      </div>
      <div class="dh-panel-side">
        <div class="dh-panel">
          <div class="dp-head">
            <div class="dp-title"><i class="uil uil-chart-pie" style="color:var(--accent)"></i> Categories</div>
          </div>
          <div class="dcat-list">${catItems}</div>
        </div>
        <div class="dh-panel dh-checkin-card">
          <div class="dp-head">
            <div class="dp-title"><i class="uil uil-clipboard-notes" style="color:var(--purple)"></i> Weekly Check-ins</div>
          </div>
          <div class="dck-body">
            <div class="dck-ring">
              <svg viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg4)" stroke-width="6"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--purple)" stroke-width="6" stroke-dasharray="${checkinPct * 2.136} 213.6" stroke-dashoffset="0" stroke-linecap="round" class="dck-progress"/>
              </svg>
              <div class="dck-ring-text">${checkinPct}%</div>
            </div>
            <div class="dck-info">
              <div class="dck-done">${checkins.done || 0} <span>of ${checkins.total || 0}</span></div>
              <div class="dck-due">${(checkins.total || 0) - (checkins.done || 0)} schools due</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  return { load, render };
})();
