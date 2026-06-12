const AnalyticsPage = (() => {
  let data = null, errors = [];

  async function load() {
    try {
      const [d, e] = await Promise.all([API.getDashboard(), API.getErrors()]);
      data = d;
      errors = e.errors || e || [];
    } catch (e) { data = null; errors = []; }
  }

  function render() {
    if (!data) return '<div class="empty"><i class="ti ti-loader"></i>Loading...</div>';

    const { schools_total, schools_healthy, errors: errStats, checkins, category_breakdown } = data;
    const open = parseInt(errStats.open_count) || 0;
    const total = parseInt(errStats.total) || 0;
    const resolved = total - open;
    const resolveRate = total > 0 ? Math.round(resolved / total * 100) : 100;
    const avgAge = errors.length ? Math.round(errors.reduce((a, e) => a + parseFloat(e.hours_open || 0), 0) / errors.length) : 0;
    const checkinRate = checkins.total > 0 ? Math.round((checkins.done || 0) / checkins.total * 100) : 0;
    const slaBreaches = errors.filter(e => slaState(e) === 'breach').length;
    const critCount = parseInt(errStats.critical_open) || 0;

    const catBars = (category_breakdown || []).map(c => {
      const m = CAT_META[c.category] || CAT_META.Other;
      const pct = total > 0 ? Math.round(c.count / total * 100) : 0;
      return `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${c.category}</span><span style="color:var(--text3)">${c.count} (${pct}%)</span></div>
        <div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${m.color};border-radius:3px"></div></div>
      </div>`;
    }).join('');

    const statusDist = [
      { label: 'Open', count: errors.filter(e => e.status === 'open').length, color: 'var(--red)' },
      { label: 'In Progress', count: errors.filter(e => e.status === 'progress').length, color: 'var(--amber)' },
      { label: 'Escalated', count: errors.filter(e => e.status === 'escalated').length, color: 'var(--purple)' },
      { label: 'Resolved', count: errors.filter(e => e.status === 'resolved').length, color: 'var(--green)' }
    ];
    const statusBars = statusDist.map(s => `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${s.label}</span><span style="color:var(--text3)">${s.count}</span></div>
      <div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden"><div style="height:100%;width:${total > 0 ? Math.round(s.count / total * 100) : 0}%;background:${s.color};border-radius:3px"></div></div>
    </div>`).join('');

    return `
    <div class="section-header"><div><div class="section-title">Analytics</div><div class="section-sub">Term 2 · 2026 — performance metrics</div></div></div>

    <div class="stats-grid" style="margin-bottom:24px">
      <div class="stat-card"><div class="stat-label">Total Errors Logged</div><div class="stat-val">${total}</div><div class="stat-sub">${resolved} resolved</div></div>
      <div class="stat-card r"><div class="stat-label">Open / Critical</div><div class="stat-val" style="color:var(--red)">${open} <span style="font-size:16px">/ ${critCount}</span></div><div class="stat-sub">${slaBreaches} SLA breaches</div></div>
      <div class="stat-card g"><div class="stat-label">Resolution Rate</div><div class="stat-val" style="color:var(--green)">${resolveRate}<span style="font-size:18px">%</span></div><div class="stat-sub">target: 90%+</div></div>
      <div class="stat-card a"><div class="stat-label">Avg Age (hours)</div><div class="stat-val" style="color:var(--amber)">${avgAge}<span style="font-size:14px">h</span></div><div class="stat-sub">all open errors</div></div>
      <div class="stat-card t"><div class="stat-label">Weekly Check-In Rate</div><div class="stat-val" style="color:var(--teal)">${checkinRate}<span style="font-size:18px">%</span></div><div class="stat-sub">${checkins.done || 0}/${checkins.total || 0} expected</div></div>
      <div class="stat-card"><div class="stat-label">School Health</div><div class="stat-val">${schools_healthy}<span style="font-size:18px">/${schools_total}</span></div><div class="stat-sub">${schools_total - schools_healthy} need attention</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-title">Errors by Category</div>
        ${catBars || '<div class="empty">No data</div>'}
      </div>
      <div class="card">
        <div class="card-title">Status Distribution</div>
        ${statusBars}
      </div>
    </div>`;
  }

  return { load, render };
})();
