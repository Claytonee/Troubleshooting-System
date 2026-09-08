/**
 * Visit planner. Design: docs/features/05-visit-planner.md
 *
 * The queue grouped by school instead of by ticket, so one trip closes several
 * faults. Not a route optimiser — the engineers know the roads; what was
 * missing was batching and a record of what happened.
 */
const VisitsPage = (() => {
  let queue = [], visits = [], suggestions = null, activeView = 'plan';
  const user = () => API.getUser();

  async function load() {
    try {
      [queue, visits] = await Promise.all([API.getVisitQueue(), API.getVisits()]);
    } catch (e) { queue = []; visits = []; }
  }

  function render() {
    const planned = visits.filter(v => v.status === 'planned');
    const worthGoing = queue.filter(q => q.open_faults > 0);
    const trips = worthGoing.length;
    const faults = worthGoing.reduce((s, q) => s + q.open_faults, 0);
    // The number the feature exists for: faults per trip. One means the queue
    // is being worked one drive at a time.
    const perTrip = trips ? (faults / trips).toFixed(1) : '—';

    return `
    <div class="section-header">
      <div>
        <div class="section-title">Visit Planner</div>
        <div class="section-sub">${trips} school${trips === 1 ? '' : 's'} worth a trip · ${faults} open fault${faults === 1 ? '' : 's'}</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary btn-sm" onclick="VisitsPage.reload()"><i class="ti ti-refresh"></i> <span class="btn-label">Refresh</span></button>
      </div>
    </div>

    <div class="three-col" style="margin-bottom:18px">
      <div class="stat-card a">
        <div class="stat-label">Schools worth a trip</div>
        <div class="stat-val" style="color:var(--amber)">${trips}</div>
        <div class="stat-sub">${queue.length - trips} with nothing open</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Faults per trip</div>
        <div class="stat-val" style="color:var(--accent)">${perTrip}</div>
        <div class="stat-sub">${faults} fault${faults === 1 ? '' : 's'} across ${trips} school${trips === 1 ? '' : 's'}</div>
      </div>
      <div class="stat-card g">
        <div class="stat-label">Visits planned</div>
        <div class="stat-val" style="color:${planned.length ? 'var(--green)' : 'var(--text3)'}">${planned.length}</div>
        <div class="stat-sub">${planned.length ? 'next ' + fmtDay(planned.map(v => v.planned_for).sort()[0]) : 'none scheduled'}</div>
      </div>
    </div>

    <div class="tab-row" style="margin-bottom:12px">
      <button class="tab-btn ${activeView === 'plan' ? 'active' : ''}" onclick="VisitsPage.setView('plan')"><i class="ti ti-map-pin"></i> Where to go</button>
      <button class="tab-btn ${activeView === 'visits' ? 'active' : ''}" onclick="VisitsPage.setView('visits')"><i class="ti ti-clipboard-check"></i> Visits (${visits.length})</button>
    </div>

    <div id="visits-view">${activeView === 'plan' ? planView() : visitsView()}</div>`;
  }

  /** Schools ordered by what going there would achieve. */
  function planView() {
    if (!queue.length) {
      return `<div class="card"><div class="empty" style="padding:40px 20px"><i class="ti ti-school-off"></i>No schools assigned to you.</div></div>`;
    }
    const worth = queue.filter(q => q.open_faults > 0);
    if (!worth.length) {
      return `<div class="card"><div class="empty" style="padding:40px 20px"><i class="ti ti-circle-check" style="color:var(--green)"></i>Nothing open at any of your schools.</div></div>`;
    }
    return `<div style="display:flex;flex-direction:column;gap:10px">
      ${worth.map(q => schoolRow(q)).join('')}
    </div>`;
  }

  function schoolRow(q) {
    const urgent = q.critical > 0 || q.breached > 0;
    return `
      <div class="card" style="padding:14px 16px;border-left:3px solid ${urgent ? 'var(--red)' : q.high ? 'var(--amber)' : 'var(--accent)'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="min-width:0;flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--text)">${esc(q.school_name)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${esc(q.zone || 'zone not recorded')}${q.engineer_name ? ' · ' + esc(q.engineer_name) : ''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${q.critical ? `<span class="badge-red" style="font-size:11px">${q.critical} critical</span>` : ''}
            ${q.high ? `<span class="badge-amber" style="font-size:11px">${q.high} high</span>` : ''}
            ${q.breached ? `<span class="badge-red" style="font-size:11px">${q.breached} SLA breached</span>` : ''}
            ${q.due_today ? `<span class="badge-amber" style="font-size:11px">${q.due_today} due today</span>` : ''}
          </div>
        </div>

        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="font-size:12px;color:var(--text2)">
            <strong style="color:var(--text)">${q.open_faults}</strong> open fault${q.open_faults === 1 ? '' : 's'}${q.oldest_hours != null ? ` · oldest ${ageStr(q.oldest_hours)}` : ''}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="VisitsPage.openSuggestions(${q.school_id})"><i class="ti ti-list-check"></i> What else is there</button>
            ${q.planned_visit_id
              ? `<button class="btn btn-secondary btn-sm" onclick="VisitsPage.openVisit(${q.planned_visit_id})"><i class="ti ti-calendar-check"></i> ${fmtDay(q.planned_for)}</button>`
              : `<button class="btn btn-primary btn-sm" onclick="VisitsPage.openPlan(${q.school_id}, '${esc(q.school_name)}')"><i class="ti ti-calendar-plus"></i> Plan a visit</button>`}
          </div>
        </div>
      </div>`;
  }

  function visitsView() {
    if (!visits.length) {
      return `<div class="card"><div class="empty" style="padding:40px 20px"><i class="ti ti-clipboard-off"></i>No visits recorded yet.
        <div style="font-size:12px;color:var(--text3);margin-top:8px;max-width:400px;margin-left:auto;margin-right:auto">
          Plan one from "Where to go". The record of what was and was not finished is what the weekly check-in cannot tell you.
        </div></div></div>`;
    }
    const STATUS = {
      planned: { color: 'var(--accent)', icon: 'ti-calendar', label: 'Planned' },
      done: { color: 'var(--green)', icon: 'ti-circle-check', label: 'Done' },
      cancelled: { color: 'var(--text3)', icon: 'ti-circle-x', label: 'Cancelled' }
    };
    return `<div class="card" style="padding:0">
      <div class="table-wrap"><table>
        <thead><tr><th>School</th><th class="hide-mobile">Engineer</th><th>Date</th><th>Faults</th><th>Status</th></tr></thead>
        <tbody>${visits.map(v => {
          const st = STATUS[v.status] || STATUS.planned;
          return `<tr style="cursor:pointer" onclick="VisitsPage.openVisit(${v.id})">
            <td><span style="font-weight:500;font-size:13px">${esc(v.school_name)}</span>
              <div style="font-size:11px;color:var(--text3)">${esc(v.zone || '')}</div></td>
            <td class="hide-mobile" style="font-size:12px;color:var(--text2)">${esc(v.engineer_name || '—')}</td>
            <td style="font-size:12px;white-space:nowrap">${fmtDay(v.planned_for)}</td>
            <td style="font-size:12px">${v.closed_faults}/${v.attached_faults}</td>
            <td><span style="font-size:12px;color:${st.color}"><i class="ti ${st.icon}" style="font-size:12px"></i> ${st.label}</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
  }

  // --- planning ------------------------------------------------------------

  function openPlan(schoolId, schoolName) {
    const today = new Date();
    const iso = d => d.toISOString().slice(0, 10);
    const tomorrow = new Date(today.getTime() + 86400000);
    Modal.open('Plan a visit', `
      <div style="font-size:13px;color:var(--text2);margin-bottom:14px">
        Every fault currently open at <strong style="color:var(--text)">${esc(schoolName)}</strong> will be attached to this visit.
        Their status does not change — a plan is not work done.
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>Date</label>
        <input type="date" id="visit-date" value="${iso(tomorrow)}" min="${iso(today)}">
      </div>
      <div class="form-group">
        <label>Notes (optional)</label>
        <textarea id="visit-notes" rows="3" placeholder="Parts to bring, who to meet, anything to prepare…"></textarea>
      </div>`,
      `<button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
       <button class="btn btn-primary" onclick="VisitsPage.submitPlan(${schoolId})"><i class="ti ti-calendar-plus"></i> Plan it</button>`);
  }

  async function submitPlan(schoolId) {
    const date = document.getElementById('visit-date').value;
    if (!date) { showToast('Pick a date'); return; }
    try {
      const r = await API.planVisit({
        school_id: schoolId,
        planned_for: date,
        notes: document.getElementById('visit-notes').value || null
      });
      Modal.close();
      showToast(`Visit planned — ${r.attached_faults} fault${r.attached_faults === 1 ? '' : 's'} attached`);
      await reload();
    } catch (e) {
      // 409 means somebody already planned this trip; say who and when rather
      // than a generic failure.
      showToast(e.status === 409 && e.planned_for
        ? `Already planned for ${fmtDay(e.planned_for)}`
        : (e.error || 'Could not plan the visit'));
    }
  }

  /** Everything worth doing while on site — where features 1 and 4 pay off. */
  async function openSuggestions(schoolId) {
    Modal.open('While you are there', '<div class="empty"><i class="ti ti-loader"></i>Loading…</div>');
    try {
      suggestions = await API.getVisitSuggestions(schoolId);
    } catch (e) {
      Modal.open('While you are there', `<div class="empty">${esc(e.error || 'Could not load')}</div>`);
      return;
    }
    const s = suggestions;
    const block = (icon, color, title, body) => `
      <div style="padding:11px 13px;border-radius:10px;background:var(--bg3);border:1px solid var(--border);margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:${body ? '7px' : '0'}">
          <i class="ti ${icon}" style="font-size:15px;color:${color}"></i>
          <span style="font-size:12px;font-weight:600;color:var(--text)">${title}</span>
        </div>
        ${body || ''}
      </div>`;

    const faultsBody = s.faults.length
      ? s.faults.map(f => `<div style="font-size:12px;color:var(--text2);padding:3px 0">
          <span class="error-id" style="font-size:11px">${esc(f.error_code)}</span>
          <span class="badge-${(PRI[f.priority] || PRI.medium).badge.replace('badge-', '')}" style="font-size:10px;margin-left:5px">${(PRI[f.priority] || PRI.medium).label}</span>
          ${f.breached ? '<i class="ti ti-alert-triangle" style="color:var(--red);font-size:11px;margin-left:4px"></i>' : ''}
          <div style="margin-left:2px">${esc(f.title)}</div>
        </div>`).join('')
      : '<div style="font-size:12px;color:var(--text3)">Nothing open.</div>';

    const devicesBody = s.devices.length
      ? s.devices.map(d => `<div style="font-size:12px;color:var(--text2);padding:3px 0">
          <span class="error-id" style="font-size:11px">${esc(d.asset_tag || d.serial_number)}</span>
          ${d.repeat_offender ? '<i class="ti ti-alert-triangle" style="color:var(--red);font-size:11px;margin-left:4px" title="Repeat faults"></i>' : ''}
          <div style="font-size:11px;color:var(--text3);margin-left:2px">${esc(d.verdict)}</div>
        </div>`).join('')
      : '<div style="font-size:12px;color:var(--text3)">No devices need attention.</div>';

    Modal.open(`While you are at ${esc(s.school.name)}`, `
      ${block('ti-bug', 'var(--red)', `${s.faults.length} open fault${s.faults.length === 1 ? '' : 's'}`, faultsBody)}
      ${block('ti-calendar-week', s.checkin_due ? 'var(--purple)' : 'var(--green)',
        s.checkin_due ? `Week ${s.week_number} check-in is due` : `Week ${s.week_number} check-in already done`)}
      ${block('ti-device-tablet', s.devices.length ? 'var(--amber)' : 'var(--green)',
        `${s.devices.length} device${s.devices.length === 1 ? '' : 's'} needing attention`, devicesBody)}
      ${s.lrs
        ? block(s.lrs.state === 'down' ? 'ti-server-off' : 'ti-server', s.lrs.state === 'down' ? 'var(--red)' : s.lrs.state === 'unknown' ? 'var(--text3)' : 'var(--green)',
            s.lrs.state === 'down' ? `LRS silent for ${s.lrs.silent_minutes} minutes`
              : s.lrs.state === 'unknown' ? 'LRS has never reported in — check the agent is installed'
              : 'LRS reporting normally',
            `<div style="font-size:11px;color:var(--text3)">${esc(s.lrs.hostname || 'hostname not recorded')} at ${esc(s.lrs.ip_address || 'IP not recorded')}</div>`)
        : block('ti-server-off', 'var(--text3)', 'No LRS recorded for this school')}
      ${s.school.contact_name ? `<div style="font-size:12px;color:var(--text3);margin-top:4px"><i class="ti ti-user" style="font-size:12px"></i> ${esc(s.school.contact_name)}${s.school.contact_phone ? ' · ' + esc(s.school.contact_phone) : ''}</div>` : ''}
    `, `<button class="btn btn-secondary" onclick="Modal.close()">Close</button>
        <button class="btn btn-primary" onclick="Modal.close();VisitsPage.openPlan(${s.school.id}, '${esc(s.school.name)}')"><i class="ti ti-calendar-plus"></i> Plan a visit</button>`);
  }

  /** The on-site checklist. */
  async function openVisit(id) {
    Modal.open('Visit', '<div class="empty"><i class="ti ti-loader"></i>Loading…</div>');
    let v;
    try { v = await API.getVisit(id); }
    catch (e) { Modal.open('Visit', `<div class="empty">${esc(e.error || 'Could not load')}</div>`); return; }

    const done = v.faults.filter(f => f.status === 'resolved').length;
    const rows = v.faults.length
      ? v.faults.map(f => `<div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid var(--border)">
          <i class="ti ${f.status === 'resolved' ? 'ti-circle-check' : 'ti-circle'}" style="font-size:15px;color:${f.status === 'resolved' ? 'var(--green)' : 'var(--text3)'};flex-shrink:0;margin-top:1px"></i>
          <div style="min-width:0;flex:1">
            <div style="font-size:12px;color:var(--text);${f.status === 'resolved' ? 'text-decoration:line-through;color:var(--text3)' : ''}">${esc(f.title)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${esc(f.error_code)} · ${esc(f.category)} · ${(PRI[f.priority] || PRI.medium).label}</div>
          </div>
        </div>`).join('')
      : '<div style="font-size:12px;color:var(--text3)">No faults attached.</div>';

    const canAct = v.status === 'planned';
    Modal.open(`Visit — ${esc(v.school_name)}`, `
      <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text3);margin-bottom:12px">
        <span><i class="ti ti-calendar" style="font-size:12px"></i> ${fmtDay(v.planned_for)}</span>
        <span><i class="ti ti-user" style="font-size:12px"></i> ${esc(v.engineer_name || '—')}</span>
        <span><i class="ti ti-map-pin" style="font-size:12px"></i> ${esc(v.zone || '—')}</span>
      </div>
      <div style="padding:11px 13px;border-radius:10px;background:var(--bg3);border:1px solid var(--border)">
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:6px">${done}/${v.faults.length} closed</div>
        ${rows}
      </div>
      ${v.notes ? `<div style="margin-top:12px;font-size:12px;color:var(--text2)"><strong style="color:var(--text3);font-size:11px;display:block;margin-bottom:3px">NOTES</strong>${esc(v.notes)}</div>` : ''}
      ${canAct ? `<div class="form-group" style="margin-top:12px">
        <label>What could not be finished, and why</label>
        <textarea id="visit-close-notes" rows="2" placeholder="Left open because…">${esc(v.notes || '')}</textarea>
      </div>` : ''}`,
      canAct
        ? `<button class="btn btn-secondary" onclick="VisitsPage.setStatus(${v.id}, 'cancelled')"><i class="ti ti-x"></i> Cancel visit</button>
           <button class="btn btn-success" onclick="VisitsPage.setStatus(${v.id}, 'done')"><i class="ti ti-check"></i> Mark done</button>`
        : `<button class="btn btn-secondary" onclick="Modal.close()">Close</button>`);
  }

  async function setStatus(id, status) {
    const el = document.getElementById('visit-close-notes');
    try {
      const r = await API.updateVisit(id, { status, notes: el ? el.value : undefined });
      Modal.close();
      showToast(status === 'cancelled'
        ? `Visit cancelled${r.released_faults ? ` — ${r.released_faults} fault${r.released_faults === 1 ? '' : 's'} back in the queue` : ''}`
        : 'Visit marked done');
      await reload();
    } catch (e) { showToast(e.error || 'Could not update the visit'); }
  }

  // --- plumbing ------------------------------------------------------------

  function fmtDay(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  function setView(v) {
    activeView = v;
    // In-place swap, never App.render() — that flickers and drops the sidebar.
    document.querySelectorAll('.main .tab-row .tab-btn').forEach((b, i) => {
      b.classList.toggle('active', ['plan', 'visits'][i] === v);
    });
    const slot = document.getElementById('visits-view');
    if (slot) {
      slot.innerHTML = v === 'plan' ? planView() : visitsView();
      slot.querySelectorAll('.card').forEach(c => c.classList.add('reveal', 'visible'));
    }
  }

  async function reload() {
    await load();
    const main = document.querySelector('.main');
    if (main) { main.innerHTML = render(); afterRender(); }
  }

  function afterRender() {
    document.querySelectorAll('.main .card, .main .stat-card').forEach(c => c.classList.add('reveal', 'visible'));
  }

  return { load, render, afterRender, setView, reload, openPlan, submitPlan, openSuggestions, openVisit, setStatus };
})();
