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
    const checkinRate = checkins.total > 0 ? Math.round((checkins.done || 0) / checkins.total * 100) : 0;

    // SLA compliance comes from the backend, which compares each resolution
    // against that error own due time. It used to be computed here by
    // subtracting the count of still-OPEN breaches from the RESOLVED count —
    // two different populations — which is how this card came to read -200%.
    const measurable = parseInt(errStats.sla_measurable) || 0;
    const onTime = parseInt(errStats.sla_on_time) || 0;
    const unmeasurable = parseInt(errStats.sla_unmeasurable) || 0;
    const slaMet = measurable > 0 ? Math.round(onTime / measurable * 100) : null;
    const slaSub = measurable > 0
      ? `${onTime}/${measurable} resolved on time${unmeasurable ? ` · ${unmeasurable} not timed` : ''}`
      : unmeasurable > 0
        ? `${unmeasurable} resolved without a timestamp`
        : 'nothing resolved yet';

    const catBars = (category_breakdown || []).map(c => {
      const m = CAT_META[c.category] || CAT_META.Other;
      const pct = total > 0 ? Math.round(c.count / total * 100) : 0;
      return `<div style="display:flex;justify-content:space-between;align-items:center"><span><i class="ti ${m.ic}" style="color:${m.color};margin-right:6px;font-size:13px"></i>${c.category}</span><div style="display:flex;align-items:center;gap:8px"><div class="progress" style="width:120px"><div class="progress-fill" style="width:${pct}%;background:${m.color}"></div></div><span style="color:var(--text2);width:54px;text-align:right">${c.count} (${pct}%)</span></div></div>`;
    }).join('');

    const bySchool = {};
    errors.forEach(e => { const name = e.school_name || 'Unknown'; bySchool[name] = (bySchool[name] || 0) + 1; });
    const ranked = Object.keys(bySchool).map(name => ({ name, n: bySchool[name] })).sort((a, b) => b.n - a.n);
    const maxN = Math.max(1, ...ranked.map(r => r.n));
    const schoolBars = ranked.map(r => {
      const pct = Math.round(r.n / maxN * 100);
      const col = r.n >= 8 ? 'var(--red)' : r.n >= 5 ? 'var(--amber)' : 'var(--accent)';
      return `<div style="display:flex;align-items:center;gap:10px"><span style="width:120px;color:var(--text2);flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</span><div class="progress" style="flex:1"><div class="progress-fill" style="width:${pct}%;background:${col}"></div></div><span style="color:var(--text2);width:24px;text-align:right">${r.n}</span></div>`;
    }).join('');

    return `
    <div class="section-header"><div><div class="section-title">Analytics</div><div class="section-sub">Term 2 · 2026 — performance metrics</div></div></div>

    <div class="three-col" style="margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Total Errors Logged</div><div class="stat-val" style="color:var(--accent)">${total}</div><div class="stat-sub">${resolved} resolved</div></div>
      <div class="stat-card g"><div class="stat-label">SLA Compliance</div><div class="stat-val" style="color:var(--green)">${slaMet === null ? '&mdash;' : `${slaMet}<span style="font-size:18px">%</span>`}</div><div class="stat-sub">${slaSub}</div></div>
      <div class="stat-card t"><div class="stat-label">Weekly Check-In Rate</div><div class="stat-val" style="color:var(--teal)">${checkinRate}<span style="font-size:18px">%</span></div><div class="stat-sub">${checkins.done || 0}/${checkins.total || 0} expected</div></div>
    </div>

    <div class="two-col" style="align-items:start">
      <div class="card">
        <div class="card-title">Errors by School</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:12px">
          ${schoolBars || '<div class="empty">No data</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Error Type Distribution</div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:12px">
          ${catBars || '<div class="empty">No data</div>'}
        </div>
      </div>
    </div>`;
  }

  return { load, render };
})();
