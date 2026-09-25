/**
 * Dashboards, one per level.
 *
 * Every tile here has to answer "if this number changed, what would I do
 * differently today". Counts that cannot change anybody's next action —
 * lifetime totals, how many guides exist, how many faults are in progress —
 * are not shown, however cheap they are to render. They cost the one thing the
 * page is short of, which is the reader's attention to the numbers that matter.
 *
 * Payload shapes come from backend/src/controllers/dashboardController.js.
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
    if (data.type === 'teacher') return renderTeacher();
    if (data.type === 'school') return renderSchool();
    if (data.type === 'subadmin') return renderSubadmin();
    return renderAdmin();
  }

  /* ---------------------------------------------------------------- *
   * Shared bits
   * ---------------------------------------------------------------- */

  const go = page => `Router.navigate('${page}');App.loadAndRender()`;

  /** Hours as something a person reads at a glance. */
  function dur(hours) {
    if (hours == null) return '—';
    const h = Number(hours);
    if (h < 1) return Math.round(h * 60) + 'm';
    if (h < 48) return Math.round(h) + 'h';
    return Math.round(h / 24) + 'd';
  }

  /** How long since the last heartbeat. A week-old outage reads "8d", not "11190m". */
  function since(minutes) {
    return minutes == null ? '—' : dur(Number(minutes) / 60);
  }

  /** Heartbeat state as label + colour. "Never reported" is not "down". */
  function beat(state) {
    if (state === 'down') return { label: 'Down', color: 'var(--red)', icon: 'ti-wifi-off' };
    if (state === 'up') return { label: 'Up', color: 'var(--green)', icon: 'ti-wifi' };
    if (state === 'unknown') return { label: 'Never reported', color: 'var(--text3)', icon: 'ti-help-circle' };
    return { label: 'Not monitored', color: 'var(--text3)', icon: 'ti-help-circle' };
  }

  function faultRows(rows, opts) {
    const o = opts || {};
    if (!rows || !rows.length) {
      return `<tr><td colspan="${o.cols || 5}"><div class="empty" style="padding:20px 0"><i class="ti ti-circle-check"></i>${o.empty || 'Nothing open'}</div></td></tr>`;
    }
    return rows.map(e => {
      const pri = PRI[e.priority] || PRI.medium;
      const stat = STAT[e.status] || STAT.open;
      const breach = Number(e.sla_breached) === 1;
      return `<tr style="cursor:pointer" onclick="ErrorDetailModal.open(${e.id})">
        <td><span class="dot ${pri.dot}"></span></td>
        <td><span style="font-size:12px;font-weight:500">${esc(e.title)}</span><br><span class="error-id">${esc(e.error_code)}</span></td>
        ${o.school ? `<td class="hide-mobile" style="font-size:12px;color:var(--text2)">${esc(e.school_name || '')}</td>` : ''}
        ${o.holder ? `<td class="hide-mobile" style="font-size:12px;color:var(--text2)">${esc(holderOf(e))}</td>` : ''}
        <td><span class="badge ${stat.badge}">${stat.label}</span></td>
        <td style="font-size:12px;color:${breach ? 'var(--red)' : 'var(--text3)'}">${ageStr(e.hours_open)}${breach ? ' <i class="ti ti-alert-triangle" style="font-size:11px"></i>' : ''}</td>
      </tr>`;
    }).join('');
  }

  /** Who is holding a school's fault right now — the school, or somebody upstream. */
  function holderOf(e) {
    if (e.escalation_level === 'school' && !e.assigned_to) return 'You';
    return e.assignee_name || 'Field engineer';
  }

  /* ---------------------------------------------------------------- *
   * Head office — what has to move today
   * ---------------------------------------------------------------- */

  function renderAdmin() {
    const { schools, faults, devices, resolution, priorities, schools_attention, category_breakdown, checkins } = data;

    // Resolution time, with a direction. A figure with no direction cannot tell
    // anybody whether the operation is getting better, which is the only
    // question a monthly review asks.
    let resolveVal = '—', resolveSub = `nothing resolved in ${resolution.window_days} days`, resolveColor = 'var(--text3)';
    if (resolution.hours != null) {
      resolveVal = dur(resolution.hours);
      resolveColor = 'var(--text)';
      if (resolution.prev_hours == null || resolution.prev_hours === 0) {
        resolveSub = `${resolution.basis} resolved · no earlier period to compare`;
      } else {
        const delta = resolution.hours - resolution.prev_hours;
        const pct = Math.round(Math.abs(delta) / resolution.prev_hours * 100);
        if (pct === 0) resolveSub = 'unchanged on the previous 4 weeks';
        else {
          const faster = delta < 0;
          resolveColor = faster ? 'var(--green)' : 'var(--red)';
          resolveSub = `<span style="color:${resolveColor}"><i class="ti ti-trending-${faster ? 'down' : 'up'}" style="font-size:11px;vertical-align:-1px"></i> ${pct}% ${faster ? 'faster' : 'slower'}</span> than the 4 weeks before`;
        }
      }
    }

    const attentionRows = (schools_attention || []).map(s => {
      const b = beat(s.heartbeat_state);
      const flags = [];
      if (s.heartbeat_state === 'down') flags.push(`<span style="color:var(--red)"><i class="ti ti-wifi-off" style="font-size:11px"></i> LRS down ${since(s.minutes_since_heartbeat)}</span>`);
      if (s.critical_count > 0) flags.push(`<span style="color:var(--red)">${s.critical_count} critical</span>`);
      if (s.breached_count > 0) flags.push(`<span style="color:var(--amber)">${s.breached_count} past due</span>`);
      if (s.devices_down > 0) flags.push(`<span style="color:var(--text2)">${s.devices_down} device${s.devices_down > 1 ? 's' : ''} down</span>`);
      if (s.spares_needed > 0) flags.push(`<span style="color:var(--purple)">needs ${s.spares_needed} spare${s.spares_needed > 1 ? 's' : ''}</span>`);
      return `<div class="dash-row" onclick="${go('schools')}">
        <div style="width:32px;height:32px;border-radius:8px;background:${b.color}14;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ti-building" style="font-size:15px;color:${b.color}"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</div>
          <div style="font-size:11px;color:var(--text3);display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">${flags.join('<span style="color:var(--border)">·</span>') || 'no open faults'}</div>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text2)">${s.open_count}</div>
      </div>`;
    }).join('') || '<div class="empty" style="padding:24px 0"><i class="ti ti-circle-check"></i>Every school is clear</div>';

    const catRows = (category_breakdown || []).map(c => {
      const m = CAT_META[c.category] || CAT_META.Other;
      const pct = Math.round(c.count / Math.max(1, faults.open) * 100);
      return `<div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span><i class="ti ${m.ic}" style="font-size:13px;vertical-align:-2px;margin-right:5px;color:${m.color}"></i>${esc(c.category)}</span>
        <span style="color:var(--text2)">${c.count}</span></div>
        <div class="progress"><div class="progress-fill" style="width:${pct}%;background:${m.color}"></div></div></div>`;
    }).join('') || '<div class="empty" style="padding:16px 0"><i class="ti ti-circle-check"></i>No open faults</div>';

    // One banner, for the sharpest fact. A blackout outranks a clock.
    let banner = '';
    if (schools.lrs_silent > 0) {
      banner = `<div class="alert-banner">
        <i class="ti ti-wifi-off"></i>
        <div class="alert-banner-text"><strong>${schools.lrs_silent} school${schools.lrs_silent > 1 ? 's' : ''} offline</strong> — no LRS heartbeat for over ${schools.silent_after_minutes} minutes. Nobody there can report a fault either.</div>
        <button class="btn btn-danger btn-sm" onclick="${go('lrs')}">View</button>
      </div>`;
    } else if (faults.breaching_now > 0) {
      banner = `<div class="alert-banner">
        <i class="ti ti-clock-exclamation"></i>
        <div class="alert-banner-text"><strong>${faults.breaching_now} fault${faults.breaching_now > 1 ? 's' : ''} past the agreed time</strong>${faults.due_soon > 0 ? `, and ${faults.due_soon} due within 4 hours` : ''}.</div>
        <button class="btn btn-danger btn-sm" onclick="${go('tracker')}">View</button>
      </div>`;
    }

    return `
  <div class="section-header">
    <div>
      <div class="section-title">Today at a glance</div>
      <div class="section-sub">All ${schools.total} schools · Week ${checkins.current_week}</div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-secondary btn-sm" onclick="${go('visits')}"><i class="ti ti-route"></i> Plan a visit</button>
      <button class="btn btn-primary btn-sm" onclick="${go('tracker')}"><i class="ti ti-list-check"></i> All faults</button>
    </div>
  </div>

  ${banner}

  <div class="stats-grid">
    <div class="stat-card r">
      <div class="stat-label">Past the agreed time</div>
      <div class="stat-val" style="color:var(--red)">${faults.breaching_now}</div>
      <div class="stat-sub">${faults.due_soon} due within 4h · ${faults.open} open</div>
    </div>
    <div class="stat-card a">
      <div class="stat-label">Nobody has answered</div>
      <div class="stat-val" style="color:var(--amber)">${faults.unanswered}</div>
      <div class="stat-sub">${faults.unanswered > 0 && faults.unanswered_oldest_hours != null ? 'oldest waiting ' + dur(faults.unanswered_oldest_hours) : 'every fault acknowledged'}</div>
    </div>
    <div class="stat-card t">
      <div class="stat-label">Schools needing attention</div>
      <div class="stat-val" style="color:var(--teal)">${schools.needing_attention}<span style="font-size:16px;color:var(--text3)">/${schools.total}</span></div>
      <div class="stat-sub">${faults.critical} critical · ${schools.lrs_silent} offline</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Devices out of service</div>
      <div class="stat-val">${devices.out_of_service}<span style="font-size:16px;color:var(--text3)">/${devices.total}</span></div>
      <div class="stat-sub" style="color:${devices.stockout_schools > 0 ? 'var(--purple)' : 'var(--text3)'}">${devices.stockout_schools > 0 ? devices.stockout_schools + ' school' + (devices.stockout_schools > 1 ? 's' : '') + ' with no spare' : 'spares available everywhere'}</div>
    </div>
    <div class="stat-card g">
      <div class="stat-label">Time to resolve · ${resolution.window_days}d</div>
      <div class="stat-val" style="color:${resolveColor}">${resolveVal}</div>
      <div class="stat-sub">${resolveSub}</div>
    </div>
  </div>

  <div class="two-col" style="align-items:start">
    <div class="card">
      <div class="card-title">What to move first
        <a style="font-size:11px;color:var(--accent);cursor:pointer;text-transform:none;letter-spacing:0" onclick="${go('tracker')}">View all</a>
      </div>
      <div style="font-size:11px;color:var(--text3);margin:-6px 0 12px">Past the agreed time first, then by severity, oldest at the top.</div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Fault</th><th class="hide-mobile">School</th><th>Status</th><th>Age</th></tr></thead>
        <tbody>${faultRows(priorities, { school: true, empty: 'No open faults anywhere' })}</tbody>
      </table></div>
    </div>

    <div class="card">
      <div class="card-title">Where to send someone</div>
      <div style="display:flex;flex-direction:column;gap:8px">${attentionRows}</div>

      <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border)">
        <div class="card-title" style="margin-bottom:12px">Open faults by cause</div>
        <div style="display:flex;flex-direction:column;gap:12px">${catRows}</div>
      </div>

      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="${go('weekly')}">
        <span style="font-size:12px;color:var(--text3)"><i class="ti ti-clipboard-check" style="font-size:13px;color:var(--purple);margin-right:6px"></i>Week ${checkins.current_week} check-ins</span>
        <span style="font-size:12px;font-weight:600;color:${checkins.done >= checkins.total ? 'var(--green)' : 'var(--text2)'}">${checkins.done}/${checkins.total}</span>
      </div>
    </div>
  </div>`;
  }

  /* ---------------------------------------------------------------- *
   * School administrator — can lessons run tomorrow, and what is mine
   * ---------------------------------------------------------------- */

  function renderSchool() {
    if (data.unlinked || !data.school) {
      return `<div class="section-header"><div><div class="section-title">My school</div>
        <div class="section-sub">School administrator</div></div></div>
        <div class="empty" style="padding:40px 0"><i class="ti ti-school"></i>This account is not linked to a school yet. Ask head office to link it before reporting faults.</div>`;
    }

    const { school, devices, by_form, faults, open_errors, lrs, maintenance, checkin, teachers } = data;
    const b = beat(lrs.state);
    const workingPct = devices.total > 0 ? Math.round(devices.working / devices.total * 100) : null;

    let banner = '';
    if (lrs.state === 'down') {
      banner = `<div class="alert-banner">
        <i class="ti ti-wifi-off"></i>
        <div class="alert-banner-text"><strong>The learning server has stopped reporting</strong> — no signal for ${since(lrs.minutes_since)}. Students will not be able to reach the platform.</div>
        <button class="btn btn-danger btn-sm" onclick="${go('report')}">Report it</button>
      </div>`;
    } else if (faults.waiting_on_me > 0 && faults.waiting_oldest_hours != null && faults.waiting_oldest_hours >= 48) {
      banner = `<div class="alert-banner">
        <i class="ti ti-inbox"></i>
        <div class="alert-banner-text"><strong>${faults.waiting_on_me} fault${faults.waiting_on_me > 1 ? 's' : ''} waiting on you</strong> — the oldest has been waiting ${dur(faults.waiting_oldest_hours)}. Fix it here, or send it to the engineer.</div>
        <button class="btn btn-danger btn-sm" onclick="${go('tracker')}">Open</button>
      </div>`;
    }

    const formRows = (by_form || []).map(f => {
      const pct = f.total > 0 ? Math.round(f.down / f.total * 100) : 0;
      return `<div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span><i class="ti ti-users" style="font-size:13px;vertical-align:-2px;margin-right:5px;color:var(--amber)"></i>${esc(f.form)}</span>
        <span style="color:var(--text2)">${f.down} of ${f.total} down</span></div>
        <div class="progress"><div class="progress-fill" style="width:${pct}%;background:var(--amber)"></div></div></div>`;
    }).join('') || '<div class="empty" style="padding:16px 0"><i class="ti ti-circle-check"></i>Every class has its devices</div>';

    const checkRows = (maintenance.next || []).map(c => `
      <div style="display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid var(--border)">
        <i class="ti ti-${c.overdue ? 'alert-triangle' : 'tool'}" style="font-size:14px;color:${c.overdue ? 'var(--red)' : 'var(--amber)'};flex-shrink:0"></i>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:var(--text)">${esc(c.name)}</div>
          <div style="font-size:10px;color:var(--text3)">${c.never_done ? 'never recorded' : 'last done ' + fmtDate(c.last_done)}</div>
        </div>
      </div>`).join('') || '<div style="font-size:12px;color:var(--text3);padding:8px 0">Nothing due right now.</div>';

    return `
  <div class="section-header">
    <div>
      <div class="section-title">${esc(school.name)}</div>
      <div class="section-sub">School administrator · ${esc(school.zone || 'No zone')} · Week ${checkin.current_week}</div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-secondary btn-sm" onclick="${go('inventory')}"><i class="ti ti-device-tablet"></i> Devices</button>
      <button class="btn btn-primary btn-sm" onclick="${go('report')}"><i class="ti ti-plus"></i> Report a fault</button>
    </div>
  </div>

  ${banner}

  <div class="stats-grid">
    <div class="stat-card t">
      <div class="stat-label">Devices working</div>
      <div class="stat-val" style="color:var(--teal)">${devices.working}<span style="font-size:16px;color:var(--text3)">/${devices.total}</span></div>
      <div class="stat-sub">${devices.total === 0 ? 'no devices on the register yet' : `${workingPct}% · ${devices.faulty} faulty · ${devices.in_repair} in repair`}</div>
    </div>
    <div class="stat-card r">
      <div class="stat-label">Waiting on you</div>
      <div class="stat-val" style="color:var(--red)">${faults.waiting_on_me}</div>
      <div class="stat-sub">${faults.waiting_on_me > 0 && faults.waiting_oldest_hours != null ? 'oldest waiting ' + dur(faults.waiting_oldest_hours) : 'nothing in your queue'}</div>
    </div>
    <div class="stat-card a">
      <div class="stat-label">With the engineer</div>
      <div class="stat-val" style="color:var(--amber)">${faults.with_engineer}</div>
      <div class="stat-sub">${faults.engineer_breached > 0 ? `<span style="color:var(--red)">${faults.engineer_breached} past the agreed time</span>` : 'all within the agreed time'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Learning server</div>
      <div class="stat-val" style="color:${b.color};font-size:22px"><i class="ti ${b.icon}" style="font-size:20px;vertical-align:-2px;margin-right:4px"></i>${b.label}</div>
      <div class="stat-sub">${lrs.state === 'up' || lrs.state === 'down'
        ? `last signal ${since(lrs.minutes_since)} ago`
        : lrs.state === 'unknown' ? 'monitoring not installed' : 'no server on record'}</div>
    </div>
    <div class="stat-card ${maintenance.overdue > 0 ? 'r' : 'g'}">
      <div class="stat-label">Checks due</div>
      <div class="stat-val" style="color:${maintenance.overdue > 0 ? 'var(--red)' : 'var(--green)'}">${maintenance.due}<span style="font-size:16px;color:var(--text3)">/${maintenance.total}</span></div>
      <div class="stat-sub">${maintenance.overdue > 0 ? maintenance.overdue + ' overdue' : 'nothing overdue'}</div>
    </div>
  </div>

  <div class="two-col" style="align-items:start">
    <div class="card">
      <div class="card-title">Open faults here
        <a style="font-size:11px;color:var(--accent);cursor:pointer;text-transform:none;letter-spacing:0" onclick="${go('tracker')}">View all</a>
      </div>
      <div style="font-size:11px;color:var(--text3);margin:-6px 0 12px">Yours first — those are the ones nobody upstream has picked up.</div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Fault</th><th class="hide-mobile">Held by</th><th>Status</th><th>Age</th></tr></thead>
        <tbody>${faultRows(open_errors, { holder: true, empty: 'Nothing open at this school' })}</tbody>
      </table></div>
    </div>

    <div class="card">
      <div class="card-title">Classes short of devices</div>
      <div style="display:flex;flex-direction:column;gap:12px">${formRows}</div>

      <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border)">
        <div class="card-title" style="margin-bottom:8px">Next checks due</div>
        ${checkRows}
      </div>

      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="${go('weekly')}">
        <span style="font-size:12px;color:var(--text3)"><i class="ti ti-clipboard-check" style="font-size:13px;color:var(--purple);margin-right:6px"></i>Week ${checkin.current_week} check-in</span>
        <span style="font-size:12px;font-weight:600;color:${checkin.done ? 'var(--green)' : 'var(--amber)'}">${checkin.done ? 'Done' : 'Not yet'}</span>
      </div>
      <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="${go('teachers')}">
        <span style="font-size:12px;color:var(--text3)"><i class="ti ti-users" style="font-size:13px;color:var(--teal);margin-right:6px"></i>Active teachers</span>
        <span style="font-size:12px;font-weight:600;color:var(--text2)">${teachers.active}</span>
      </div>
    </div>
  </div>`;
  }

  /* ---------------------------------------------------------------- *
   * Teacher — is my report moving, and what do I do while I wait
   * ---------------------------------------------------------------- */

  function renderTeacher() {
    const { school, my, recent_errors, waiting_on, suggested_guides } = data;

    /** What is actually happening to this report, in the reporter's words. */
    function progressOf(e) {
      if (e.status === 'resolved') {
        return e.csat_rating == null
          ? { text: 'Fixed — please confirm', color: 'var(--accent)' }
          : { text: 'Fixed and confirmed', color: 'var(--green)' };
      }
      if (!e.first_response_at) return { text: 'Waiting to be picked up', color: 'var(--amber)' };
      return { text: 'Someone is working on it', color: 'var(--text2)' };
    }

    const rows = (recent_errors || []).map(e => {
      const pri = PRI[e.priority] || PRI.medium;
      const p = progressOf(e);
      return `<tr style="cursor:pointer" onclick="ErrorDetailModal.open(${e.id})">
        <td><span class="dot ${pri.dot}"></span></td>
        <td><span style="font-size:12px;font-weight:500">${esc(e.title)}</span><br><span class="error-id">${esc(e.error_code)}</span></td>
        <td class="hide-mobile"><span style="font-size:11px;color:var(--text3)">${esc(e.category)}</span></td>
        <td><span style="font-size:12px;color:${p.color}">${p.text}</span></td>
        <td style="font-size:12px;color:var(--text3)">${ageStr(e.hours_open)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5"><div class="empty" style="padding:20px 0"><i class="ti ti-circle-check"></i>You have not reported anything yet</div></td></tr>';

    const guideCards = (suggested_guides || []).map(g => `
      <div style="display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="${go('troubleshoot')}">
        <div style="width:34px;height:34px;border-radius:8px;background:rgba(54,217,204,.10);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ${esc(g.icon || 'ti-tools')}" style="font-size:16px;color:var(--teal)"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;color:var(--text)">${esc(g.title)}</div>
          <div style="font-size:10px;color:var(--text3)">${esc(g.category || '')} · ${(g.steps || []).length} steps</div>
        </div>
        <i class="ti ti-chevron-right" style="font-size:14px;color:var(--text3)"></i>
      </div>`).join('');

    return `
  <div class="section-header">
    <div>
      <div class="section-title">My reports</div>
      <div class="section-sub">Teacher · ${school ? esc(school.name) : 'No school linked'}</div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-primary btn-sm" onclick="${go('report')}"><i class="ti ti-plus"></i> Report a fault</button>
    </div>
  </div>

  ${my.awaiting_rating > 0 ? `<div class="alert-banner" style="border-color:rgba(79,124,255,.25)">
    <i class="ti ti-star" style="color:var(--accent)"></i>
    <div class="alert-banner-text"><strong>${my.awaiting_rating} report${my.awaiting_rating > 1 ? 's were' : ' was'} marked fixed</strong> — please say whether it really is. It is the only way anyone knows the repair worked.</div>
    <button class="btn btn-secondary btn-sm" onclick="${go('tracker')}">Confirm</button>
  </div>` : ''}

  <div class="stats-grid">
    <div class="stat-card r">
      <div class="stat-label">Still open</div>
      <div class="stat-val" style="color:var(--red)">${my.open}</div>
      <div class="stat-sub">${my.open === 0 ? 'nothing waiting' : `${my.answered_open} picked up · oldest ${dur(my.oldest_open_hours)}`}</div>
    </div>
    <div class="stat-card a">
      <div class="stat-label">Waiting on your word</div>
      <div class="stat-val" style="color:var(--amber)">${my.awaiting_rating}</div>
      <div class="stat-sub">${my.awaiting_rating === 0 ? 'nothing to confirm' : 'marked fixed, not yet confirmed'}</div>
    </div>
    <div class="stat-card g">
      <div class="stat-label">Fixed for you · 30d</div>
      <div class="stat-val" style="color:var(--green)">${my.resolved_30d}</div>
      <div class="stat-sub">in the last month</div>
    </div>
  </div>

  <div class="two-col" style="align-items:start">
    <div class="card">
      <div class="card-title">What I have reported
        <a style="font-size:11px;color:var(--accent);cursor:pointer;text-transform:none;letter-spacing:0" onclick="${go('tracker')}">See all</a>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Fault</th><th class="hide-mobile">Category</th><th>What is happening</th><th>Age</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>

    ${guideCards ? `<div class="card">
      <div class="card-title">While you wait</div>
      <div style="font-size:11px;color:var(--text3);margin:-6px 0 8px">Steps that have fixed ${esc(waiting_on.category)} faults like “${esc(waiting_on.title)}”.</div>
      ${guideCards}
    </div>` : `<div class="card" style="text-align:center;padding:32px 20px">
      <i class="ti ti-book-2" style="font-size:34px;color:var(--teal);margin-bottom:12px"></i>
      <div style="font-size:14px;font-weight:500;margin-bottom:6px">Troubleshooting guides</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Many faults have a fix you can do yourself in a few minutes.</div>
      <button class="btn btn-secondary btn-sm" onclick="${go('troubleshoot')}">Open guides</button>
    </div>`}
  </div>`;
  }

  /* ---------------------------------------------------------------- *
   * Field engineer — my queue, and what I cannot fix empty-handed
   * ---------------------------------------------------------------- */

  function renderSubadmin() {
    const user = API.getUser();
    const { my_queue, stats, my_schools, spares, stale, stale_after_hours, visits, checkins } = data;

    // Windowed to 30 days. A lifetime figure never moves, so it can never say
    // whether this month went well — and with nothing timed it stays a dash
    // rather than claiming a perfect score.
    const slaPct = stats.sla_basis_30d > 0 ? Math.round(stats.sla_on_time_30d / stats.sla_basis_30d * 100) : null;
    const slaColor = slaPct === null ? 'var(--text3)' : slaPct >= 80 ? 'var(--green)' : slaPct >= 60 ? 'var(--amber)' : 'var(--red)';

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const urgent = stats.overdue + stats.due_soon;

    const taskCards = (my_queue || []).slice(0, 5).map(e => {
      const breach = Number(e.sla_breached) === 1;
      const mins = e.sla_minutes_left;
      let tag = '', tagColor = '';
      if (breach) { tag = 'PAST DUE'; tagColor = 'var(--red)'; }
      else if (mins != null && mins <= 120) { tag = `${Math.max(0, Math.round(mins / 60))}h left`; tagColor = 'var(--amber)'; }
      else if (mins != null && mins <= 480) { tag = `${Math.round(mins / 60)}h left`; tagColor = 'var(--text3)'; }
      const priColors = { critical: 'var(--red)', high: 'var(--amber)', medium: 'var(--accent)', low: 'var(--green)' };
      const priColor = priColors[e.priority] || 'var(--accent)';
      return `<div class="sa-task-card" style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid ${priColor};border-radius:10px;padding:14px 16px;cursor:pointer" onclick="ErrorDetailModal.open(${e.id})">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span class="error-id" style="font-size:11px">${esc(e.error_code)}</span>
          ${tag ? `<span style="font-size:9px;padding:2px 7px;border-radius:4px;background:${tagColor}18;color:${tagColor};font-weight:600;letter-spacing:.3px">${tag}</span>` : ''}
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:5px;line-height:1.3">${esc(e.title)}</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text3)">
          <span><i class="ti ti-school" style="font-size:11px;margin-right:3px"></i>${esc(e.school_name)}</span>
          <span style="color:var(--border)">|</span><span>${ageStr(e.hours_open)}</span>
        </div>
      </div>`;
    }).join('') || `<div style="text-align:center;padding:40px 20px">
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(45,217,138,.08);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
        <i class="ti ti-circle-check" style="font-size:28px;color:var(--green)"></i></div>
      <div style="font-size:14px;font-weight:500;margin-bottom:4px">Queue clear</div>
      <div style="font-size:12px;color:var(--text3)">Nothing assigned to you right now</div></div>`;

    const schoolCards = (my_schools || []).slice(0, 6).map(s => {
      const down = s.heartbeat_state === 'down';
      const color = down || s.critical_errors > 0 ? 'var(--red)' : s.open_errors > 0 || s.devices_down > 0 ? 'var(--amber)' : 'var(--green)';
      const note = down ? 'LRS down'
        : s.spares_needed > 0 ? `needs ${s.spares_needed} spare${s.spares_needed > 1 ? 's' : ''}`
        : s.devices_down > 0 ? `${s.devices_down} device${s.devices_down > 1 ? 's' : ''} down`
        : s.open_errors > 0 ? `${s.open_errors} open` : 'clear';
      return `<div class="dash-row" onclick="${go('schools')}">
        <div style="width:34px;height:34px;border-radius:8px;background:${color}14;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ti-${down ? 'wifi-off' : 'building'}" style="font-size:15px;color:${color}"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</div>
          <div style="font-size:10px;color:${color}">${esc(note)}</div>
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text2)">${s.open_errors}</div>
      </div>`;
    }).join('') || '<div style="text-align:center;padding:30px 20px"><i class="ti ti-school" style="font-size:24px;color:var(--text3);margin-bottom:8px"></i><div style="font-size:12px;color:var(--text3)">No schools assigned yet</div></div>';

    // Replaces the activity feed. What happened is history; what stopped moving
    // is a decision.
    const staleRows = (stale || []).map(s => `
      <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="ErrorDetailModal.open(${s.id})">
        <div style="width:6px;height:6px;border-radius:50%;background:var(--amber);margin-top:6px;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:var(--text);line-height:1.4">${esc(s.title)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px"><span class="error-id">${esc(s.error_code)}</span> · ${esc(s.school_name)} · no update in ${dur(s.stale_hours)}</div>
        </div>
      </div>`).join('') || `<div style="font-size:12px;color:var(--text3);padding:12px 0">Everything in your queue has been touched in the last ${Math.round(stale_after_hours / 24)} days.</div>`;

    const visitRows = (visits || []).map(v => `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="${go('visits')}">
        <i class="ti ti-calendar-event" style="font-size:15px;color:var(--accent);flex-shrink:0"></i>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:var(--text)">${esc(v.school_name)}</div>
          <div style="font-size:10px;color:var(--text3)">${fmtDate(v.planned_for)} · ${v.open_faults} fault${v.open_faults === 1 ? '' : 's'} attached</div>
        </div>
      </div>`).join('');

    return `
  <div class="section-header">
    <div>
      <div class="section-title">${greeting}, ${esc((user.full_name || '').split(' ')[0])}</div>
      <div class="section-sub">${urgent > 0 ? `<span style="color:var(--amber)">${urgent} urgent</span> · ` : ''}${stats.queue_count} in queue · Week ${checkins.current_week}</div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="${go('visits')}"><i class="ti ti-route"></i> Plan a visit</button>
      <button class="btn btn-primary btn-sm" onclick="${go('tracker')}"><i class="ti ti-list-check"></i> All faults</button>
    </div>
  </div>

  ${stats.overdue > 0 ? `<div class="alert-banner">
    <i class="ti ti-clock-exclamation"></i>
    <div class="alert-banner-text"><strong>${stats.overdue} fault${stats.overdue > 1 ? 's are' : ' is'} past the agreed time</strong> in your queue.</div>
    <button class="btn btn-danger btn-sm" onclick="${go('tracker')}">View now</button>
  </div>` : ''}

  <div class="sa-metrics" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px">
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px;display:flex;align-items:center;gap:16px">
      <div style="position:relative;width:56px;height:56px;flex-shrink:0">
        <svg viewBox="0 0 80 80" style="width:100%;height:100%;transform:rotate(-90deg)">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg4)" stroke-width="5"/>
          <circle cx="40" cy="40" r="34" fill="none" stroke="${slaColor}" stroke-width="5" stroke-dasharray="${(slaPct || 0) * 2.136} 213.6" stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${slaColor}">${slaPct === null ? '&mdash;' : slaPct + '%'}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">On time · 30 days</div>
        <div style="font-size:13px;font-weight:500;margin-top:2px">${stats.sla_basis_30d > 0 ? `${stats.sla_on_time_30d} of ${stats.sla_basis_30d}` : 'nothing timed yet'}</div>
      </div>
    </div>

    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px;display:flex;align-items:center;gap:16px">
      <div style="width:56px;height:56px;border-radius:12px;background:rgba(45,217,138,.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="ti ti-checks" style="font-size:24px;color:var(--green)"></i>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Resolved</div>
        <div style="font-size:22px;font-weight:700;color:var(--green);line-height:1">${stats.resolved_week}</div>
        <div style="font-size:10px;color:var(--text3)">this week</div>
      </div>
    </div>

    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px;display:flex;align-items:center;gap:16px;cursor:pointer" onclick="${go('inventory')}">
      <div style="width:56px;height:56px;border-radius:12px;background:rgba(155,125,255,.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="ti ti-package" style="font-size:24px;color:var(--purple)"></i>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Spares to carry</div>
        <div style="font-size:22px;font-weight:700;color:var(--purple);line-height:1">${spares.to_carry}</div>
        <div style="font-size:10px;color:${spares.stockout_schools > 0 ? 'var(--red)' : spares.short_schools > 0 ? 'var(--amber)' : 'var(--text3)'}">${
          spares.stockout_schools > 0 ? `${spares.stockout_schools} school${spares.stockout_schools > 1 ? 's' : ''} cannot be fixed today`
          : spares.short_schools > 0 ? `short at ${spares.short_schools} school${spares.short_schools > 1 ? 's' : ''}`
          : 'every school can swap on site'}</div>
      </div>
    </div>
  </div>

  <div class="sa-layout" style="display:grid;grid-template-columns:1fr 340px;gap:14px;align-items:start">
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="card" style="padding:16px 18px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="font-size:13px;font-weight:600"><i class="ti ti-urgent" style="font-size:14px;color:var(--red);margin-right:6px"></i>My queue <span style="font-size:11px;font-weight:400;color:var(--text3)">${stats.queue_count} faults · past due first</span></div>
          <a style="font-size:11px;color:var(--accent);cursor:pointer" onclick="${go('tracker')}">View all →</a>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">${taskCards}</div>
        ${(my_queue || []).length > 5 ? `<div style="text-align:center;padding-top:12px"><a style="font-size:11px;color:var(--accent);cursor:pointer" onclick="${go('tracker')}">+${my_queue.length - 5} more →</a></div>` : ''}
      </div>

      <div class="card" style="padding:16px 18px">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px"><i class="ti ti-hourglass-low" style="font-size:14px;color:var(--amber);margin-right:6px"></i>Stalled <span style="font-size:11px;font-weight:400;color:var(--text3)">no update in ${Math.round(stale_after_hours / 24)}+ days</span></div>
        <div style="display:flex;flex-direction:column">${staleRows}</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="card" style="padding:16px 18px">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px"><i class="ti ti-building" style="font-size:14px;color:var(--teal);margin-right:6px"></i>My schools <span style="font-size:11px;font-weight:400;color:var(--text3)">${my_schools.length}</span></div>
        <div style="display:flex;flex-direction:column;gap:8px">${schoolCards}</div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="${go('weekly')}">
          <span style="font-size:12px;color:var(--text3)"><i class="ti ti-clipboard-check" style="font-size:13px;color:var(--purple);margin-right:6px"></i>Week ${checkins.current_week} check-ins</span>
          <span style="font-size:12px;font-weight:600;color:${checkins.done >= checkins.total ? 'var(--green)' : 'var(--text2)'}">${checkins.done}/${checkins.total}</span>
        </div>
      </div>

      ${visitRows ? `<div class="card" style="padding:16px 18px">
        <div style="font-size:13px;font-weight:600;margin-bottom:6px"><i class="ti ti-route" style="font-size:14px;color:var(--accent);margin-right:6px"></i>Planned visits</div>
        ${visitRows}
      </div>` : ''}
    </div>
  </div>`;
  }

  return { load, render };
})();
