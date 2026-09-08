/**
 * Analytics. Design: docs/features/06-trend-metrics.md
 *
 * Two halves: the snapshot that was already here, and trends over the last 13
 * ISO weeks — because a number without a direction is not a decision.
 *
 * Charts are inline SVG. The CSP allows scripts from a short CDN list only, and
 * a bar or line over 13 points does not need a charting library.
 *
 * Honesty rules throughout, and they are the reason this file exists in this
 * shape: an em dash where nothing is measurable, never a fabricated 0 or 100;
 * rows that cannot be judged counted and named; every metric titled for what it
 * actually measures. This page once displayed −200%.
 */
const AnalyticsPage = (() => {
  let data = null, errors = [], trends = null, activeView = 'trends';

  async function load() {
    try {
      const [d, e, t] = await Promise.all([
        API.getDashboard(),
        API.getErrors(),
        API.getTrends().catch(() => null)
      ]);
      data = d;
      errors = e.errors || e || [];
      trends = t;
    } catch (e) { data = null; errors = []; trends = null; }
  }

  // --- formatting ----------------------------------------------------------

  const NA = '&mdash;';
  const hrs = v => v == null ? NA : v < 1 ? Math.round(v * 60) + 'm' : v < 48 ? v + 'h' : (v / 24).toFixed(1) + 'd';
  const pctText = v => v == null ? NA : v + '%';

  /**
   * A movement against the four-week average. `goodDown` says which direction
   * is an improvement, so MTTR falling and SLA rising both read as green.
   */
  function delta(change, goodDown, fmt) {
    if (change == null || change === 0) {
      return `<span style="font-size:11px;color:var(--text3)">${change === 0 ? 'no change' : 'no baseline yet'}</span>`;
    }
    const better = goodDown ? change < 0 : change > 0;
    const arrow = change > 0 ? 'ti-arrow-up-right' : 'ti-arrow-down-right';
    const col = better ? 'var(--green)' : 'var(--red)';
    return `<span style="font-size:11px;color:${col}"><i class="ti ${arrow}" style="font-size:11px"></i> ${fmt(Math.abs(change))} vs 4-week avg</span>`;
  }

  // --- charts --------------------------------------------------------------

  /**
   * A line over the weekly buckets. Weeks with no measurable value break the
   * line rather than being drawn as zero — a gap is the truth, a dip is a lie.
   */
  function lineChart(rows, key, color, fmt) {
    const W = 320, H = 90, PAD = 4;
    const pts = rows.map((r, i) => ({ i, v: r[key], week: r.week_number }));
    const vals = pts.map(p => p.v).filter(v => v != null);
    if (!vals.length) {
      return `<div style="height:${H}px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text3)">nothing measurable in this period</div>`;
    }
    if (vals.length < 3) {
      // Not enough weeks to show a direction. Say the numbers plainly rather
      // than drawing an almost-empty chart, which reads as broken.
      const shown = pts.filter(p => p.v != null);
      return `<div style="height:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px">
        <div style="display:flex;gap:16px">${shown.map(p => `<div style="text-align:center">
          <div style="font-size:15px;font-weight:600;color:${color}">${fmt(p.v)}</div>
          <div style="font-size:10px;color:var(--text3)">wk ${p.week}</div>
        </div>`).join('')}</div>
        <div style="font-size:10px;color:var(--text3)">${shown.length === 1 ? 'one week' : shown.length + ' weeks'} of data — not enough for a direction yet</div>
      </div>`;
    }

    const max = Math.max(...vals), min = Math.min(...vals);
    const span = max - min || 1;
    const x = i => PAD + (i * (W - PAD * 2)) / Math.max(1, pts.length - 1);
    const y = v => H - PAD - ((v - min) / span) * (H - PAD * 2);

    // Split into unbroken runs so a gap stays a gap.
    const runs = [];
    let run = [];
    for (const p of pts) {
      if (p.v == null) { if (run.length) runs.push(run); run = []; }
      else run.push(p);
    }
    if (run.length) runs.push(run);

    return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible" role="img"
         aria-label="${pts.length} weeks, from ${fmt(vals[0])} to ${fmt(vals[vals.length - 1])}">
      ${runs.map(r => r.length === 1
        ? `<circle cx="${x(r[0].i).toFixed(1)}" cy="${y(r[0].v).toFixed(1)}" r="2.5" fill="${color}"/>`
        : `<polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
             points="${r.map(p => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>`).join('')}
      ${pts.filter(p => p.v != null).map(p =>
        `<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2" fill="${color}" opacity=".85"/>`).join('')}
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-top:2px">
      <span>wk ${pts[0].week}</span><span>wk ${pts[pts.length - 1].week}</span>
    </div>`;
  }

  /**
   * Reported vs resolved per week, as paired bars.
   *
   * The pair width is capped and the row left-aligned: with one week of data
   * `flex:1` stretched a single pair across the whole card and it read as a
   * solid block rather than a bar.
   */
  function volumeChart(rows) {
    const H = 96;
    const max = Math.max(1, ...rows.map(r => Math.max(r.reported, r.resolved)));
    const sparse = rows.length < 3;
    return `
    <div style="display:flex;align-items:flex-end;gap:${sparse ? 10 : 3}px;height:${H}px;justify-content:${sparse ? 'flex-start' : 'stretch'}">
      ${rows.map(r => `
        <div style="flex:${sparse ? '0 0 44px' : '1'};display:flex;flex-direction:column;justify-content:flex-end;gap:2px;min-width:0"
             title="Week ${r.week_number}: ${r.reported} reported, ${r.resolved} resolved">
          <div style="display:flex;gap:2px;align-items:flex-end;height:${H - 14}px">
            <div style="flex:1;background:var(--accent);border-radius:2px 2px 0 0;height:${Math.round((r.reported / max) * 100)}%;min-height:${r.reported ? '2px' : '0'}"></div>
            <div style="flex:1;background:var(--green);border-radius:2px 2px 0 0;height:${Math.round((r.resolved / max) * 100)}%;min-height:${r.resolved ? '2px' : '0'}"></div>
          </div>
          <div style="font-size:9px;color:var(--text3);text-align:center">${r.week_number}</div>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:14px;font-size:11px;color:var(--text3);margin-top:6px;flex-wrap:wrap">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--accent);margin-right:4px"></span>reported</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--green);margin-right:4px"></span>resolved</span>
      ${sparse ? `<span style="color:var(--text3)">${rows.length === 1 ? 'one week' : rows.length + ' weeks'} of data</span>` : ''}
    </div>`;
  }

  function trendCard(title, sub, value, change, goodDown, fmt, chart) {
    return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px">
        <div style="min-width:0">
          <div class="card-title" style="margin:0">${title}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px">${sub}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:22px;font-weight:600;letter-spacing:-.5px">${value}</div>
          ${delta(change, goodDown, fmt)}
        </div>
      </div>
      ${chart}
    </div>`;
  }

  // --- views ---------------------------------------------------------------

  function trendsView() {
    if (!trends) {
      return `<div class="card"><div class="empty" style="padding:40px 20px"><i class="ti ti-chart-line-off"></i>Trends could not be loaded.</div></div>`;
    }
    const rows = trends.weekly;
    if (!rows.length) {
      return `<div class="card"><div class="empty" style="padding:40px 20px"><i class="ti ti-chart-line"></i>No faults reported in the last ${trends.weeks} weeks.</div></div>`;
    }
    const t = trends.totals;
    const last = t.last_week || {};
    // Name the bucket by its own week number. Calling week 24 "last week" on a
    // dataset three months old would be a plain untruth.
    const wk = last.week_number != null ? ('week ' + last.week_number) : 'the latest week';
    const unmeasurable = rows.reduce((s, r) => s + r.sla_unmeasurable, 0);
    const d = trends.ai_deflection;

    return `
    ${unmeasurable ? `
    <div class="alert-banner" style="background:rgba(99,106,130,0.10);border-color:var(--border)">
      <i class="ti ti-info-circle" style="font-size:16px;color:var(--text3);flex-shrink:0"></i>
      <div class="alert-banner-text" style="flex:1;min-width:0;font-size:12px;color:var(--text2)">
        ${unmeasurable} resolved fault${unmeasurable === 1 ? '' : 's'} in this period ${unmeasurable === 1 ? 'has' : 'have'} no resolution time or target recorded,
        so ${unmeasurable === 1 ? 'it is' : 'they are'} excluded from SLA compliance rather than counted as a miss.
      </div>
    </div>` : ''}

    <div class="two-col" style="align-items:start;margin-bottom:16px">
      ${trendCard('Time to resolve',
        `mean over ${last.mttr_basis || 0} resolved in ${wk}`,
        hrs(last.mttr_hours), t.change.mttr_hours, true, hrs,
        lineChart(rows, 'mttr_hours', 'var(--accent)', hrs))}

      ${trendCard('Time to first response',
        `the part the team controls · ${last.ttfr_basis || 0} answered in ${wk}`,
        hrs(last.ttfr_hours), t.change.ttfr_hours, true, hrs,
        lineChart(rows, 'ttfr_hours', 'var(--teal)', hrs))}

      ${trendCard('SLA compliance',
        `${last.sla_pct == null ? 0 : Math.round((last.sla_pct / 100) * last.sla_measurable)}/${last.sla_measurable || 0} on time in ${wk}`,
        pctText(last.sla_pct), t.change.sla_pct, false, v => v + '%',
        lineChart(rows, 'sla_pct', 'var(--green)', v => v + '%'))}

      ${trendCard('Escalation rate',
        'rising means the first line needs more support',
        pctText(last.escalation_pct), t.change.escalation_pct, true, v => v + '%',
        lineChart(rows, 'escalation_pct', 'var(--purple)', v => v + '%'))}
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Reported and resolved by week</div>
      <div style="font-size:11px;color:var(--text3);margin:-6px 0 12px">
        ${t.reported_total} reported, ${t.resolved_total} resolved over ${trends.weeks} weeks
      </div>
      ${volumeChart(rows)}
    </div>

    <div class="two-col" style="align-items:start;margin-bottom:16px">
      <div class="card">
        <div class="card-title">Resolved without escalation</div>
        <div style="font-size:11px;color:var(--text3);margin:-6px 0 10px">
          Named for what it measures: nothing here records contacts, so this is not "first-contact resolution".
        </div>
        <div style="font-size:26px;font-weight:600;letter-spacing:-1px;color:var(--green)">${pctText(last.no_escalation_pct)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">of ${wk}'s resolutions</div>
        <div style="margin-top:10px">${lineChart(rows, 'no_escalation_pct', 'var(--green)', v => v + '%')}</div>
      </div>

      <div class="card">
        <div class="card-title">Assistant deflection</div>
        <div style="font-size:11px;color:var(--text3);margin:-6px 0 10px">
          Chats after which the same person did not file a fault within ${d.window}.
        </div>
        <div style="font-size:26px;font-weight:600;letter-spacing:-1px;color:${d.deflected_pct == null ? 'var(--text3)' : 'var(--teal)'}">${pctText(d.deflected_pct)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">
          ${d.chats ? `${d.chats - d.followed_by_a_report} of ${d.chats} chats ended without a ticket` : 'nobody has used the assistant in this period'}
        </div>
        ${trends.channels.length ? `
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text3);margin-bottom:7px">HOW FAULTS ARRIVED</div>
          ${trends.channels.map(c => `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);padding:2px 0">
            <span>${channelLabel(c.channel)}</span><span>${c.count}</span></div>`).join('')}
        </div>` : ''}
      </div>
    </div>

    ${engineerTable()}
    ${schoolTable()}`;
  }

  function channelLabel(c) {
    return { web: 'Web form', whatsapp: 'WhatsApp', monitor: 'Detected automatically', unrecorded: 'Before channels were recorded' }[c] || esc(c);
  }

  /**
   * Per engineer. Framed as workload beside outcome, never a scoreboard: an
   * engineer with the worst MTTR is more likely covering the hardest zone than
   * being slow, so the schools they cover sit next to the number.
   */
  function engineerTable() {
    const rows = trends.engineers;
    if (!rows.length) return '';
    return `
    <div class="card" style="padding:0;margin-bottom:16px">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
        <div class="card-title" style="margin:0">By engineer</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">Load beside outcome — the hardest zone shows up as a slower time, not a worse engineer.</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Engineer</th><th class="hide-mobile">Schools</th><th>Assigned</th><th>Open</th><th>Resolve time</th><th class="hide-mobile">SLA</th></tr></thead>
        <tbody>${rows.map(e => `<tr>
          <td><span style="font-weight:500;font-size:13px">${esc(e.full_name)}</span>
            <div style="font-size:11px;color:var(--text3)">${esc(e.zone || '—')}</div></td>
          <td class="hide-mobile" style="font-size:12px">${e.schools_covered}</td>
          <td style="font-size:12px">${e.assigned}</td>
          <td style="font-size:12px;color:${e.still_open ? 'var(--amber)' : 'var(--text2)'}">${e.still_open}</td>
          <td style="font-size:12px;white-space:nowrap">${hrs(e.mttr_hours)}</td>
          <td class="hide-mobile" style="font-size:12px">${pctText(e.sla_pct)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  }

  function schoolTable() {
    const rows = trends.schools;
    if (!rows.length) return '';
    const max = Math.max(1, ...rows.map(r => r.reported));
    return `
    <div class="card" style="padding:0">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
        <div class="card-title" style="margin:0">By school</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">Last ${trends.weeks} weeks</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>School</th><th>Reported</th><th>Open</th><th>Resolve time</th><th class="hide-mobile">Escalated</th></tr></thead>
        <tbody>${rows.map(s => `<tr>
          <td><span style="font-weight:500;font-size:13px">${esc(s.name)}</span>
            <div style="font-size:11px;color:var(--text3)">${esc(s.zone || '—')}</div></td>
          <td style="min-width:100px">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="progress" style="flex:1"><div class="progress-fill" style="width:${Math.round((s.reported / max) * 100)}%;background:var(--accent)"></div></div>
              <span style="font-size:12px;width:20px;text-align:right">${s.reported}</span>
            </div>
          </td>
          <td style="font-size:12px;color:${s.still_open ? 'var(--amber)' : 'var(--text2)'}">${s.still_open}</td>
          <td style="font-size:12px;white-space:nowrap">${hrs(s.mttr_hours)}</td>
          <td class="hide-mobile" style="font-size:12px;color:${s.escalated ? 'var(--purple)' : 'var(--text3)'}">${s.escalated}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  }

  /** The original snapshot, kept: "right now" is still worth one glance. */
  function snapshotView() {
    if (!data) return '<div class="empty"><i class="ti ti-loader"></i>Loading...</div>';
    const { errors: errStats, checkins, category_breakdown } = data;
    const total = parseInt(errStats.total) || 0;
    const open = parseInt(errStats.open_count) || 0;
    const resolved = total - open;
    const checkinRate = checkins.total > 0 ? Math.round((checkins.done || 0) / checkins.total * 100) : 0;

    const measurable = parseInt(errStats.sla_measurable) || 0;
    const onTime = parseInt(errStats.sla_on_time) || 0;
    const unmeasurable = parseInt(errStats.sla_unmeasurable) || 0;
    const slaMet = measurable > 0 ? Math.round(onTime / measurable * 100) : null;
    const slaSub = measurable > 0
      ? `${onTime}/${measurable} resolved on time${unmeasurable ? ` · ${unmeasurable} not timed` : ''}`
      : unmeasurable > 0 ? `${unmeasurable} resolved without a timestamp` : 'nothing resolved yet';

    const catBars = (category_breakdown || []).map(c => {
      const m = CAT_META[c.category] || CAT_META.Other;
      const p = total > 0 ? Math.round(c.count / total * 100) : 0;
      return `<div style="display:flex;justify-content:space-between;align-items:center"><span><i class="ti ${m.ic}" style="color:${m.color};margin-right:6px;font-size:13px"></i>${c.category}</span><div style="display:flex;align-items:center;gap:8px"><div class="progress" style="width:120px"><div class="progress-fill" style="width:${p}%;background:${m.color}"></div></div><span style="color:var(--text2);width:54px;text-align:right">${c.count} (${p}%)</span></div></div>`;
    }).join('');

    const bySchool = {};
    errors.forEach(e => { const n = e.school_name || 'Unknown'; bySchool[n] = (bySchool[n] || 0) + 1; });
    const ranked = Object.keys(bySchool).map(n => ({ n, c: bySchool[n] })).sort((a, b) => b.c - a.c);
    const maxN = Math.max(1, ...ranked.map(r => r.c));
    const schoolBars = ranked.map(r => {
      const p = Math.round(r.c / maxN * 100);
      const col = r.c >= 8 ? 'var(--red)' : r.c >= 5 ? 'var(--amber)' : 'var(--accent)';
      return `<div style="display:flex;align-items:center;gap:10px"><span style="width:120px;color:var(--text2);flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.n)}</span><div class="progress" style="flex:1"><div class="progress-fill" style="width:${p}%;background:${col}"></div></div><span style="color:var(--text2);width:24px;text-align:right">${r.c}</span></div>`;
    }).join('');

    return `
    <div class="three-col" style="margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Total Errors Logged</div><div class="stat-val" style="color:var(--accent)">${total}</div><div class="stat-sub">${resolved} resolved</div></div>
      <div class="stat-card g"><div class="stat-label">SLA Compliance</div><div class="stat-val" style="color:var(--green)">${slaMet === null ? NA : `${slaMet}<span style="font-size:18px">%</span>`}</div><div class="stat-sub">${slaSub}</div></div>
      <div class="stat-card t"><div class="stat-label">Weekly Check-In Rate</div><div class="stat-val" style="color:var(--teal)">${checkinRate}<span style="font-size:18px">%</span></div><div class="stat-sub">${checkins.done || 0}/${checkins.total || 0} expected</div></div>
    </div>

    <div class="two-col" style="align-items:start">
      <div class="card">
        <div class="card-title">Errors by School</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:12px">${schoolBars || '<div class="empty">No data</div>'}</div>
      </div>
      <div class="card">
        <div class="card-title">Error Type Distribution</div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:12px">${catBars || '<div class="empty">No data</div>'}</div>
      </div>
    </div>`;
  }

  function render() {
    if (!data) return '<div class="empty"><i class="ti ti-loader"></i>Loading...</div>';
    return `
    <div class="section-header">
      <div>
        <div class="section-title">Analytics</div>
        <div class="section-sub">Term 2 · 2026 — ${trends ? `last ${trends.weeks} weeks` : 'performance metrics'}</div>
      </div>
    </div>

    <div class="tab-row" style="margin-bottom:14px">
      <button class="tab-btn ${activeView === 'trends' ? 'active' : ''}" onclick="AnalyticsPage.setView('trends')"><i class="ti ti-chart-line"></i> Trends</button>
      <button class="tab-btn ${activeView === 'snapshot' ? 'active' : ''}" onclick="AnalyticsPage.setView('snapshot')"><i class="ti ti-camera"></i> Right now</button>
    </div>

    <div id="analytics-view">${activeView === 'trends' ? trendsView() : snapshotView()}</div>`;
  }

  function setView(v) {
    activeView = v;
    // In-place swap, never App.render() — that flickers and drops the sidebar.
    document.querySelectorAll('.main .tab-row .tab-btn').forEach((b, i) => {
      b.classList.toggle('active', ['trends', 'snapshot'][i] === v);
    });
    const slot = document.getElementById('analytics-view');
    if (slot) {
      slot.innerHTML = v === 'trends' ? trendsView() : snapshotView();
      slot.querySelectorAll('.card, .stat-card, .alert-banner').forEach(c => c.classList.add('reveal', 'visible'));
    }
  }

  function afterRender() {
    document.querySelectorAll('.main .card, .main .stat-card, .main .alert-banner').forEach(c => c.classList.add('reveal', 'visible'));
  }

  return { load, render, afterRender, setView };
})();
