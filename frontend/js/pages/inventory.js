const InventoryPage = (() => {
  let devices = [], stats = null, schools = [];
  let filters = { status: '', form: '', search: '', school_id: '', warranty: '', repeat_offender: '' };
  let refreshPlan = null, batchRows = null, sparesView = null, activeView = 'devices';
  const user = () => API.getUser();
  const isAdmin = () => ['admin','subadmin'].includes(user()?.role);

  /**
   * May this account change the inventory?
   *
   * The answer comes from the server (`/inventory/stats`.can_write), not from
   * the role in localStorage: a teacher's write access is a grant the school
   * admin can give and take back, so the buttons have to follow it on the next
   * page load. Until the load finishes, assume read-only — a button that turns
   * out to 403 is worse than a button that appears a second late.
   */
  const canWrite = () => stats?.can_write === true;

  async function load() {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.form) params.form = filters.form;
      if (filters.search) params.search = filters.search;
      if (filters.school_id) params.school_id = filters.school_id;
      if (filters.warranty) params.warranty = filters.warranty;
      if (filters.repeat_offender) params.repeat_offender = filters.repeat_offender;
      [devices, stats] = await Promise.all([
        API.getInventory(params),
        API.getInventoryStats(params.school_id ? { school_id: params.school_id } : {})
      ]);
      if (isAdmin()) schools = await API.getSchools();
    } catch (e) { devices = []; stats = null; }
  }

  function render() {
    const s = stats?.summary || {};
    const total = +s.total || 0;
    const working = +s.working || 0;
    const faulty = +s.faulty || 0;
    const inRepair = +s.in_repair || 0;
    const lostMissing = +s.lost_missing || 0;
    const assigned = +s.assigned || 0;
    const healthPct = total ? Math.round((working / total) * 100) : 0;

    return `
  <div class="section-header">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:38px;height:38px;border-radius:10px;background:rgba(79,124,255,.12);display:flex;align-items:center;justify-content:center"><i class="ti ti-device-tablet" style="font-size:20px;color:var(--accent)"></i></div>
      <div>
        <div class="section-title" style="margin:0">Tablet Inventory</div>
        <div class="section-sub" style="margin:0">${total} devices · ${healthPct}% fleet health</div>
      </div>
    </div>
    <div class="inv-header-actions">
      <div class="inv-header-stats">
        <div style="padding:4px 10px;border-radius:6px;background:rgba(45,217,138,.1);font-size:11px;font-weight:600;color:var(--green)">${working} <span style="font-weight:400;opacity:.7">OK</span></div>
        <div style="padding:4px 10px;border-radius:6px;background:rgba(255,82,99,.1);font-size:11px;font-weight:600;color:var(--red)">${faulty} <span style="font-weight:400;opacity:.7">Faulty</span></div>
        <div style="padding:4px 10px;border-radius:6px;background:rgba(245,166,35,.1);font-size:11px;font-weight:600;color:var(--amber)">${inRepair} <span style="font-weight:400;opacity:.7">Repair</span></div>
        <div style="padding:4px 10px;border-radius:6px;background:rgba(155,125,255,.1);font-size:11px;font-weight:600;color:var(--purple)">${lostMissing} <span style="font-weight:400;opacity:.7">Lost</span></div>
      </div>
      ${canWrite() ? `<button class="btn btn-ghost" onclick="InventoryPage.openImport()" title="Import CSV"><i class="ti ti-upload"></i></button>` : ''}
      <button class="btn btn-ghost" onclick="InventoryPage.exportCsv()" title="Export"><i class="ti ti-download"></i></button>
      ${canWrite()
        ? `<button class="btn btn-primary" onclick="InventoryPage.openAdd()"><i class="ti ti-plus"></i> Add</button>`
        : `<span class="inv-readonly-chip" data-tip="Your school administrator can give you edit access"><i class="ti ti-eye"></i> Read-only</span>`}
  <div class="tab-row" style="margin-bottom:12px">
    <button class="tab-btn ${activeView === 'devices' ? 'active' : ''}" onclick="InventoryPage.setView('devices')"><i class="ti ti-device-tablet"></i> Devices</button>
    <button class="tab-btn ${activeView === 'refresh' ? 'active' : ''}" onclick="InventoryPage.setView('refresh')"><i class="ti ti-recycle"></i> Replace &amp; renew</button>
    <button class="tab-btn ${activeView === 'batches' ? 'active' : ''}" onclick="InventoryPage.setView('batches')"><i class="ti ti-packages"></i> Batches</button>
    <button class="tab-btn ${activeView === 'spares' ? 'active' : ''}" onclick="InventoryPage.setView('spares')"><i class="ti ti-refresh-dot"></i> Spares</button>
  </div>

  <div id="inv-view">${activeView === 'devices' ? deviceView()
    : activeView === 'refresh' ? refreshView()
    : activeView === 'spares' ? sparesViewHtml()
    : batchView()}</div>`;
  }

  /** The device list, with the lifecycle filters. */
  function deviceView() {
    return `
  <div class="inv-toolbar">
    ${isAdmin() ? `<div style="min-width:200px">${Dropdown.render('inv-school', 'All Schools', [{value:'',label:'All Schools'},...schools.map(sc => ({value:sc.id,label:sc.name,tag:sc.zone||''}))], {defaultValue: filters.school_id, onSelect: () => InventoryPage.onSchoolSelect()})}</div>` : ''}
    <div style="min-width:150px">${Dropdown.render('inv-status', 'All Statuses', [
      {value:'',label:'All Statuses'},
      {value:'Working',label:'Working'},
      {value:'Needs Setup',label:'Needs Setup'},
      {value:'In Repair',label:'In Repair'},
      {value:'Faulty',label:'Faulty'},
      {value:'Lost/Missing',label:'Lost/Missing'}
    ], {defaultValue: filters.status, onSelect: () => InventoryPage.onStatusSelect()})}</div>
    <div style="min-width:130px">${Dropdown.render('inv-form', 'All Forms', [
      {value:'',label:'All Forms'},
      {value:'Form 1',label:'Form 1'},
      {value:'Form 2',label:'Form 2'},
      {value:'Form 3',label:'Form 3'},
      {value:'Form 4',label:'Form 4'}
    ], {defaultValue: filters.form, onSelect: () => InventoryPage.onFormSelect()})}</div>
    <div style="min-width:160px">${Dropdown.render('inv-warranty', 'Any warranty', [
      {value:'',label:'Any warranty'},
      {value:'active',label:'Under warranty'},
      {value:'expiring',label:'Expiring soon'},
      {value:'expired',label:'Out of warranty'},
      {value:'unknown',label:'Not recorded'}
    ], {defaultValue: filters.warranty, onSelect: () => InventoryPage.onWarrantySelect()})}</div>
    <div style="flex:1;position:relative;min-width:160px">
      <i class="ti ti-search" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--text3)"></i>
      <input type="text" id="inv-search" placeholder="Search serial, tag, student, batch..." value="${filters.search}" onkeyup="InventoryPage.debounceSearch(this.value)" style="width:100%;padding:7px 10px 7px 30px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:12px">
    </div>
    <button class="btn ${filters.repeat_offender ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="InventoryPage.toggleRepeatOffenders()" data-tip="Devices with 3+ faults, or 2+ in the last 90 days">
      <!-- Text kept at every width: .inv-toolbar stretches its children on a
           phone, and an icon alone in a full-width bar reads as broken. -->
      <i class="ti ti-alert-triangle"></i> Repeat faults
    </button>
    <span style="font-size:11px;color:var(--text3);white-space:nowrap">${devices.length} shown</span>
  </div>

  <div class="inv-grid">
    ${devices.length ? devices.map(d => deviceCard(d)).join('') : '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text3)"><i class="ti ti-device-tablet-off" style="font-size:40px;opacity:.4;display:block;margin-bottom:10px"></i>No devices found</div>'}
  </div>`;
  }

  function deviceCard(d) {
    const statusColors = { 'Working': 'green', 'Needs Setup': 'amber', 'In Repair': 'amber', 'Faulty': 'red', 'Lost/Missing': 'purple' };
    const borderColor = `var(--${statusColors[d.status] || 'accent'})`;
    return `<div class="card reveal" onclick="InventoryPage.openDetail(${d.id})" style="cursor:pointer;border-left:3px solid ${borderColor};padding:12px 14px;transition:all .15s;overflow:hidden" onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background=''">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
        <div style="font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--text);white-space:nowrap">${esc(d.asset_tag || d.serial_number)}</div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          ${d.form ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--bg3);color:var(--text3)">${esc(d.form)}${d.stream ? ' '+esc(d.stream) : ''}</span>` : ''}
          ${statusBadge(d.status)}
          ${d.is_spare ? '<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(155,125,255,.15);color:var(--purple);font-weight:600;letter-spacing:.4px">SPARE</span>' : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="min-width:0;flex:1">
          <div style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.serial_number)}${d.model ? ' · ' + esc(d.model) : ''}</div>
          <div style="font-size:12px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${d.student_name ? 'var(--text2)' : 'var(--text3)'}"><i class="ti ti-user" style="font-size:12px;margin-right:4px"></i>${d.student_name ? esc(d.student_name) : 'Unassigned'}${d.admission_no ? ' · ' + esc(d.admission_no) : ''}</div>
        </div>
        ${canWrite() ? `<button class="btn-icon" onclick="event.stopPropagation();InventoryPage.openEdit(${d.id})" title="Edit" style="width:26px;height:26px;flex-shrink:0"><i class="ti ti-pencil" style="font-size:13px"></i></button>` : ''}
      </div>
      ${lifecycleStrip(d)}
    </div>`;
  }

  /**
   * The repair-or-replace line, on the card itself. Rendered only when there is
   * something to say — a healthy in-warranty device adds no row, so the strip
   * draws the eye exactly to the devices that need a decision.
   */
  function lifecycleStrip(d) {
    const bits = [];
    if (d.repeat_offender) {
      bits.push(`<span style="color:var(--red)"><i class="ti ti-alert-triangle" style="font-size:11px"></i> ${d.fault_count} faults</span>`);
    }
    if (d.warranty_state === 'expiring') {
      bits.push(`<span style="color:var(--amber)"><i class="ti ti-shield-half" style="font-size:11px"></i> warranty ends in ${d.warranty_days_left}d</span>`);
    } else if (d.warranty_state === 'expired') {
      bits.push('<span style="color:var(--text3)"><i class="ti ti-shield-off" style="font-size:11px"></i> out of warranty</span>');
    }
    if (d.eol_state === 'past') {
      bits.push('<span style="color:var(--purple)"><i class="ti ti-clock-exclamation" style="font-size:11px"></i> past end of life</span>');
    }
    if (d.batch_ref) {
      bits.push(`<span style="color:var(--text3)"><i class="ti ti-package" style="font-size:11px"></i> ${esc(d.batch_ref)}</span>`);
    }
    if (!bits.length) return '';
    return `<div style="margin-top:7px;padding-top:7px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:10px;font-size:11px">${bits.join('')}</div>`;
  }

  const TZS = n => n == null ? '—' : 'TZS ' + Number(n).toLocaleString('en-GB');

  /** Colour and wording for a warranty state. 'unknown' is grey, never red. */
  const WARRANTY_META = {
    active:   { color: 'var(--green)', label: 'Under warranty' },
    expiring: { color: 'var(--amber)', label: 'Expiring soon' },
    expired:  { color: 'var(--red)',   label: 'Out of warranty' },
    unknown:  { color: 'var(--text3)', label: 'Warranty not recorded' }
  };

  /**
   * The procurement request. Every number here is traceable: the total says how
   * much came from each device's own recorded cost and how much is an estimate,
   * and devices with no paperwork at all are counted rather than hidden.
   */
  function refreshView() {
    if (!refreshPlan) return '<div class="card"><div class="empty"><i class="ti ti-loader"></i>Loading…</div></div>';
    const p = refreshPlan;

    const costLine = p.estimated_cost == null
      ? 'nothing priced yet'
      : `${p.priced_from_own_record} from their own cost` +
        (p.priced_from_fleet_median ? ` · ${p.priced_from_fleet_median} estimated at the fleet median` : '') +
        (p.unpriced ? ` · ${p.unpriced} unpriced` : '');

    return `
    <div class="three-col" style="margin-bottom:16px">
      <div class="stat-card a">
        <div class="stat-label">Due for replacement</div>
        <div class="stat-val" style="color:var(--amber)">${p.due_count}</div>
        <div class="stat-sub">of ${p.devices_total} devices</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Estimated cost</div>
        <div class="stat-val" style="color:var(--accent);font-size:22px">${p.estimated_cost == null ? '&mdash;' : TZS(p.estimated_cost)}</div>
        <div class="stat-sub">${costLine}</div>
      </div>
      <div class="stat-card r">
        <div class="stat-label">No purchase record</div>
        <div class="stat-val" style="color:${p.devices_without_any_purchase_record ? 'var(--red)' : 'var(--green)'}">${p.devices_without_any_purchase_record}</div>
        <div class="stat-sub">${p.devices_without_any_purchase_record ? 'cannot be planned for' : 'all devices have dates'}</div>
      </div>
    </div>

    ${p.devices_without_any_purchase_record ? `
    <div class="alert-banner" style="background:rgba(245,166,35,0.08);border-color:rgba(245,166,35,0.25)">
      <i class="ti ti-file-off" style="font-size:18px;color:var(--amber);flex-shrink:0"></i>
      <div class="alert-banner-text" style="flex:1;min-width:0;font-size:12px;color:var(--text2)">
        <strong style="color:var(--amber)">${p.devices_without_any_purchase_record} device${p.devices_without_any_purchase_record === 1 ? ' has' : 's have'} no purchase date, warranty or end-of-life recorded.</strong>
        They are excluded from this plan — not because they are healthy, but because there is nothing to judge them by.
      </div>
    </div>` : ''}

    <div class="card" style="padding:0">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div class="card-title" style="margin:0">Replace or renew</div>
        ${p.median_device_cost != null ? `<span style="font-size:11px;color:var(--text3)">median device cost ${TZS(p.median_device_cost)}</span>` : ''}
      </div>
      ${p.due.length ? `<div class="table-wrap"><table>
        <thead><tr>
          <th>Device</th><th class="hide-mobile">School</th><th>Why</th>
          <th class="hide-mobile">Warranty</th><th>Cost</th>
        </tr></thead>
        <tbody>${p.due.map(d => {
          const w = WARRANTY_META[d.warranty_state] || WARRANTY_META.unknown;
          return `<tr style="cursor:pointer" onclick="InventoryPage.openDetail(${d.id})">
            <td><span class="error-id">${esc(d.asset_tag || d.serial_number)}</span>
              ${d.repeat_offender ? '<i class="ti ti-alert-triangle" style="font-size:12px;color:var(--red);margin-left:5px" title="Repeat faults"></i>' : ''}
              <div style="font-size:11px;color:var(--text3);margin-top:2px">${esc(d.model || d.serial_number)}</div></td>
            <td class="hide-mobile" style="font-size:12px;color:var(--text2)">${esc(d.school_name)}</td>
            <td style="font-size:12px;color:var(--text2)">${d.reasons.map(esc).join('<br>')}</td>
            <td class="hide-mobile" style="font-size:12px;color:${w.color}">${w.label}</td>
            <td style="font-size:12px;white-space:nowrap">${TZS(d.replacement_cost)}${d.replacement_cost_estimated && d.replacement_cost != null ? '<div style="font-size:10px;color:var(--text3)">estimated</div>' : ''}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : `<div class="empty" style="padding:40px 20px"><i class="ti ti-circle-check" style="color:var(--green)"></i>Nothing is due for replacement.</div>`}
    </div>`;
  }

  /**
   * Fault rate per procurement batch — the warranty-claim argument. Devices
   * bought together and used identically fail together.
   */
  function batchView() {
    if (!batchRows) return '<div class="card"><div class="empty"><i class="ti ti-loader"></i>Loading…</div></div>';
    if (!batchRows.length) {
      return `<div class="card"><div class="empty" style="padding:40px 20px">
        <i class="ti ti-packages"></i>No batches recorded yet.
        <div style="font-size:12px;color:var(--text3);margin-top:8px;max-width:420px;margin-left:auto;margin-right:auto">
          Give devices bought together the same batch reference when you add or edit them. A fault rate per batch is far stronger evidence than any single device.
        </div>
      </div></div>`;
    }
    return `
    <div class="card" style="padding:0">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border)"><div class="card-title" style="margin:0">Fault rate by batch</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Batch</th><th class="hide-mobile">Supplier</th><th>Devices</th><th>Faulty now</th><th>Fault rate</th><th class="hide-mobile">Warranty ends</th></tr></thead>
        <tbody>${batchRows.map(b => {
          const bad = b.fault_rate_pct >= 20;
          const warn = b.fault_rate_pct >= 10;
          const col = bad ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--green)';
          return `<tr>
            <td><span class="error-id">${esc(b.batch_ref)}</span>
              ${b.purchased ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">bought ${fmtDate(b.purchased).split(' ')[0]} ${fmtDate(b.purchased).split(' ')[1]} ${fmtDate(b.purchased).split(' ')[2]}</div>` : ''}</td>
            <td class="hide-mobile" style="font-size:12px;color:var(--text2)">${esc(b.supplier || '—')}</td>
            <td style="font-size:12px">${b.devices}</td>
            <td style="font-size:12px;color:${col}">${b.faulty_now}</td>
            <td style="min-width:120px">
              <div style="display:flex;align-items:center;gap:8px">
                <div class="progress" style="flex:1"><div class="progress-fill" style="width:${Math.min(100, b.fault_rate_pct)}%;background:${col}"></div></div>
                <span style="font-size:12px;color:${col};width:34px;text-align:right">${b.fault_rate_pct}%</span>
              </div>
            </td>
            <td class="hide-mobile" style="font-size:12px;color:var(--text2)">${b.warranty_expires_on ? String(b.warranty_expires_on).slice(0,10) : '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
  }

  /**
   * Spares: what is on the shelf, and — the point of the page — where it is not.
   *
   * Sorted by what is MISSING rather than by what is present. The only question
   * an engineer asks here is "which school can I not fix today", and a list
   * sorted by stock answers a question nobody has.
   */
  function sparesViewHtml() {
    const d = sparesView;
    if (!d) return '<div class="card"><div class="empty"><i class="ti ti-loader"></i>Loading…</div></div>';
    const t = d.totals || {};
    const ftf = d.first_time_fix || {};

    const ftfCard = ftf.rate == null
      ? `<div class="stat-card"><div class="stat-label">First-time fix</div>
           <div class="stat-val" style="color:var(--text3)">—</div>
           <div class="stat-sub">${ftf.visits_completed ? ftf.visits_completed + ' visit(s), none with faults attached' : 'no completed visits yet'}</div></div>`
      : `<div class="stat-card ${ftf.rate >= 70 ? 'g' : ftf.rate >= 40 ? 'a' : 'r'}">
           <div class="stat-label">First-time fix</div>
           <div class="stat-val" style="color:var(--${ftf.rate >= 70 ? 'green' : ftf.rate >= 40 ? 'amber' : 'red'})">${ftf.rate}%</div>
           <div class="stat-sub">${ftf.fixed_first_time}/${ftf.visits_measurable} visits, last ${ftf.window_days}d</div></div>`;

    const rows = (d.schools || []).filter(x => x.awaiting_swap > 0 || x.spares_available > 0);

    return `
    <div class="stats-grid" style="margin-bottom:14px">
      <div class="stat-card ${t.stockout_schools ? 'r' : 'g'}">
        <div class="stat-label">Cannot fix today</div>
        <div class="stat-val" style="color:var(--${t.stockout_schools ? 'red' : 'green'})">${t.stockout_schools || 0}</div>
        <div class="stat-sub">schools with faults and no spare</div></div>
      <div class="stat-card a"><div class="stat-label">Awaiting a swap</div>
        <div class="stat-val" style="color:var(--amber)">${t.awaiting_swap || 0}</div>
        <div class="stat-sub">faulty or in repair</div></div>
      <div class="stat-card t"><div class="stat-label">Spares on the shelf</div>
        <div class="stat-val" style="color:var(--teal)">${t.spares_available || 0}</div>
        <div class="stat-sub">working and unassigned</div></div>
      ${ftfCard}
    </div>

    <div class="card" style="padding:0">
      <div class="table-wrap"><table>
        <thead><tr><th>School</th><th>Awaiting swap</th><th>Spares on site</th><th>To carry</th><th></th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(r => `<tr>
            <td><strong>${esc(r.school_name)}</strong></td>
            <td>${r.awaiting_swap}</td>
            <td style="color:var(--${r.spares_available ? 'teal' : 'text3'})">${r.spares_available}</td>
            <td>${r.needed ? '<strong style="color:var(--amber)">' + r.needed + '</strong>' : '<span style="color:var(--text3)">—</span>'}</td>
            <td>${r.stockout ? '<span class="badge-red">cannot fix on site</span>' : ''}</td>
          </tr>`).join('') : `<tr><td colspan="5"><div class="empty" style="padding:30px 20px">
            <i class="ti ti-circle-check" style="color:var(--green)"></i>Nothing is waiting for a swap.</div></td></tr>`}
        </tbody>
      </table></div>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:10px;line-height:1.6">
      A <strong>spare</strong> is a working, unassigned device held aside on purpose. Mark one from any
      device's detail view. &ldquo;To carry&rdquo; is what to load into the vehicle: faulty devices minus
      the spares already at that school.
    </div>`;
  }

  /** Hold a device aside as a spare, or put it back into normal use. */
  async function toggleSpare(id, makeSpare) {
    try {
      const r = await API.setSpare(id, makeSpare);
      showToast(r.message);
      sparesView = null;                       // stale the moment stock changes
      await load();
      App.render();
    } catch (e) { showToast(e.error || 'Could not change that'); }
  }

  /**
   * Swap a faulty device for a spare at the same school.
   *
   * The picker lists the spares actually on site; with none, the modal says so
   * plainly rather than offering an empty dropdown.
   */
  async function openSwap(id) {
    if (!guardWrite()) return;
    try {
      const device = devices.find(x => x.id === id) || await API.getInventoryItem(id);
      const pool = devices.length ? devices : await API.getInventory({ school_id: device.school_id });
      const usable = pool.filter(t => t.is_spare && t.status === 'Working' && !t.student_name && t.id !== id
        && t.school_id === device.school_id);

      Modal.open('Swap this device', usable.length ? `
        <div style="font-size:13px;color:var(--text2);margin-bottom:12px">
          <strong>${esc(device.asset_tag || device.serial_number)}</strong>
          ${device.student_name ? ' is with <strong>' + esc(device.student_name) + '</strong>.' : ' is unassigned.'}
          Pick the spare that takes its place — the student keeps working and this one goes to the repair pile.
        </div>
        <div class="form-group">
          <label>Spare to use</label>
          <select id="swap-spare" class="form-control">
            ${usable.map(t => `<option value="${t.id}">${esc(t.asset_tag || t.serial_number)}${t.model ? ' · ' + esc(t.model) : ''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Note (optional)</label>
          <input type="text" id="swap-note" class="form-control" placeholder="e.g. screen cracked, sent to Moshi"></div>
        <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="InventoryPage.submitSwap(${id})">
          <i class="ti ti-refresh-dot"></i> Swap</button>
      ` : `
        <div class="empty" style="padding:30px 20px">
          <i class="ti ti-package-off" style="color:var(--amber)"></i>
          No spare at this school.<br>
          <span style="font-size:12px;color:var(--text3)">Mark a working, unassigned device as a spare first, or bring one from another school.</span>
        </div>`, '');
    } catch (e) { showToast(e.error || 'Could not load the spares'); }
  }

  async function submitSwap(id) {
    const spareId = document.getElementById('swap-spare')?.value;
    const note = document.getElementById('swap-note')?.value || '';
    if (!spareId) return;
    try {
      const r = await API.swapDevice(id, { spare_id: Number(spareId), note });
      Modal.close();
      showToast(r.message, 5000);
      sparesView = null;
      await load();
      App.render();
    } catch (e) { showToast(e.error || 'Swap failed'); }
  }

  async function setView(v) {
    activeView = v;
    document.querySelectorAll('.main .tab-row .tab-btn').forEach((b, i) => {
      b.classList.toggle('active', ['devices', 'refresh', 'batches', 'spares'][i] === v);
    });
    // In-place swap, never App.render() — that flickers and drops the sidebar.
    const slot = document.getElementById('inv-view');
    if (slot) slot.innerHTML = '<div class="card"><div class="empty"><i class="ti ti-loader"></i>Loading…</div></div>';
    if (v === 'refresh' && !refreshPlan) {
      try { refreshPlan = await API.getRefreshPlan(filters.school_id ? { school_id: filters.school_id } : {}); }
      catch (e) { refreshPlan = { devices_total: 0, due_count: 0, estimated_cost: null, due: [], devices_without_any_purchase_record: 0 }; }
    }
    if (v === 'spares' && !sparesView) {
      try { sparesView = await API.getSpares(filters.school_id ? { school_id: filters.school_id } : {}); }
      catch (e) { sparesView = { schools: [], totals: { spares_available: 0, awaiting_swap: 0, needed: 0, stockout_schools: 0 }, first_time_fix: null }; }
    }
    if (v === 'batches' && !batchRows) {
      try { batchRows = await API.getDeviceBatches(filters.school_id ? { school_id: filters.school_id } : {}); }
      catch (e) { batchRows = []; }
    }
    const again = document.getElementById('inv-view');
    if (again) {
      again.innerHTML = v === 'devices' ? deviceView()
        : v === 'refresh' ? refreshView()
        : v === 'spares' ? sparesViewHtml()
        : batchView();
      again.querySelectorAll('.card, .stat-card, .alert-banner').forEach(c => c.classList.add('reveal', 'visible'));
      if (v === 'devices') Dropdown.initAll && Dropdown.initAll();
    }
  }

  function onWarrantySelect() { filters.warranty = Dropdown.getValue('inv-warranty') || ''; reload(); }
  function toggleRepeatOffenders() {
    filters.repeat_offender = filters.repeat_offender ? '' : 'true';
    reload();
  }

  function afterRender() {
    document.querySelectorAll('.main .stats-grid, .main .card').forEach(c => c.classList.add('reveal', 'visible'));
  }

  function statusBadge(status) {
    const colors = { 'Working': 'green', 'Needs Setup': 'amber', 'In Repair': 'amber', 'Faulty': 'red', 'Lost/Missing': 'purple' };
    return `<span class="badge-${colors[status] || 'accent'}" style="font-size:11px">${status}</span>`;
  }

  let _searchTimeout;
  function debounceSearch(val) {
    clearTimeout(_searchTimeout);
    _searchTimeout = setTimeout(() => { filters.search = val; reload(); }, 400);
  }
  function filterStatus(val) { filters.status = val; reload(); }
  function filterForm(val) { filters.form = val; reload(); }
  function filterSchool(val) { filters.school_id = val; reload(); }
  function onSchoolSelect() { filters.school_id = Dropdown.getValue('inv-school') || ''; reload(); }
  function onStatusSelect() { filters.status = Dropdown.getValue('inv-status') || ''; reload(); }
  function onFormSelect() { filters.form = Dropdown.getValue('inv-form') || ''; reload(); }

  async function reload() {
    refreshPlan = null;
    batchRows = null;
    await load();
    const main = document.querySelector('.main');
    if (main) { main.innerHTML = render(); afterRender(); }
  }

  /** Refuses politely instead of opening a form the server will reject. */
  function guardWrite() {
    if (canWrite()) return true;
    showToast('Inventory is read-only for your account — ask your school administrator for edit access');
    return false;
  }

  function openAdd() {
    if (!guardWrite()) return;
    const schoolSelect = isAdmin() ? `<div class="form-group"><label>School</label><select id="dev-school" required>
      <option value="">Select school</option>${schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></div>` : '';
    Modal.open('Add Device', `
      <form id="add-device-form" onsubmit="InventoryPage.submitAdd(event)">
        ${schoolSelect}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>Serial Number *</label><input id="dev-serial" required></div>
          <div class="form-group"><label>Asset Tag</label><input id="dev-tag"></div>
          <div class="form-group"><label>Model</label><input id="dev-model"></div>
          <div class="form-group"><label>Year First Used</label><input id="dev-year" type="number" min="2015" max="2030"></div>
          <div class="form-group"><label>Form</label><select id="dev-form">
            <option value="">—</option><option>Form 1</option><option>Form 2</option><option>Form 3</option><option>Form 4</option></select></div>
          <div class="form-group"><label>Stream</label><select id="dev-stream">
            <option value="">—</option><option>A</option><option>B</option><option>C</option></select></div>
          <div class="form-group"><label>Status</label><select id="dev-status">
            <option>Working</option><option>Needs Setup</option><option>In Repair</option><option>Faulty</option><option>Lost/Missing</option></select></div>
          <div class="form-group"><label>Last Checked</label>${DatePicker.render('dev-checked', { max: DatePicker.today(), placeholder: 'Not recorded' })}</div>
        </div>
        <div style="border-top:1px solid var(--border);margin:14px 0;padding-top:14px">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text2)">Student Assignment (optional)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Student Name</label><input id="dev-student"></div>
            <div class="form-group"><label>Admission No.</label><input id="dev-admission"></div>
          </div>
        </div>
        <div class="form-group"><label>Notes</label><textarea id="dev-notes" rows="2"></textarea></div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">Add Device</button>
      </form>
    `, '', true);
  }

  async function submitAdd(e) {
    e.preventDefault();
    const data = {
      serial_number: document.getElementById('dev-serial').value.trim(),
      asset_tag: document.getElementById('dev-tag').value.trim(),
      model: document.getElementById('dev-model').value.trim(),
      year_first_used: document.getElementById('dev-year').value ? +document.getElementById('dev-year').value : null,
      form: document.getElementById('dev-form').value,
      stream: document.getElementById('dev-stream').value,
      status: document.getElementById('dev-status').value,
      last_checked: document.getElementById('dev-checked').value || null,
      student_name: document.getElementById('dev-student').value.trim(),
      admission_no: document.getElementById('dev-admission').value.trim(),
      notes: document.getElementById('dev-notes').value.trim(),
    };
    if (isAdmin()) data.school_id = document.getElementById('dev-school')?.value;
    try {
      await API.createDevice(data);
      Modal.close();
      showToast('Device added successfully', 'success');
      reload();
    } catch (err) { showToast(err.error || 'Failed to add device', 'error'); }
  }

  function openEdit(id) {
    if (!guardWrite()) return;
    const d = devices.find(x => x.id === id);
    if (!d) return;
    const schoolSelect = isAdmin() ? `<div class="form-group"><label>School</label><select id="dev-school">
      ${schools.map(s => `<option value="${s.id}" ${s.id===d.school_id?'selected':''}>${s.name}</option>`).join('')}</select></div>` : '';
    Modal.open('Edit Device', `
      <form id="edit-device-form" onsubmit="InventoryPage.submitEdit(event, ${id})">
        ${schoolSelect}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>Serial Number *</label><input id="dev-serial" value="${esc(d.serial_number)}" required></div>
          <div class="form-group"><label>Asset Tag</label><input id="dev-tag" value="${esc(d.asset_tag||'')}"></div>
          <div class="form-group"><label>Model</label><input id="dev-model" value="${esc(d.model||'')}"></div>
          <div class="form-group"><label>Year First Used</label><input id="dev-year" type="number" min="2015" max="2030" value="${d.year_first_used||''}"></div>
          <div class="form-group"><label>Form</label><select id="dev-form">
            <option value="">—</option>${['Form 1','Form 2','Form 3','Form 4'].map(f => `<option ${d.form===f?'selected':''}>${f}</option>`).join('')}</select></div>
          <div class="form-group"><label>Stream</label><select id="dev-stream">
            <option value="">—</option>${['A','B','C'].map(s => `<option ${d.stream===s?'selected':''}>${s}</option>`).join('')}</select></div>
          <div class="form-group"><label>Status</label><select id="dev-status">
            ${['Working','Needs Setup','In Repair','Faulty','Lost/Missing'].map(s => `<option ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
          <div class="form-group"><label>Last Checked</label>${DatePicker.render('dev-checked', { value: d.last_checked ? d.last_checked.split('T')[0] : '', max: DatePicker.today(), placeholder: 'Not recorded' })}</div>
        </div>
        <div style="border-top:1px solid var(--border);margin:14px 0;padding-top:14px">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text2)">Student Assignment</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Student Name</label><input id="dev-student" value="${esc(d.student_name||'')}"></div>
            <div class="form-group"><label>Admission No.</label><input id="dev-admission" value="${esc(d.admission_no||'')}"></div>
          </div>
        </div>
        <div class="form-group"><label>Notes</label><textarea id="dev-notes" rows="2">${esc(d.notes||'')}</textarea></div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <button type="submit" class="btn btn-primary" style="flex:1">Save Changes</button>
          ${isAdmin() ? `<button type="button" class="btn btn-danger" onclick="InventoryPage.confirmDelete(${id})">Delete</button>` : ''}
        </div>
      </form>
    `, '', true);
  }

  async function submitEdit(e, id) {
    e.preventDefault();
    const data = {
      serial_number: document.getElementById('dev-serial').value.trim(),
      asset_tag: document.getElementById('dev-tag').value.trim(),
      model: document.getElementById('dev-model').value.trim(),
      year_first_used: document.getElementById('dev-year').value ? +document.getElementById('dev-year').value : null,
      form: document.getElementById('dev-form').value,
      stream: document.getElementById('dev-stream').value,
      status: document.getElementById('dev-status').value,
      last_checked: document.getElementById('dev-checked').value || null,
      student_name: document.getElementById('dev-student').value.trim(),
      admission_no: document.getElementById('dev-admission').value.trim(),
      notes: document.getElementById('dev-notes').value.trim(),
    };
    try {
      await API.updateDevice(id, data);
      Modal.close();
      showToast('Device updated', 'success');
      reload();
    } catch (err) { showToast(err.error || 'Failed to update', 'error'); }
  }

  async function openDetail(id) {
    try {
      const d = await API.getDevice(id);
      const history = d.history || [];
      Modal.open('Device Detail', `
        <div>
          <table class="detail-info-table" style="width:100%;border-collapse:separate;border-spacing:0;background:var(--bg3);border-radius:10px;border:1px solid var(--border);overflow:hidden">
            <tr><td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-hash" style="font-size:13px;color:var(--accent)"></i>Asset Tag</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${esc(d.asset_tag||'-')}</td>
                <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-barcode" style="font-size:13px;color:var(--teal)"></i>Serial</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text);font-family:var(--font-mono)">${esc(d.serial_number)}</td></tr>
            <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
            <tr><td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-device-tablet" style="font-size:13px;color:var(--purple)"></i>Model</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${esc(d.model||'-')}</td>
                <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-calendar" style="font-size:13px;color:var(--amber)"></i>Year</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.year_first_used||'-'}</td></tr>
            <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
            <tr><td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-school" style="font-size:13px;color:var(--green)"></i>Form</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${esc(d.form||'-')} ${esc(d.stream||'')}</td>
                <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-activity" style="font-size:13px;color:${d.status==='Working'?'var(--green)':'var(--red)'}"></i>Status</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px">${statusBadge(d.status)}</td></tr>
            <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
            <tr><td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-user" style="font-size:13px;color:var(--accent)"></i>Student</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${esc(d.student_name||'Unassigned')}</td>
                <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-id" style="font-size:13px;color:var(--purple)"></i>Adm. No</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${esc(d.admission_no||'-')}</td></tr>
            ${d.notes ? `<tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr><tr><td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-note" style="font-size:13px;color:var(--amber)"></i>Notes</span></td><td colspan="3" style="padding:9px 12px;font-size:13px;color:var(--text2)">${esc(d.notes)}</td></tr>` : ''}
            ${lifecycleRows(d)}
          </table>
        </div>
        ${lifecycleVerdictBox(d)}
        ${history.length ? `
        <div style="margin-top:16px">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:8px">History</div>
          <div style="max-height:200px;overflow-y:auto">
            ${history.map(h => `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">
              <span style="color:var(--text3);min-width:80px">${new Date(h.created_at).toLocaleDateString()}</span>
              <span style="color:var(--text2)">${historyLabel(h)}</span>
              <span style="margin-left:auto;color:var(--text3)">${esc(h.actor_name||'')}</span>
            </div>`).join('')}
          </div>
        </div>` : ''}
        ${canWrite() ? `<div style="display:flex;gap:8px;margin-top:14px;justify-content:space-between">
          <button class="btn" onclick="InventoryPage.openEdit(${d.id})" style="padding:8px 16px;font-size:12px;background:rgba(79,124,255,.12);color:var(--accent);border:1px solid rgba(79,124,255,.25);border-radius:8px"><i class="ti ti-pencil"></i> Edit</button>
          <button class="btn" onclick="InventoryPage.openStatusChange(${d.id},'${d.status}')" style="padding:8px 16px;font-size:12px;background:rgba(54,217,204,.12);color:var(--teal);border:1px solid rgba(54,217,204,.25);border-radius:8px"><i class="ti ti-refresh"></i> Change Status</button>
          ${['Faulty','In Repair'].includes(d.status) ? `<button class="btn" onclick="InventoryPage.openSwap(${d.id})" style="padding:8px 16px;font-size:12px;background:rgba(245,166,35,.12);color:var(--amber);border:1px solid rgba(245,166,35,.25);border-radius:8px"><i class="ti ti-refresh-dot"></i> Swap for a spare</button>` : ''}
          ${d.status === 'Working' && !d.student_name ? `<button class="btn" onclick="InventoryPage.toggleSpare(${d.id}, ${d.is_spare ? 'false' : 'true'})" style="padding:8px 16px;font-size:12px;background:rgba(155,125,255,.12);color:var(--purple);border:1px solid rgba(155,125,255,.25);border-radius:8px"><i class="ti ti-${d.is_spare ? 'package-off' : 'package'}"></i> ${d.is_spare ? 'Return to use' : 'Hold as spare'}</button>` : ''}
        </div>` : ''}
      `, '', true);
    } catch (err) { showToast('Failed to load device details', 'error'); }
  }

  /**
   * Procurement rows for the detail modal. Rendered only when at least one
   * field is recorded: four rows of "—" would suggest the data exists and is
   * empty, when in fact it was never captured.
   */
  function lifecycleRows(d) {
    const has = d.purchase_date || d.purchase_cost || d.supplier || d.warranty_expires_on || d.expected_eol_on || d.batch_ref;
    if (!has) return '';
    const sep = '<tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>';
    const cell = (icon, color, label, value) =>
      `<td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)">` +
      `<i class="ti ${icon}" style="font-size:13px;color:${color}"></i>${label}</span></td>` +
      `<td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${value}</td>`;
    const date = v => v ? String(v).slice(0, 10) : '—';

    return sep +
      `<tr>${cell('ti-calendar-plus', 'var(--amber)', 'Purchased', date(d.purchase_date))}` +
      `${cell('ti-coin', 'var(--green)', 'Cost', d.purchase_cost != null ? TZS(d.purchase_cost) : '—')}</tr>` +
      sep +
      `<tr>${cell('ti-truck-delivery', 'var(--teal)', 'Supplier', esc(d.supplier || '—'))}` +
      `${cell('ti-package', 'var(--purple)', 'Batch', esc(d.batch_ref || '—'))}</tr>` +
      sep +
      `<tr>${cell('ti-shield-check', 'var(--accent)', 'Warranty ends', date(d.warranty_expires_on))}` +
      `${cell('ti-clock-exclamation', 'var(--red)', 'End of life', date(d.expected_eol_on))}</tr>`;
  }

  /**
   * The one sentence that decides repair or replace, composed on the server so
   * the same wording appears in the list, here, and in the refresh plan.
   */
  function lifecycleVerdictBox(d) {
    if (!d.lifecycle_verdict) return '';
    const w = WARRANTY_META[d.warranty_state] || WARRANTY_META.unknown;
    const replace = d.repeat_offender && d.warranty_state !== 'active';
    return `
      <div style="margin-top:14px;padding:11px 13px;border-radius:10px;background:${replace ? 'rgba(255,82,99,0.07)' : 'var(--bg3)'};border:1px solid ${replace ? 'rgba(255,82,99,0.22)' : 'var(--border)'}">
        <div style="display:flex;align-items:flex-start;gap:9px">
          <i class="ti ${replace ? 'ti-replace' : 'ti-tools'}" style="font-size:16px;color:${replace ? 'var(--red)' : w.color};flex-shrink:0;margin-top:1px"></i>
          <div style="min-width:0">
            <div style="font-size:12px;color:var(--text2);line-height:1.5">${esc(d.lifecycle_verdict)}</div>
            ${replace ? '<div style="font-size:12px;color:var(--red);font-weight:500;margin-top:4px">Replace rather than repair again.</div>' : ''}
            ${d.age_months != null ? `<div style="font-size:11px;color:var(--text3);margin-top:3px">${d.age_months} months old</div>` : ''}
          </div>
        </div>
      </div>`;
  }

  function historyLabel(h) {
    if (h.action === 'created') return 'Device added to inventory';
    if (h.action === 'status_change') return `Status: ${esc(h.old_value)} → <strong>${esc(h.new_value)}</strong>`;
    if (h.action === 'assigned') return `Assigned: ${esc(h.old_value)} → <strong>${esc(h.new_value)}</strong>`;
    return esc(h.action) + (h.note ? ` — ${esc(h.note)}` : '');
  }

  function openStatusChange(id, currentStatus) {
    if (!guardWrite()) return;
    Modal.open('Change Status', `
      <form onsubmit="InventoryPage.submitStatus(event, ${id})">
        <div class="form-group"><label>New Status</label><select id="st-status">
          ${['Working','Needs Setup','In Repair','Faulty','Lost/Missing'].map(s => `<option ${s===currentStatus?'selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>Note (optional)</label><textarea id="st-note" rows="2" placeholder="Reason for status change..."></textarea></div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">Update Status</button>
      </form>
    `);
  }

  async function submitStatus(e, id) {
    e.preventDefault();
    try {
      await API.changeDeviceStatus(id, {
        status: document.getElementById('st-status').value,
        note: document.getElementById('st-note').value.trim()
      });
      Modal.close();
      showToast('Status updated', 'success');
      reload();
    } catch (err) { showToast(err.error || 'Failed to update status', 'error'); }
  }

  function confirmDelete(id) {
    if (confirm('Are you sure you want to permanently delete this device from inventory?')) {
      API.deleteDevice(id).then(() => {
        Modal.close();
        showToast('Device removed', 'success');
        reload();
      }).catch(err => showToast(err.error || 'Failed to delete', 'error'));
    }
  }

  function openImport() {
    if (!guardWrite()) return;
    Modal.open('Import Devices from CSV', `
      <div style="margin-bottom:12px">
        <p style="font-size:13px;color:var(--text2);margin:0 0 10px">Upload a CSV file with tablet inventory data. Required column: <strong>serial_number</strong>.</p>
        <button class="btn btn-ghost" onclick="InventoryPage.downloadTemplate()" style="font-size:12px"><i class="ti ti-download"></i> Download Template</button>
      </div>
      <div class="form-group">
        <input type="file" id="csv-file" accept=".csv" onchange="InventoryPage.previewCsv(this)">
      </div>
      <div id="csv-preview" style="display:none;margin-top:12px">
        <div style="font-size:12px;color:var(--text3);margin-bottom:6px"><span id="csv-count">0</span> devices found</div>
        <div style="max-height:200px;overflow:auto;border:1px solid var(--border);border-radius:6px">
          <table id="csv-table" style="font-size:11px;width:100%"></table>
        </div>
        <button class="btn btn-primary" onclick="InventoryPage.submitImport()" style="width:100%;margin-top:12px"><i class="ti ti-upload"></i> Import All</button>
      </div>
    `, '', true);
  }

  function downloadTemplate() {
    const csv = 'serial_number,asset_tag,form,stream,model,year_first_used,status,student_name,admission_no,last_checked,notes\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tablet_inventory_template.csv';
    a.click();
  }

  let _csvData = [];
  function previewCsv(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      _csvData = parseCsv(e.target.result);
      const preview = document.getElementById('csv-preview');
      const count = document.getElementById('csv-count');
      const table = document.getElementById('csv-table');
      if (!_csvData.length) { preview.style.display = 'none'; return; }
      preview.style.display = 'block';
      count.textContent = _csvData.length;
      const cols = ['serial_number','asset_tag','form','status','student_name'];
      table.innerHTML = `<thead><tr>${cols.map(c => `<th style="padding:4px 6px;text-align:left">${c}</th>`).join('')}</tr></thead>
        <tbody>${_csvData.slice(0, 10).map(r => `<tr>${cols.map(c => `<td style="padding:4px 6px">${esc(r[c]||'')}</td>`).join('')}</tr>`).join('')}
        ${_csvData.length > 10 ? `<tr><td colspan="${cols.length}" style="padding:6px;text-align:center;color:var(--text3)">...and ${_csvData.length - 10} more</td></tr>` : ''}
        </tbody>`;
    };
    reader.readAsText(file);
  }

  function parseCsv(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const colMap = {
      serial_number: headers.findIndex(h => h.includes('serial')),
      asset_tag: headers.findIndex(h => h.includes('asset') || h.includes('tag') || h.includes('device_no')),
      form: headers.findIndex(h => h === 'form' || h.includes('class')),
      stream: headers.findIndex(h => h.includes('stream')),
      model: headers.findIndex(h => h.includes('model') || h.includes('brand')),
      year_first_used: headers.findIndex(h => h.includes('year')),
      status: headers.findIndex(h => h.includes('status') || h.includes('condition')),
      student_name: headers.findIndex(h => h.includes('student') || h.includes('name')),
      admission_no: headers.findIndex(h => h.includes('admission') || h.includes('adm')),
      last_checked: headers.findIndex(h => h.includes('checked') || h.includes('date')),
      notes: headers.findIndex(h => h.includes('note') || h.includes('remark') || h.includes('comment')),
    };
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = splitCsvLine(line);
      const row = {};
      for (const [field, idx] of Object.entries(colMap)) {
        if (idx >= 0 && vals[idx]) row[field] = vals[idx].trim().replace(/^"|"$/g, '');
      }
      return row;
    }).filter(r => r.serial_number);
  }

  function splitCsvLine(line) {
    const result = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
    }
    result.push(current);
    return result;
  }

  async function submitImport() {
    if (!_csvData.length) return;
    const data = { devices: _csvData };
    if (isAdmin() && filters.school_id) data.school_id = filters.school_id;
    try {
      const res = await API.bulkImportDevices(data);
      Modal.close();
      showToast(`Imported: ${res.created} new, ${res.updated} updated${res.errors?.length ? `, ${res.errors.length} errors` : ''}`, 'success');
      reload();
    } catch (err) { showToast(err.error || 'Import failed', 'error'); }
  }

  async function exportCsv() {
    try {
      const params = {};
      if (filters.school_id) params.school_id = filters.school_id;
      const blob = await API.exportInventoryCsv(params);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tablet_inventory.csv';
      a.click();
      showToast('Export downloaded', 'success');
    } catch (err) { showToast('Export failed', 'error'); }
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return {
    load, render, afterRender,
    openAdd, submitAdd, openEdit, submitEdit, openDetail,
    toggleSpare, openSwap, submitSwap,
    openStatusChange, submitStatus, confirmDelete,
    openImport, downloadTemplate, previewCsv, submitImport, exportCsv,
    filterStatus, filterForm, filterSchool, debounceSearch,
    onSchoolSelect, onStatusSelect, onFormSelect,
    setView, onWarrantySelect, toggleRepeatOffenders,
  };
})();
